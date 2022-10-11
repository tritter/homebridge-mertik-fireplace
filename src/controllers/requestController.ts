import { Logger } from 'homebridge';
import { FlameHeight } from '../models/flameHeight';
import { OperationMode } from '../models/operationMode';
import { IRequest } from '../models/request';
import { IFireplaceController } from './fireplaceController';

export interface IRequestController {
    unlock(): void;
    lock(): void;
    setFlameHeight(height: FlameHeight): void;
    setAux(on: boolean): void;
    setMode(mode: OperationMode): void;
    setTemperature(temperature: number): void;
    locked(): boolean;
    currentRequest(): IRequest | undefined;
}

export class RequestController implements IRequestController{
  private _locked = false;
  private _busy = false;
  private _scheduledRequest?: IRequest;
  private _sendTask?: NodeJS.Timer;

  constructor(
    public readonly log: Logger,
    public readonly fireplace: IFireplaceController) {
  }

  private isAllowed(): boolean {
    return !this._locked;
  }

  currentRequest() {
    return this._scheduledRequest;
  }

  lock() {
    this.log.info('Lock controls');
    this._locked = true;
  }

  unlock() {
    this.log.info('Unlock controls');
    this._locked = false;
  }

  locked = () => this._locked;

  setFlameHeight(height: FlameHeight) {
    this.scheduleRequest({height});
  }

  setAux(on: boolean) {
    this.scheduleRequest({auxOn: on});
  }

  setMode(mode: OperationMode) {
    this.scheduleRequest({mode});
  }

  setTemperature(temperature: number) {
    this.scheduleRequest({temperature});
  }

  clearScheduledTask() {
    clearInterval(this._sendTask);
    this._sendTask = undefined;
  }

  private scheduleRequest(request: IRequest) {
    if (this._sendTask) {
      this.clearScheduledTask();
    }

    const mergedRequest = this._scheduledRequest ? {...this._scheduledRequest, ...request} : request;
    this._scheduledRequest = mergedRequest;
    this._sendTask = setInterval(() => this.sendRequest(mergedRequest), 2_500);
  }

  private async sendRequest(request: IRequest) {
    if (!this._busy) {
      this.clearScheduledTask();
    }
    if (!this.isAllowed()) {
      this.log.info('Parental controls active, action is not allowed!');
      return;
    }
    this.log.debug(`Request: ${JSON.stringify(request)}`);
    this._busy = true;
    const success = await this.fireplace.request(request);
    if (!success) {
      this.scheduleRequest(request);
    }
    this._scheduledRequest = undefined;
    this._busy = false;
  }
}

