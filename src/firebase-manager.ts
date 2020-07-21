import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'open-website-status-9e70b',
  databaseURL: 'https://open-website-status-9e70b.firebaseio.com',
});

export interface TokenVerifyResult {
  uid: string;
}

export default class FirebaseManager {
  public static async verifyIdToken(idToken: string): Promise<TokenVerifyResult> {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
    };
  }
}
