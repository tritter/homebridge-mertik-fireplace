export enum FlameHeight {
    Step0 = '3830',
    Step1 = '3842',
    Step2 = '3937',
    Step3 = '4132',
    Step4 = '4145',
    Step5 = '4239',
    Step6 = '4335',
    Step7 = '4430',
    Step8 = '4443',
    Step9 = '4537',
    Step10 = '4633',
    Step11 = '4646',
    StepUndefined = 'undefined',
  }

export class FlameHeightUtils {
  public static ofPercentage(value: number) : FlameHeight {
    const keys = Object.keys(FlameHeight);
    const fullSteps = keys.length - 1;
    const factorStep = value * fullSteps;
    const index = Math.ceil(factorStep);
    return Object.values(FlameHeight)[index];
  }

  public static toPercentage(height: FlameHeight) : number {
    const values = Object.values(FlameHeight);
    const index: number = values.indexOf(height);
    const oneStep = 100 / (values.length - 1);
    return (index * oneStep) / 100;
  }
}
