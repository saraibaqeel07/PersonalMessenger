import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pushConfigured, setAppBadge, showMessageNotification } from '../lib/pwa';
import { useToast } from '../components/ui';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { otherUid } from '../lib/utils';

const DataContext = createContext(null);

/** Live, app-wide data: all users, my chats (= friends) and friend requests. */
export function DataProvider({ children }) {
  const { profile } = useAuth();
  const uid = profile?.uid;

  const [users, setUsers] = useState({});
  const [chats, setChats] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    const unsubs = [];
    let pending = 4;
    const done = () => {
      pending -= 1;
      if (pending <= 0) setReady(true);
    };
    const once = (fn) => {
      let called = false;
      return (...args) => {
        fn(...args);
        if (!called) {
          called = true;
          done();
        }
      };
    };
    // On error still count the listener as finished so the UI doesn't spin forever.
    const onErr = (e) => {
      console.error(e);
      done();
    };

    unsubs.push(
      onSnapshot(
        collection(db, 'users'),
        once((snap) => {
          const map = {};
          snap.forEach((d) => (map[d.id] = d.data()));
          setUsers(map);
        }),
        onErr,
      ),
    );
    unsubs.push(
      onSnapshot(
        // No orderBy here: array-contains + orderBy needs a composite index, and if it is
        // missing the whole query fails silently. Sort on the client instead.
        query(collection(db, 'chats'), where('participants', 'array-contains', uid)),
        once((snap) => {
          const ms = (t) => (t?.toMillis ? t.toMillis() : 0);
          setChats(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
              .sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt)),
          );
        }),
        onErr,
      ),
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'friendRequests'), where('to', '==', uid)),
        once((snap) => setIncoming(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
        onErr,
      ),
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'friendRequests'), where('from', '==', uid)),
        once((snap) => setOutgoing(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
        onErr,
      ),
    );
    return () => {
      unsubs.forEach((u) => u());
      setReady(false);
    };
  }, [uid]);

  // ---- new-message alerts ----
  const navigate = useNavigate();
  const toast = useToast();
  const seenLast = useRef(null); // chatId -> key of last message already handled

  useEffect(() => {
    if (!ready) return;
    const first = seenLast.current === null;
    if (first) seenLast.current = new Map();
    chats.forEach((c) => {
      const last = c.lastMessage;
      const key = last ? `${last.createdAt?.toMillis?.() || 0}|${last.senderId}|${last.text}` : '';
      const prev = seenLast.current.get(c.id);
      seenLast.current.set(c.id, key);
      if (first || !last || key === prev || last.senderId === uid) return;
      // only alert for messages that are actually new (not old ones re-delivered)
      if ((c.unread?.[uid] || 0) === 0) return;
      if (!document.hidden && window.location.pathname === `/chat/${c.id}`) return; // already looking at it
      const sender = users[last.senderId];
      const name = sender?.displayName || 'New message';
      const body = last.type === 'gif' && !last.text?.startsWith('👻') ? 'Sent a GIF' : last.text;
      if (document.hidden) {
        // with real push set up, the service worker shows it (avoid double alerts)
        if (!pushConfigured) showMessageNotification({ title: name, body, chatId: c.id });
      } else {
        toast(`${name}: ${body}`);
      }
    });
  }, [chats, ready, uid, users, toast]);

  useEffect(() => {
    setAppBadge(chats.reduce((n, c) => n + (c.unread?.[uid] || 0), 0));
  }, [chats, uid]);

  // tapping a notification while the app is open -> go to that chat
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMsg = (e) => {
      if (e.data?.type === 'open-url' && e.data.url) navigate(e.data.url);
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [navigate]);

  const value = useMemo(() => {
    const friendIds = new Set(chats.map((c) => otherUid(c, uid)));
    const incomingFrom = new Set(incoming.map((r) => r.from));
    const outgoingTo = new Set(outgoing.map((r) => r.to));
    const unreadTotal = chats.reduce((n, c) => n + (c.unread?.[uid] || 0), 0);
    const relation = (otherId) => {
      if (friendIds.has(otherId)) return 'friend';
      if (incomingFrom.has(otherId)) return 'incoming';
      if (outgoingTo.has(otherId)) return 'outgoing';
      return 'none';
    };
    return { users, chats, incoming, outgoing, ready, relation, unreadTotal };
  }, [users, chats, incoming, outgoing, ready, uid]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
