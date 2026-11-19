import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, MessageCircle, Timer, Ghost } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatListTime, otherUid, toDate } from '../lib/utils';
import { Avatar, Header, Empty, listItem, Spinner } from '../components/ui';

export default function Chats() {
  const { profile } = useAuth();
  const { chats, users, ready } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return chats
      .map((c) => ({ chat: c, user: users[otherUid(c, profile.uid)] }))
      .filter((x) => x.user && !x.user.disabled)
      .filter((x) => !term || x.user.displayNameLower?.includes(term));
  }, [chats, users, q, profile.uid]);

  return (
    <>
      <Header title="Chats" sub={`Hi, ${profile.displayName.split(' ')[0]} 👋`} />
      <label className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" />
      </label>
      <div className="scroll">
        {!ready ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 40, color: 'var(--primary)' }}>
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <Empty
            icon={<MessageCircle size={32} />}
            title={q ? 'No chats found' : 'No chats yet'}
            text={q ? 'Try another name.' : 'Add friends from the People tab. Once they accept, you can chat here.'}
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
            {list.map(({ chat, user }, i) => {
              const unread = chat.unread?.[profile.uid] || 0;
              const typing = chat.typing?.[user.uid];
              // hide the preview of a message I cleared
              const clearedAt = toDate(chat.clearedAt?.[profile.uid])?.getTime() || 0;
              const lm = chat.lastMessage;
              const last = lm && (toDate(lm.createdAt)?.getTime() || Date.now()) > clearedAt ? lm : null;
              const preview = typing
                ? 'typing…'
                : last
                  ? `${last.senderId === profile.uid ? 'You: ' : ''}${last.text}`
                  : 'Say hi 👋';
              return (
                <motion.button
                  key={chat.id}
                  className="row"
                  layout
                  variants={listItem}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  custom={i}
                  onClick={() => navigate(`/chat/${chat.id}`)}
                >
                  <Avatar user={user} size={54} showOnline />
                  <div className="row-main">
                    <div className="row-title">
                      {user.displayName}
                      {chat.disappearMode === 'seen' && <Ghost size={14} color="var(--primary)" />}
                      {chat.disappearMode === '24h' && <Timer size={14} color="var(--primary)" />}
                    </div>
                    <div className={`row-sub ${unread ? 'strong' : ''}`} style={typing ? { color: 'var(--primary)', fontWeight: 600 } : undefined}>
                      {preview}
                    </div>
                  </div>
                  <div className="row-meta">
                    <span style={unread ? { color: 'var(--primary)', fontWeight: 700 } : undefined}>
                      {formatListTime(last?.createdAt || chat.updatedAt)}
                    </span>
                    <AnimatePresence>
                      {unread > 0 && (
                        <motion.span className="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          {unread > 99 ? '99+' : unread}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </>
  );
}
