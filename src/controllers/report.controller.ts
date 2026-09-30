// TODO: submit anonymous reports and let reporters track them by case code.
import { AppError } from '../utils/AppError';

export function submitReport() {
  throw new AppError(501, 'NOT_IMPLEMENTED', 'Not implemented');
}

export function trackReport() {
  throw new AppError(501, 'NOT_IMPLEMENTED', 'Not implemented');
}
