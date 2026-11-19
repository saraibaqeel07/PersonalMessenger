import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, Inbox, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { acceptFriendRequest, declineFriendRequest, cancelFriendRequest } from '../lib/api';
import { friendlyAuthError, formatListTime } from '../lib/utils';
import { Avatar, Header, Empty, Spinner, Segmented, listItem, useToast } from '../components/ui';

export default function Requests() {
  const { profile } = useAuth();
  const { incoming, outgoing, users } = useData();
  const toast = useToast();
  const [tab, setTab] = useState('incoming');
  const [busy, setBusy] = useState('');

  const run = async (key, fn, msg) => {
    setBusy(key);
    try {
      await fn();
      if (msg) toast(msg);
    } catch (err) {
      toast(friendlyAuthError(err), 'error');
    } finally {
      setBusy('');
    }
  };

  const list = (tab === 'incoming' ? incoming : outgoing)
    .slice()
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  return (
    <>
      <Header title="Requests" sub="Accept people to start chatting" />
      <Segmented
        layoutId="req-seg"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'incoming', label: <>Received {incoming.length > 0 && <span className="badge">{incoming.length}</span>}</> },
          { value: 'outgoing', label: 'Sent' },
        ]}
      />
      <div className="scroll" style={{ paddingTop: 6 }}>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: tab === 'incoming' ? -24 : 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {list.length === 0 ? (
              <Empty
                icon={tab === 'incoming' ? <Inbox size={32} /> : <Send size={30} />}
                title={tab === 'incoming' ? 'No new requests' : 'No pending requests'}
                text={tab === 'incoming' ? 'Friend requests you receive appear here.' : 'Go to People to add someone.'}
              />
            ) : (
              <AnimatePresence initial={false}>
                {list.map((r, i) => {
                  const otherId = tab === 'incoming' ? r.from : r.to;
                  const u = users[otherId] || { displayName: 'Unknown user' };
                  return (
                    <motion.div key={r.id} className="row" layout variants={listItem} initial="initial" animate="animate" exit="exit" custom={i}>
                      <Avatar user={u} size={50} />
                      <div className="row-main">
                        <div className="row-title">{u.displayName}</div>
                        <div className="row-sub">
                          {tab === 'incoming' ? 'Wants to be friends' : 'Waiting for reply'} · {formatListTime(r.createdAt)}
                        </div>
                      </div>
                      {busy === r.id ? (
                        <Spinner size={20} style={{ color: 'var(--primary)' }} />
                      ) : tab === 'incoming' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <motion.button
                            className="btn sm secondary"
                            whileTap={{ scale: 0.9 }}
                            aria-label="Decline"
                            style={{ width: 38, padding: 0 }}
                            onClick={() => run(r.id, () => declineFriendRequest(profile.uid, r.from))}
                          >
                            <X size={18} />
                          </motion.button>
                          <motion.button
                            className="btn sm"
                            whileTap={{ scale: 0.9 }}
                            onClick={() =>
                              run(
                                r.id,
                                () => acceptFriendRequest(profile.uid, r.from, outgoing.some((o) => o.to === r.from)),
                                `You and ${u.displayName} are now friends`,
                              )
                            }
                          >
                            <Check size={16} /> Accept
                          </motion.button>
                        </div>
                      ) : (
                        <motion.button
                          className="btn sm secondary"
                          whileTap={{ scale: 0.9 }}
                          onClick={() => run(r.id, () => cancelFriendRequest(profile.uid, r.to), 'Request cancelled')}
                        >
                          Cancel
                        </motion.button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
