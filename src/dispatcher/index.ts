import SocketIO from 'socket.io';
import Database from '../database';
import {
  BaseJob,
  DispatchedJob, Job, JobResult, Query,
} from '../database/types';
import SocketManager from '../socket-manager';
import APIManager from '../socket-manager/api-manager';
import ProviderManager from '../socket-manager/provider-manager';
import { getIPInfo } from '../utils/get-ip-info';
import verifyReCaptcha from '../utils/recaptcha';
import {
  APIQueryMessage, ProviderConnection, QueryMessage, WebsiteQueryMessage,
} from './types';

export default class Dispatcher {
  private readonly socketManager: SocketManager;

  public readonly providerManager: ProviderManager;

  private readonly apiManager: APIManager;

  private connectedProviders: ProviderConnection[] = [];

  private database: Database;

  public constructor(socketManager: SocketManager, database: Database) {
    this.socketManager = socketManager;
    this.database = database;

    this.providerManager = new ProviderManager(
      this.socketManager,
      (socket: SocketIO.Socket, token: string) => this.initProvider(socket, token),
      (socket, jobId) => this.acceptJob(socket, jobId),
      (socket, jobId) => this.rejectJob(socket, jobId),
      (socket, jobId) => this.cancelJob(socket, jobId),
      (socket, jobId, result) => this.completeJob(socket, jobId, result),
    );
    this.providerManager.onDisconnect((socket) => this.onDisconnect(socket));

    this.apiManager = new APIManager(
      this.socketManager,
      (data: APIQueryMessage) => this.dispatchAPIQuery(data),
      (data: WebsiteQueryMessage) => this.dispatchWebsiteQuery(data),
      (queryId: string) => this.getQuery(queryId),
    );
  }

  private async initProvider(socket: SocketIO.Socket, token: string): Promise<void> {
    if (this.connectedProviders.findIndex((item) => item.provider.token === token) !== -1) {
      throw new Error('This provider has already been initialized');
    }

    const provider = await this.database.findProviderByToken(token);
    if (provider === null) {
      throw new Error('Invalid token');
    }

    const ipInfo = await getIPInfo(socket.handshake.address);

    const providerConnection: ProviderConnection = {
      socket,
      provider,
      countryCode: ipInfo.countryCode,
      regionCode: ipInfo.regionCode,
      ispName: ipInfo.ispName,
    };

    this.connectedProviders.push(providerConnection);

    console.log(`Provider "${provider.name}" initialized`);
  }

  private async onDisconnect(socket: SocketIO.Socket): Promise<void> {
    const providerConnection = this.connectedProviders.find((item) => item.socket.id === socket.id);
    this.connectedProviders = this.connectedProviders.filter((item) => item.socket.id !== socket.id);
    if (providerConnection !== undefined) {
      try {
        const jobs = await this.database.findJobsByProviderId(providerConnection.provider._id);
        await Promise.all(jobs.map(async (job) => {
          if (job.jobState === 'accepted') {
            await this.modifyJob({
              _id: job._id,
              queryId: job.queryId,
              jobState: 'canceled',
              cancelTimestamp: new Date(),
              dispatchTimestamp: job.dispatchTimestamp,
              providerId: job.providerId,
              acceptTimestamp: job.acceptTimestamp,
              countryCode: job.countryCode,
              regionCode: job.regionCode,
              ispName: job.ispName,
            });
          } else if (job.jobState === 'dispatched') {
            await this.modifyJob({
              _id: job._id,
              queryId: job.queryId,
              jobState: 'rejected',
              rejectTimestamp: new Date(),
              dispatchTimestamp: job.dispatchTimestamp,
              providerId: job.providerId,
              countryCode: job.countryCode,
              regionCode: job.regionCode,
              ispName: job.ispName,
            });
          }
        }));
      } catch (error) {
        console.error(error);
      }
    }
  }

  private getProviderConnection(socket: SocketIO.Socket): ProviderConnection {
    const providerConnection = this.connectedProviders.find((item) => item.socket.id === socket.id);
    if (!providerConnection) {
      throw new Error('Provider not connected');
    }
    return providerConnection;
  }

