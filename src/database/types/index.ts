import { ObjectId } from 'mongodb';

export interface Provider {
  _id: ObjectId;
  userId: ObjectId;
  creationTimestamp: Date;
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
  /**
   * pathname: For example: "/doodles/", "/"
   */
  pathname: string;
  port: number | null;
  /**
   * search query: For example: "?v=dQw4w9WgXcQ", ""
   */
  search: string;
}

export interface APIClient {
  _id: ObjectId;
  userId: ObjectId;
  creationTimestamp: Date;
  token: string;
  name: string;
}

export interface User {
  _id: ObjectId;
  firebaseUid: string;
}

export * from './jobs';
