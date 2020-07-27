import { JobResult } from '../../database/types';

export interface BaseJobMessage {
  id: string;
  queryId: string;
  jobState: string;
  dispatchTimestamp: string;
  countryCode: string,
  regionCode: string,
  ispName: string,
}

export interface DispatchedJobMessage extends BaseJobMessage {
  jobState: 'dispatched';
}

export interface AcceptedJobMessage extends BaseJobMessage {
  jobState: 'accepted';
  acceptTimestamp: string;
}

export interface RejectedJobMessage extends BaseJobMessage {
  jobState: 'rejected';
  rejectTimestamp: string;
}

export interface CanceledJobMessage extends BaseJobMessage {
  jobState: 'canceled';
  acceptTimestamp: string;
  cancelTimestamp: string;
}

export interface CompletedJobMessage extends BaseJobMessage {
  jobState: 'completed';
  acceptTimestamp: string;
  completeTimestamp: string;
  result: JobResult;
}

export type JobMessage = DispatchedJobMessage | AcceptedJobMessage | RejectedJobMessage | CanceledJobMessage | CompletedJobMessage;

export interface JobDeleteMessage {
  jobId: string;
  queryId: string;
}

export interface JobListMessage {
  queryId: string;
  jobs: JobMessage[];
}
