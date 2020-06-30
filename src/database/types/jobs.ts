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

export interface DispatchedJob extends BaseJob {
  jobState: 'dispatched';
}

export interface AcceptedJob extends BaseJob {
  jobState: 'accepted';
  acceptTimestamp: Date;
}

export interface RejectedJob extends BaseJob {
  jobState: 'rejected';
  rejectTimestamp: Date;
}

export interface CanceledJob extends BaseJob {
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

export interface CompletedJob extends BaseJob {
  jobState: 'completed';
  acceptTimestamp: Date;
  completeTimestamp: Date;
  result: JobResult;
}

export type Job = DispatchedJob | AcceptedJob | RejectedJob | CanceledJob | CompletedJob;
