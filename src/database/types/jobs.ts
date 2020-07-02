import * as t from 'io-ts';
import { ObjectId } from 'mongodb';

export interface BaseJob {
  _id: ObjectId;
  providerId: ObjectId;
  queryId: ObjectId;
  jobState: string;
  dispatchTimestamp: Date;
  countryCode: string,
  regionCode: string,
  ispName: string,
}

export interface DispatchedJob {
  jobState: 'dispatched';
}

export interface AcceptedJob {
  jobState: 'accepted';
  acceptTimestamp: Date;
}

export interface RejectedJob {
  jobState: 'rejected';
  rejectTimestamp: Date;
}

export interface CanceledJob {
  jobState: 'canceled';
  acceptTimestamp: Date;
  cancelTimestamp: Date;
}

export const JobResultSuccess = t.type({
  state: t.literal('success'),
  httpCode: t.number,
  /**
   * Execution time in milliseconds
   */
  executionTime: t.number,
});

export const JobResultTimeout = t.type({
  state: t.literal('timeout'),
  executionTime: t.number,
});

export const JobResultError = t.type({
  state: t.literal('error'),
  errorCode: t.string,
});

export const JobResult = t.union([JobResultSuccess, JobResultTimeout, JobResultError]);

export type JobResult = t.TypeOf<typeof JobResult>;

export interface CompletedJob {
  jobState: 'completed';
  acceptTimestamp: Date;
  completeTimestamp: Date;
  result: JobResult;
}

export type Job = BaseJob & (DispatchedJob | AcceptedJob | RejectedJob | CanceledJob | CompletedJob);
