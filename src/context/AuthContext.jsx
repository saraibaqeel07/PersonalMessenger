import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { touchLastSeen } from '../lib/api';
import { notifyEnabled } from '../lib/pwa';
import { registerPush, unregisterPush } from '../lib/push';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [blockedReason, setBlockedReason] = useState('');

  useEffect(() => onAuthStateChanged(auth, (u) => setAuthUser(u || null)), []);

  // Live profile. Rules deny reading when the account has no profile or is disabled,
  // so a permission error = not allowed in. We retry a couple of times because during
  // first-run setup the profile is written a moment after the auth account is created.
  useEffect(() => {
    if (!authUser) {
      setProfile(null);
      return undefined;
    }
    let unsub = () => {};
    let attempts = 0;
    let cancelled = false;
    let retryTimer;

    const kick = (reason) => {
      setBlockedReason(reason);
      setProfile(null);
      signOut(auth);
    };

    const subscribe = () => {
      unsub = onSnapshot(
        doc(db, 'users', authUser.uid),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          if (data.disabled) return kick('Your account has been disabled by the admin.');
          setProfile(data);
        },
        () => {
          if (cancelled) return;
          attempts += 1;
          if (attempts < 3) {
            retryTimer = setTimeout(subscribe, 1500);
          } else {
            kick('This account is disabled or was not created by the admin.');
          }
        },
      );
    };
    subscribe();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      unsub();
    };
  }, [authUser]);

  // keep this device's push token fresh (tokens can rotate)
  useEffect(() => {
    if (profile?.uid && notifyEnabled()) registerPush(profile.uid);
  }, [profile?.uid]);

  // presence heartbeat
  useEffect(() => {
    if (!profile?.uid) return undefined;
    const uid = profile.uid;
    const beat = () => document.visibilityState === 'visible' && touchLastSeen(uid);
    beat();
    const t = setInterval(beat, 45000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [profile?.uid]);

  const login = async (email, password) => {
    setBlockedReason('');
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const logout = async () => {
    await unregisterPush(); // stop pushes for this account on this device
    await signOut(auth);
  };

  const loading = authUser === undefined || (!!authUser && !profile);

  return (
    <AuthContext.Provider
      value={{ authUser, profile, loading, login, logout, blockedReason, isAdmin: profile?.role === 'admin' }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
