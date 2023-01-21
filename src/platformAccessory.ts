import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { IFireplaceController, FireplaceController } from './controllers/fireplaceController';
import { IRequestController, RequestController } from './controllers/requestController';
import { IServiceController, ServiceController } from './controllers/serviceController';
import { AuxModeUtils } from './models/auxMode';
import { FireplaceStatus } from './models/fireplaceStatus';
import { FlameHeight, FlameHeightUtils } from './models/flameHeight';
import { OperationMode, OperationModeUtils } from './models/operationMode';
import { MertikPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FireplacePlatformAccessory {
  private readonly fireplace: IFireplaceController;
  private readonly request: IRequestController;
  private readonly service: IServiceController;

  constructor(
    private readonly platform: MertikPlatform,
    accessory: PlatformAccessory,
  ) {
    this.fireplace = new FireplaceController(platform.log, accessory);
    this.service = new ServiceController(platform.log, accessory, platform);
    this.request = new RequestController(platform.log, this.fireplace, this.isLocked());
    this.subscribeFireplace();
    this.subscribeService();
  }

  private isLocked(): boolean {
    return this.service.lockControlsCharacteristic()?.value === this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED;
  }

  subscribeFireplace() {
    this.fireplace.on('status', (status) => {
      this.platform.log.info(`Received status - ${status}`);
      this.updateActive(status);
      if (!status.igniting && !status.shutdown) {
        this.updateCurrentHeatingCoolerState(status);
        this.updateTargetHeatingCoolerState(status);
        this.updateCurrentTemperature(status);
      }
      this.updateSwingMode(status);
      this.updateHeatingThresholdTemperature(status);
    });
    this.fireplace.on('reachable', (reachable) =>{
      this.updateReachable(reachable);
    });
  }

  subscribeService() {
    this.service.activeCharacteristic()
      .onGet(() => this.activeValue(this.getStatus()))
      .onSet((value) => {
        this.platform.log.debug('activeCharacteristic onSet');
        const status = this.getStatus();
        if (value === this.platform.Characteristic.Active.ACTIVE && status.mode === OperationMode.Off
          || value === this.platform.Characteristic.Active.INACTIVE && status.mode !== OperationMode.Off) {
          this.request.setMode(OperationModeUtils.ofActive(this.platform, value,
            this.service.targetHeaterCoolerStateCharacteristic().value || this.platform.Characteristic.TargetHeaterCoolerState.AUTO));
        }
      });
    this.service.currentHeaterCoolerStateCharacteristic()
      .onGet(() => this.heaterCoolerStateValue(this.getStatus()));

    this.service.targetHeaterCoolerStateCharacteristic()
      .onGet(() => this.targetHeaterCoolerStateValue(this.getStatus()))
      .onSet((value) => {
        this.platform.log.debug('targetHeaterCoolerStateCharacteristic onSet');
        this.request.setMode(OperationModeUtils.ofHeaterCoolerState(this.platform, value));
      });

    this.service.lockControlsCharacteristic()
      .onGet(() => this.request.isLocked())
      .onSet((value) => value === this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED ?
        this.request.lock() : this.request.unlock());

    this.service.swingModeCharacteristic()
      .onGet(() => this.swingModeValue(this.getStatus()))
      .onSet((value) => this.request.setAux(AuxModeUtils.fromSwingMode(this.platform, value)));

    this.service.heatingThresholdTemperatureCharacteristic()
      .onGet(() => this.targetHeatingThresholdValue(this.getStatus()))
      .onSet((value) => {
        this.request.setTemperature(value as number);
      });
    this.service.reachableCharacteristic()
      .onGet(() => this.reachableValue(this.fireplace.reachable()));
  }

  private getStatus(): FireplaceStatus {
    if (!this.fireplace.reachable()) {
      this.platform.log.debug('Device not connected!');
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    const status = this.fireplace.status();
    if (!status) {
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.RESOURCE_BUSY);
    }
    return status!;
  }

  // Update handlers

  private updateReachable(reachable: boolean) {
    this.service.reachableCharacteristic().updateValue(this.reachableValue(reachable));
  }

  private updateActive(status: FireplaceStatus) {
    this.service.activeCharacteristic().updateValue(this.activeValue(status));
  }

  private updateCurrentHeatingCoolerState(status: FireplaceStatus) {
    this.service.currentHeaterCoolerStateCharacteristic().updateValue(this.heaterCoolerStateValue(status));
  }

  private updateTargetHeatingCoolerState(status: FireplaceStatus) {
    this.service.targetHeaterCoolerStateCharacteristic().updateValue(this.targetHeaterCoolerStateValue(status));
  }

  private updateCurrentTemperature(status: FireplaceStatus) {
    this.service.currentTemperatureCharacteristic().updateValue(status.currentTemperature > 100 ? 20 : status.currentTemperature);
  }

  private updateSwingMode(status: FireplaceStatus) {
    this.service.swingModeCharacteristic().updateValue(this.swingModeValue(status));
  }

  private updateHeatingThresholdTemperature(status: FireplaceStatus) {
    this.service.heatingThresholdTemperatureCharacteristic().updateValue(this.targetHeatingThresholdValue(status));
  }

  // CharacteristicValues

  private reachableValue(reachable: boolean): CharacteristicValue {
    return reachable ? this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED
      : this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
  }

  private activeValue(status: FireplaceStatus): CharacteristicValue {
    const currentRequest = this.request.currentRequest();
    let mode = status.mode;
    if (currentRequest?.mode) {
      const requestedMode = currentRequest?.mode || OperationMode.Manual;
      // Override mode with requested mode to not flicker the interface.
      mode = requestedMode;
    }
    return OperationModeUtils.toActive(this.platform, mode, status.igniting, status.shuttingDown);
  }

  private swingModeValue(status: FireplaceStatus): CharacteristicValue {
    const currentRequest = this.request.currentRequest();
    if (currentRequest?.auxOn) {
      const requestedAux = currentRequest?.auxOn || false;
      return AuxModeUtils.toSwingMode(this.platform, requestedAux);
    }
    return AuxModeUtils.toSwingMode(this.platform, status.auxOn);
  }

  private heaterCoolerStateValue(status: FireplaceStatus): CharacteristicValue {
    const currentRequest = this.request.currentRequest();
    if (currentRequest?.mode) {
      const requestedMode = currentRequest?.mode || OperationMode.Manual;
      return OperationModeUtils.toHeatingCoolerState(this.platform, requestedMode, status.guardFlameOn);
    }
    return OperationModeUtils.toHeatingCoolerState(this.platform, status.mode, status.guardFlameOn);
  }

  private targetHeaterCoolerStateValue(status: FireplaceStatus): CharacteristicValue {
    const currentRequest = this.request.currentRequest();
    if (currentRequest?.mode) {
      const requestedMode = currentRequest?.mode || OperationMode.Manual;
      return OperationModeUtils.toTargetHeaterCoolerState(this.platform, requestedMode);
    }
    return OperationModeUtils.toTargetHeaterCoolerState(this.platform, status.mode);
  }

  private targetHeatingThresholdValue(status: FireplaceStatus): CharacteristicValue {
    const currentRequest = this.request.currentRequest();
    if (currentRequest?.temperature && currentRequest?.height) {
      let operationMode = status.mode;
      if (currentRequest?.mode) {
        operationMode = currentRequest?.mode || OperationMode.Manual;
      }
      let targetTemperature = currentRequest?.temperature || 36;
      if (operationMode === OperationMode.Manual) {
        targetTemperature = Math.round((FlameHeightUtils
          .toPercentage(currentRequest?.height || FlameHeight.Step11) * 31 + 5));
      }
      return targetTemperature;
    }
    let targetTemperature = status.targetTemperature;
    if (status.mode === OperationMode.Manual) {
      targetTemperature = Math.round((FlameHeightUtils.toPercentage(this.fireplace.getFlameHeight()) * 31 + 5));
    }
    return targetTemperature;
  }
}
