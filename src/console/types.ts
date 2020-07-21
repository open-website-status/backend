import SocketIO from 'socket.io';

export type InitUserFunction = (socket: SocketIO.Socket, token: string) => Promise<void>;
