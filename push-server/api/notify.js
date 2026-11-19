import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

/*
 * POST /api/notify   { chatId }   Authorization: Bearer <Firebase ID token>
 *
 * Called by the sender's app right after a message is sent. Everything that ends up
 * in the notification is read from Firestore here (never trusted from the request),
 * so a user can only trigger a push for a chat they are in, about their own last message.
 */

let db;
function init() {
  if (db) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  let sa;
  try {
    sa = JSON.parse(raw.trim().replace(/^﻿/, ''));
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }
  if (!getApps().length) initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function cors(req, res) {
  const origin = req.headers.origin || '';
  if (!ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  try {
    init();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'config', detail: err.message });
  }

  try {
    const idToken = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!idToken) return res.status(401).json({ error: 'auth' });
    const { uid } = await getAuth().verifyIdToken(idToken);

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const chatId = String(body.chatId || '');
    if (!chatId || chatId.includes('/')) return res.status(400).json({ error: 'chatId' });

    const chatSnap = await db.doc(`chats/${chatId}`).get();
    if (!chatSnap.exists) return res.status(404).json({ error: 'chat' });
    const chat = chatSnap.data();
    const participants = chat.participants || [];
    if (!participants.includes(uid)) return res.status(403).json({ error: 'forbidden' });

    const last = chat.lastMessage;
    if (!last || last.senderId !== uid) return res.status(200).json({ sent: 0 });

    const toUid = participants.find((p) => p !== uid);
    const [senderSnap, tokensSnap] = await Promise.all([
      db.doc(`users/${uid}`).get(),
      db.collection('pushTokens').where('uid', '==', toUid).get(),
    ]);
    if (senderSnap.data()?.disabled) return res.status(403).json({ error: 'disabled' });
    if (tokensSnap.empty) return res.status(200).json({ sent: 0 });

    const title = senderSnap.data()?.displayName || 'New message';
    const text = last.type === 'gif' && !String(last.text || '').startsWith('👻') ? 'Sent a GIF' : String(last.text || '');
    const tokens = tokensSnap.docs.map((d) => d.id);

    // Data-only message: public/sw-notify.js in the app decides how to show it.
    const result = await getMessaging().sendEachForMulticast({
      tokens,
      data: { title, body: text.slice(0, 180), chatId },
      webpush: { headers: { Urgency: 'high', TTL: '86400' } },
    });

    // clean up tokens of uninstalled apps / revoked permissions
    const dead = [];
    result.responses.forEach((r, i) => {
      const code = r.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
        dead.push(db.doc(`pushTokens/${tokens[i]}`).delete());
      }
    });
    await Promise.all(dead);

    return res.status(200).json({ sent: result.successCount });
  } catch (err) {
    console.error(err);
    const status = String(err?.code || '').startsWith('auth/') ? 401 : 500;
    return res.status(status).json({ error: 'failed' });
  }
}
