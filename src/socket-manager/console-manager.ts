import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import * as t from 'io-ts';
import SocketIO from 'socket.io';
import { EventEmitter } from 'typed-event-emitter';
import {
  APIClientListMessage,
  APIClientMessage,
  CreateAPIClientFunction,
  CreateAPIClientMessage,
  CreateProviderFunction,
  CreateProviderMessage,
  InitUserFunction,
  ProviderListMessage,
  ProviderMessage,
  RenameAPIClientFunction,
  RenameAPIClientMessage,
  RenameProviderFunction,
  RenameProviderMessage,
  ResetAPIClientTokenFunction,
  ResetAPIClientTokenMessage,
  ResetProviderTokenFunction,
  ResetProviderTokenMessage,
} from '../console/types';
import { IONext } from '../dispatcher/types';
import { safeDataCallback, safeEmptyCallback } from '../utils/safe-socket-callback';
import { AcknowledgementCallbackData, UnsafeCallback } from './types';
import SocketManager from './index';

export default class ConsoleManager extends EventEmitter {
  public onDisconnect = this.registerEvent<(socket: SocketIO.Socket) => unknown>();

  private socketManager: SocketManager;

  private socketServer: SocketIO.Server;

  private readonly initUser: InitUserFunction;

  private readonly createProvider: CreateProviderFunction;

  private readonly renameProvider: RenameProviderFunction;

  private readonly resetProviderToken: ResetProviderTokenFunction;

  private readonly createAPIClient: CreateAPIClientFunction;

  private readonly renameAPIClient: RenameAPIClientFunction;

  private readonly resetAPIClientToken: ResetAPIClientTokenFunction;

