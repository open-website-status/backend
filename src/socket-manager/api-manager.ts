import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import SocketIO from 'socket.io';
import { Job } from '../database/types';
import {
  APIQueryMessage, BaseJobMessage,
  DispatchAPIQueryFunction,
  DispatchWebsiteQueryFunction,
  GetQueryFunction,
  GetQueryMessage,
  JobCreateAndChangeMessage,
  JobDeleteMessage,
  QueryMessage,
  WebsiteQueryMessage,
} from '../dispatcher/types';
import { safeDataCallback } from '../utils/safe-socket-callback';
import { AcknowledgementCallbackData, UnsafeCallback } from './types';
import SocketManager from './index';

export default class APIManager {
  public readonly socketServer: SocketIO.Server;

  private readonly dispatchAPIQuery: DispatchAPIQueryFunction;

  private readonly dispatchWebsiteQuery: DispatchWebsiteQueryFunction;

  private readonly getQuery: GetQueryFunction;

  public constructor(
    socketManager: SocketManager,
    dispatchAPIQueryFunction: DispatchAPIQueryFunction,
    dispatchWebsiteQueryFunction: DispatchWebsiteQueryFunction,
    getQueryFunction: GetQueryFunction,
  ) {
    this.dispatchAPIQuery = dispatchAPIQueryFunction;
    this.dispatchWebsiteQuery = dispatchWebsiteQueryFunction;
    this.getQuery = getQueryFunction;

    this.socketServer = SocketIO(socketManager.httpServer, {
      path: '/api-socket',
    });

    this.socketServer.on('connection', (socket) => {
      socket.on(
        'query-website',
        (data, callback: AcknowledgementCallbackData<QueryMessage>) => this.onWebsiteQuery(socket, data, callback),
      );

      socket.on(
        'query',
        (data, callback: AcknowledgementCallbackData<QueryMessage>) => this.onAPIQuery(socket, data, callback),
      );

      socket.on(
        'get-query',
        (data, callback: AcknowledgementCallbackData<QueryMessage>) => this.onGetQuery(socket, data, callback),
      );
    });
  }

  private onWebsiteQuery(socket: SocketIO.Socket, data: unknown, callback: UnsafeCallback<AcknowledgementCallbackData<QueryMessage>>): void {
    pipe(WebsiteQueryMessage.decode(data), fold(
      () => safeDataCallback(callback, 'Request does not match schema', null),
      async (parsedData): Promise<void> => {
        try {
          const query = await this.dispatchWebsiteQuery(parsedData);
          if (parsedData.subscribe) {
            socket.join(`queries/${query.id}`);
          }
          safeDataCallback(callback, null, query);
        } catch (error) {
          console.error(error);
          safeDataCallback(callback, error instanceof Error ? error.message : 'Failed to dispatch query', null);
        }
      },
    ));
  }

  private onAPIQuery(socket: SocketIO.Socket, data: unknown, callback: UnsafeCallback<AcknowledgementCallbackData<QueryMessage>>): void {
    pipe(APIQueryMessage.decode(data), fold(
      () => safeDataCallback(callback, 'Request does not match schema', null),
      async (parsedData): Promise<void> => {
        try {
          const query = await this.dispatchAPIQuery(parsedData);
          if (parsedData.subscribe) {
            socket.join(`queries/${query.id}`);
          }
          safeDataCallback(callback, null, query);
        } catch (error) {
          console.error(error);
          safeDataCallback(callback, error instanceof Error ? error.message : 'Failed to dispatch query', null);
        }
      },
    ));
  }

  private onGetQuery(socket: SocketIO.Socket, data: unknown, callback: UnsafeCallback<AcknowledgementCallbackData<QueryMessage>>): void {
    pipe(GetQueryMessage.decode(data), fold(
      () => safeDataCallback(callback, 'Request does not match schema', null),
      async (parsedData): Promise<void> => {
        try {
          const query = await this.getQuery(parsedData.queryId);
          safeDataCallback(callback, null, query);
        } catch (error) {
          console.error(error);
          safeDataCallback(callback, error instanceof Error ? error.message : 'Failed to get query info', null);
        }
      },
    ));
  }

  private static getJobMessage(job: Job): JobCreateAndChangeMessage {
    const message: Omit<BaseJobMessage, 'jobState'> = {
      id: job._id.toHexString(),
      queryId: job.queryId.toHexString(),
      dispatchTimestamp: job.dispatchTimestamp,
      countryCode: job.countryCode,
      regionCode: job.regionCode,
      ispName: job.ispName,
    };

    if (job.jobState === 'accepted') {
      return {
        ...message,
        jobState: 'accepted',
        acceptTimestamp: job.acceptTimestamp,
      };
    }
    if (job.jobState === 'rejected') {
      return {
        ...message,
        jobState: 'rejected',
        rejectTimestamp: job.rejectTimestamp,
      };
    }
    if (job.jobState === 'canceled') {
      return {
        ...message,
        jobState: 'canceled',
        acceptTimestamp: job.acceptTimestamp,
        cancelTimestamp: job.cancelTimestamp,
      };
    }
    if (job.jobState === 'completed') {
      return {
        ...message,
        jobState: 'completed',
        acceptTimestamp: job.acceptTimestamp,
        completeTimestamp: job.completeTimestamp,
        result: job.result,
      };
    } // if (job.jobState === 'dispatched')
    return {
      ...message,
      jobState: job.jobState,
    };
  }

  public emitJobCreate(job: Job): void {
    const message = APIManager.getJobMessage(job);
    this.socketServer.in(`queries/${message.queryId}`).emit('job-create', message);
    this.socketServer.in(`jobs/${message.id}`).emit('job-create', message);
  }

  public emitJobModify(job: Job): void {
    const message = APIManager.getJobMessage(job);
    this.socketServer.in(`queries/${message.queryId}`).emit('job-modify', message);
    this.socketServer.in(`jobs/${message.id}`).emit('job-modify', message);
  }

  public emitJobDelete(jobId: string, queryId: string): void {
    const message: JobDeleteMessage = {
      id: jobId,
      queryId,
    };
    this.socketServer.in(`queries/${queryId}`).emit('job-delete', message);
    this.socketServer.in(`jobs/${jobId}`).emit('job-delete', message);
  }
}
