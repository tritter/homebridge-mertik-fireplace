import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { FireplacePlatformAccessory } from './platformAccessory';
import { IDeviceConfig } from './models/deviceConfig';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class MertikPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.configureDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  configureDevices() {
    const configuredDevices: IDeviceConfig[] = this.config['fireplaces'] ?? new Array<IDeviceConfig>();
    const devicesMap = configuredDevices.reduce((a, x) => ({...a, [x.name]: x.ip}), {});
    for (const configuredDevice of configuredDevices) {
      if (!configuredDevice.name) {
        this.log.error('No valid fireplace name given!');
        return;
      }
      const uuid = this.api.hap.uuid.generate(configuredDevice.name);
      const accessory = this.accessories.find(a => a.UUID === uuid);
      if (accessory) {
        this.log.info('Restoring existing fireplace from cache:', accessory.displayName);
        accessory.context.device = configuredDevice;
        new FireplacePlatformAccessory(this, accessory);
        this.api.updatePlatformAccessories([accessory]);
      } else {
        this.log.info('Adding new fireplace:', configuredDevice.name);
        const newAccessory = new this.api.platformAccessory(configuredDevice.name, uuid);
        newAccessory.context.device = configuredDevice;
        new FireplacePlatformAccessory(this, newAccessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newAccessory]);
      }
    }

    // Delete previously configured devices that don't exist anymore
    for (const existingAccessory of this.accessories) {
      if (!devicesMap[existingAccessory.context.device.name]) {
        this.log.debug('Removing unconfigured fireplace');
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        this.log.info('Removing existing fireplace from cache:', existingAccessory.displayName);
      }
    }

  }
}