  public constructor(
    socketManager: SocketManager,
    initUserFunction: InitUserFunction,
    createProviderFunction: CreateProviderFunction,
    renameProviderFunction: RenameProviderFunction,
    resetProviderTokenFunction: ResetProviderTokenFunction,
    createAPIClientFunction: CreateAPIClientFunction,
    renameAPIClientFunction: RenameAPIClientFunction,
    resetAPIClientTokenFunction: ResetAPIClientTokenFunction,
  ) {
    super();

    this.initUser = initUserFunction;
    this.createProvider = createProviderFunction;
    this.renameProvider = renameProviderFunction;
    this.resetProviderToken = resetProviderTokenFunction;
    this.createAPIClient = createAPIClientFunction;
    this.renameAPIClient = renameAPIClientFunction;
    this.resetAPIClientToken = resetAPIClientTokenFunction;

    this.socketManager = socketManager;

    this.socketServer = SocketIO(socketManager.httpServer, {
      path: '/console-socket',
    });

    this.socketServer.use(
      (socket: SocketIO.Socket, next: IONext) => this.initMiddleware(socket, next),
    );

    this.socketServer.on('connection', (socket) => {
      console.log('Console connection', socket.id);

      socket.on('create-provider', (data: unknown, callback: UnsafeCallback<AcknowledgementCallbackData<ProviderMessage>>) => {
        pipe(CreateProviderMessage.decode(data), fold(
          () => safeEmptyCallback(callback, 'Request does not match schema'),
          async (parsedData) => {
            try {
              const providerMessage = await this.createProvider(socket, parsedData);
              safeDataCallback(callback, null, providerMessage);
            } catch (error) {
              console.error(error);
              safeDataCallback(callback, error instanceof Error ? error.message : 'Failed to create provider', null);
            }
          },
        ));
      });

      socket.on('rename-provider', (data: unknown, callback: UnsafeCallback<AcknowledgementCallbackData<ProviderMessage>>) => {
        pipe(RenameProviderMessage.decode(data), fold(
          () => safeEmptyCallback(callback, 'Request does not match schema'),
          async (parsedData) => {
            try {
              const providerMessage = await this.renameProvider(socket, parsedData.id, parsedData.name);
              safeDataCallback(callback, null, providerMessage);
            } catch (error) {
              console.error(error);
              safeDataCallback(callback, error instanceof Error ? error.message : 'Failed to rename provider', null);
            }
          },
        ));
      });

      socket.on('reset-provider-token', (data: unknown, callback: UnsafeCallback<AcknowledgementCallbackData<ProviderMessage>>) => {
        pipe(ResetProviderTokenMessage.decode(data), fold(
          () => safeEmptyCallback(callback, 'Request does not match schema'),
          async (parsedData) => {
            try {
              const providerMessage = await this.resetProviderToken(socket, parsedData.id);
              safeDataCallback(callback, null, providerMessage);
            } catch (error) {
              console.error(error);
              safeDataCallback(callback, error instanceof Error ? error.message : 'Failed to reset provider token', null);
            }
          },
        ));
      });

      socket.on('create-api-client', (data: unknown, callback: UnsafeCallback<AcknowledgementCallbackData<APIClientMessage>>) => {
        pipe(CreateAPIClientMessage.decode(data), fold(
          () => safeEmptyCallback(callback, 'Request does not match schema'),
          async (parsedData) => {
            try {
              const apiClientMessage = await this.createAPIClient(socket, parsedData);
              safeDataCallback(callback, null, apiClientMessage);
            } catch (error) {
              console.error(error);
              safeDataCallback(callback, error instanceof Error ? error.message : 'Failed to create API client', null);
            }
          },
        ));
      });

      socket.on('rename-api-client', (data: unknown, callback: UnsafeCallback<AcknowledgementCallbackData<APIClientMessage>>) => {
        pipe(RenameAPIClientMessage.decode(data), fold(
          () => safeEmptyCallback(callback, 'Request does not match schema'),
          async (parsedData) => {
            try {
              const apiClientMessage = await this.renameAPIClient(socket, parsedData.id, parsedData.name);
              safeDataCallback(callback, null, apiClientMessage);
            } catch (error) {
              console.error(error);
              safeDataCallback(callback, error instanceof Error ? error.message : 'Failed to rename API client', null);
            }
          },
        ));
      });

      socket.on('reset-api-client-token', (data: unknown, callback: UnsafeCallback<AcknowledgementCallbackData<APIClientMessage>>) => {
        pipe(ResetAPIClientTokenMessage.decode(data), fold(
          () => safeEmptyCallback(callback, 'Request does not match schema'),
          async (parsedData) => {
            try {
              const apiClientMessage = await this.resetAPIClientToken(socket, parsedData.id);
              safeDataCallback(callback, null, apiClientMessage);
            } catch (error) {
              console.error(error);
              safeDataCallback(callback, error instanceof Error ? error.message : 'Failed to reset API client token', null);
            }
          },
        ));
      });

      socket.on('disconnect', () => {
        this.emit(this.onDisconnect, socket);
      });
    });
  }

  private initMiddleware(socket: SocketIO.Socket, next: IONext): void {
    const HandshakeQuery = t.type({
      token: t.string,
    });

    pipe(HandshakeQuery.decode(socket.handshake.query), fold(() => {
      next(new Error('Query params does not match schema'));
    }, async (handshakeQuery) => {
      try {
        await this.initUser(socket, handshakeQuery.token);
        next();
      } catch (error) {
        next(error);
      }
    }));
  }

  public static sendProviderList(sockets: SocketIO.Socket[], providers: ProviderMessage[]): void {
    const message: ProviderListMessage = {
      data: providers,
    };
    sockets.forEach((socket) => {
      socket.emit('provider-list', message);
    });
  }

  public static sendAPIClientList(sockets: SocketIO.Socket[], apiClients: APIClientMessage[]): void {
    const message: APIClientListMessage = {
      data: apiClients,
    };
    sockets.forEach((socket) => {
      socket.emit('api-client-list', message);
    });
  }
}
