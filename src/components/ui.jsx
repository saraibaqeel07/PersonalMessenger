import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { avatarColor, initials, isOnline } from '../lib/utils';

/* ---------- shared motion presets ---------- */
export const spring = { type: 'spring', stiffness: 420, damping: 34 };

export const listItem = {
  initial: { opacity: 0, y: 12 },
  animate: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.035, ...spring } }),
  exit: { opacity: 0, x: -40, transition: { duration: 0.2 } },
};

export function Tap({ as = 'button', className, children, ...props }) {
  const Comp = motion[as];
  return (
    <Comp className={className} whileTap={{ scale: 0.96 }} transition={spring} {...props}>
      {children}
    </Comp>
  );
}

/* ---------- avatar ---------- */
export function Avatar({ user, size = 48, showOnline = false }) {
  const online = showOnline && isOnline(user?.lastSeen);
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, background: avatarColor(user), fontSize: size * 0.36 }}
    >
      {initials(user?.displayName)}
      <AnimatePresence>
        {online && (
          <motion.span className="dot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- header ---------- */
export function Header({ title, sub, left, right }) {
  return (
    <>
      <header className="header">
        {left}
        <div style={{ flex: 1, minWidth: 0 }}>
          <motion.h1 initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            {title}
          </motion.h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {right}
      </header>
      <div className="header-curve" />
    </>
  );
}

/* ---------- empty state ---------- */
export function Empty({ icon, title, text, action }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </motion.div>
  );
}

export function Spinner({ size = 22, style }) {
  return <span className="spinner" style={{ width: size, height: size, ...style }} />;
}

/* ---------- bottom sheet ---------- */
export function Sheet({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="sheet-handle" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- toasts ---------- */
const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((text, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              className={`toast ${t.type}`}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={spring}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------- segmented control ---------- */
export function Segmented({ value, onChange, options, layoutId }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.div layoutId={layoutId} className="seg-bg" transition={spring} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Logo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path
        d="M24 6C13.5 6 5 13.6 5 23c0 5.2 2.6 9.8 6.7 12.9L10 43l8-4.1c1.9.5 3.9.8 6 .8 10.5 0 19-7.6 19-17S34.5 6 24 6Z"
        fill="currentColor"
      />
      <circle cx="16" cy="23" r="2.6" fill="#a98bf2" />
      <circle cx="24" cy="23" r="2.6" fill="#8f8bf4" />
      <circle cx="32" cy="23" r="2.6" fill="#7f8cf5" />
    </svg>
  );
}
