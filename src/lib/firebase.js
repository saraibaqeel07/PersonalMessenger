import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app
  ? initializeFirestore(app, {
      // In-memory cache: the IndexedDB multi-tab cache can crash with
      // "INTERNAL ASSERTION FAILED: Unexpected state".
      localCache: memoryLocalCache(),
    })
  : null;

if (auth) setPersistence(auth, browserLocalPersistence).catch(() => {});

/**
 * Creates a Firebase Auth account WITHOUT signing the admin out.
 * Uses a temporary secondary Firebase app instance, so no Cloud Functions are needed.
 * Returns the new user's uid.
 */
export async function createAuthUserAsAdmin(email, password, writeProfile) {
  const secondary = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondary);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    try {
      await writeProfile(cred.user.uid);
    } catch (err) {
      // roll back so the email can be used again
      await deleteUser(cred.user).catch(() => {});
      throw err;
    }
    return cred.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondary).catch(() => {});
  }
}
