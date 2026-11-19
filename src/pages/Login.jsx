import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { Mail, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { bootstrapAdmin } from '../lib/api';
import { friendlyAuthError } from '../lib/utils';
import { Logo, Spinner, spring } from '../components/ui';

export default function Login() {
  const { login, blockedReason } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [setupCheckError, setSetupCheckError] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'config', 'setup'))
      .then((s) => setNeedsSetup(!s.exists()))
      .catch((err) => {
        console.error('Setup check failed:', err);
        setNeedsSetup(false);
        setSetupCheckError(
          err?.code === 'permission-denied'
            ? 'Firestore rules are not deployed yet. Run: pnpm dlx firebase-tools deploy --only firestore'
            : 'Cannot reach Firestore. Make sure the Firestore database is created in the Firebase console.',
        );
      });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (needsSetup) {
        if (!name.trim()) throw new Error('Please enter your name.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        await bootstrapAdmin({ name, email, password });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  };

  const shownError = error || blockedReason || setupCheckError;

  return (
    <motion.div className="screen login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {['b1', 'b2', 'b3'].map((b, i) => (
        <motion.div
          key={b}
          className={`blob ${b}`}
          animate={{ x: [0, i % 2 ? -18 : 18, 0], y: [0, i % 2 ? 14 : -14, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 9 + i * 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="login-hero">
        <motion.div
          className="logo-mark"
          initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        >
          <Logo size={48} />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}>
          Messenger
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.75 }} transition={{ delay: 0.2 }}>
          Private chats for invited people only
        </motion.p>
      </div>

      <motion.form
        className="login-card"
        onSubmit={submit}
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30, delay: 0.05 }}
      >
        <AnimatePresence mode="wait">
          <motion.div key={needsSetup ? 'setup' : 'login'} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h2>{needsSetup ? 'Create admin account' : 'Welcome back'}</h2>
            <p className="lead">
              {needsSetup
                ? 'First time setup. This account will manage all users.'
                : 'Sign in with the email and password your admin gave you.'}
            </p>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {shownError && (
            <motion.div
              className="error-box"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 14, x: [0, -8, 8, -4, 4, 0] }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            >
              {shownError}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {needsSetup && (
            <motion.div className="field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <label>Your name</label>
              <div className="input-wrap">
                <User size={18} />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Admin name" autoComplete="name" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="field">
          <label>Email</label>
          <div className="input-wrap">
            <Mail size={18} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              required
            />
          </div>
        </div>
        <div className="field">
          <label>Password</label>
          <div className="input-wrap">
            <Lock size={18} />
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={needsSetup ? 'new-password' : 'current-password'}
              required
            />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label="Show password" style={{ color: 'var(--muted)' }}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <motion.button className="btn" type="submit" disabled={busy} whileTap={{ scale: 0.97 }} style={{ marginTop: 6 }}>
          {busy ? <Spinner /> : needsSetup ? (<><ShieldCheck size={18} /> Create admin</>) : 'Sign in'}
        </motion.button>

        {!needsSetup && (
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 18, marginBottom: 0 }}>
            No account? Ask your admin to create one for you.
          </p>
        )}
      </motion.form>
    </motion.div>
  );
}
