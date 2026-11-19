import { lazy, Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ImageOff } from 'lucide-react';
import { fetchGifs, isGiphyConfigured } from '../lib/giphy';
import { Spinner, spring } from './ui';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

export default function Picker({ onEmoji, onGif }) {
  const [tab, setTab] = useState('emoji');
  return (
    <motion.div
      className="picker"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
    >
      <div className="picker-tabs">
        {['emoji', 'gif'].map((t) => (
          <button key={t} type="button" className={`picker-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {tab === t && <motion.div layoutId="picker-tab" className="tab-bg" transition={spring} />}
            <span>{t === 'emoji' ? 'Emoji' : 'GIF'}</span>
          </button>
        ))}
      </div>
      <div className="picker-body">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0, x: tab === 'emoji' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'emoji' ? (
              <Suspense fallback={<Center><Spinner style={{ color: 'var(--primary)' }} /></Center>}>
                <EmojiPicker
                  onEmojiClick={(e) => onEmoji(e.emoji)}
                  width="100%"
                  height="100%"
                  lazyLoadEmojis
                  emojiStyle="native"
                  skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                  searchPlaceholder="Search emoji"
                />
              </Suspense>
            ) : (
              <GifPanel onGif={onGif} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Center({ children }) {
  return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>{children}</div>;
}

function GifPanel({ onGif }) {
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isGiphyConfigured) return undefined;
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetchGifs(q, ctrl.signal)
        .then((g) => {
          setGifs(g);
          setError('');
        })
        .catch((e) => e.name !== 'AbortError' && setError('Could not load GIFs'))
        .finally(() => setLoading(false));
    }, q ? 350 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  if (!isGiphyConfigured) {
    return (
      <Center>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <ImageOff size={28} />
          <p style={{ fontSize: 14 }}>
            GIFs need a GIPHY API key.
            <br />
            Add <b>VITE_GIPHY_API_KEY</b> to .env
          </p>
        </div>
      </Center>
    );
  }

  return (
    <div className="gif-panel">
      <label className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIPHY" />
      </label>
      {loading && gifs.length === 0 ? (
        <Center>
          <Spinner style={{ color: 'var(--primary)' }} />
        </Center>
      ) : error ? (
        <Center>{error}</Center>
      ) : (
        <div className="gif-grid">
          {gifs.map((g, i) => (
            <motion.button
              key={g.id}
              type="button"
              onClick={() => onGif(g)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i, 15) * 0.02 }}
              whileTap={{ scale: 0.94 }}
              style={{ aspectRatio: `${g.width} / ${g.height}` }}
            >
              <img src={g.previewUrl} alt={g.title} loading="lazy" />
            </motion.button>
          ))}
        </div>
      )}
      <div className="giphy-credit">Powered by GIPHY</div>
    </div>
  );
}
