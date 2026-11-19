import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, MessageCircle, UserMinus, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { unfriend } from '../lib/api';
import { friendlyAuthError, isOnline, lastSeenLabel, otherUid } from '../lib/utils';
import { Avatar, Header, Empty, Spinner, listItem, useToast } from '../components/ui';

export default function Friends() {
  const { profile } = useAuth();
  const { chats, users, ready } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return chats
      .map((c) => ({ chat: c, user: users[otherUid(c, profile.uid)] }))
      .filter((x) => x.user && !x.user.disabled)
      .filter((x) => !term || x.user.displayNameLower?.includes(term) || x.user.email?.includes(term))
      .sort((a, b) => {
        // online first, then alphabetical
        const oa = isOnline(a.user.lastSeen) ? 0 : 1;
        const ob = isOnline(b.user.lastSeen) ? 0 : 1;
        return oa - ob || (a.user.displayNameLower || '').localeCompare(b.user.displayNameLower || '');
      });
  }, [chats, users, q, profile.uid]);

  const onlineCount = list.filter((x) => isOnline(x.user.lastSeen)).length;

  const remove = async (chat, user) => {
    if (!window.confirm(`Remove ${user.displayName} from friends? Your chat history will be deleted.`)) return;
    setBusy(chat.id);
    try {
      await unfriend(chat.id);
      toast(`${user.displayName} removed`);
    } catch (err) {
      toast(friendlyAuthError(err), 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <Header
        title="Friends"
        sub={list.length ? `${list.length} friend${list.length === 1 ? '' : 's'} · ${onlineCount} online` : 'Your friends list'}
      />
      <label className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friends" />
      </label>
      <div className="scroll">
        {!ready ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 40, color: 'var(--primary)' }}>
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <Empty
            icon={<Heart size={32} />}
            title={q ? 'No friends found' : 'No friends yet'}
            text={q ? 'Try another name.' : 'Send requests from the People tab. Accepted friends appear here.'}
            action={
              !q && (
                <motion.button className="btn sm" whileTap={{ scale: 0.95 }} onClick={() => navigate('/people', { replace: true })} style={{ marginTop: 8 }}>
                  Find people
                </motion.button>
              )
            }
          />
        ) : (
          <AnimatePresence initial={false}>
            {list.map(({ chat, user }, i) => (
              <motion.div key={chat.id} className="row" layout variants={listItem} initial="initial" animate="animate" exit="exit" custom={i}>
                <Avatar user={user} size={50} showOnline />
                <div className="row-main">
                  <div className="row-title">{user.displayName}</div>
                  <div className="row-sub">{lastSeenLabel(user.lastSeen)}</div>
                </div>
                {busy === chat.id ? (
                  <Spinner size={20} style={{ color: 'var(--primary)' }} />
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <motion.button
                      className="btn sm secondary"
                      whileTap={{ scale: 0.9 }}
                      aria-label={`Unfriend ${user.displayName}`}
                      style={{ width: 38, padding: 0 }}
                      onClick={() => remove(chat, user)}
                    >
                      <UserMinus size={17} />
                    </motion.button>
                    <motion.button className="btn sm" whileTap={{ scale: 0.9 }} onClick={() => navigate(`/chat/${chat.id}`)}>
                      <MessageCircle size={15} /> Chat
                    </motion.button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </>
  );
}
