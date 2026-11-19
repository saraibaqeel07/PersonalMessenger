import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UserPlus, Search, Mail, Lock, User, Ban, CheckCircle2, Shield, ShieldOff, Pencil, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { adminCreateUser, adminSetDisabled, adminSetRole, adminRenameUser } from '../lib/api';
import { friendlyAuthError } from '../lib/utils';
import { Avatar, Header, Sheet, Spinner, Tap, listItem, useToast, Segmented, spring } from '../components/ui';

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function Admin() {
  const { users } = useData();
  const { profile } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return Object.values(users)
      .filter((u) => (filter === 'disabled' ? u.disabled : filter === 'admins' ? u.role === 'admin' : true))
      .filter((u) => !term || u.displayNameLower?.includes(term) || u.email?.includes(term))
      .sort((a, b) => (a.displayNameLower || '').localeCompare(b.displayNameLower || ''));
  }, [users, q, filter]);

  const all = Object.values(users);
  const stats = {
    total: all.length,
    active: all.filter((u) => !u.disabled).length,
    disabled: all.filter((u) => u.disabled).length,
  };

  const sel = selected ? users[selected] : null;

  return (
    <>
      <Header title="Admin" sub="Create and manage accounts" />
      <div className="stats">
        {[
          ['Users', stats.total],
          ['Active', stats.active],
          ['Disabled', stats.disabled],
        ].map(([l, v], i) => (
          <motion.div key={l} className="stat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.05 }}>
            <b>{v}</b>
            <span>{l}</span>
          </motion.div>
        ))}
      </div>
      <div style={{ height: 10 }} />
      <Segmented
        layoutId="admin-seg"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'admins', label: 'Admins' },
          { value: 'disabled', label: 'Disabled' },
        ]}
      />
      <div style={{ height: 6 }} />
      <label className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" />
      </label>

      <div className="scroll" style={{ paddingBottom: 90 }}>
        <AnimatePresence initial={false}>
          {list.map((u, i) => (
            <motion.button
              key={u.uid}
              className="row"
              layout
              variants={listItem}
              initial="initial"
              animate="animate"
              exit="exit"
              custom={i}
              onClick={() => setSelected(u.uid)}
              style={{ opacity: u.disabled ? 0.55 : 1 }}
            >
              <Avatar user={u} size={46} />
              <div className="row-main">
                <div className="row-title">
                  {u.displayName}
                  {u.uid === profile.uid && <span className="pill">You</span>}
                </div>
                <div className="row-sub">{u.email}</div>
              </div>
              {u.role === 'admin' && <span className="pill">Admin</span>}
              {u.disabled && <span className="pill danger">Disabled</span>}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <Tap className="fab" onClick={() => setCreating(true)} initial={{ scale: 0 }} animate={{ scale: 1 }} aria-label="Create user">
        <UserPlus size={24} />
      </Tap>

      <CreateUserSheet open={creating} onClose={() => setCreating(false)} toast={toast} />
      <ManageUserSheet user={sel} me={profile} onClose={() => setSelected(null)} toast={toast} />
    </>
  );
}

function CreateUserSheet({ open, onClose, toast }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(genPassword());
  const [show, setShow] = useState(true);
  const [role, setRole] = useState('user');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setEmail('');
    setPassword(genPassword());
    setRole('user');
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Enter a name.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setBusy(true);
    try {
      await adminCreateUser({ name, email, password, role });
      toast(`${name.trim()} can now sign in`);
      try {
        await navigator.clipboard?.writeText(`Email: ${email.trim()}\nPassword: ${password}`);
        toast('Login details copied to clipboard');
      } catch {
        /* clipboard not available */
      }
      reset();
      onClose();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <h3>New user</h3>
        <p className="lead">They will sign in with this email and password.</p>
        {error && <div className="error-box">{error}</div>}
        <div className="field">
          <label>Name</label>
          <div className="input-wrap">
            <User size={18} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <div className="input-wrap">
            <Mail size={18} />
            <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
          </div>
        </div>
        <div className="field">
          <label>Password</label>
          <div className="input-wrap">
            <Lock size={18} />
            <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setPassword(genPassword())} aria-label="Generate password" style={{ color: 'var(--muted)' }}>
              <RefreshCw size={17} />
            </button>
            <button type="button" onClick={() => setShow((s) => !s)} aria-label="Show password" style={{ color: 'var(--muted)' }}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className="field">
          <label>Role</label>
          <Segmented
            layoutId="role-seg"
            value={role}
            onChange={setRole}
            options={[
              { value: 'user', label: 'User' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
        </div>
        <motion.button className="btn" disabled={busy} whileTap={{ scale: 0.97 }}>
          {busy ? <Spinner /> : 'Create account'}
        </motion.button>
      </form>
    </Sheet>
  );
}

function ManageUserSheet({ user, me, onClose, toast }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const isMe = user?.uid === me.uid;

  const run = async (key, fn, msg) => {
    setBusy(key);
    try {
      await fn();
      toast(msg);
    } catch (err) {
      toast(friendlyAuthError(err), 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <Sheet
      open={!!user}
      onClose={() => {
        setRenaming(false);
        onClose();
      }}
    >
      {user && (
        <>
          <div className="profile-hero" style={{ paddingTop: 0 }}>
            <Avatar user={user} size={72} />
            <h2>{user.displayName}</h2>
            <p>{user.email}</p>
          </div>

          <AnimatePresence>
            {renaming && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ display: 'flex', gap: 8, marginBottom: 12, overflow: 'hidden' }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name.trim()) return;
                  run('rename', () => adminRenameUser(user.uid, name), 'Name updated').then(() => setRenaming(false));
                }}
              >
                <div className="input-wrap" style={{ flex: 1 }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </div>
                <button className="btn sm">{busy === 'rename' ? <Spinner size={16} /> : 'Save'}</button>
              </motion.form>
            )}
          </AnimatePresence>

          <div style={{ display: 'grid', gap: 10 }}>
            <motion.button
              className="btn secondary"
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setName(user.displayName);
                setRenaming((r) => !r);
              }}
            >
              <Pencil size={17} /> Rename
            </motion.button>
            {!isMe && (
              <motion.button
                className="btn secondary"
                whileTap={{ scale: 0.97 }}
                disabled={!!busy}
                onClick={() =>
                  run(
                    'role',
                    () => adminSetRole(user.uid, user.role === 'admin' ? 'user' : 'admin'),
                    user.role === 'admin' ? 'Admin rights removed' : 'Made admin',
                  )
                }
              >
                {busy === 'role' ? <Spinner size={18} /> : user.role === 'admin' ? <><ShieldOff size={17} /> Remove admin</> : <><Shield size={17} /> Make admin</>}
              </motion.button>
            )}
            {!isMe && (
              <motion.button
                className={`btn ${user.disabled ? 'secondary' : 'danger'}`}
                whileTap={{ scale: 0.97 }}
                disabled={!!busy}
                onClick={() =>
                  run('disable', () => adminSetDisabled(user.uid, !user.disabled), user.disabled ? 'Account enabled' : 'Account disabled')
                }
              >
                {busy === 'disable' ? <Spinner size={18} /> : user.disabled ? <><CheckCircle2 size={17} /> Enable account</> : <><Ban size={17} /> Disable account</>}
              </motion.button>
            )}
          </div>
          {!isMe && (
            <p className="note" style={{ marginTop: 14 }}>
              Disabling signs the user out right away and blocks them from all chats. Passwords can be reset from the
              Firebase console (Authentication tab).
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
