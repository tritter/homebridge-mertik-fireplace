import { IDeviceConfig } from '../models/deviceConfig';
import EventEmitter from 'events';
import net, { Socket } from 'net';
import { FireplaceStatus } from '../models/fireplaceStatus';
import { OperationMode, OperationModeUtils } from '../models/operationMode';
import { FlameHeight } from '../models/flameHeight';
import { Logger, PlatformAccessory } from 'homebridge';
import { TemperatureRangeUtils } from '../models/temperatureRange';
import { IRequest } from '../models/request';

export interface IFireplaceController {
  request(request: IRequest): Promise<boolean>;
  status(): FireplaceStatus | undefined;
  reachable(): boolean;
}

export interface IFireplaceEvents {
  on(event: 'status', listener: (status: FireplaceStatus) => void): this;
}

export class FireplaceController extends EventEmitter implements IFireplaceController, IFireplaceEvents {
  private readonly _config: IDeviceConfig;
  private _height = FlameHeight.Step11;
  private _statusTimer: NodeJS.Timer | undefined;
  private _client: Socket | null = null;
  private _lastContact: Date = new Date();
  private _lastStatus: FireplaceStatus | undefined;
  private _igniting = false;
  private _shuttingDown = false;
  private static UNREACHABLE_TIMEOUT = 1000 * 60 * 1; //1 min
  private static REFRESH_TIMEOUT = 1000 * 15; //15 seconds

  constructor(
    public readonly log: Logger,
    public readonly accessory: PlatformAccessory) {
    super();
    this._config = accessory.context.device;
    this.startStatusSubscription();
  }

  private startStatusSubscription(): void {
    this.stopStatusSubscription();
    this.log.debug('Start requesting status');
    this._client = null;
    this._statusTimer = setInterval((e) => e.refreshStatus(), FireplaceController.REFRESH_TIMEOUT, this);
  }

  private stopStatusSubscription() {
    this.log.debug('Stop requesting status');
    if (this._statusTimer) {
      clearInterval(this._statusTimer);
      this._statusTimer = undefined;
    }
  }

  private refreshStatus() {
    try {
      this.sendCommand('303303');
    } catch {
      this.log.error('Failed to refresh!');
    }
  }

  private processStatusResponse(response: string) {
    const newStatus = new FireplaceStatus(response);
    this._lastContact = new Date();
    this._igniting = newStatus.igniting;
    this._shuttingDown = newStatus.shuttingDown;
    this._lastStatus = newStatus;
    this.emit('status', this._lastStatus);
  }

  private async igniteFireplace() {
    if (this._igniting) {
      this.log.debug('Ignore already igniting!');
      return;
    }
    this._igniting = true;
    this.sendCommand('314103');
    await this.delay(40_000);
    this.refreshStatus();
  }

  private async guardFlameOff() {
    if (this._shuttingDown) {
      this.log.debug('Ignore already shutting down!');
      return;
    }
    this._shuttingDown = true;
    this.sendCommand('313003');
    await this.delay(30_000);
  }

  private setEcoMode(){
    return this.sendCommand('4233303103');
  }

  private setManualMode(){
    return this.sendCommand('423003');
  }

  private setTemperatureMode() {
    return this.sendCommand('4232303103');
  }

  private ensureClient(): Socket {
    const ip = this._config.ip;
    this.log.debug(`Using ip:'${ip}'`);
    if (!this._client
      || (typeof(this._client) === 'undefined') || (typeof(this._client.destroyed) !== 'boolean') || (this._client.destroyed === true)) {
      this.log.debug('Created socket');
      this._client = new net.Socket();
      this._client.connect(2000, ip);
      this._client.setTimeout(FireplaceController.REFRESH_TIMEOUT);
      this._client.on('data', (data) => {
        const tempData = data.toString().substr(1).replace(/\r/g, ';');
        this.log.debug('Data: ' + tempData);
        if (tempData.startsWith('30303030000')) {
          this.processStatusResponse(tempData);
        }
      });
      this._client.on('error', (err) => {
        this.log.debug('Socket error: ' + err.message);
        if (this._client && typeof(this._client.destroy) === 'function') {
          this._client.destroy();
        }
      });
    }
    return this._client;
  }

