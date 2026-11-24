import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './config';

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.info('Connected to Firestore successfully.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is offline or not reachable.');
    }
    return false;
  }
}