  private async getAndVerifyJob(providerConnection: ProviderConnection, jobId: string): Promise<Job> {
    const job = await this.database.findJobById(Database.getObjectIdFromHexString(jobId));
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.providerId.toHexString() !== providerConnection.provider._id.toHexString()) {
      throw new Error('Job assigned to a different provider');
    }
    return job;
  }

  private async acceptJob(socket: SocketIO.Socket, jobId: string): Promise<void> {
    const providerConnection = this.getProviderConnection(socket);
    const job = await this.getAndVerifyJob(providerConnection, jobId);

    await this.modifyJob({
      _id: job._id,
      queryId: job.queryId,
      providerId: job.providerId,
      dispatchTimestamp: job.dispatchTimestamp,
      acceptTimestamp: new Date(),
      jobState: 'accepted',
      countryCode: job.countryCode,
      regionCode: job.regionCode,
      ispName: job.ispName,
    });
  }

  private async rejectJob(socket: SocketIO.Socket, jobId: string): Promise<void> {
    const providerConnection = this.getProviderConnection(socket);
    const job = await this.getAndVerifyJob(providerConnection, jobId);

    await this.modifyJob({
      _id: job._id,
      queryId: job.queryId,
      providerId: job.providerId,
      dispatchTimestamp: job.dispatchTimestamp,
      rejectTimestamp: new Date(),
      jobState: 'rejected',
      countryCode: job.countryCode,
      regionCode: job.regionCode,
      ispName: job.ispName,
    });
  }

  private async cancelJob(socket: SocketIO.Socket, jobId: string): Promise<void> {
    const providerConnection = this.getProviderConnection(socket);
    const job = await this.getAndVerifyJob(providerConnection, jobId);

    if (job.jobState !== 'accepted') {
      throw new Error('Job state is not accepted');
    }

    await this.modifyJob({
      _id: job._id,
      queryId: job.queryId,
      providerId: job.providerId,
      dispatchTimestamp: job.dispatchTimestamp,
      acceptTimestamp: job.acceptTimestamp,
      cancelTimestamp: new Date(),
      jobState: 'canceled',
      countryCode: job.countryCode,
      regionCode: job.regionCode,
      ispName: job.ispName,
    });
  }

  private async completeJob(socket: SocketIO.Socket, jobId: string, result: JobResult): Promise<void> {
    const providerConnection = this.getProviderConnection(socket);
    const job = await this.getAndVerifyJob(providerConnection, jobId);

    if (job.jobState !== 'accepted' && job.jobState !== 'canceled') {
      throw new Error('Job state is not accepted or canceled');
    }

    await this.modifyJob({
      _id: job._id,
      queryId: job.queryId,
      providerId: job.providerId,
      dispatchTimestamp: job.dispatchTimestamp,
      acceptTimestamp: job.acceptTimestamp,
      completeTimestamp: new Date(),
      result,
      jobState: 'completed',
      countryCode: job.countryCode,
      regionCode: job.regionCode,
      ispName: job.ispName,
    });
  }

  // TODO: Implement throttling
  private async dispatchAPIQuery(data: APIQueryMessage): Promise<QueryMessage> {
    const apiClient = await this.database.findAPIClientByToken(data.token);
    if (apiClient === null) {
      throw new Error('Invalid token');
    }

    return this.dispatchQuery({
      _id: Database.generateObjectId(),
      hostname: data.hostname,
      pathname: data.pathname,
      port: data.port,
      search: data.search,
      protocol: data.protocol,
      timestamp: new Date(),
      apiClientId: apiClient._id,
    });
  }

  private async dispatchWebsiteQuery(data: WebsiteQueryMessage): Promise<QueryMessage> {
    const captchaValid = await verifyReCaptcha(data.reCaptchaResponse);

    if (!captchaValid) throw new Error('Captcha verification failed');

    return this.dispatchQuery({
      _id: Database.generateObjectId(),
      hostname: data.hostname,
      pathname: data.pathname,
      port: data.port,
      protocol: data.protocol,
      search: data.search,
      timestamp: new Date(),
      apiClientId: null,
    });
  }

  private async dispatchQuery(query: Query): Promise<QueryMessage> {
    await this.database.createQuery(query);

    await Promise.all(this.connectedProviders.map(async (providerConnection): Promise<void> => {
      const jobId = Database.generateObjectId();
      const job: BaseJob & DispatchedJob = {
        _id: jobId,
        providerId: providerConnection.provider._id,
        jobState: 'dispatched',
        queryId: query._id,
        dispatchTimestamp: new Date(),
        countryCode: providerConnection.countryCode,
        regionCode: providerConnection.regionCode,
        ispName: providerConnection.ispName,
      };

      await this.createJob(job);
      ProviderManager.dispatchJob(providerConnection.socket, query, jobId.toHexString());
    }));

    return {
      id: query._id.toHexString(),
      hostname: query.hostname,
      pathname: query.pathname,
      port: query.port,
      protocol: query.protocol,
      timestamp: query.timestamp,
      search: query.search,
    };
  }

  private async getQuery(queryId: string): Promise<QueryMessage> {
    const query = await this.database.findQueryById(Database.getObjectIdFromHexString(queryId));
    if (query === null) throw new Error('Query not found');
    return {
      id: queryId,
      timestamp: query.timestamp,
      protocol: query.protocol,
      pathname: query.pathname,
      hostname: query.hostname,
      port: query.port,
      search: query.search,
    };
  }

  private async createJob(job: Job): Promise<void> {
    await this.database.createJob(job);
    this.apiManager.emitJobCreate(job);
  }

  private async modifyJob(job: Job): Promise<void> {
    await this.database.replaceJob(job);
    this.apiManager.emitJobModify(job);
  }

  private async removeJob(jobId: string, queryId: string): Promise<void> {
    await this.database.removeJob(Database.getObjectIdFromHexString(jobId));
    this.apiManager.emitJobDelete(jobId, queryId);
  }
}
