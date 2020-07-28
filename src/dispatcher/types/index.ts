import * as t from 'io-ts';
import { ObjectId } from 'mongodb';
import SocketIO from 'socket.io';
import { Job, JobResult, Provider } from '../../database/types';

export * from './jobs';

export interface QueryMessage {
  id: string;
  timestamp: Date;
  protocol: 'http:' | 'https:';
  hostname: string;
  port: number | undefined;
  pathname: string;
  search: string;
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
  protocol: t.union([t.literal('http:'), t.literal('https:')]),
  hostname: t.string,
  port: t.union([t.number, t.undefined]),
  pathname: t.string,
  search: t.string,
  subscribe: t.boolean,
});

export type APIQueryMessage = t.TypeOf<typeof APIQueryMessage>;

export const WebsiteQueryMessage = t.type({
  protocol: t.union([t.literal('http:'), t.literal('https:')]),
  hostname: t.string,
  port: t.union([t.number, t.undefined]),
  pathname: t.string,
  search: t.string,
  reCaptchaResponse: t.string,
  subscribe: t.boolean,
});

export type WebsiteQueryMessage = t.TypeOf<typeof WebsiteQueryMessage>;

export const GetQueryMessage = t.type({
  queryId: t.string,
  subscribe: t.boolean,
});

export type GetQueryMessage = t.TypeOf<typeof GetQueryMessage>;

export interface ProviderJobMessage {
  jobId: string,
  queryId: string,
  protocol: 'http:' | 'https:',
  hostname: string,
  port: number | undefined,
  pathname: string,
  search: string,
}

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

export interface ConnectedProvidersCountMessage {
  count: number,
}

export type ProviderInitFunction = (socket: SocketIO.Socket, token: string) => Promise<void>;

export type AcceptJobFunction = (socket: SocketIO.Socket, jobId: string) => Promise<void>;

export type RejectJobFunction = (socket: SocketIO.Socket, jobId: string) => Promise<void>;

export type CancelJobFunction = (socket: SocketIO.Socket, jobId: string) => Promise<void>;

export type CompleteJobFunction = (socket: SocketIO.Socket, jobId: string, result: JobResult) => Promise<void>;

export type DispatchAPIQueryFunction = (data: APIQueryMessage, id: ObjectId) => Promise<QueryMessage>;

export type DispatchWebsiteQueryFunction = (data: WebsiteQueryMessage, id: ObjectId) => Promise<QueryMessage>;

export type GetQueryFunction = (queryId: string) => Promise<QueryMessage>;

export type GetConnectedProvidersCountFunction = () => number;

export type GetJobsFunction = (queryId: string) => Promise<Job[]>;

export type IONext = (err?: unknown) => void;
