import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Check, Clock, MessageCircle, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { sendFriendRequest, cancelFriendRequest, acceptFriendRequest } from '../lib/api';
import { chatIdOf, friendlyAuthError, lastSeenLabel } from '../lib/utils';
import { Avatar, Header, Empty, Spinner, listItem, useToast, spring } from '../components/ui';

export default function People() {
  const { profile } = useAuth();
  const { users, relation, outgoing } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return Object.values(users)
      .filter((u) => u.uid !== profile.uid && !u.disabled)
      .filter((u) => !term || u.displayNameLower?.includes(term) || u.email?.includes(term))
      .sort((a, b) => (a.displayNameLower || '').localeCompare(b.displayNameLower || ''));
  }, [users, q, profile.uid]);

  const act = async (u) => {
    const rel = relation(u.uid);
    if (rel === 'friend') return navigate(`/chat/${chatIdOf(profile.uid, u.uid)}`);
    setBusy(u.uid);
    try {
      if (rel === 'none') {
        await sendFriendRequest(profile, u.uid);
        toast(`Request sent to ${u.displayName}`);
      } else if (rel === 'outgoing') {
        await cancelFriendRequest(profile.uid, u.uid);
        toast('Request cancelled');
      } else if (rel === 'incoming') {
        await acceptFriendRequest(profile.uid, u.uid, outgoing.some((o) => o.to === u.uid));
        toast(`You and ${u.displayName} are now friends`);
      }
    } catch (err) {
      toast(friendlyAuthError(err), 'error');
    } finally {
      setBusy('');
    }
  };

  const btn = {
    friend: { label: 'Chat', icon: MessageCircle, cls: 'secondary' },
    none: { label: 'Add', icon: UserPlus, cls: '' },
    outgoing: { label: 'Sent', icon: Clock, cls: 'secondary' },
    incoming: { label: 'Accept', icon: Check, cls: '' },
  };

  return (
    <>
      <Header title="People" sub="Find people and send friend requests" />
      <label className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" />
      </label>
      <div className="scroll">
        {list.length === 0 ? (
          <Empty
            icon={<Users size={32} />}
            title={q ? 'No one found' : 'No other users yet'}
            text={q ? 'Try a different name or email.' : 'When the admin creates accounts they will show up here.'}
          />
        ) : (
          <AnimatePresence initial={false}>
            {list.map((u, i) => {
              const rel = relation(u.uid);
              const b = btn[rel];
              return (
                <motion.div key={u.uid} className="row" layout variants={listItem} initial="initial" animate="animate" exit="exit" custom={i}>
                  <Avatar user={u} size={48} showOnline={rel === 'friend'} />
                  <div className="row-main">
                    <div className="row-title">{u.displayName}</div>
                    <div className="row-sub">{rel === 'friend' ? lastSeenLabel(u.lastSeen) : u.email}</div>
                  </div>
                  <motion.button
                    className={`btn sm ${b.cls}`}
                    whileTap={{ scale: 0.92 }}
                    disabled={busy === u.uid}
                    onClick={() => act(u)}
                    layout
                    transition={spring}
                  >
                    {busy === u.uid ? (
                      <Spinner size={16} />
                    ) : (
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={rel}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.15 }}
                        >
                          <b.icon size={15} /> {b.label}
                        </motion.span>
                      </AnimatePresence>
                    )}
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </>
  );
}
