import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import SocketIO from 'socket.io';
import {
  AcknowledgementCallbackData,
  APIQueryMessage,
  DispatchAPIQueryFunction,
  DispatchWebsiteQueryFunction, GetQueryFunction, GetQueryMessage,
  QueryMessage,
  UnsafeCallback,
  WebsiteQueryMessage,
} from '../dispatcher/types';
import { Emitter } from '../utils/emitter';
import { safeDataCallback } from '../utils/safe-socket-callback';
import SocketManager from './index';

export default class APIManager extends Emitter<never> {
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
    super();

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
}
