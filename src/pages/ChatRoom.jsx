import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, limitToLast, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ArrowLeft, MoreVertical, Smile, Send, Keyboard, Ghost, Timer, Infinity as InfinityIcon, Check, CheckCheck, UserMinus, Trash2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  sendMessage,
  markChatRead,
  markMessagesSeen,
  deleteMessages,
  setDisappearMode,
  setTyping,
  unfriend,
} from '../lib/api';
import { DISAPPEAR_MODES, formatDayLabel, formatTime, friendlyAuthError, lastSeenLabel, otherUid, toDate } from '../lib/utils';
import { Avatar, Sheet, Spinner, useToast, spring } from '../components/ui';
import Picker from '../components/Picker';

const MODE_ICONS = { off: InfinityIcon, seen: Ghost, '24h': Timer };
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;

function isEmojiOnly(text) {
  if (!text || text.length > 24 || !EMOJI_ONLY.test(text)) return false;
  return /\p{Extended_Pictographic}/u.test(text);
}

export default function ChatRoom() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { chats, users, ready } = useData();
  const toast = useToast();
  const myUid = profile.uid;

  const chat = chats.find((c) => c.id === chatId);
  const otherId = chat ? otherUid(chat, myUid) : chatId.split('_').find((p) => p !== myUid);
  const other = users[otherId];
  const mode = chat?.disappearMode || 'off';

  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [msgAction, setMsgAction] = useState(null);
  const [now, setNow] = useState(Date.now());

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const viewedEphemeral = useRef(new Set()); // "seen" mode messages I have viewed this session
  const typingTimer = useRef(null);
  const isTypingRef = useRef(false);
  const firstLoad = useRef(true);

  // chat removed (unfriended) -> go back
  useEffect(() => {
    if (ready && !chat) navigate('/', { replace: true });
  }, [ready, chat, navigate]);

  // live messages
  useEffect(() => {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(200));
    return onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
        if (firstLoad.current) {
          firstLoad.current = false;
          // leftovers: "seen" messages I already viewed earlier but that were not deleted yet
          const stale = all.filter((m) => m.mode === 'seen' && m.senderId !== myUid && m.seenBy?.includes(myUid));
          if (stale.length) deleteMessages(chatId, stale.map((m) => m.id));
          const staleIds = new Set(stale.map((m) => m.id));
          setMessages(all.filter((m) => !staleIds.has(m.id)));
          return;
        }
        setMessages(all);
      },
      () => setMessages([]),
    );
  }, [chatId, myUid]);

  // clock tick for 24h expiry; also re-checks read receipts when the app comes back to the foreground
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 30000);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const visible = useMemo(() => {
    if (!messages) return [];
    return messages.filter((m) => {
      const exp = toDate(m.expireAt);
      return !exp || exp.getTime() > now;
    });
  }, [messages, now]);

  // clean up expired 24h messages
  useEffect(() => {
    if (!messages) return;
    const expired = messages.filter((m) => {
      const exp = toDate(m.expireAt);
      return exp && exp.getTime() <= now;
    });
    if (expired.length) deleteMessages(chatId, expired.map((m) => m.id));
  }, [messages, now, chatId]);

  // read receipts + unread counter
  useEffect(() => {
    if (!messages || document.visibilityState !== 'visible') return;
    const unseen = messages.filter((m) => m.senderId !== myUid && m.type !== 'system' && !m.seenBy?.includes(myUid));
    unseen.filter((m) => m.mode === 'seen').forEach((m) => viewedEphemeral.current.add(m.id));
    if (unseen.length) markMessagesSeen(chatId, unseen.map((m) => m.id), myUid);
    if (chat?.unread?.[myUid]) markChatRead(chatId, myUid);
  }, [messages, chat?.unread, chatId, myUid, now]);

  // Snapchat-style: delete viewed "seen" messages when I leave the chat or the app goes to background
  const flushEphemeral = useCallback(() => {
    const ids = [...viewedEphemeral.current];
    viewedEphemeral.current.clear();
    if (ids.length) deleteMessages(chatId, ids);
  }, [chatId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        flushEphemeral();
        if (isTypingRef.current) {
          isTypingRef.current = false;
          setTyping(chatId, myUid, false);
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      flushEphemeral();
      clearTimeout(typingTimer.current);
      if (isTypingRef.current) setTyping(chatId, myUid, false);
    };
  }, [chatId, myUid, flushEphemeral]);

  // auto-scroll
  const lastCount = useRef(0);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const jump = lastCount.current === 0;
    lastCount.current = visible.length;
    el.scrollTo({ top: el.scrollHeight, behavior: jump ? 'auto' : 'smooth' });
  }, [visible.length, chat?.typing?.[otherId]]);

  // keep last message in view when keyboard / picker resizes the list
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => el.scrollTo({ top: el.scrollHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [messages === null]);

  const onType = (v) => {
    setText(v);
    if (!isTypingRef.current && v) {
      isTypingRef.current = true;
      setTyping(chatId, myUid, true);
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        setTyping(chatId, myUid, false);
      }
    }, 2500);
  };

  // autosize textarea
  useLayoutEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [text]);

  const send = async (msg) => {
    try {
      isTypingRef.current = false;
      clearTimeout(typingTimer.current);
      await sendMessage({ chatId, myUid, otherUid: otherId, msg, mode });
    } catch (err) {
      toast(friendlyAuthError(err), 'error');
    }
  };

  const sendText = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    send({ type: 'text', text: t });
    inputRef.current?.focus();
  };

  const sendGif = (g) => {
    setPickerOpen(false);
    send({ type: 'gif', gif: { url: g.url, width: g.width, height: g.height, title: g.title } });
  };

  const togglePicker = () => {
    if (pickerOpen) {
      setPickerOpen(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      inputRef.current?.blur();
      setTimeout(() => setPickerOpen(true), 60);
    }
  };

  const otherTyping = chat?.typing?.[otherId];
  const ModeIcon = MODE_ICONS[mode];

  return (
    <motion.div
      className="screen"
      style={{ zIndex: 10, boxShadow: '-20px 0 40px -20px rgba(6,18,51,.4)' }}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
    >
      <header className="header chat-header">
        <motion.button className="icon-btn" whileTap={{ scale: 0.85 }} onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/', { replace: true }))}
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </motion.button>
        <Avatar user={other} size={42} showOnline />
        <div className="who">
          <b>{other?.displayName || '…'}</b>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={otherTyping ? 't' : 's'}
              style={{ display: 'block' }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 0.85, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              {otherTyping ? 'typing…' : lastSeenLabel(other?.lastSeen)}
            </motion.span>
          </AnimatePresence>
        </div>
        <motion.button className="icon-btn" whileTap={{ scale: 0.85 }} onClick={() => setMenuOpen(true)} aria-label="Chat options">
          <MoreVertical size={22} />
        </motion.button>
      </header>

      <AnimatePresence initial={false}>
        {mode !== 'off' && (
          <motion.button
            className="mode-banner"
            onClick={() => setMenuOpen(true)}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <ModeIcon size={14} /> {mode === 'seen' ? 'Messages delete after they are seen' : 'Messages delete after 24 hours'}
          </motion.button>
        )}
      </AnimatePresence>

      <div className="messages" ref={listRef} onClick={() => pickerOpen && setPickerOpen(false)}>
        {messages === null ? (
          <div style={{ margin: 'auto', color: 'var(--primary)' }}>
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <motion.div className="empty" style={{ margin: 'auto' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
            <Avatar user={other} size={76} />
            <h3>{other?.displayName}</h3>
            <p>You are friends now. Say hi! 👋</p>
          </motion.div>
        ) : (
          <MessageList messages={visible} myUid={myUid} other={other} onLongPress={setMsgAction} />
        )}
        <AnimatePresence>
          {otherTyping && (
            <motion.div className="typing" initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <i />
              <i />
              <i />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="composer">
        <motion.button className="icon-btn light" whileTap={{ scale: 0.85 }} onClick={togglePicker} aria-label="Emoji and GIFs">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={pickerOpen ? 'k' : 'e'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }} style={{ display: 'grid' }}>
              {pickerOpen ? <Keyboard size={24} /> : <Smile size={24} />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        <div className="composer-box">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            placeholder={mode === 'seen' ? 'Disappearing message…' : 'Message'}
            onChange={(e) => onType(e.target.value)}
            onFocus={() => setPickerOpen(false)}
            onKeyDown={(e) => {
              // Enter sends on desktop; on phones Enter adds a new line
              if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                e.preventDefault();
                sendText();
              }
            }}
          />
        </div>
        <motion.button
          className="send-btn"
          whileTap={{ scale: 0.85 }}
          disabled={!text.trim()}
          onPointerDown={(e) => e.preventDefault() /* keep keyboard open */}
          onClick={sendText}
          aria-label="Send"
          animate={{ scale: text.trim() ? 1 : 0.9 }}
          transition={spring}
        >
          <Send size={19} style={{ marginLeft: -2 }} />
        </motion.button>
      </div>

      <AnimatePresence>
        {pickerOpen && <Picker onEmoji={(em) => onType(text + em)} onGif={sendGif} />}
      </AnimatePresence>

      <ChatMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        mode={mode}
        other={other}
        onMode={async (m) => {
          setMenuOpen(false);
          if (m === mode) return;
          try {
            await setDisappearMode(chatId, myUid, m);
          } catch (err) {
            toast(friendlyAuthError(err), 'error');
          }
        }}
        onUnfriend={async () => {
          setMenuOpen(false);
          try {
            await unfriend(chatId);
            toast(`Removed ${other?.displayName || 'friend'}`);
            navigate('/', { replace: true });
          } catch (err) {
            toast(friendlyAuthError(err), 'error');
          }
        }}
      />

      <Sheet open={!!msgAction} onClose={() => setMsgAction(null)}>
        <h3>Message</h3>
        <p className="lead">This removes the message for both of you.</p>
        <motion.button
          className="btn danger"
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            deleteMessages(chatId, [msgAction.id]);
            setMsgAction(null);
          }}
        >
          <Trash2 size={18} /> Delete for everyone
        </motion.button>
      </Sheet>
    </motion.div>
  );
}

function MessageList({ messages, myUid, other, onLongPress }) {
  let lastDay = '';
  let prev = null;
  return (
    <AnimatePresence initial={false}>
      {messages.map((m) => {
        const day = formatDayLabel(m.createdAt);
        const showDay = day !== lastDay;
        lastDay = day;
        const gap = !prev || prev.senderId !== m.senderId || prev.type === 'system' || showDay;
        prev = m;

        if (m.type === 'system') {
          const Icon = MODE_ICONS[m.value] || InfinityIcon;
          const who = m.senderId === myUid ? 'You' : other?.displayName?.split(' ')[0] || 'They';
          return (
            <motion.div key={m.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {showDay && <DayLabel day={day} />}
              <div className="system-msg">
                <Icon size={13} /> {who} set messages to: {DISAPPEAR_MODES[m.value]?.label || m.value}
              </div>
            </motion.div>
          );
        }

        const mine = m.senderId === myUid;
        const seen = m.seenBy?.includes(other?.uid);
        const emojiOnly = m.type === 'text' && isEmojiOnly(m.text);
        const cls = ['bubble', mine ? 'mine' : 'theirs', m.type === 'gif' ? 'gif' : '', emojiOnly ? 'emoji-only' : ''].join(' ');

        return (
          <motion.div
            key={m.id}
            layout="position"
            initial={{ opacity: 0, scale: 0.85, y: 12, x: mine ? 12 : -12 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.6, filter: 'blur(4px)', transition: { duration: 0.35 } }}
            transition={spring}
            style={{ display: 'flex', flexDirection: 'column', transformOrigin: mine ? 'right bottom' : 'left bottom' }}
          >
            {showDay && <DayLabel day={day} />}
            <div className={`bubble-row ${mine ? 'mine' : ''} ${gap ? 'gap' : ''}`}>
              <LongPress className={cls} onLongPress={() => mine && onLongPress(m)}>
                {m.type === 'gif' ? (
                  <img
                    src={m.gif.url}
                    alt={m.gif.title || 'GIF'}
                    width={m.gif.width}
                    height={m.gif.height}
                    style={{ width: Math.min(m.gif.width, 240), aspectRatio: `${m.gif.width} / ${m.gif.height}` }}
                    loading="lazy"
                  />
                ) : (
                  m.text
                )}
                <div className="meta">
                  {m.mode === 'seen' && <Ghost size={11} />}
                  {m.mode === '24h' && <Timer size={11} />}
                  {formatTime(m.createdAt)}
                  {mine && (seen ? <CheckCheck size={14} /> : <Check size={14} />)}
                </div>
              </LongPress>
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}

function DayLabel({ day }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <span className="day-label">{day}</span>
    </div>
  );
}

function LongPress({ onLongPress, children, className }) {
  const timer = useRef(null);
  const start = () => {
    timer.current = setTimeout(() => {
      navigator.vibrate?.(15);
      onLongPress();
    }, 450);
  };
  const cancel = () => clearTimeout(timer.current);
  return (
    <motion.div
      className={className}
      whileTap={{ scale: 0.97 }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerMove={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress();
      }}
    >
      {children}
    </motion.div>
  );
}

function ChatMenu({ open, onClose, mode, onMode, onUnfriend, other }) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!open) setConfirm(false);
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose}>
      <h3>Disappearing messages</h3>
      <p className="lead">Applies to new messages from both of you.</p>
      {Object.entries(DISAPPEAR_MODES).map(([key, m]) => {
        const Icon = MODE_ICONS[key];
        return (
          <motion.button key={key} className={`option ${mode === key ? 'selected' : ''}`} whileTap={{ scale: 0.98 }} onClick={() => onMode(key)}>
            <div className="opt-icon">
              <Icon size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <b>{m.label}</b>
              <span>{m.desc}</span>
            </div>
            <AnimatePresence>
              {mode === key && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ color: 'var(--primary)' }}>
                  <Check size={20} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
      <div style={{ height: 8 }} />
      <AnimatePresence mode="wait" initial={false}>
        {!confirm ? (
          <motion.button key="a" className="btn danger" whileTap={{ scale: 0.97 }} onClick={() => setConfirm(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <UserMinus size={18} /> Remove {other?.displayName?.split(' ')[0] || 'friend'}
          </motion.button>
        ) : (
          <motion.div key="b" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="note" style={{ marginTop: 0 }}>
              This deletes the whole chat for both of you. You can send a new friend request later.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn secondary" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button className="btn danger" onClick={onUnfriend}>
                Remove
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
