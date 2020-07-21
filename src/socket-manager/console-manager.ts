import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import * as t from 'io-ts';
import SocketIO from 'socket.io';
import { EventEmitter } from 'typed-event-emitter';
import { InitUserFunction } from '../console/types';
import { IONext } from '../dispatcher/types';
import SocketManager from './index';

export default class ConsoleManager extends EventEmitter {
  public onDisconnect = this.registerEvent<(socket: SocketIO.Socket) => unknown>();

  private socketManager: SocketManager;

  private socketServer: SocketIO.Server;

  private readonly initUser: InitUserFunction;

  public constructor(
    socketManager: SocketManager,
    initUserFunction: InitUserFunction,
  ) {
    super();

    this.initUser = initUserFunction;
    this.socketManager = socketManager;

    this.socketServer = SocketIO(socketManager.httpServer, {
      path: '/console-socket',
    });

    this.socketServer.use(
      (socket: SocketIO.Socket, next: IONext) => this.initMiddleware(socket, next),
    );

    this.socketServer.on('connection', (socket) => {
      console.log('Console connection', socket.id);

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
}
