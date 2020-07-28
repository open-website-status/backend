import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import SocketIO from 'socket.io';
import Database from '../database';
import { Job } from '../database/types';
import {
  APIQueryMessage, BaseJobMessage,
  DispatchAPIQueryFunction,
  DispatchWebsiteQueryFunction,
  GetQueryFunction,
  GetQueryMessage,
  JobMessage,
  JobDeleteMessage, JobListMessage,
  QueryMessage,
  WebsiteQueryMessage, ConnectedProvidersCountMessage, GetConnectedProvidersCountFunction,
} from '../dispatcher/types';
import { safeDataCallback } from '../utils/safe-socket-callback';
import { AcknowledgementCallbackData, UnsafeCallback } from './types';
import SocketManager from './index';

export default class APIManager {
  public readonly socketServer: SocketIO.Server;

  private readonly dispatchAPIQuery: DispatchAPIQueryFunction;

  private readonly dispatchWebsiteQuery: DispatchWebsiteQueryFunction;

  private readonly getQuery: GetQueryFunction;

  private readonly getConnectedProvidersCount: GetConnectedProvidersCountFunction;

  public constructor(
    socketManager: SocketManager,
    dispatchAPIQueryFunction: DispatchAPIQueryFunction,
    dispatchWebsiteQueryFunction: DispatchWebsiteQueryFunction,
    getQueryFunction: GetQueryFunction,
    getConnectedProvidersCountFunction: GetConnectedProvidersCountFunction,
  ) {
    this.dispatchAPIQuery = dispatchAPIQueryFunction;
    this.dispatchWebsiteQuery = dispatchWebsiteQueryFunction;
    this.getQuery = getQueryFunction;
    this.getConnectedProvidersCount = getConnectedProvidersCountFunction;

    this.socketServer = SocketIO(socketManager.httpServer, {
      path: '/api-socket',
    });

    this.socketServer.on('connection', (socket) => {
      socket.on(
        'query-website',
        (data, callback: AcknowledgementCallbackData<QueryMessage>) => this.onWebsiteQuery(socket, data, callback),
      );

      socket.on(
        'query-api',
        (data, callback: AcknowledgementCallbackData<QueryMessage>) => this.onAPIQuery(socket, data, callback),
      );

      socket.on(
        'get-query',
        (data, callback: AcknowledgementCallbackData<QueryMessage>) => this.onGetQuery(socket, data, callback),
      );

      socket.emit('connected-providers-count', this.getConnectedProvidersCount());
    });
  }

  private onWebsiteQuery(socket: SocketIO.Socket, data: unknown, callback: UnsafeCallback<AcknowledgementCallbackData<QueryMessage>>): void {
    pipe(WebsiteQueryMessage.decode(data), fold(
      () => safeDataCallback(callback, 'Request does not match schema', null),
      async (parsedData): Promise<void> => {
        try {
          const id = Database.generateObjectId();
          if (parsedData.subscribe) {
            socket.join(`queries/${id.toHexString()}`);
          }
          const query = await this.dispatchWebsiteQuery(parsedData, id);
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
          const id = Database.generateObjectId();
          if (parsedData.subscribe) {
            socket.join(`queries/${id.toHexString()}`);
          }
          const query = await this.dispatchAPIQuery(parsedData, id);
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
          if (parsedData.subscribe) {
            socket.join(`query/${parsedData.queryId}`);
          }
          safeDataCallback(callback, null, query);
        } catch (error) {
          console.error(error);
          safeDataCallback(callback, error instanceof Error ? error.message : 'Failed to get query info', null);
        }
      },
    ));
  }

  private static getJobMessage(job: Job): JobMessage {
    const message: Omit<BaseJobMessage, 'jobState'> = {
      id: job._id.toHexString(),
      queryId: job.queryId.toHexString(),
      dispatchTimestamp: job.dispatchTimestamp.toISOString(),
      countryCode: job.countryCode,
      regionCode: job.regionCode,
      ispName: job.ispName,
    };

    if (job.jobState === 'accepted') {
      return {
        ...message,
        jobState: 'accepted',
        acceptTimestamp: job.acceptTimestamp.toISOString(),
      };
    }
    if (job.jobState === 'rejected') {
      return {
        ...message,
        jobState: 'rejected',
        rejectTimestamp: job.rejectTimestamp.toISOString(),
      };
    }
    if (job.jobState === 'canceled') {
      return {
        ...message,
        jobState: 'canceled',
        acceptTimestamp: job.acceptTimestamp.toISOString(),
        cancelTimestamp: job.cancelTimestamp.toISOString(),
      };
    }
    if (job.jobState === 'completed') {
      return {
        ...message,
        jobState: 'completed',
        acceptTimestamp: job.acceptTimestamp.toISOString(),
        completeTimestamp: job.completeTimestamp.toISOString(),
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
      jobId,
      queryId,
    };
    this.socketServer.in(`queries/${queryId}`).emit('job-delete', message);
    this.socketServer.in(`jobs/${jobId}`).emit('job-delete', message);
  }

  public emitJobList(jobs: Job[], queryId: string): void {
    const message: JobListMessage = {
      jobs: jobs.map((job) => APIManager.getJobMessage(job)),
      queryId,
    };
    this.socketServer.in(`queries/${queryId}`).emit('job-list', message);
  }

  public emitConnectedProvidersCount(count: number): void {
    const message: ConnectedProvidersCountMessage = {
      count,
    };

    this.socketServer.emit('connected-providers-count', message);
  }
}
