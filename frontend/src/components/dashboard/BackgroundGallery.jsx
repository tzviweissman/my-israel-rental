import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * The background gallery (Tzvi, 4 Nov 2026): Pixabay photos already showing
 * when it opens, with topics to tap and a search box, so nobody has to think
 * of a word first. Previews only; the photo picked is copied to our own
 * storage (routes/short_links.py), because Pixabay asks that its photos are
 * not linked to permanently. Used by the owners' ad maker and the Super
 * Admin Ads area.
 */
const TOPICS = ['wood', 'marble', 'kitchen', 'food', 'nature', 'beach', 'city', 'sky', 'home', 'texture'];

export default function BackgroundGallery({ API, token, lang, onPick }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  // The search asked for last wins: a slow earlier reply must not replace it.
  const latest = useRef(0);
  const search = async (q) => {
    latest.current += 1;
    const mine = latest.current;
    setBusy(true);
    try {
      const { data } = await axios.get(`${API}/ads/backgrounds`, { ...auth, params: { q, lang: TOPICS.includes(q) ? 'en' : lang } });
      if (mine === latest.current) setPhotos(data.photos || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('ads.bgFailed', 'Photo search did not answer. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { search(topic); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [topic]);

  const pick = async (photo) => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/ads/backgrounds/keep`, { url: photo.full }, auth);
      await onPick(data.url);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('ads.bgFailed', 'Photo search did not answer. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2" data-testid="ad-bg-gallery">
      <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('ads.bgGalleryTitle', 'Background gallery')}</p>
      <div className="flex flex-wrap gap-1.5">
        {TOPICS.map((k) => (
          <button key={k} type="button" onClick={() => { setQuery(''); setTopic(k); }} aria-pressed={topic === k}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold border"
            style={topic === k && !query ? { background: '#000', color: '#fff', borderColor: '#000' } : { borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
            data-testid={`ad-bg-topic-${k}`}>
            {t(`ads.bgTopic.${k}`, k)}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) search(query.trim()); }} className="flex gap-2">
        <input className="w-full rounded-lg border px-3 py-2 text-sm" value={query} onChange={(e) => setQuery(e.target.value)} dir="auto"
          placeholder={t('ads.bgSearch', 'Search photos: wood table, beach, kitchen…')} data-testid="ad-bg-query" />
        <button type="submit" disabled={busy} className="shrink-0 px-3 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#000' }} data-testid="ad-bg-go">
          {busy ? <Loader2 className="animate-spin" size={14} /> : t('ads.bgGo', 'Search')}
        </button>
      </form>
      <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto" data-testid="ad-bg-results">
        {photos.map((ph) => (
          <button key={ph.id} type="button" onClick={() => pick(ph)} disabled={busy} className="aspect-square rounded overflow-hidden bg-[#F9FAFB]">
            <img src={ph.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      <p className="text-[10px]" style={{ color: 'var(--brand-muted)' }}>{t('ads.bgCredit', 'Photos from Pixabay, free to use in ads.')}</p>
    </div>
  );
}
