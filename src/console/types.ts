import * as t from 'io-ts';
import SocketIO from 'socket.io';

export type InitUserFunction = (socket: SocketIO.Socket, token: string) => Promise<void>;

export type CreateProviderFunction = (socket: SocketIO.Socket, data: CreateProviderMessage) => Promise<ProviderMessage>;

export type RenameProviderFunction = (socket: SocketIO.Socket, id: string, name: string) => Promise<ProviderMessage>;

export type ResetProviderTokenFunction = (socket: SocketIO.Socket, id: string) => Promise<ProviderMessage>;

export interface ConsoleConnection {
  socket: SocketIO.Socket,
  firebaseUid: string,
  userId: string,
}

export interface ProviderMessage {
  id: string;
  name: string;
  token: string;
}

export interface ProviderListMessage {
  data: ProviderMessage[];
}

export const CreateProviderMessage = t.type({
  reCaptchaResponse: t.string,
  name: t.string,
});

export type CreateProviderMessage = t.TypeOf<typeof CreateProviderMessage>;

export const RenameProviderMessage = t.type({
  id: t.string,
  name: t.string,
});

export const ResetProviderTokenMessage = t.type({
  id: t.string,
});
