import {
  AcceptedJob,
  CanceledJob,
  CompletedJob,
  DispatchedJob,
  RejectedJob,
} from '../../database/types';

export interface BaseJobMessage {
  id: string;
  queryId: string;
  jobState: string;
  dispatchTimestamp: Date;
  countryCode: string,
  regionCode: string,
  ispName: string,
}

export type JobCreateAndChangeMessage = BaseJobMessage & (DispatchedJob | AcceptedJob | RejectedJob | CanceledJob | CompletedJob);

export interface JobDeleteMessage {
  id: string;
  queryId: string;
}
