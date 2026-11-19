import {
  doc,
  collection,
  writeBatch,
  setDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  getDocs,
  increment,
  arrayUnion,
  Timestamp,
  query,
  limit,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db, auth, createAuthUserAsAdmin } from './firebase';
import { chatIdOf, randomColor } from './utils';

/* ---------------- users ---------------- */

function profileData({ uid, name, email, role }) {
  return {
    uid,
    displayName: name.trim(),
    displayNameLower: name.trim().toLowerCase(),
    email: email.trim().toLowerCase(),
    role,
    disabled: false,
    color: randomColor(),
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
  };
}

/** First run only: creates the admin account and locks setup. */
export async function bootstrapAdmin({ name, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const uid = cred.user.uid;
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), profileData({ uid, name, email, role: 'admin' }));
  batch.set(doc(db, 'config', 'setup'), { adminUid: uid, createdAt: serverTimestamp() });
  await batch.commit();
}

/** Admin creates a user with a password they choose. */
export async function adminCreateUser({ name, email, password, role = 'user' }) {
  return createAuthUserAsAdmin(email.trim(), password, (uid) =>
    setDoc(doc(db, 'users', uid), profileData({ uid, name, email, role })),
  );
}

export function adminSetDisabled(uid, disabled) {
  return updateDoc(doc(db, 'users', uid), { disabled });
}

export function adminSetRole(uid, role) {
  return updateDoc(doc(db, 'users', uid), { role });
}

export function adminRenameUser(uid, name) {
  return updateDoc(doc(db, 'users', uid), {
    displayName: name.trim(),
    displayNameLower: name.trim().toLowerCase(),
  });
}

export function updateMyName(uid, name) {
  return updateDoc(doc(db, 'users', uid), {
    displayName: name.trim(),
    displayNameLower: name.trim().toLowerCase(),
  });
}

export function touchLastSeen(uid) {
  return updateDoc(doc(db, 'users', uid), { lastSeen: serverTimestamp() }).catch(() => {});
}

export async function changeMyPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPassword);
}

/* ---------------- friend requests ---------------- */

export function sendFriendRequest(me, toUid) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'friendRequests', `${me.uid}_${toUid}`), {
    from: me.uid,
    to: toUid,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return batch.commit();
}

export function cancelFriendRequest(fromUid, toUid) {
  return deleteDoc(doc(db, 'friendRequests', `${fromUid}_${toUid}`));
}

/** Accepting creates the shared chat (= friendship) and removes the request(s). */
export async function acceptFriendRequest(myUid, fromUid, alsoHaveOutgoing = false) {
  const chatId = chatIdOf(myUid, fromUid);
  const batch = writeBatch(db);
  batch.set(doc(db, 'chats', chatId), {
    participants: [myUid, fromUid].sort(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    disappearMode: 'off',
    lastMessage: null,
    unread: { [myUid]: 0, [fromUid]: 0 },
    typing: {},
  });
  batch.delete(doc(db, 'friendRequests', `${fromUid}_${myUid}`));
  if (alsoHaveOutgoing) batch.delete(doc(db, 'friendRequests', `${myUid}_${fromUid}`));
  await batch.commit();
  return chatId;
}

export function declineFriendRequest(myUid, fromUid) {
  return deleteDoc(doc(db, 'friendRequests', `${fromUid}_${myUid}`));
}

/** Removes friendship: wipes all messages, then the chat. */
export async function unfriend(chatId) {
  const msgsRef = collection(db, 'chats', chatId, 'messages');
  // delete in chunks of 400
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await getDocs(query(msgsRef, limit(400)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'chats', chatId));
}

/* ---------------- messages ---------------- */

function previewFor(msg, mode) {
  if (mode === 'seen') return msg.type === 'gif' ? '👻 Disappearing GIF' : '👻 Disappearing message';
  if (msg.type === 'gif') return 'GIF';
  return msg.text;
}

/**
 * msg = { type: 'text', text } | { type: 'gif', gif: { url, width, height, title } }
 */
export async function sendMessage({ chatId, myUid, otherUid, msg, mode }) {
  const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
  const data = {
    senderId: myUid,
    type: msg.type,
    createdAt: serverTimestamp(),
    clientTime: Date.now(),
    mode: mode || 'off',
    seenBy: [],
  };
  if (msg.type === 'text') data.text = msg.text;
  if (msg.type === 'gif') data.gif = msg.gif;
  if (mode === '24h') data.expireAt = Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000);

  const batch = writeBatch(db);
  batch.set(msgRef, data);
  batch.update(doc(db, 'chats', chatId), {
    lastMessage: {
      text: previewFor(msg, mode),
      type: msg.type,
      senderId: myUid,
      createdAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
    [`unread.${otherUid}`]: increment(1),
    [`typing.${myUid}`]: false,
  });
  await batch.commit();
}

export function markChatRead(chatId, myUid) {
  return updateDoc(doc(db, 'chats', chatId), { [`unread.${myUid}`]: 0 }).catch(() => {});
}

export async function markMessagesSeen(chatId, ids, myUid) {
  if (!ids.length) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, 'chats', chatId, 'messages', id), { seenBy: arrayUnion(myUid) }));
  await batch.commit().catch(() => {});
}

export async function deleteMessages(chatId, ids) {
  if (!ids.length) return;
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => batch.delete(doc(db, 'chats', chatId, 'messages', id)));
    await batch.commit().catch(() => {});
  }
}

export async function setDisappearMode(chatId, myUid, mode) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'chats', chatId), { disappearMode: mode });
  batch.set(doc(collection(db, 'chats', chatId, 'messages')), {
    senderId: myUid,
    type: 'system',
    event: 'mode',
    value: mode,
    createdAt: serverTimestamp(),
    clientTime: Date.now(),
    mode: 'off',
    seenBy: [],
  });
  await batch.commit();
}

export function setTyping(chatId, myUid, typing) {
  return updateDoc(doc(db, 'chats', chatId), { [`typing.${myUid}`]: typing }).catch(() => {});
}
