import { ObjectId } from 'mongodb';
import srs from 'secure-random-string';
import SocketIO, { Socket } from 'socket.io';
import Database from '../database';
import { APIClient, Provider } from '../database/types';
import FirebaseManager from '../firebase-manager';
import SocketManager from '../socket-manager';
import ConsoleManager from '../socket-manager/console-manager';
import verifyReCaptcha from '../utils/recaptcha';
import {
  APIClientMessage,
  ConsoleConnection,
  CreateAPIClientMessage,
  CreateProviderMessage,
  ProviderMessage,
} from './types';

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
      (socket, data) => this.createAPIClient(socket, data),
      (socket, id, name) => this.renameAPIClient(socket, id, name),
      ((socket, id) => this.resetAPIClientToken(socket, id)),
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
    await this.sendAPIClients(user._id, [socket]);
  }

  private async sendProviders(userId: ObjectId, sockets?: SocketIO.Socket[]): Promise<void> {
    const providers = await this.database.findProvidersByUserId(userId);
    const messageProviders: ProviderMessage[] = providers.map((provider) => ({
      id: provider._id.toHexString(),
      name: provider.name,
      token: provider.token,
      creationTimestamp: provider.creationTimestamp.toISOString(),
    }));
    const resolvedSockets = sockets ?? this.consoleConnections
      .filter(((e) => e.userId === userId.toHexString()))
      .map((e) => e.socket);
    ConsoleManager.sendProviderList(resolvedSockets, messageProviders);
  }

  private async sendAPIClients(userId: ObjectId, sockets?: SocketIO.Socket[]): Promise<void> {
    const apiClients = await this.database.findAPIClientByUserId(userId);
    const messageAPIClients: APIClientMessage[] = apiClients.map((apiClient) => ({
      id: apiClient._id.toHexString(),
      name: apiClient.name,
      token: apiClient.token,
      creationTimestamp: apiClient.creationTimestamp.toISOString(),
    }));
    const resolvedSockets = sockets ?? this.consoleConnections
      .filter(((e) => e.userId === userId.toHexString()))
      .map((e) => e.socket);
    ConsoleManager.sendAPIClientList(resolvedSockets, messageAPIClients);
  }

  private requireConnection(socketId: string): ConsoleConnection {
    const connection = this.consoleConnections.find(((e) => e.socket.id === socketId));
    if (connection === undefined) throw new Error('No connection of this socket');
    return connection;
  }

  private async requireProvider(id: string, userId: string): Promise<Provider> {
    const provider = await this.database.findProviderById(Database.getObjectIdFromHexString(id));
    if (provider === null) throw new Error('Provider not found');
    if (provider.userId.toHexString() !== userId) throw new Error('User is not the owner of this provider');
    return provider;
  }

  private async requireAPIClient(id: string, userId: string): Promise<APIClient> {
    const apiClient = await this.database.findAPIClientById(Database.getObjectIdFromHexString(id));
    if (apiClient === null) throw new Error('API client not found');
    if (apiClient.userId.toHexString() !== userId) throw new Error('User is not the owner of this API client');
    return apiClient;
  }

  private onDisconnect(socket: Socket): void {
    this.consoleConnections = this.consoleConnections.filter((item) => item.socket.id !== socket.id);
  }

  private async createProvider(socket: SocketIO.Socket, data: CreateProviderMessage): Promise<ProviderMessage> {
    const connection = this.requireConnection(socket.id);

    const secret = process.env.RECAPTCHA_SECRET_CONSOLE;
    if (secret === undefined) {
      throw new Error('Environment variable RECAPTCHA_SECRET_CONSOLE not provided');
    }
    const captchaValid = await verifyReCaptcha(data.reCaptchaResponse, secret);
    if (!captchaValid) throw new Error('Captcha verification failed');

    const userId = Database.getObjectIdFromHexString(connection.userId);

    const provider: Provider = {
      _id: Database.generateObjectId(),
      token: Console.generateToken(),
      creationTimestamp: new Date(),
      name: data.name,
      userId,
    };
    await this.database.createProvider(provider);
    await this.sendProviders(userId);

    return {
      id: provider._id.toHexString(),
      token: provider.token,
      name: provider.name,
      creationTimestamp: provider.creationTimestamp.toISOString(),
    };
  }

  private async renameProvider(socket: SocketIO.Socket, id: string, name: string): Promise<ProviderMessage> {
    const connection = this.requireConnection(socket.id);
    const provider = await this.requireProvider(id, connection.userId);

    const newProvider: Provider = {
      ...provider,
      name,
    };
    await this.database.replaceProvider(newProvider);
    await this.sendProviders(provider.userId);

    return {
      id: newProvider._id.toHexString(),
      token: newProvider.token,
      name: newProvider.name,
      creationTimestamp: newProvider.creationTimestamp.toISOString(),
    };
  }

  private async resetProviderToken(socket: SocketIO.Socket, id: string): Promise<ProviderMessage> {
    const connection = this.requireConnection(socket.id);
    const provider = await this.requireProvider(id, connection.userId);

    const newProvider: Provider = {
      ...provider,
      token: Console.generateToken(),
    };
    await this.database.replaceProvider(newProvider);
    await this.sendProviders(provider.userId);

    return {
      id: newProvider._id.toHexString(),
      token: newProvider.token,
      name: newProvider.name,
      creationTimestamp: newProvider.creationTimestamp.toISOString(),
    };
  }

  private async createAPIClient(socket: SocketIO.Socket, data: CreateAPIClientMessage): Promise<APIClientMessage> {
    const connection = this.requireConnection(socket.id);

    const secret = process.env.RECAPTCHA_SECRET_CONSOLE;
    if (secret === undefined) {
      throw new Error('Environment variable RECAPTCHA_SECRET_CONSOLE not provided');
    }
    const captchaValid = await verifyReCaptcha(data.reCaptchaResponse, secret);
    if (!captchaValid) throw new Error('Captcha verification failed');

    const userId = Database.getObjectIdFromHexString(connection.userId);

    const apiClient: APIClient = {
      _id: Database.generateObjectId(),
      creationTimestamp: new Date(),
      name: data.name,
      token: Console.generateToken(),
      userId,
    };
    await this.database.createAPIClient(apiClient);
    await this.sendAPIClients(userId);

    return {
      id: apiClient._id.toHexString(),
      token: apiClient.token,
      name: apiClient.name,
      creationTimestamp: apiClient.creationTimestamp.toISOString(),
    };
  }

  private async renameAPIClient(socket: SocketIO.Socket, id: string, name: string): Promise<APIClientMessage> {
    const connection = this.requireConnection(socket.id);
    const apiClient = await this.requireAPIClient(id, connection.userId);

    const newAPIClient: APIClient = {
      ...apiClient,
      name,
    };
    await this.database.replaceAPIClient(newAPIClient);
    await this.sendAPIClients(apiClient.userId);

    return {
      id: newAPIClient._id.toHexString(),
      token: newAPIClient.token,
      name: newAPIClient.name,
      creationTimestamp: newAPIClient.creationTimestamp.toISOString(),
    };
  }

  private async resetAPIClientToken(socket: SocketIO.Socket, id: string): Promise<APIClientMessage> {
    const connection = this.requireConnection(socket.id);
    const apiClient = await this.requireAPIClient(id, connection.userId);

    const newAPIClient: APIClient = {
      ...apiClient,
      token: Console.generateToken(),
    };
    await this.database.replaceAPIClient(newAPIClient);
    await this.sendAPIClients(newAPIClient.userId);

    return {
      id: newAPIClient._id.toHexString(),
      token: newAPIClient.token,
      name: newAPIClient.name,
      creationTimestamp: newAPIClient.creationTimestamp.toISOString(),
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
