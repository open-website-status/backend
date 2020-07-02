import * as t from 'io-ts';
import SocketIO from 'socket.io';
import { JobResult, Provider } from '../../database/types';

export * from './jobs';

export interface QueryMessage {
  id: string;
  timestamp: Date;
  protocol: 'http' | 'https';
  host: string;
  path: string;
}

export interface ProviderConnection {
  socket: SocketIO.Socket,
  provider: Provider,
  countryCode: string,
  regionCode: string,
  ispName: string,
}

export const APIQueryMessage = t.type({
  token: t.string,
  protocol: t.union([t.literal('http'), t.literal('https')]),
  host: t.string,
  path: t.string,
});

export type APIQueryMessage = t.TypeOf<typeof APIQueryMessage>;

export const WebsiteQueryMessage = t.type({
  /* TODO: ADD CAPTCHA RESPONSE */
  protocol: t.union([t.literal('http'), t.literal('https')]),
  host: t.string,
  path: t.string,
});

export type WebsiteQueryMessage = t.TypeOf<typeof WebsiteQueryMessage>;

export const GetQueryMessage = t.type({
  queryId: t.string,
});

export type GetQueryMessage = t.TypeOf<typeof GetQueryMessage>;

export const ProviderJobAcceptMessage = t.type({
  jobId: t.string,
});

export const ProviderJobRejectMessage = t.type({
  jobId: t.string,
});

export const ProviderJobCancelMessage = t.type({
  jobId: t.string,
});

export const ProviderJobCompleteMessage = t.type({
  jobId: t.string,
  result: JobResult,
});

export type AcknowledgementCallbackEmpty = (errorMessage: string | null) => void;

export type AcknowledgementCallbackData<T> = (errorMessage: string | null, data: T | null) => void;

// eslint-disable-next-line @typescript-eslint/ban-types
export type UnsafeCallback<T> = Exclude<unknown, Function> | T;

export type ProviderInitFunction = (socket: SocketIO.Socket, token: string) => Promise<void>;

export type AcceptJobFunction = (socket: SocketIO.Socket, jobId: string) => Promise<void>;

export type RejectJobFunction = (socket: SocketIO.Socket, jobId: string) => Promise<void>;

export type CancelJobFunction = (socket: SocketIO.Socket, jobId: string) => Promise<void>;

export type CompleteJobFunction = (socket: SocketIO.Socket, jobId: string, result: JobResult) => Promise<void>;

export type DispatchAPIQueryFunction = (data: APIQueryMessage) => Promise<QueryMessage>;

export type DispatchWebsiteQueryFunction = (data: WebsiteQueryMessage) => Promise<QueryMessage>;

export type GetQueryFunction = (queryId: string) => Promise<QueryMessage>;

export type IONext = (err?: unknown) => void;
