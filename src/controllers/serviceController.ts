import { Characteristic, Logger, PlatformAccessory, Service } from 'homebridge';
import { IDeviceConfig } from '../models/deviceConfig';
import { MertikPlatform } from '../platform';

export interface IServiceController {
  reachableCharacteristic(): Characteristic;
  activeCharacteristic(): Characteristic;
  currentHeaterCoolerStateCharacteristic(): Characteristic;
  targetHeaterCoolerStateCharacteristic(): Characteristic;
  currentTemperatureCharacteristic(): Characteristic;
  lockControlsCharacteristic(): Characteristic;
  parentControlCharacteristic(): Characteristic;
  swingModeCharacteristic(): Characteristic;
  heatingThresholdTemperatureCharacteristic(): Characteristic;
}

export class ServiceController implements IServiceController {
  private readonly config: IDeviceConfig;
  private readonly service: Service;
  private readonly reachableService: Service;
  private readonly parentControlService: Service;

  constructor(
    public readonly log: Logger,
    public readonly accessory: PlatformAccessory,
    private readonly platform: MertikPlatform) {
    this.config = this.accessory.context.device;
    this.service = this.accessory.getService(this.platform.Service.HeaterCooler)
      || this.accessory.addService(this.platform.Service.HeaterCooler);
    this.reachableService = this.accessory.getService(this.platform.Service.ContactSensor)
      || this.accessory.addService(this.platform.Service.ContactSensor);
    this.parentControlService = this.accessory.getService('Parent Control')
      || this.accessory.addService(this.platform.Service.Switch, 'Parent Control', 'parent-control');
    this.initCharacteristics();
  }

  initCharacteristics() {
    const name = this.config.name;
    if (name.length < 2) {
      this.platform.log.error(`The given name ${this.config.name}, is too short`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.RESOURCE_DOES_NOT_EXIST);
    }
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Mertik')
      .setCharacteristic(this.platform.Characteristic.Model, 'B6R-WME')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.UUID)
      .setCharacteristic(this.platform.Characteristic.Name, this.config.name ?? 'Fireplace');

    this.reachableService.setCharacteristic(this.platform.Characteristic.Name, 'Connected');
    this.parentControlService.setCharacteristic(this.platform.Characteristic.Name, 'Parent Control');

    this.heatingThresholdTemperatureCharacteristic()
      .setProps({
        minValue: 0.0,
        maxValue: 36,
        minStep: 0.5,
      });


    this.currentTemperatureCharacteristic()
      .setProps({
        minValue: -50.0,
        maxValue: 100.0,
      });
  }

  reachableCharacteristic = () => this.reachableService.getCharacteristic(this.platform.Characteristic.ContactSensorState);

  activeCharacteristic = () => this.service.getCharacteristic(this.platform.Characteristic.Active);

  currentHeaterCoolerStateCharacteristic = () => this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState);

  targetHeaterCoolerStateCharacteristic = () => this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState);

  currentTemperatureCharacteristic = () => this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature);

  lockControlsCharacteristic = () => this.service.getCharacteristic(this.platform.Characteristic.LockPhysicalControls);

  parentControlCharacteristic = () => this.parentControlService.getCharacteristic(this.platform.Characteristic.On);

  swingModeCharacteristic = () => this.service.getCharacteristic(this.platform.Characteristic.SwingMode);

  heatingThresholdTemperatureCharacteristic = () =>
    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature);
}
