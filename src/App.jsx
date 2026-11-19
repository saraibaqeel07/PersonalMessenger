import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, Route, Routes, useLocation, useOutlet, NavLink } from 'react-router-dom';
import { MessageCircle, Users, UserPlus, User, Shield, Heart } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ToastProvider, Logo, Spinner, spring } from './components/ui';
import { isFirebaseConfigured } from './lib/firebase';
import Login from './pages/Login';
import Chats from './pages/Chats';
import Friends from './pages/Friends';
import People from './pages/People';
import Requests from './pages/Requests';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import ChatRoom from './pages/ChatRoom';
import SetupNeeded from './pages/SetupNeeded';

export default function App() {
  if (!isFirebaseConfigured) {
    return (
      <div className="app">
        <SetupNeeded />
      </div>
    );
  }
  return (
    <div className="app">
      <ToastProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ToastProvider>
    </div>
  );
}

function Splash() {
  return (
    <motion.div className="splash" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <motion.div
        style={{ color: 'var(--primary)', display: 'grid', placeItems: 'center', gap: 18 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
      >
        <Logo size={64} />
        <Spinner />
      </motion.div>
    </motion.div>
  );
}

function Gate() {
  const { authUser, loading } = useAuth();
  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <Splash key="splash" />
      ) : !authUser ? (
        <Login key="login" />
      ) : (
        <DataProvider key="app">
          <MainRoutes />
        </DataProvider>
      )}
    </AnimatePresence>
  );
}

function MainRoutes() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const inChat = location.pathname.startsWith('/chat/');
  return (
    <AnimatePresence initial={false}>
      <Routes location={location} key={inChat ? location.pathname : 'tabs'}>
        <Route element={<TabsLayout />}>
          <Route path="/" element={<Chats />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/people" element={<People />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/profile" element={<Profile />} />
          {isAdmin && <Route path="/admin" element={<Admin />} />}
        </Route>
        <Route path="/chat/:chatId" element={<ChatRoom />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function TabsLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const { isAdmin } = useAuth();
  const { incoming, unreadTotal } = useData();

  const tabs = [
    { to: '/', label: 'Chats', icon: MessageCircle, badge: unreadTotal },
    { to: '/friends', label: 'Friends', icon: Heart },
    { to: '/people', label: 'People', icon: Users },
    { to: '/requests', label: 'Requests', icon: UserPlus, badge: incoming.length },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
    { to: '/profile', label: 'Me', icon: User },
  ];

  return (
    <motion.div
      className="screen"
      initial={{ x: '-25%', opacity: 0.6 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-25%', opacity: 0.6 }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
    >
      <div className="tab-body">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={location.pathname}
            className="screen"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </div>
      <nav className="bottom-nav">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end replace className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-ind" className="nav-indicator" transition={spring} />}
                <motion.span animate={{ scale: isActive ? 1.12 : 1, y: isActive ? -1 : 0 }} transition={spring}>
                  <t.icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                </motion.span>
                {t.label}
                <AnimatePresence>
                  {t.badge > 0 && (
                    <motion.span
                      className="nav-badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={spring}
                    >
                      {t.badge > 99 ? '99+' : t.badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </motion.div>
  );
}
