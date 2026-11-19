import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Lock, LogOut, Download, Mail, Shield, Bell, BellOff, Share, PlusSquare, MoreVertical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { updateMyName, changeMyPassword } from '../lib/api';
import { friendlyAuthError } from '../lib/utils';
import { useInstall, promptInstall, notifyEnabled, notifySupported, enableNotifications, disableNotifications } from '../lib/pwa';
import { Avatar, Header, Sheet, Spinner, useToast, spring } from '../components/ui';

export default function Profile() {
  const { profile, logout } = useAuth();
  const { chats } = useData();
  const toast = useToast();
  const [sheet, setSheet] = useState(null); // 'name' | 'password' | 'install'
  const { canPrompt, installed, ios } = useInstall();
  const [notifyOn, setNotifyOn] = useState(notifyEnabled());

  const install = async () => {
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') toast('Installing… find Messenger on your home screen');
    } else {
      setSheet('install');
    }
  };

  const toggleNotify = async () => {
    if (notifyOn) {
      disableNotifications();
      setNotifyOn(false);
      toast('Notifications off');
      return;
    }
    if (!notifySupported()) {
      toast(ios && !installed ? 'Install the app first to get notifications on iPhone' : 'Notifications are not supported here', 'error');
      return;
    }
    const perm = await enableNotifications();
    if (perm === 'granted') {
      setNotifyOn(true);
      toast('Notifications on');
    } else {
      toast('Notifications are blocked. Allow them in your browser/site settings.', 'error');
    }
  };

  const rows = [
    { icon: Pencil, label: 'Change name', onClick: () => setSheet('name') },
    { icon: Lock, label: 'Change password', onClick: () => setSheet('password') },
    {
      icon: notifyOn ? Bell : BellOff,
      label: 'Message notifications',
      sub: notifyOn ? 'On — tap to turn off' : 'Off — tap to turn on',
      onClick: toggleNotify,
    },
    ...(!installed
      ? [
          {
            icon: Download,
            label: 'Install app',
            sub: canPrompt ? 'One tap — adds Messenger to your home screen' : 'Add Messenger to your home screen',
            onClick: install,
          },
        ]
      : []),
  ];

  return (
    <>
      <Header title="Me" />
      <div className="scroll">
        <motion.div className="profile-hero" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
          <Avatar user={profile} size={92} />
          <h2>{profile.displayName}</h2>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mail size={14} /> {profile.email}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {profile.role === 'admin' && (
              <span className="pill" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                <Shield size={12} /> Admin
              </span>
            )}
            <span className="pill">{chats.length} friends</span>
          </div>
        </motion.div>

        <div className="card">
          {rows.map((r, i) => (
            <motion.button
              key={r.label}
              className="row"
              onClick={r.onClick}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.05 * i }}
            >
              <div className="row-icon">
                <r.icon size={18} />
              </div>
              <div className="row-main">
                <div className="row-title">{r.label}</div>
                {r.sub && <div className="row-sub">{r.sub}</div>}
              </div>
            </motion.button>
          ))}
        </div>

        <div style={{ padding: '4px 16px 24px' }}>
          <motion.button className="btn danger" whileTap={{ scale: 0.97 }} onClick={logout}>
            <LogOut size={18} /> Sign out
          </motion.button>
        </div>
      </div>

      <NameSheet open={sheet === 'name'} onClose={() => setSheet(null)} profile={profile} toast={toast} />
      <PasswordSheet open={sheet === 'password'} onClose={() => setSheet(null)} toast={toast} />
      <InstallSheet open={sheet === 'install'} onClose={() => setSheet(null)} ios={ios} />
    </>
  );
}

function NameSheet({ open, onClose, profile, toast }) {
  const [name, setName] = useState(profile.displayName);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setName(profile.displayName);
  }, [open, profile.displayName]);
  return (
    <Sheet open={open} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          try {
            await updateMyName(profile.uid, name);
            toast('Name updated');
            onClose();
          } catch (err) {
            toast(friendlyAuthError(err), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>Your name</h3>
        <p className="lead">This is how friends see you.</p>
        <div className="field">
          <div className="input-wrap">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
        </div>
        <button className="btn" disabled={busy}>
          {busy ? <Spinner /> : 'Save'}
        </button>
      </form>
    </Sheet>
  );
}

function PasswordSheet({ open, onClose, toast }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Sheet open={open} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          if (next.length < 6) return setError('New password must be at least 6 characters.');
          setBusy(true);
          try {
            await changeMyPassword(current, next);
            toast('Password changed');
            setCurrent('');
            setNext('');
            onClose();
          } catch (err) {
            setError(friendlyAuthError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>Change password</h3>
        <p className="lead">Enter your current password first.</p>
        {error && <div className="error-box">{error}</div>}
        <div className="field">
          <label>Current password</label>
          <div className="input-wrap">
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </div>
        </div>
        <div className="field">
          <label>New password</label>
          <div className="input-wrap">
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          </div>
        </div>
        <button className="btn" disabled={busy}>
          {busy ? <Spinner /> : 'Update password'}
        </button>
      </form>
    </Sheet>
  );
}

function InstallSheet({ open, onClose, ios }) {
  const steps = ios
    ? [
        { icon: Share, text: <>Tap the <b>Share</b> button in Safari's toolbar</> },
        { icon: PlusSquare, text: <>Choose <b>Add to Home Screen</b></> },
        { icon: Download, text: <>Tap <b>Add</b> — open Messenger from your home screen</> },
      ]
    : [
        { icon: MoreVertical, text: <>Open the browser menu <b>⋮</b></> },
        { icon: Download, text: <>Tap <b>Install app</b> (or <b>Add to Home screen</b>)</> },
        { icon: PlusSquare, text: <>Confirm — Messenger opens like a normal app</> },
      ];
  return (
    <Sheet open={open} onClose={onClose}>
      <h3>Install Messenger</h3>
      <p className="lead">
        {ios ? 'On iPhone/iPad apps are installed from Safari.' : 'Your browser did not offer one-tap install yet. You can do it from the menu:'}
      </p>
      <div className="card" style={{ margin: '8px 0 16px' }}>
        {steps.map((s, i) => (
          <div key={i} className="row" style={{ cursor: 'default' }}>
            <div className="row-icon">
              <s.icon size={18} />
            </div>
            <div className="row-main">
              <div className="row-sub" style={{ color: 'inherit', whiteSpace: 'normal' }}>
                {i + 1}. {s.text}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn" onClick={onClose}>
        Got it
      </button>
    </Sheet>
  );
}
