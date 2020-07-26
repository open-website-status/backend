import { ObjectId } from 'mongodb';
import srs from 'secure-random-string';
import SocketIO, { Socket } from 'socket.io';
import Database from '../database';
import { Provider } from '../database/types';
import FirebaseManager from '../firebase-manager';
import SocketManager from '../socket-manager';
import ConsoleManager from '../socket-manager/console-manager';
import verifyReCaptcha from '../utils/recaptcha';
import { ConsoleConnection, CreateProviderMessage, ProviderMessage } from './types';

export default class Console {
  private socketManager: SocketManager;

  private database: Database;

  private consoleManager: ConsoleManager;

  private consoleConnections = new Array<ConsoleConnection>();

  public constructor(socketManager: SocketManager, database: Database) {
    this.socketManager = socketManager;
    this.database = database;

    this.consoleManager = new ConsoleManager(
      socketManager,
      (socket, token) => this.initUser(socket, token),
      (socket, data) => this.createProvider(socket, data),
      (socket, id, name) => this.renameProvider(socket, id, name),
      ((socket, id) => this.resetProviderToken(socket, id)),
    );

    this.consoleManager.onDisconnect((socket) => this.onDisconnect(socket));
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

    this.consoleConnections.push({
      socket,
      firebaseUid: uid,
      userId: user._id.toHexString(),
    });

    await this.sendProviders(user._id, [socket]);
  }

  private async sendProviders(userId: ObjectId, sockets: SocketIO.Socket[]): Promise<void> {
    const providers = await this.database.findProvidersByUserId(userId);
    const messageProviders: ProviderMessage[] = providers.map((provider) => ({
      id: provider._id.toHexString(),
      name: provider.name,
      token: provider.token,
    }));
    ConsoleManager.sendProviderList(sockets, messageProviders);
  }

  private onDisconnect(socket: Socket): void {
    this.consoleConnections = this.consoleConnections.filter((item) => item.socket.id !== socket.id);
  }

  private async createProvider(socket: SocketIO.Socket, data: CreateProviderMessage): Promise<ProviderMessage> {
    const connection = this.consoleConnections.find(((e) => e.socket.id === socket.id));
    if (connection === undefined) throw new Error('No connection of this socket');

    const captchaValid = await verifyReCaptcha(data.reCaptchaResponse);
    if (!captchaValid) throw new Error('Captcha verification failed');

    const userId = Database.getObjectIdFromHexString(connection.userId);

    const provider: Provider = {
      _id: Database.generateObjectId(),
      token: Console.generateToken(),
      name: data.name,
      userId,
    };
    await this.database.createProvider(provider);
    const providers = await this.database.findProvidersByUserId(userId);

    ConsoleManager.sendProviderList(
      this.consoleConnections
        .filter(((e) => e.userId === connection.userId))
        .map((e) => e.socket),
      providers.map((e) => ({
        id: e._id.toHexString(),
        name: e.name,
        token: e.token,
      })),
    );

    return {
      id: provider._id.toHexString(),
      token: provider.token,
      name: provider.name,
    };
  }

  private async renameProvider(socket: SocketIO.Socket, id: string, name: string): Promise<ProviderMessage> {
    const connection = this.consoleConnections.find(((e) => e.socket.id === socket.id));
    if (connection === undefined) throw new Error('No connection of this socket');

    const provider = await this.database.findProviderById(Database.getObjectIdFromHexString(id));
    if (provider === null) throw new Error('Provider not found');
    if (provider.userId.toHexString() !== connection.userId) throw new Error('User is not the owner of this provider');

    const newProvider: Provider = {
      ...provider,
      name,
    };

    await this.database.replaceProvider(newProvider);
    const providers = await this.database.findProvidersByUserId(provider.userId);

    ConsoleManager.sendProviderList(
      this.consoleConnections
        .filter(((e) => e.userId === connection.userId))
        .map((e) => e.socket),
      providers.map((e) => ({
        id: e._id.toHexString(),
        name: e.name,
        token: e.token,
      })),
    );

    return {
      id: newProvider._id.toHexString(),
      token: newProvider.token,
      name: newProvider.name,
    };
  }

  private async resetProviderToken(socket: SocketIO.Socket, id: string): Promise<ProviderMessage> {
    const connection = this.consoleConnections.find(((e) => e.socket.id === socket.id));
    if (connection === undefined) throw new Error('No connection of this socket');

    const provider = await this.database.findProviderById(Database.getObjectIdFromHexString(id));
    if (provider === null) throw new Error('Provider not found');
    if (provider.userId.toHexString() !== connection.userId) throw new Error('User is not the owner of this provider');

    const newProvider: Provider = {
      ...provider,
      token: Console.generateToken(),
    };

    await this.database.replaceProvider(newProvider);
    const providers = await this.database.findProvidersByUserId(provider.userId);

    ConsoleManager.sendProviderList(
      this.consoleConnections
        .filter(((e) => e.userId === connection.userId))
        .map((e) => e.socket),
      providers.map((e) => ({
        id: e._id.toHexString(),
        name: e.name,
        token: e.token,
      })),
    );

    return {
      id: newProvider._id.toHexString(),
      token: newProvider.token,
      name: newProvider.name,
    };
  }

  private static generateToken(): string {
    srs(((error, result) => {
      if (error === null) return;
      console.log(result);
    }));

    return srs({
      alphanumeric: true,
      length: 32,
    });
  }
}
