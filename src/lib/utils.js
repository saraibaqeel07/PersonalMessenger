// pastel avatar backgrounds (dark text sits on top)
export const AVATAR_COLORS = ['#ddd3fb', '#f7c9da', '#c4eadc', '#fde0c8', '#cfe3fb', '#f9e4a8', '#e6d1f5', '#c9ecf2'];

export function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

/** Stable pastel per user, so older accounts with saved dark colours also match the theme. */
export function avatarColor(user) {
  const key = user?.uid || user?.displayName || '';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function chatIdOf(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

export function otherUid(chat, myUid) {
  return chat.participants.find((p) => p !== myUid);
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export function toDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts === 'number') return new Date(ts);
  return null;
}

export function formatTime(ts) {
  const d = toDate(ts);
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatListTime(ts) {
  const d = toDate(ts);
  if (!d) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return formatTime(d);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = (now - d) / 86400000;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function formatDayLabel(ts) {
  const d = toDate(ts);
  if (!d) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

export function lastSeenLabel(ts) {
  const d = toDate(ts);
  if (!d) return 'Offline';
  const diff = Date.now() - d.getTime();
  if (diff < 70 * 1000) return 'Online';
  if (diff < 3600 * 1000) return `Last seen ${Math.round(diff / 60000)} min ago`;
  return `Last seen ${formatListTime(d).toLowerCase()}`;
}

export function isOnline(ts) {
  const d = toDate(ts);
  return !!d && Date.now() - d.getTime() < 70 * 1000;
}

export function friendlyAuthError(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
    'auth/network-request-failed': 'No internet connection.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'permission-denied': 'You do not have permission to do that.',
  };
  return map[code] || err?.message || 'Something went wrong.';
}

export const DISAPPEAR_MODES = {
  off: { label: 'Keep messages', short: 'Off', desc: 'Messages stay in the chat until deleted.' },
  seen: {
    label: 'Delete after seen',
    short: 'After seen',
    desc: 'Like Snapchat: a message is deleted as soon as it has been seen and the chat is closed.',
  },
  '24h': { label: 'Delete after 24 hours', short: '24h', desc: 'Messages disappear 24 hours after sending.' },
};
