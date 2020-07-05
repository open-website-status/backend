import { ObjectId } from 'mongodb';

export interface Provider {
  _id: ObjectId;
  userId: ObjectId;
  token: string;
  name: string;
}

export interface Query {
  _id: ObjectId;
  timestamp: Date;
  protocol: 'http:' | 'https:';
  /**
   * API client id with which the call was made: null is used for website access
   */
  apiClientId: ObjectId | null;
  /**
   * URL host: For example: "www.google.com", not "www.google.com:3000"
   */
  hostname: string;
  /** URL
   * pathname: For example: "/doodles/", "/"
   */
  pathname: string;
  port: number | undefined;
}

export interface APIClient {
  _id: ObjectId;
  userId: ObjectId;
  creationTimestamp: Date;
  token: string;
  hourlyLimit: null;
  name: string;
}

export * from './jobs';
