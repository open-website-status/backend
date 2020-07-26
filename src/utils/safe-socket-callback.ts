import { AcknowledgementCallbackData, AcknowledgementCallbackEmpty, UnsafeCallback } from '../socket-manager/types';

export function safeDataCallback<T>(
  callback: UnsafeCallback<AcknowledgementCallbackData<T>>,
  error: string | null,
  data: T | null,
): void {
  if (callback instanceof Function) {
    callback(error, data);
  }
}

export function safeEmptyCallback(
  callback: UnsafeCallback<AcknowledgementCallbackEmpty>,
  error: string | null,
): void {
  if (callback instanceof Function) {
    callback(error);
  }
}
