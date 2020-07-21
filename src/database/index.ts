import { Db, MongoClient, ObjectId } from 'mongodb';
import {
  APIClient, Job, Provider, Query,
} from './types';

export default class Database {
  private readonly client: MongoClient;

  private db: Db | undefined;

  public constructor() {
    const url = process.env.MONGODB_URL;
    if (url === undefined) {
      throw new Error('Environment variable MONGODB_URL not provided');
    }
    this.client = new MongoClient(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }

  public async connect(): Promise<void> {
    await this.client.connect();
    const dbName = process.env.MONGODB_DB_NAME;
    this.db = this.client.db(dbName);
  }

  public getProviderByToken(token: string): Promise<Provider | null> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('providers').findOne({ token });
  }

  public getAPIClientByToken(token: string): Promise<APIClient | null> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('api-clients').findOne({ token });
  }

  public getQueryById(id: ObjectId): Promise<Query | null> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('queries').findOne({ _id: id });
  }

  public async createQuery(query: Query): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    await this.db.collection('queries').insertOne(query);
  }

  public getJobById(id: ObjectId): Promise<Job | null> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('jobs').findOne({ _id: id });
  }

  public findJobsByProviderId(id: ObjectId): Promise<Job[]> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('jobs').find<Job>({
      providerId: id,
    }).toArray();
  }

  public async createJob(job: Job): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    await this.db.collection('jobs').insertOne(job);
  }

  public async replaceJob(job: Job): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    await this.db.collection('jobs').replaceOne({
      _id: job._id,
    }, job);
  }

  public async removeJob(id: ObjectId): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    await this.db.collection('jobs').deleteOne({
      _id: id,
    });
  }

  public static getObjectIdFromHexString(string: string): ObjectId {
    return new ObjectId(string);
  }

  public static generateObjectId(): ObjectId {
    return new ObjectId();
  }
}
