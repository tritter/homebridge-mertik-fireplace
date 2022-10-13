import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { FireplaceController } from './controllers/fireplaceController';
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
  private readonly _fireplace: FireplaceController;
  private readonly _request: IRequestController;
  private readonly _service: IServiceController;

  constructor(
    private readonly platform: MertikPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this._fireplace = new FireplaceController(platform.log, accessory);
    this._service = new ServiceController(platform.log, accessory, platform);
    this._request = new RequestController(platform.log, this._fireplace, this.isLocked());
    this.subscribeFireplace();
    this.subscribeService();
  }

  private isLocked(): boolean {
    return this._service.lockControlsCharacteristic()?.value === this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED;
  }

  subscribeFireplace() {
    this._fireplace.on('status', (status) => {
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
  }

  subscribeService() {
    this._service.activeCharacteristic()
      .onGet(() => this.activeValue(this.getStatus()))
      .onSet((value) => {
        this.platform.log.debug('activeCharacteristic onSet');
        const status = this.getStatus();
        if (value === this.platform.Characteristic.Active.ACTIVE && status.mode === OperationMode.Off
          || value === this.platform.Characteristic.Active.INACTIVE && status.mode !== OperationMode.Off) {
          this._request.setMode(OperationModeUtils.ofActive(this.platform, value,
            this._service.targetHeaterCoolerStateCharacteristic().value || this.platform.Characteristic.TargetHeaterCoolerState.AUTO));
        }
      });
    this._service.currentHeaterCoolerStateCharacteristic()
      .onGet(() => this.heaterCoolerStateValue(this.getStatus()));

    this._service.targetHeaterCoolerStateCharacteristic()
      .onGet(() => this.targetHeaterCoolerStateValue(this.getStatus()))
      .onSet((value) => {
        this.platform.log.debug('targetHeaterCoolerStateCharacteristic onSet');
        this._request.setMode(OperationModeUtils.ofHeaterCoolerState(this.platform, value));
      });

    this._service.lockControlsCharacteristic()
      .onGet(() => this._request.locked())
      .onSet((value) => value === this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED ?
        this._request.lock() : this._request.unlock());

    this._service.swingModeCharacteristic()
      .onGet(() => this.swingModeValue(this.getStatus()))
      .onSet((value) => this._request.setAux(AuxModeUtils.fromSwingMode(this.platform, value)));

    this._service.heatingThresholdTemperatureCharacteristic()
      .onGet(() => this.heatingThresholdValue(this.getStatus()))
      .onSet((value) => {
        const percentage = ((value as number) - 5) / 31;
        this.platform.log.debug(`Set flame height to percentage: ${percentage}`);
        this._request.setFlameHeight(FlameHeightUtils.ofPercentage(percentage));
        this._request.setTemperature(value as number);
      });
  }

  private getStatus(): FireplaceStatus {
    if (!this._fireplace.reachable()) {
      this.platform.log.debug('Device not connected!');
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    const status = this._fireplace.status();
    if (!status) {
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.RESOURCE_BUSY);
    }
    return status!;
  }

  // Update handlers

  private updateActive(status: FireplaceStatus) {
    this._service.activeCharacteristic().updateValue(this.activeValue(status));
  }

  private updateCurrentHeatingCoolerState(status: FireplaceStatus) {
    this._service.currentHeaterCoolerStateCharacteristic().updateValue(this.heaterCoolerStateValue(status));
  }

  private updateTargetHeatingCoolerState(status: FireplaceStatus) {
    this._service.targetHeaterCoolerStateCharacteristic().updateValue(this.targetHeaterCoolerStateValue(status));
  }

  private updateCurrentTemperature(status: FireplaceStatus) {
    this._service.currentTemperatureCharacteristic().updateValue(status.currentTemperature);
  }

  private updateSwingMode(status: FireplaceStatus) {
    this._service.swingModeCharacteristic().updateValue(this.swingModeValue(status));
  }

  private updateHeatingThresholdTemperature(status: FireplaceStatus) {
    this._service.heatingThresholdTemperatureCharacteristic().updateValue(this.heatingThresholdValue(status));
  }

  // CharacteristicValues

  private activeValue(status: FireplaceStatus): CharacteristicValue {
    const currentRequest = this._request.currentRequest();
    if (currentRequest?.mode) {
      const requestedMode = currentRequest?.mode || OperationMode.Manual;
      return OperationModeUtils.toActive(this.platform, requestedMode, status.igniting, status.shuttingDown);
    }
    return OperationModeUtils.toActive(this.platform, status.mode, status.igniting, status.shuttingDown);
  }

  private swingModeValue(status: FireplaceStatus): CharacteristicValue {
    const currentRequest = this._request.currentRequest();
    if (currentRequest?.auxOn) {
      const requestedAux = currentRequest?.auxOn || false;
      return AuxModeUtils.toSwingMode(this.platform, requestedAux);
    }
    return AuxModeUtils.toSwingMode(this.platform, status.auxOn);
  }

  private heaterCoolerStateValue(status: FireplaceStatus): CharacteristicValue {
    const currentRequest = this._request.currentRequest();
    if (currentRequest?.mode) {
      const requestedMode = currentRequest?.mode || OperationMode.Manual;
      return OperationModeUtils.toHeatingCoolerState(this.platform, requestedMode, status.guardFlameOn);
    }
    return OperationModeUtils.toHeatingCoolerState(this.platform, status.mode, status.guardFlameOn);
  }

  private targetHeaterCoolerStateValue(status: FireplaceStatus): CharacteristicValue {
    const currentRequest = this._request.currentRequest();
    if (currentRequest?.mode) {
      const requestedMode = currentRequest?.mode || OperationMode.Manual;
      return OperationModeUtils.toTargetHeaterCoolerState(this.platform, requestedMode);
    }
    return OperationModeUtils.toTargetHeaterCoolerState(this.platform, status.mode);
  }

  private heatingThresholdValue(status: FireplaceStatus): CharacteristicValue {
    const currentRequest = this._request.currentRequest();
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
      targetTemperature = Math.round((FlameHeightUtils.toPercentage(this._fireplace.getFlameHeight()) * 31 + 5));
    }
    return targetTemperature;
  }
}
