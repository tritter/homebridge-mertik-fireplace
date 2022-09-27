import { CharacteristicValue } from 'homebridge';
import { MertikPlatform } from '../platform';

export class AuxModeUtils {
  public static toSwingMode(platform: MertikPlatform, auxOn: boolean): CharacteristicValue {
    return auxOn ? platform.Characteristic.SwingMode.SWING_ENABLED : platform.Characteristic.SwingMode.SWING_DISABLED;
  }

  public static fromSwingMode(platform: MertikPlatform, swingMode: CharacteristicValue): boolean {
    return swingMode === platform.Characteristic.SwingMode.SWING_ENABLED;
  }
}