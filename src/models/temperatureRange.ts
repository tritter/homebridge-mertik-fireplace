export class TemperatureRangeUtils {
  public static toBits(value: number) : string {
    const temperature = value * 10;
    const degrees = Math.floor(temperature / 16) * 100;
    const decimals = (temperature % 16);
    const startDecimalsBit = decimals > 0 ? 30 : 0;
    const sum = degrees + decimals + startDecimalsBit;
    if (temperature < 160) {
      return '0' + (3000 + sum);
    } else if (temperature < 256) {
      return '0' + (3100 + sum);
    } else {
      return '1' + (1400 + sum );
    }
  }
}