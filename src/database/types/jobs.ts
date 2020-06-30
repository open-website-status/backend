import * as t from 'io-ts';
import { ObjectId } from 'mongodb';

export interface DispatchedJob {
  _id: ObjectId;
  providerId: ObjectId;
  queryId: ObjectId;
  jobState: 'dispatched';
  dispatchTimestamp: Date;
}

export interface AcceptedJob {
  _id: ObjectId;
  providerId: ObjectId;
  queryId: ObjectId;
  jobState: 'accepted';
  dispatchTimestamp: Date;
  acceptTimestamp: Date;
}

export interface RejectedJob {
  _id: ObjectId;
  providerId: ObjectId;
  queryId: ObjectId;
  jobState: 'rejected';
  dispatchTimestamp: Date;
  rejectTimestamp: Date;
}

export interface CanceledJob {
  _id: ObjectId;
  providerId: ObjectId;
  queryId: ObjectId;
  jobState: 'canceled';
  dispatchTimestamp: Date;
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
  _id: ObjectId;
  providerId: ObjectId;
  queryId: ObjectId;
  jobState: 'completed';
  dispatchTimestamp: Date;
  acceptTimestamp: Date;
  completeTimestamp: Date;
  result: JobResult;
}

export type Job = DispatchedJob | AcceptedJob | RejectedJob | CanceledJob | CompletedJob;
