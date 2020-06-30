import http from 'http';

export default class SocketManager {
  public readonly httpServer: http.Server;

  private readonly port: number;

  public constructor(port: number) {
    this.port = port;
    this.httpServer = http.createServer();

    this.httpServer.listen(this.port, () => {
      console.log(`Listening on port ${this.port}`);
    });
  }
}
