import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import * as t from 'io-ts';
import SocketIO from 'socket.io';
import { Query } from '../database/types';
import {
  AcceptJobFunction, AcknowledgementCallbackEmpty,
  CancelJobFunction,
  CompleteJobFunction,
  IONext,
  ProviderInitFunction,
  ProviderJobAcceptMessage,
  ProviderJobCancelMessage,
  ProviderJobCompleteMessage, ProviderJobMessage,
  ProviderJobRejectMessage,
  RejectJobFunction, UnsafeCallback,
} from '../dispatcher/types';
import { Emitter } from '../utils/emitter';
import { safeEmptyCallback } from '../utils/safe-socket-callback';
import SocketManager from './index';

export default class ProviderManager extends Emitter<{
  disconnect: SocketIO.Socket,
}> {
  public readonly socketServer: SocketIO.Server;

  private readonly initProvider: ProviderInitFunction;

  private readonly acceptJob: AcceptJobFunction;

  private readonly rejectJob: RejectJobFunction;

  private readonly cancelJob: CancelJobFunction;

  private readonly completeJob: CompleteJobFunction;

  public constructor(
    socketManager: SocketManager,
    providerInitFunction: ProviderInitFunction,
    acceptJobFunction: AcceptJobFunction,
    rejectJobFunction: RejectJobFunction,
    cancelJobFunction: CancelJobFunction,
    completeJobFunction: CompleteJobFunction,
  ) {
    super();

    this.initProvider = providerInitFunction;
    this.acceptJob = acceptJobFunction;
    this.rejectJob = rejectJobFunction;
    this.cancelJob = cancelJobFunction;
    this.completeJob = completeJobFunction;

    this.socketServer = SocketIO(socketManager.httpServer, {
      path: '/provider-socket',
    });

    this.socketServer.use(
      (socket: SocketIO.Socket, next: IONext) => this.initMiddleware(socket, next),
    );

    this.socketServer.on('connection', (socket: SocketIO.Socket) => {
      console.log('a user connected');

      socket.on('disconnect', () => {
        this.emit('disconnect', socket);
      });

      socket.on('accept-job', (data: unknown, callback: UnsafeCallback<AcknowledgementCallbackEmpty>) => {
        pipe(ProviderJobAcceptMessage.decode(data), fold(
          () => safeEmptyCallback(callback, 'Request does not match schema'),
          async (parsedData) => {
            try {
              await this.acceptJob(socket, parsedData.jobId);
              safeEmptyCallback(callback, null);
            } catch (error) {
              console.error(error);
              safeEmptyCallback(callback, error instanceof Error ? error.message : 'Failed to accept job');
            }
          },
        ));
      });

      socket.on('reject-job', (data: unknown, callback: UnsafeCallback<AcknowledgementCallbackEmpty>) => {
        pipe(ProviderJobRejectMessage.decode(data), fold(
          () => safeEmptyCallback(callback, 'Request does not match schema'),
          async (parsedData) => {
            try {
              await this.rejectJob(socket, parsedData.jobId);
              safeEmptyCallback(callback, null);
            } catch (error) {
              console.error(error);
              safeEmptyCallback(callback, error instanceof Error ? error.message : 'Failed to reject job');
            }
          },
        ));
      });

      socket.on('cancel-job', (data: unknown, callback: UnsafeCallback<AcknowledgementCallbackEmpty>) => {
        pipe(ProviderJobCancelMessage.decode(data), fold(
          () => safeEmptyCallback(callback, 'Request does not match schema'),
          async (parsedData) => {
            try {
              await this.cancelJob(socket, parsedData.jobId);
              safeEmptyCallback(callback, null);
            } catch (error) {
              console.error(error);
              safeEmptyCallback(callback, error instanceof Error ? error.message : 'Failed to cancel job');
            }
          },
        ));
      });

      socket.on('complete-job', (data: unknown, callback: UnsafeCallback<AcknowledgementCallbackEmpty>) => {
        pipe(ProviderJobCompleteMessage.decode(data), fold(
          () => safeEmptyCallback(callback, 'Request does not match schema'),
          async (parsedData) => {
            try {
              await this.completeJob(socket, parsedData.jobId, parsedData.result);
              safeEmptyCallback(callback, null);
            } catch (error) {
              console.error(error);
              safeEmptyCallback(callback, error instanceof Error ? error.message : 'Failed to complete job');
            }
          },
        ));
      });
    });
  }

  public static dispatchJob(socket: SocketIO.Socket, query: Query, jobId: string): void {
    const message: ProviderJobMessage = {
      jobId,
      queryId: query._id.toHexString(),
      protocol: query.protocol,
      hostname: query.hostname,
      pathname: query.pathname,
      port: query.port,
      search: query.search,
    };
    socket.emit('dispatch-job', message);
  }

  private initMiddleware(socket: SocketIO.Socket, next: IONext): void {
    const HandshakeQuery = t.type({
      token: t.string,
    });

    pipe(HandshakeQuery.decode(socket.handshake.query), fold(() => {
      next(new Error('Query params does not match schema'));
    }, async (handshakeQuery) => {
      try {
        await this.initProvider(socket, handshakeQuery.token);
        next();
      } catch (error) {
        next(error);
      }
    }));
  }
}