  private sendCommand(command: string): boolean {
    const prefix = '0233303330333033303830';
    const packet = Buffer.from(prefix + command, 'hex');
    this.log.debug('Sending packet: ' + prefix + command);
    return this.ensureClient().write(packet);
  }

  reachable(): boolean {
    if (!this._lastContact) {
      return false;
    }
    const now = new Date().getTime();
    const last = this._lastContact.getTime();
    return (now - last) < FireplaceController.UNREACHABLE_TIMEOUT;
  }

  status(): FireplaceStatus | undefined {
    return this._lastStatus;
  }

  delay = ms => new Promise(res => setTimeout(res, ms));

  resetFlameHeight(): void {
    const msg = '3136' + FlameHeight.Step11 + '03';
    this.sendCommand(msg);
  }

  async setFlameHeight(height: FlameHeight) {
    this.log.info(`Set flame height to ${height.toString()}`);
    this._height = height;
    this.resetFlameHeight();
    await this.delay(10_000);
    const msg = '3136' + height + '03';
    this.sendCommand(msg);
    await this.delay(1_000);
  }

  getFlameHeight(): FlameHeight {
    return this._height;
  }

  async setTemperature(temperature: number) {
    this.log.info(`Set temperature to ${temperature}`);
    this.setManualMode();
    await this.delay(1_000);
    this.resetFlameHeight();
    await this.delay(10_000);
    this.setTemperatureMode();
    await this.delay(1_000);
    const value = TemperatureRangeUtils.toBits(temperature);
    const msg = '42324644303' + value + '03';
    this.sendCommand(msg);
    await this.delay(1_000);
  }

  async setMode(request: IRequest): Promise<boolean> {
    const mode = request.mode!;
    const currentMode = this._lastStatus?.mode || OperationMode.Off;
    if (this._igniting) {
      this.log.debug('Ignore as we are igniting the fireplace first!');
      return false;
    }
    if (OperationModeUtils.needsIgnite(mode) && currentMode === OperationMode.Off && !this._lastStatus?.guardFlameOn) {
      this.log.info('Ignite fireplace');
      await this.igniteFireplace();
      return false;
    }
    if (currentMode === mode) {
      this.log.debug('Ignore same mode!');
      return true;
    }
    this.log.info(`Set mode to: ${OperationMode[mode]}`);
    switch(mode) {
      case OperationMode.Manual:
        this.setManualMode();
        this.setFlameHeight(FlameHeight.Step11);
        break;
      case OperationMode.Eco:
        this.setFlameHeight(FlameHeight.Step11);
        this.setEcoMode();
        break;
      case OperationMode.Temperature:
        this.setTemperature(request.temperature ?? this._lastStatus?.targetTemperature ?? 20);
        break;
      case OperationMode.Off:
        await this.guardFlameOff();
        break;
    }
    return true;
  }

  setAux(on: boolean) {
    this.log.info(`Set aux mode to ${on}`);
    this.sendCommand(on ? '32303031030a' : '32303030030a');
  }

  async request(request: IRequest): Promise<boolean> {
    let succeeds = true;
    this.stopStatusSubscription();
    if (request.mode) {
      succeeds = await this.setMode(request);
    } else if (request.temperature && request.mode === OperationMode.Temperature) {
      await this.setTemperature(request.temperature);
    } else if (request.height && (request.mode === OperationMode.Manual || request.mode === OperationMode.Eco)) {
      await this.setFlameHeight(request.height);
    } else if (request.temperature
      && this._lastStatus?.mode === OperationMode.Temperature) {
      await this.setTemperature(request.temperature);
    } else if (request.height && (this._lastStatus?.mode === OperationMode.Manual || this._lastStatus?.mode === OperationMode.Eco)) {
      await this.setFlameHeight(request.height);
    } else if (request.auxOn) {
      this.setAux(request.auxOn);
    }
    await this.delay(5_000);
    this.startStatusSubscription();
    return succeeds;
  }
}