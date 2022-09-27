import { CharacteristicValue } from 'homebridge';
import { MertikPlatform } from '../platform';
import { FireplaceStatus } from './fireplaceStatus';

export enum OperationMode {
    Off = 1,
    Manual = 2,
    Temperature = 3,
    Eco = 4
}

export class OperationModeUtils {
  public static needsIgnite(mode: OperationMode) : boolean {
    switch(mode) {
      case OperationMode.Eco:
      case OperationMode.Manual:
      case OperationMode.Temperature:
        return true;
      default:
        return false;
    }
  }

  public static toHeatingCoolerState(platform: MertikPlatform, status: FireplaceStatus) : CharacteristicValue {
    const mode = status.mode;
    let state = platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    switch(mode) {
      case OperationMode.Temperature:
        state = platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        break;
      case OperationMode.Eco:
        state = platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        break;
      case OperationMode.Manual:
        state = platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        break;
      default:
        state = status.guardFlameOn ? platform.Characteristic.CurrentHeaterCoolerState.IDLE
          : platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
        break;
    }
    return state;
  }

  public static toTargetHeaterCoolerState(platform: MertikPlatform, mode: OperationMode) : CharacteristicValue {
    switch(mode) {
      case OperationMode.Manual:
        return platform.Characteristic.TargetHeaterCoolerState.HEAT;
      case OperationMode.Eco:
        return platform.Characteristic.TargetHeaterCoolerState.COOL;
      default:
        return platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }
  }

  public static ofHeaterCoolerState(platform: MertikPlatform, value: CharacteristicValue) : OperationMode {
    if (value === platform.Characteristic.TargetHeaterCoolerState.AUTO) {
      return OperationMode.Temperature;
    } else if (value === platform.Characteristic.TargetHeaterCoolerState.COOL) {
      return OperationMode.Eco;
    } else if (value === platform.Characteristic.TargetHeaterCoolerState.HEAT) {
      return OperationMode.Manual;
    } else {
      return OperationMode.Off;
    }
  }

  public static toActive(platform: MertikPlatform, status: FireplaceStatus): CharacteristicValue {
    return status.mode === OperationMode.Off && !status.igniting && !status.guardFlameOn
      ? platform.Characteristic.Active.INACTIVE : platform.Characteristic.Active.ACTIVE;
  }

  public static ofActive(platform: MertikPlatform, value: CharacteristicValue,
    heatingCoolerStateValue: CharacteristicValue): OperationMode {
    return value === platform.Characteristic.Active.ACTIVE ?
      this.ofHeaterCoolerState(platform, heatingCoolerStateValue) : OperationMode.Off;
  }
}
