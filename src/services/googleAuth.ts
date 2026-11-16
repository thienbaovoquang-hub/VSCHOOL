import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import type { GoogleWorkspaceAccount } from '../types';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/documents.readonly',
] as const;

let isSigningIn = false;
// STRICT SECURITY INVARIANT: OAuth access tokens MUST remain in-memory only (never localStorage/sessionStorage/Firestore)
let cachedAccessToken: string | null = null;
let cachedTokenAcquiredAt: number | null = null;
let cachedExpiresInSeconds = 3500;
let cachedGrantedScopes: string[] = [];
let delegateSessionId: string | null = null;
let lastSignedInUid: string | null = null;

type AuthListener = (account: GoogleWorkspaceAccount) => void;
const listeners = new Set<AuthListener>();

function buildWorkspaceAccountSnapshot(user: User | null): GoogleWorkspaceAccount {
  if (!user) {
    return {
      displayName: '',
      email: '',
      status: 'disconnected',
      grantedScopes: [],
      backgroundDelegated: false,
    };
  }
  const expired =
    Boolean(cachedAccessToken && cachedTokenAcquiredAt) &&
    Date.now() - (cachedTokenAcquiredAt || 0) > cachedExpiresInSeconds * 1000;

  return {
    uid: user.uid,
    displayName: user.displayName || user.email || 'Người dùng Google',
    email: user.email || '',
    photoUrl: user.photoURL || undefined,
    status: !cachedAccessToken ? 'expired' : expired ? 'expired' : 'connected',
    grantedScopes: cachedGrantedScopes,
    connectedAt: cachedTokenAcquiredAt
      ? new Date(cachedTokenAcquiredAt).toISOString()
      : undefined,
    expiresAt: cachedTokenAcquiredAt
      ? new Date(cachedTokenAcquiredAt + cachedExpiresInSeconds * 1000).toISOString()
      : undefined,
    backgroundDelegated: Boolean(delegateSessionId && cachedAccessToken && !expired),
  };
}

function notifyListeners() {
  const snapshot = buildWorkspaceAccountSnapshot(auth.currentUser);
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch {
      // Ignore subscriber errors
    }
  }
}

export function subscribeWorkspaceAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  listener(buildWorkspaceAccountSnapshot(auth.currentUser));
  return () => {
    listeners.delete(listener);
  };
}

let initializedUnsubscribe: Unsubscribe | null = null;

function clearInMemoryOAuthTokens() {
  cachedAccessToken = null;
  cachedTokenAcquiredAt = null;
  cachedGrantedScopes = [];
  delegateSessionId = null;
}

export function initGoogleWorkspaceAuth(): () => void {
  if (!initializedUnsubscribe) {
    lastSignedInUid = auth.currentUser?.uid || null;
    initializedUnsubscribe = onAuthStateChanged(auth, (user) => {
      const nextUid = user?.uid || null;
      const uidChanged = lastSignedInUid !== null && nextUid !== lastSignedInUid;
      if ((!user || uidChanged) && !isSigningIn) {
        clearInMemoryOAuthTokens();
      }
      lastSignedInUid = nextUid;
      notifyListeners();
    });
  }
  return initializedUnsubscribe;
}

export function getWorkspaceAccessToken(): string | null {
  if (!cachedAccessToken) return null;
  if (
    cachedTokenAcquiredAt &&
    Date.now() - cachedTokenAcquiredAt > cachedExpiresInSeconds * 1000
  ) {
    return null;
  }
  return cachedAccessToken;
}

export function getDelegateSessionId(): string | null {
  return delegateSessionId;
}

export function getCurrentWorkspaceAccount(): GoogleWorkspaceAccount {
  return buildWorkspaceAccountSnapshot(auth.currentUser);
}

export async function connectGoogleWorkspace(options?: {
  enableBackgroundSession?: boolean;
}): Promise<{
  user: User;
  accessToken: string;
  account: GoogleWorkspaceAccount;
}> {
  const provider = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
  });

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Không nhận được OAuth access token từ Google. Vui lòng thử kết nối lại và cấp quyền Google Drive / Sheets / Docs.'
      );
    }

    cachedAccessToken = credential.accessToken;
    cachedTokenAcquiredAt = Date.now();
    cachedExpiresInSeconds = 3500;
    cachedGrantedScopes = [...WORKSPACE_SCOPES];

    // Inspect tokeninfo on backend to confirm granted scopes & optionally hold ephemeral RAM session
    try {
      const statusResp = await fetch('/api/google/status', {
        headers: { Authorization: `Bearer ${cachedAccessToken}` },
      });
      if (statusResp.ok) {
        const statusData = await statusResp.json();
        if (Array.isArray(statusData.scopes) && statusData.scopes.length > 0) {
          cachedGrantedScopes = statusData.scopes;
        }
        if (typeof statusData.expiresIn === 'number' && statusData.expiresIn > 60) {
          cachedExpiresInSeconds = statusData.expiresIn - 60;
        }
      }

      if (options?.enableBackgroundSession !== false) {
        const delResp = await fetch('/api/google/session/delegate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cachedAccessToken}`,
          },
          body: JSON.stringify({
            email: result.user.email || '',
            expiresInSeconds: cachedExpiresInSeconds,
          }),
        });
        if (delResp.ok) {
          const delData = await delResp.json();
          delegateSessionId = delData.sessionId || null;
        }
      }
    } catch {
      // Non-blocking if backend probe fails temporarily
    }

    const account = buildWorkspaceAccountSnapshot(result.user);
    notifyListeners();
    return { user: result.user, accessToken: cachedAccessToken, account };
  } finally {
    isSigningIn = false;
  }
}

export async function signInWithGoogleAccount(): Promise<{
  user: User;
  accessToken: string | null;
}> {
  const prevUid = auth.currentUser?.uid || null;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    if (prevUid && result.user.uid !== prevUid) {
      clearInMemoryOAuthTokens();
    }
    lastSignedInUid = result.user.uid;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      cachedTokenAcquiredAt = Date.now();
      cachedExpiresInSeconds = 3500;
    }
    notifyListeners();
    return {
      user: result.user,
      accessToken: credential?.accessToken || null,
    };
  } finally {
    isSigningIn = false;
  }
}

export async function disconnectGoogleWorkspace(options?: {
  signOutFirebase?: boolean;
}): Promise<void> {
  const token = cachedAccessToken;
  const sessionId = delegateSessionId;
  cachedAccessToken = null;
  cachedTokenAcquiredAt = null;
  cachedGrantedScopes = [];
  delegateSessionId = null;

  if (sessionId || token) {
    try {
      await fetch('/api/google/session/delegate', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // Ignore cleanup failures
    }
  }

  if (options?.signOutFirebase) {
    await signOut(auth);
  }
  notifyListeners();
}
