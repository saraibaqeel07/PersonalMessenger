import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { app, auth, db } from './firebase';

/*
 * Real push notifications (arrive even when the app is closed).
 *
 * 1. This device gets an FCM token and stores it in pushTokens/{token}.
 * 2. After sending a message, the sender's app calls the push server
 *    (push-server/, deployed free on Vercel) with its Firebase ID token.
 * 3. The server checks the chat, finds the receiver's tokens and sends the push.
 * 4. public/sw-notify.js shows it, even with the app closed.
 *
 * Needs VITE_FIREBASE_VAPID_KEY and VITE_PUSH_URL in .env. Without them the app
 * silently falls back to in-app notifications only.
 */

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const PUSH_URL = import.meta.env.VITE_PUSH_URL;
const TOKEN_KEY = 'push-token';

export const pushConfigured = Boolean(VAPID_KEY && PUSH_URL);

async function getMessagingIfSupported() {
  if (!pushConfigured || !app) return null;
  const { isSupported, getMessaging } = await import('firebase/messaging');
  if (!(await isSupported())) return null;
  return getMessaging(app);
}

function savedToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Gets (or refreshes) this device's token and stores it for this user. Call only after permission is granted. */
export async function registerPush(uid) {
  try {
    const messaging = await getMessagingIfSupported();
    if (!messaging || Notification.permission !== 'granted') return false;
    const { getToken } = await import('firebase/messaging');
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return false;
    const old = savedToken();
    if (old && old !== token) await deleteDoc(doc(db, 'pushTokens', old)).catch(() => {});
    await setDoc(doc(db, 'pushTokens', token), { uid, ua: navigator.userAgent.slice(0, 200), updatedAt: serverTimestamp() });
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
    return true;
  } catch (err) {
    console.warn('push registration failed', err);
    return false;
  }
}

/** Stop pushes to this device (notifications turned off, or signing out). */
export async function unregisterPush() {
  const token = savedToken();
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  if (!token) return;
  await deleteDoc(doc(db, 'pushTokens', token)).catch(() => {});
  try {
    const messaging = await getMessagingIfSupported();
    if (messaging) {
      const { deleteToken } = await import('firebase/messaging');
      await deleteToken(messaging);
    }
  } catch {
    /* ignore */
  }
}

/** Ask the push server to notify the other person about the latest message in this chat. Fire-and-forget. */
export async function notifyChat(chatId) {
  if (!pushConfigured || !auth?.currentUser) return;
  try {
    const idToken = await auth.currentUser.getIdToken();
    await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ chatId }),
      keepalive: true,
    });
  } catch {
    /* push is best-effort */
  }
}
