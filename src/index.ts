import dotenv from 'dotenv';
import Console from './console';
import Database from './database';
import Dispatcher from './dispatcher';
import SocketManager from './socket-manager';

dotenv.config();

async function main(): Promise<void> {
  const database = new Database();
  await database.connect();
  const socketPort = process.env.SOCKET_PORT === undefined ? 3000 : parseInt(process.env.SOCKET_PORT, 10);
  const socketManager = new SocketManager(socketPort);
  const dispatcher = new Dispatcher(socketManager, database);
  const console = new Console(socketManager, database);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(2);
  });
