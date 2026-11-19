import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
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
    const onErr = (e) => console.error(e);

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
        query(collection(db, 'chats'), where('participants', 'array-contains', uid), orderBy('updatedAt', 'desc')),
        once((snap) => setChats(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })))),
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
