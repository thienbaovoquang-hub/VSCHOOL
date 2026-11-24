import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { createSingleFlightPopupRunner } from '../utils/googleAuthHelpers';

const popupRunner = createSingleFlightPopupRunner();

export function isGooglePopupInFlight(): boolean {
  return popupRunner.isInFlight();
}

export async function signInWithGoogleAccount(): Promise<{
  accessToken: string | null;
}> {
  return popupRunner.run('signin', async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({
      prompt: 'select_account',
    });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return {
      accessToken: credential?.accessToken || null,
    };
  });
}

export async function signOutGoogleAccount(): Promise<void> {
  await signOut(auth);
}
