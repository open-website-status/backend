export type AcknowledgementCallbackEmpty = (errorMessage: string | null) => void;

export type AcknowledgementCallbackData<T> = (errorMessage: string | null, data: T | null) => void;

// eslint-disable-next-line @typescript-eslint/ban-types
export type UnsafeCallback<T> = Exclude<unknown, Function> | T;
