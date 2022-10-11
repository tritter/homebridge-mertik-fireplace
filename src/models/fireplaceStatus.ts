import { OperationMode } from './operationMode';

export class FireplaceStatus {
  public readonly auxOn: boolean = false;
  public readonly mode: OperationMode = OperationMode.Off;
  public readonly currentTemperature: number = 10;
  public readonly targetTemperature: number = 10;
  public readonly igniting: boolean = false;
  public readonly guardFlameOn: boolean = false;
  public readonly shuttingDown: boolean = false;

  constructor(status: string) {
    const modeBits = status.substring(24, 25);
    const statusBits = status.substring(16, 20);
    this.shuttingDown = fromBitStatus(statusBits, 7);
    this.guardFlameOn = fromBitStatus(statusBits, 8);
    this.igniting = fromBitStatus(statusBits, 11);
    this.currentTemperature = parseInt('0x' + status.substring(28, 32)) / 10;
    this.targetTemperature = parseInt('0x' + status.substring(32, 36)) / 10;
    this.auxOn = fromBitStatus(statusBits, 12);
    let opMode = operationModeOfBits(modeBits);
    if (!this.guardFlameOn || this.shuttingDown) {
      opMode = OperationMode.Off;
    }
    this.mode = opMode;
  }

  public toString(): string {
    return `mode:${OperationMode[this.mode]} `
          +`ignite:${this.igniting} `
          +`target:${this.targetTemperature} `
          +`aux:${this.auxOn} `
          +`current:${this.currentTemperature} `
          +`shutdown:${this.shuttingDown} `
          +`guardOn:${this.guardFlameOn} `;
  }
}

function operationModeOfBits(mode) {
  switch(mode) {
    case '1':
      return OperationMode.Temperature;
    case '2':
      return OperationMode.Eco;
    default:
      return OperationMode.Manual;
  }
}

function hex2bin(hex: string){
  return (parseInt(hex, 16).toString(2)).padStart(16, '0');
}

function fromBitStatus(hex: string, index: number) {
  return hex2bin(hex).substring(index, index + 1) === '1';
}