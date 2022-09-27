import { Characteristic, Logger, PlatformAccessory, Service } from 'homebridge';
import { IDeviceConfig } from '../models/deviceConfig';
import { MertikPlatform } from '../platform';

export interface IServiceController {
    activeCharacteristic(): Characteristic;
    currentHeaterCoolerStateCharacteristic(): Characteristic;
    targetHeaterCoolerStateCharacteristic(): Characteristic;
    currentTemperatureCharacteristic(): Characteristic;
    lockControlsCharacteristic(): Characteristic;
    swingModeCharacteristic(): Characteristic;
    heatingThresholdTemperatureCharacteristic(): Characteristic;
}

export class ServiceController implements IServiceController {
  private readonly _config: IDeviceConfig;
  private readonly _service: Service;

  constructor(
        public readonly log: Logger,
        public readonly accessory: PlatformAccessory,
        private readonly platform: MertikPlatform) {
    this._config = accessory.context.device;
    this._service = this.accessory.getService(this.platform.Service.HeaterCooler)
      || this.accessory.addService(this.platform.Service.HeaterCooler);
    this.initCharacteristics();
  }

  initCharacteristics() {
    const name = this._config.name;
    if (name.length < 2) {
      this.platform.log.error(`The given name ${this._config.name}, is too short`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.RESOURCE_DOES_NOT_EXIST);
    }
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Mertik')
      .setCharacteristic(this.platform.Characteristic.Model, 'B6R-WME')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.UUID)
      .setCharacteristic(this.platform.Characteristic.Name, this._config.name ?? 'Fireplace');

    this.heatingThresholdTemperatureCharacteristic()
      .setProps({
        minValue: 5.0,
        maxValue: 36,
        minStep: 0.5,
      });

    this.currentTemperatureCharacteristic()
      .setProps({
        minValue: -50.0,
        maxValue: 100.0,
      });
  }

  activeCharacteristic = () => this._service.getCharacteristic(this.platform.Characteristic.Active);

  currentHeaterCoolerStateCharacteristic = () => this._service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState);

  targetHeaterCoolerStateCharacteristic = () => this._service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState);

  currentTemperatureCharacteristic = () => this._service.getCharacteristic(this.platform.Characteristic.CurrentTemperature);

  lockControlsCharacteristic = () => this._service.getCharacteristic(this.platform.Characteristic.LockPhysicalControls);

  swingModeCharacteristic = () => this._service.getCharacteristic(this.platform.Characteristic.SwingMode);

  heatingThresholdTemperatureCharacteristic = () =>
    this._service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature);
}