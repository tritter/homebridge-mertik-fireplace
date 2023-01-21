import { IDeviceConfig } from '../models/deviceConfig';
import EventEmitter from 'events';
import net, { Socket } from 'net';
import { FireplaceStatus } from '../models/fireplaceStatus';
import { OperationMode, OperationModeUtils } from '../models/operationMode';
import { FlameHeight, FlameHeightUtils } from '../models/flameHeight';
import { Logger, PlatformAccessory } from 'homebridge';
import { TemperatureRangeUtils } from '../models/temperatureRange';
import { IRequest } from '../models/request';

export interface IFireplaceController extends EventEmitter {
  request(request: IRequest): Promise<boolean>;
  status(): FireplaceStatus | undefined;
  getFlameHeight(): FlameHeight;
  reachable(): boolean;
  setTemperature(temperature: number): void;
}

export interface IFireplaceEvents {
  on(event: 'status', listener: (status: FireplaceStatus) => void): this;
  on(event: 'reachable', listener: (reachable: boolean) => void): this;
}

export class FireplaceController extends EventEmitter implements IFireplaceController, IFireplaceEvents {
  private readonly config: IDeviceConfig;
  private height = FlameHeight.Step11;
  private statusTimer: NodeJS.Timer | undefined;
  private client: Socket | null = null;
  private lastContact: Date = new Date();
  private lastStatus: FireplaceStatus | undefined;
  private igniting = false;
  private shuttingDown = false;
  private lostConnection = false;
  private static UNREACHABLE_TIMEOUT = 1000 * 60 * 5; //5 min
  private static REFRESH_TIMEOUT = 1000 * 15; //15 seconds

  constructor(
    public readonly log: Logger,
    public readonly accessory: PlatformAccessory) {
    super();
    this.config = this.accessory.context.device;
    this.startStatusSubscription();
  }

  private startStatusSubscription(): void {
    this.stopStatusSubscription();
    this.log.debug('Start requesting status');
    this.client = null;
    this.statusTimer = setInterval((e) => e.refreshStatus(), FireplaceController.REFRESH_TIMEOUT, this);
  }

