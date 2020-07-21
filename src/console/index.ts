import SocketIO, { Socket } from 'socket.io';
import Database from '../database';
import FirebaseManager from '../firebase-manager';
import SocketManager from '../socket-manager';
import ConsoleManager from '../socket-manager/console-manager';

export default class Console {
  private socketManager: SocketManager;

  private database: Database;

  private consoleManager: ConsoleManager;

  private socketUserIds = new Map<string, string>();

  public constructor(socketManager: SocketManager, database: Database) {
    this.socketManager = socketManager;
    this.database = database;

    this.consoleManager = new ConsoleManager(
      socketManager,
      (socket, token) => this.initUser(socket, token),
    );

    this.consoleManager.on('disconnect', (socket) => this.onDisconnect(socket));
  }

  private async initUser(socket: SocketIO.Socket, token: string): Promise<void> {
    const { uid } = await FirebaseManager.verifyIdToken(token);
    let user = await this.database.findUserByFirebaseUid(uid);
    if (user === null) {
      user = {
        _id: Database.generateObjectId(),
        firebaseUid: uid,
      };
      await this.database.createUser(user);
    }
    this.socketUserIds.set(socket.id, user._id.toHexString());
  }

  private onDisconnect(socket: Socket): void {
    this.socketUserIds.delete(socket.id);
  }
}
