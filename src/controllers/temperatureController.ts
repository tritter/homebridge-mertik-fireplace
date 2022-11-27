import { Logger } from 'homebridge';
import { FireplaceStatus } from '../models/fireplaceStatus';
import { OperationMode } from '../models/operationMode';
import { IFireplaceController } from './fireplaceController';

export interface ITemperatureController {
  startRegulatingTemperature(): void;
  stopRegulatingTemperature(): void;
}

export class TemperatureController implements ITemperatureController {
  private listener: ((status: FireplaceStatus) => void) | undefined;
  private lastRegulation: Date = new Date();
  private static REGULATION_TIMEOUT = 1000 * 60 * 20; //20 min
  private static TEMPERATURE_THRESHOLD = 0.5;

  constructor(
    public readonly log: Logger,
    public readonly fireplace: IFireplaceController) {
  }

  public startRegulatingTemperature(): void {
    if (this.listener) {
      return;
    }
    this.stopRegulatingTemperature();
    this.log.debug('Start regulate');

    this.listener = this.regulateTemperature.bind(this);
    this.fireplace.on('status', this.listener);
  }

  public stopRegulatingTemperature(): void {
    this.log.debug('Stop regulate');
    if (this.listener) {
      this.fireplace.removeListener('status', this.listener);
      this.listener = undefined;
    }
  }

  regulateTemperature(status: FireplaceStatus) {
    if (status.mode !== OperationMode.Temperature) {
      this.log.debug('No regulation needed: No temperature mode.');
      return;
    }

    const currentTemperature = status.currentTemperature;
    const threshold = status.targetTemperature - TemperatureController.TEMPERATURE_THRESHOLD;
    if (currentTemperature < threshold) {
      const now = new Date().getTime();
      const last = this.lastRegulation.getTime();
      if ((now - last) < TemperatureController.REGULATION_TIMEOUT) {
        this.log.debug('No regulation needed: Regulated already lately!');
        return;
      }
      this.fireplace.setTemperature(status.targetTemperature);
      this.lastRegulation = new Date();
    }
  }
}