  private stopStatusSubscription() {
    this.log.debug('Stop requesting status');
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = undefined;
    }
  }

  private refreshStatus() {
    const isReachable = this.reachable();
    this.emit('reachable', isReachable);

    if (this.lastStatus) {
      // Security mechanisnm to turn off fireplace when we had contcat before.
      this.lostConnection = !isReachable;
      if (this.lostConnection){
        this.log.error('Lost contact!');
      }
    }

    try {
      this.sendCommand('303303');
    } catch {
      this.log.error('Failed to refresh!');
    }
  }

  private processStatusResponse(response: string) {
    const newStatus = new FireplaceStatus(response);
    this.lastContact = new Date();
    this.igniting = newStatus.igniting;
    this.shuttingDown = newStatus.shuttingDown;
    this.lastStatus = newStatus;
    this.emit('status', this.lastStatus);
    if (this.lostConnection) {
      // Make sure to turn it off, as we are not sure which state we are in.
      this.guardFlameOff();
    }
  }

  private async igniteFireplace() {
    if (this.igniting) {
      this.log.debug('Ignore already igniting!');
      return;
    }
    this.igniting = true;
    this.sendCommand('314103');
    await this.delay(40_000);
    this.refreshStatus();
  }

  private async standBy() {
    await this.setTemperatureValue(0);
    const msg = '3136303003';
    return this.sendCommand(msg);
  }

  private async guardFlameOff() {
    if (this.shuttingDown) {
      this.log.debug('Ignore already shutting down!');
      return;
    }
    this.shuttingDown = true;
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
    const ip = this.config.ip;
    this.log.debug(`Using ip:'${ip}'`);
    if (!this.client
      || (typeof(this.client) === 'undefined') || (typeof(this.client.destroyed) !== 'boolean') || (this.client.destroyed === true)) {
      this.log.debug('Created socket');
      this.client = new net.Socket();
      this.client.connect(2000, ip);
      this.client.setTimeout(FireplaceController.REFRESH_TIMEOUT);
      this.client.on('data', (data) => {
        const tempData = data.toString().substr(1).replace(/\r/g, ';');
        this.log.debug('Data: ' + tempData);
        if (tempData.startsWith('30303030000')) {
          this.processStatusResponse(tempData);
        }
      });
      this.client.on('error', (err) => {
        this.log.debug('Socket error: ' + err.message);
        if (this.client && typeof(this.client.destroy) === 'function') {
          this.client.destroy();
        }
      });
    }
    return this.client;
  }

  private sendCommand(command: string): boolean {
    const prefix = '0233303330333033303830';
    const packet = Buffer.from(prefix + command, 'hex');
    this.log.debug('Sending packet: ' + prefix + command);
    return this.ensureClient().write(packet);
  }

  reachable(): boolean {
    const now = new Date().getTime();
    const last = this.lastContact.getTime();
    return (now - last) < FireplaceController.UNREACHABLE_TIMEOUT;
  }

  status(): FireplaceStatus | undefined {
    return this.lastStatus;
  }

  delay = ms => new Promise(res => setTimeout(res, ms));

  resetFlameHeight(): void {
    const msg = '3136' + FlameHeight.Step11 + '03';
    this.sendCommand(msg);
  }

  async setFlameHeight(temperature: number) {
    const percentage = ((temperature) - 5) / 31;
    this.log.debug(`Set flame height to percentage: ${percentage}`);
    const height = FlameHeightUtils.ofPercentage(percentage);
    this.log.info(`Set flame height to ${height.toString()}`);
    this.height = height;
    this.resetFlameHeight();
    await this.delay(10_000);
    const msg = '3136' + height + '03';
    this.sendCommand(msg);
    await this.delay(1_000);
  }

  public getFlameHeight(): FlameHeight {
    return this.height;
  }

  public async setTemperature(temperature: number) {
    this.log.info(`Set temperature to ${temperature}`);
    this.setManualMode();
    await this.delay(1_000);
    this.resetFlameHeight();
    await this.delay(10_000);
    this.setTemperatureMode();
    await this.delay(1_000);
    await this.setTemperatureValue(temperature);
  }

  private async setTemperatureValue(temperature: number) {
    const value = TemperatureRangeUtils.toBits(temperature);
    const msg = '42324644303' + value + '03';
    this.sendCommand(msg);
    await this.delay(1_000);
  }

  async setMode(request: IRequest): Promise<boolean> {
    const mode = request.mode!;
    const currentMode = this.lastStatus?.mode || OperationMode.Off;
    if (this.igniting) {
      this.log.debug('Ignore as we are igniting the fireplace first!');
      return false;
    }
    if (OperationModeUtils.needsIgnite(mode) && currentMode === OperationMode.Off && !this.lastStatus?.guardFlameOn) {
      this.log.info('Ignite fireplace');
      await this.igniteFireplace();
      return false;
    }
    if (currentMode === mode) {
      this.log.debug('Ignore same mode!');
      return true;
    }
    this.log.info(`Set mode to: ${OperationMode[mode]}`);
    const targetTemperature = this.lastStatus?.targetTemperature ?? 20;
    switch(mode) {
      case OperationMode.Manual:
        this.setManualMode();
        this.setFlameHeight(targetTemperature);
        break;
      case OperationMode.Eco:
        this.setFlameHeight(targetTemperature);
        this.setEcoMode();
        break;
      case OperationMode.Temperature:
        this.setTemperature(targetTemperature);
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
    const currentMode = this.lastStatus?.mode || OperationMode.Off;
    this.stopStatusSubscription();
    if (request.mode !== undefined
      && request.mode !== currentMode) {
      succeeds = await this.setMode(request);
    } else if (request.temperature !== undefined
      && (request.mode === OperationMode.Temperature || this.lastStatus?.mode === OperationMode.Temperature)) {
      if (request.temperature <= 0.0) {
        await this.standBy();
      } else {
        await this.setTemperature(request.temperature);
      }
    } else if (request.temperature !== undefined
       && (request.mode === OperationMode.Manual || request.mode === OperationMode.Eco
        || this.lastStatus?.mode === OperationMode.Manual || this.lastStatus?.mode === OperationMode.Eco)) {
      if (request.temperature <= 0.0) {
        await this.standBy();
      } else {
        await this.setFlameHeight(request.temperature);
      }
    }
    await this.delay(5_000);
    if (request.auxOn !== undefined) {
      await this.delay(8_000);
      this.setAux(request.auxOn);
      await this.delay(5_000);
    }
    this.startStatusSubscription();
    return succeeds;
  }
}
