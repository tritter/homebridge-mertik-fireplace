import { Logger } from 'homebridge';
import { FlameHeight } from '../models/flameHeight';
import { OperationMode } from '../models/operationMode';
import { IRequest } from '../models/request';
import { IFireplaceController } from './fireplaceController';

export interface IRequestController {
  locked: boolean;
  unlock(): void;
  lock(): void;
  setFlameHeight(height: FlameHeight): void;
  setAux(on: boolean): void;
  setMode(mode: OperationMode): void;
  setTemperature(temperature: number): void;
  currentRequest(): IRequest | undefined;
}

export class RequestController implements IRequestController{
  private busy = false;
  private scheduledRequest?: IRequest;
  private sendTask?: NodeJS.Timer;
  private lockTask?: NodeJS.Timer;

  constructor(
    public readonly log: Logger,
    public readonly fireplace: IFireplaceController,
    public locked = false) {

  }

  private isAllowed(): boolean {
    return !this.locked;
  }

  currentRequest() {
    return this.scheduledRequest;
  }

  clearScheduledLock() {
    clearInterval(this.lockTask);
    this.lockTask = undefined;
  }

  lock() {
    this.clearScheduledLock();
    this.log.info('Lock control after 1 minute (makes sure that automations still run through.');
    this.sendTask = setTimeout(() => {
      this.locked = true; this.log.info('Locked controls');
    }, 60_000);
  }

  unlock() {
    this.clearScheduledLock();
    this.locked = false;
    this.log.info('Unlocked controls');

  }

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
    clearInterval(this.sendTask);
    this.sendTask = undefined;
  }

  private scheduleRequest(request: IRequest) {
    if (this.sendTask) {
      this.clearScheduledTask();
    }

    const mergedRequest = this.scheduledRequest ? {...this.scheduledRequest, ...request} : request;
    this.scheduledRequest = mergedRequest;
    this.sendTask = setInterval(() => this.sendRequest(mergedRequest), 5_000);
  }

  private async sendRequest(request: IRequest, retry = false) {
    if (!this.busy) {
      this.clearScheduledTask();
    }
    if (!this.isAllowed()) {
      if (!retry) {
        setTimeout(() => this.sendRequest(request, true), 5_000);
        return;
      }

      this.log.info('Parental controls active, action is not allowed!');
      this.scheduledRequest = undefined;
      return;
    }
    this.log.debug(`Request: ${JSON.stringify(request)}`);
    this.busy = true;
    const success = await this.fireplace.request(request);
    if (!success) {
      this.scheduleRequest(request);
    }
    this.scheduledRequest = undefined;
    this.busy = false;
  }
}

