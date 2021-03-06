import { Db, MongoClient, ObjectId } from 'mongodb';
import {
  APIClient, Job, Provider, Query, User,
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

  // Provider

  public findProviderByToken(token: string): Promise<Provider | null> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('providers').findOne({ token });
  }

  public findProviderById(id: ObjectId): Promise<Provider | null> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('providers').findOne({ _id: id });
  }

  public async findProvidersByUserId(userId: ObjectId): Promise<Provider[]> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('providers').find<Provider>({
      userId,
    }).toArray();
  }

  public async createProvider(provider: Provider): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    await this.db.collection('providers').insertOne(provider);
  }

  public async replaceProvider(provider: Provider): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    await this.db.collection('providers').replaceOne({
      _id: provider._id,
    }, provider);
  }

  // API client

  public findAPIClientByToken(token: string): Promise<APIClient | null> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('api-clients').findOne({ token });
  }

  public findAPIClientById(id: ObjectId): Promise<APIClient | null> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('api-clients').findOne({ _id: id });
  }

  public findAPIClientByUserId(userId: ObjectId): Promise<APIClient[]> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('api-clients').find<APIClient>({
      userId,
    }).toArray();
  }

  public async createAPIClient(apiClient: APIClient): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    await this.db.collection('api-clients').insertOne(apiClient);
  }

  public async replaceAPIClient(apiClient: APIClient): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    await this.db.collection('api-clients').replaceOne({
      _id: apiClient._id,
    }, apiClient);
  }

  // Query

  public findQueryById(id: ObjectId): Promise<Query | null> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('queries').findOne({ _id: id });
  }

  public findQueriesByHostname(hostname: string): Promise<Query[]> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection<Query>('queries').find({
      hostname,
    }).toArray();
  }

  public async createQuery(query: Query): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    await this.db.collection('queries').insertOne(query);
  }

  // Job

  public findJobById(id: ObjectId): Promise<Job | null> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('jobs').findOne({ _id: id });
  }

  public findJobsByProviderId(id: ObjectId): Promise<Job[]> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('jobs').find<Job>({
      providerId: id,
    }).toArray();
  }

  public findJobsByQueryId(id: ObjectId): Promise<Job[]> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('jobs').find<Job>({
      queryId: id,
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

  // User

  public async findUserByFirebaseUid(uid: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection('users').findOne({ firebaseUid: uid });
  }

  public async createUser(user: User): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    await this.db.collection('users').insertOne(user);
  }

  // Utility methods

  public static getObjectIdFromHexString(string: string): ObjectId {
    return new ObjectId(string);
  }

  public static generateObjectId(): ObjectId {
    return new ObjectId();
  }
}
