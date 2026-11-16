import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  {
    ignoreUndefinedProperties: true,
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);

export async function validateFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'appConfig', 'runtime'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Không thể kết nối tới Cloud Firestore. Vui lòng kiểm tra cấu hình Firebase.');
    }
  }
}
void validateFirestoreConnection();
