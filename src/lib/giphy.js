const KEY = import.meta.env.VITE_GIPHY_API_KEY;
const BASE = 'https://api.giphy.com/v1/gifs';

export const isGiphyConfigured = Boolean(KEY);

function mapGif(g) {
  const small = g.images.fixed_width || g.images.downsized;
  const preview = g.images.fixed_width_small || small;
  return {
    id: g.id,
    title: g.title || 'GIF',
    url: small.webp || small.url,
    previewUrl: preview.webp || preview.url,
    width: Number(small.width) || 200,
    height: Number(small.height) || 200,
  };
}

export async function fetchGifs(search, signal) {
  if (!KEY) return [];
  const params = new URLSearchParams({ api_key: KEY, limit: '30', rating: 'pg-13' });
  let url = `${BASE}/trending?${params}`;
  if (search.trim()) {
    params.set('q', search.trim());
    url = `${BASE}/search?${params}`;
  }
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Could not load GIFs');
  const json = await res.json();
  return (json.data || []).map(mapGif);
}
