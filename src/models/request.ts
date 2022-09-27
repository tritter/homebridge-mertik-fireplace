import { FlameHeight } from './FlameHeight';
import { OperationMode } from './operationMode';

export interface IRequest {
    height?: FlameHeight;
    mode?: OperationMode;
    temperature?: number;
    auxOn?: boolean;
}
