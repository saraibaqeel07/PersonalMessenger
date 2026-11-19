import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Lock, LogOut, Download, Mail, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { updateMyName, changeMyPassword } from '../lib/api';
import { friendlyAuthError } from '../lib/utils';
import { Avatar, Header, Sheet, Spinner, useToast, spring } from '../components/ui';

export default function Profile() {
  const { profile, logout } = useAuth();
  const { chats } = useData();
  const toast = useToast();
  const [sheet, setSheet] = useState(null); // 'name' | 'password'
  const [installEvt, setInstallEvt] = useState(null);

  useEffect(() => {
    const h = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  const rows = [
    { icon: Pencil, label: 'Change name', onClick: () => setSheet('name') },
    { icon: Lock, label: 'Change password', onClick: () => setSheet('password') },
    ...(!standalone
      ? [
          {
            icon: Download,
            label: 'Install app',
            sub: installEvt ? 'Add to your home screen' : 'Browser menu → Add to Home Screen',
            onClick: async () => {
              if (installEvt) {
                installEvt.prompt();
                await installEvt.userChoice;
                setInstallEvt(null);
              } else {
                toast('Use your browser menu: "Add to Home Screen"');
              }
            },
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
