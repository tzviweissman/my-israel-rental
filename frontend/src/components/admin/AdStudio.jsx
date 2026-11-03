/**
 * Super Admin → Ads (Tzvi, 2 Nov 2026: "make me an area to create ads and
 * edit them to send on whatsapp").
 *
 * MyIsraelRental's own ads. Three designs from the ads that worked (ad
 * rules 9e): "Group chat" (your post sank in the group), "Our pages" (three
 * real custom pages on phones) and "Photo and words". Every word and picture
 * is editable, the picture redraws as you type, and each ad is saved
 * (routes/admin/ads.py) so it can be opened and changed later. It comes out
 * in two shapes: a chat post (1080x1350) and a WhatsApp status (1080x1920,
 * clear of the top and bottom bars).
 *
 * Drawn on a canvas here, like the owners' ad maker (dashboard/AdMaker.jsx),
 * so what you see is exactly the picture that is sent.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Copy, Download, Loader2, Plus, Save, Share2, Trash2, Upload } from 'lucide-react';
import { API } from '../../App';

const SHAPES = { post: [1080, 1350], status: [1080, 1920] };
const INK = '#111827';
const ACCENT = '#167AB8';
const PAGES = ['the-gift-boutique', 'chicken-munch', 'the-brown-box', 'blazin-boards', 'american-crust',
  'ls-fruit-platter', 'michal-balloons', 'noa-levi'];
const LOGO = '/ads/logo-mark.png';

const imgCache = {};
const loadImage = (src) => {
  if (!src) return Promise.resolve(null);
  if (!imgCache[src]) {
    imgCache[src] = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  return imgCache[src];
};

const isHe = (s) => /[֐-׿]/.test(s || '');
const fonts = (text) => (isHe(text)
  ? { head: '"Frank Ruhl Libre", Georgia, serif', body: 'Assistant, system-ui, sans-serif' }
  : { head: '"Playfair Display", Georgia, serif', body: 'Manrope, system-ui, sans-serif' });

function wrap(ctx, text, width, max = 9) {
  const lines = [];
  (text || '').split('\n').forEach((para) => {
    let line = '';
    para.split(/\s+/).filter(Boolean).forEach((w) => {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width <= width || !line) line = next;
      else { lines.push(line); line = w; }
    });
    lines.push(line);
  });
  return lines.slice(0, max);
}

// Centred lines, each word coloured `hl` when it is the highlighted word.
function headline(ctx, { text, hl, y, size, W, colour, accent, max = 3 }) {
  const f = fonts(text);
  ctx.font = `700 ${size}px ${f.head}`;
  ctx.direction = isHe(text) ? 'rtl' : 'ltr';
  ctx.textBaseline = 'alphabetic';
  const lines = wrap(ctx, text, W - 120, max);
  lines.forEach((l, i) => {
    const ly = y + size * 1.05 * (i + 1);
    const words = l.split(' ');
    const widths = words.map((w) => ctx.measureText(w).width);
    const space = ctx.measureText(' ').width;
    const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    let x = (W - total) / 2;
    const order = ctx.direction === 'rtl' ? [...words.keys()].reverse() : [...words.keys()];
    ctx.textAlign = 'left';
    order.forEach((k) => {
      const clean = words[k].replace(/[.,!?]/g, '');
      ctx.fillStyle = hl && clean && clean.toLowerCase() === hl.toLowerCase() ? accent : colour;
      ctx.fillText(words[k], x, ly);
      x += widths[k] + space;
    });
  });
  return y + size * 1.05 * lines.length;
}

// The foot every design shares: the logo, a title, a line and the link.
// On a status it runs under WhatsApp's reply bar, its words above it.
function foot(ctx, { W, H, shape, f, logo, dark }) {
  const safe = shape === 'status' ? 230 : 0;
  const h = 300;
  const top = H - safe - h;
  ctx.fillStyle = dark ? '#000' : '#FFFFFF';
  ctx.fillRect(0, top, W, H - top);
  const rtl = isHe(f.title + f.line);
  const ff = fonts(f.title + f.line);
  const L = 120;
  const lx = rtl ? W - 64 - L : 64;
  if (logo) {
    ctx.fillStyle = '#123B57';
    ctx.beginPath();
    ctx.roundRect(lx, top + (h - L) / 2, L, L, 26);
    ctx.fill();
    ctx.drawImage(logo, lx + 14, top + (h - L) / 2 + 14, L - 28, L - 28);
  }
  const tx = rtl ? lx - 30 : lx + L + 30;
  const tw = W - 64 - L - 30 - 64;
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.fillStyle = dark ? '#FFFFFF' : INK;
  ctx.font = `700 50px ${ff.body}`;
  ctx.fillText(wrap(ctx, f.title, tw, 1)[0] || '', tx, top + 118);
  ctx.fillStyle = dark ? '#CFD8E3' : '#444444';
  ctx.font = `500 28px ${ff.body}`;
  ctx.fillText(wrap(ctx, f.line, tw, 1)[0] || '', tx, top + 168);
  ctx.fillStyle = dark ? '#7CC4F2' : ACCENT;
  ctx.font = `700 32px ${ff.body}`;
  ctx.direction = 'ltr';
  ctx.fillText(f.link || '', tx, top + 220);
  return top;
}

function phoneFrame(ctx, img, x, y, w, h, r = 48) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 34;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 12, y + 12, w - 24, h - 24, r - 10);
  ctx.clip();
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y, w, h);
  if (img) {
    // The page fills the screen from the top, as a phone shows it.
    const s = (w - 24) / img.naturalWidth;
    ctx.drawImage(img, x + 12, y + 12, w - 24, img.naturalHeight * s);
  }
  ctx.restore();
}

// "Group chat": the reader's own post pushed off the top of a busy group.
function drawChat(ctx, W, H, shape, f, logo) {
  ctx.fillStyle = '#F6EFE4';
  ctx.fillRect(0, 0, W, H);
  const top0 = shape === 'status' ? 240 : 64;
  const hb = headline(ctx, { text: f.headline, hl: f.highlight, y: top0, size: 96, W, colour: INK, accent: ACCENT });
  const footTop = H - (shape === 'status' ? 230 : 0) - 300;
  const px = 150; const pw = W - 300; const py = hb + 60;
  ctx.save();
  ctx.shadowColor = 'rgba(17,24,39,.35)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 40;
  ctx.fillStyle = '#0B0B0F';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, footTop + 80 - py, 70);
  ctx.fill();
  ctx.restore();
  const sx = px + 18; const sy = py + 18; const sw = pw - 36;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, footTop - sy, [54, 54, 0, 0]);
  ctx.clip();
  ctx.fillStyle = '#EAE3D9';
  ctx.fillRect(sx, sy, sw, footTop - sy);
  // Messages from the bottom up; the reader's post is the oldest, at the top.
  const msgs = (f.messages || '').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => { const i = l.indexOf(':'); return i > 0 ? { who: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { who: '', text: l }; });
  const all = [{ who: '', text: f.post, me: true }, ...msgs];
  let y = footTop - 24;
  for (let i = all.length - 1; i >= 0 && y > sy; i -= 1) {
    const m = all[i];
    const ff = fonts(m.text);
    ctx.font = `500 25px ${ff.body}`;
    const lines = wrap(ctx, m.text, sw * 0.7 - 36, 3);
    const bh = 22 + (m.who ? 26 : 0) + lines.length * 33;
    const bw = Math.min(sw * 0.78, Math.max(...lines.map((l) => ctx.measureText(l).width), 120) + 40);
    y -= bh;
    const bx = m.me ? sx + sw - 24 - bw : sx + 24;
    ctx.fillStyle = m.me ? '#D9FDD3' : '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(bx, y, bw, bh, 22);
    ctx.fill();
    const rtl = isHe(m.text);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = rtl ? 'right' : 'left';
    const tx = rtl ? bx + bw - 18 : bx + 18;
    let ty = y + 8;
    if (m.who) {
      ctx.fillStyle = INK;
      ctx.font = `700 20px ${ff.body}`;
      ty += 22;
      ctx.fillText(m.who, tx, ty);
    }
    ctx.fillStyle = INK;
    ctx.font = `500 25px ${ff.body}`;
    lines.forEach((l) => { ty += 33; ctx.fillText(l, tx, ty - 4); });
    y -= 12;
  }
  // The group's own bar and a fade under it, then the pill pointing up.
  const g = ctx.createLinearGradient(0, sy + 112, 0, sy + 320);
  g.addColorStop(0, 'rgba(234,227,217,1)');
  g.addColorStop(1, 'rgba(234,227,217,0)');
  ctx.fillStyle = g;
  ctx.fillRect(sx, sy + 112, sw, 208);
  ctx.fillStyle = '#F7F5F2';
  ctx.fillRect(sx, sy, sw, 112);
  ctx.fillStyle = '#8BB3A0';
  ctx.beginPath();
  ctx.arc(sx + 58, sy + 66, 29, 0, Math.PI * 2);
  ctx.fill();
  const gf = fonts(f.group);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  ctx.font = `800 26px ${gf.body}`;
  ctx.fillText((f.group || '?').trim()[0] || '?', sx + 58, sy + 75);
  ctx.textAlign = isHe(f.group) ? 'right' : 'left';
  ctx.direction = isHe(f.group) ? 'rtl' : 'ltr';
  ctx.fillStyle = INK;
  ctx.font = `700 28px ${gf.body}`;
  ctx.fillText(f.group || '', isHe(f.group) ? sx + sw - 30 : sx + 104, sy + 72);
  if (f.pill) {
    const pf = fonts(f.pill);
    ctx.font = `700 28px ${pf.body}`;
    const w = ctx.measureText(f.pill).width + 50;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(W / 2 - w / 2, sy + 150, w, 58, 29);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.direction = isHe(f.pill) ? 'rtl' : 'ltr';
    ctx.fillText(f.pill, W / 2, sy + 189);
  }
  ctx.restore();
  foot(ctx, { W, H, shape, f, logo, dark: true });
}

// "Our pages": three real custom pages on phones, the middle one in front.
function drawShowcase(ctx, W, H, shape, f, logo, pages) {
  const g = ctx.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.45, H * 0.8);
  g.addColorStop(0, '#1F2A3D');
  g.addColorStop(1, '#0B0F17');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const top0 = shape === 'status' ? 240 : 64;
  let y = headline(ctx, { text: f.line1, y: top0, size: 84, W, colour: '#FFFFFF', accent: '#FFFFFF', max: 2 });
  y = headline(ctx, { text: f.line2, y, size: 84, W, colour: '#FFD600', accent: '#FFD600', max: 2 });
  const footTop = H - (shape === 'status' ? 230 : 0) - 300;
  const room = footTop - y - 90;
  const ph = Math.min(room, shape === 'status' ? 860 : 700);
  const pw = Math.round(ph * 390 / 844);
  const cy = y + 50;
  [[-1, pages[1]], [1, pages[2]]].forEach(([side, img]) => {
    ctx.save();
    ctx.translate(W / 2 + side * pw * 0.78, cy + ph * 0.12 + ph * 0.43);
    ctx.rotate(side * 0.14);
    ctx.scale(0.86, 0.86);
    phoneFrame(ctx, img, -pw / 2, -ph * 0.5, pw, ph);
    ctx.restore();
  });
  phoneFrame(ctx, pages[0], (W - pw) / 2, cy, pw, ph);
  if (f.label) {
    const lf = fonts(f.label);
    ctx.fillStyle = '#CFD8E3';
    ctx.font = `700 28px ${lf.body}`;
    ctx.textAlign = 'center';
    ctx.direction = isHe(f.label) ? 'rtl' : 'ltr';
    ctx.fillText(f.label, W / 2, Math.min(cy + ph + 46, footTop - 14));
  }
  foot(ctx, { W, H, shape, f, logo, dark: false });
}

// "Photo and words": one picture, whole, under a headline.
function drawPhoto(ctx, W, H, shape, f, logo, photo) {
  ctx.fillStyle = '#F6EFE4';
  ctx.fillRect(0, 0, W, H);
  const top0 = shape === 'status' ? 240 : 64;
  let y = headline(ctx, { text: f.headline, hl: f.highlight, y: top0, size: 88, W, colour: INK, accent: ACCENT });
  if (f.sub) {
    const sf = fonts(f.sub);
    ctx.font = `500 34px ${sf.body}`;
    ctx.fillStyle = '#444444';
    ctx.textAlign = 'center';
    ctx.direction = isHe(f.sub) ? 'rtl' : 'ltr';
    wrap(ctx, f.sub, W - 160, 2).forEach((l) => { y += 46; ctx.fillText(l, W / 2, y); });
  }
  const footTop = H - (shape === 'status' ? 230 : 0) - 300;
  if (photo) {
    const bw = W - 128; const bh = footTop - y - 100;
    const s = Math.min(bw / photo.naturalWidth, bh / photo.naturalHeight);
    const w = photo.naturalWidth * s; const h = photo.naturalHeight * s;
    ctx.save();
    ctx.shadowColor = 'rgba(17,24,39,.3)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
    ctx.beginPath();
    ctx.roundRect((W - w) / 2, y + 50 + (bh - h) / 2, w, h, 28);
    ctx.clip();
    ctx.drawImage(photo, (W - w) / 2, y + 50 + (bh - h) / 2, w, h);
    ctx.restore();
  }
  foot(ctx, { W, H, shape, f, logo, dark: true });
}

async function render(canvas, ad, shape) {
  const [W, H] = SHAPES[shape];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const f = ad.fields;
  const logo = await loadImage(LOGO);
  await Promise.all(['700 80px "Playfair Display"', '700 40px Manrope', '500 30px Manrope', '800 30px Manrope',
    '700 80px "Frank Ruhl Libre"', '700 40px Assistant'].map((x) => document.fonts?.load(x).catch(() => null)));
  if (ad.design === 'chat') drawChat(ctx, W, H, shape, f, logo);
  else if (ad.design === 'showcase') {
    const pages = await Promise.all((f.pages || []).slice(0, 3).map(loadImage));
    drawShowcase(ctx, W, H, shape, f, logo, pages);
  } else drawPhoto(ctx, W, H, shape, f, logo, await loadImage(f.photo));
}

// A new ad of a design, in the dashboard's language (adStudio.defaults.*).
function freshAd(design, t, lang) {
  const d = (k) => t(`adStudio.defaults.${design}.${k}`);
  const common = { title: d('title'), line: d('line'), link: 'myisraelrental.com', caption: d('caption') };
  if (design === 'chat') {
    return { design, lang, name: d('name'), fields: { ...common, headline: d('headline'), highlight: d('highlight'),
      group: d('group'), post: d('post'), messages: d('messages'), pill: d('pill') } };
  }
  if (design === 'showcase') {
    return { design, lang, name: d('name'), fields: { ...common, line1: d('line1'), line2: d('line2'),
      label: d('label'), pages: PAGES.slice(0, 3).map((p) => `/ads/pages/${p}.jpg`) } };
  }
  return { design, lang, name: d('name'), fields: { ...common, headline: d('headline'), highlight: d('highlight'), sub: d('sub'), photo: '' } };
}

export default function AdStudio({ token }) {
  const { t, i18n } = useTranslation();
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const [ads, setAds] = useState([]);
  const [ad, setAd] = useState(null);
  const [shape, setShape] = useState('post');
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canvasRef = useRef(null);
  const lang = i18n.language?.startsWith('he') ? 'he' : 'en';

  const load = () => axios.get(`${API}/admin/ads`, auth).then(({ data }) => setAds(data.ads || [])).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Redraw a moment after typing stops.
  useEffect(() => {
    if (!ad || !canvasRef.current) return undefined;
    let gone = false;
    const timer = setTimeout(async () => {
      await render(canvasRef.current, ad, shape);
      if (!gone) setPreview(canvasRef.current.toDataURL('image/jpeg', 0.85));
    }, 250);
    return () => { gone = true; clearTimeout(timer); };
  }, [ad, shape]);

  const set = (k, v) => setAd({ ...ad, fields: { ...ad.fields, [k]: v } });
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/admin/ads`, ad, auth);
      setAd({ ...ad, id: data.id });
      toast.success(t('adStudio.saved'));
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('adStudio.saveFailed'));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (a) => {
    if (!window.confirm(t('adStudio.confirmDelete', { name: a.name }))) return;
    await axios.delete(`${API}/admin/ads/${a.id}`, auth).catch(() => {});
    if (ad?.id === a.id) setAd(null);
    load();
  };
  const upload = async (file, apply) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axios.post(`${API}/upload`, form, auth);
      apply(data.url.startsWith('http') ? data.url : `${API.replace(/\/api$/, '')}${data.url}`);
    } catch {
      toast.error(t('adStudio.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const fileName = () => `${(ad.name || 'ad').replace(/[^\w֐-׿-]+/g, '-')}-${shape}.jpg`;
  const blob = () => new Promise((r) => canvasRef.current.toBlob(r, 'image/jpeg', 0.92));
  const download = async () => {
    const b = await blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = fileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  // On a phone the picture and the words go to WhatsApp together; on a
  // computer the picture is saved and WhatsApp opens with the words.
  const sendWhatsApp = async () => {
    const file = new File([await blob()], fileName(), { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: ad.fields.caption || '' }).catch(() => {});
      return;
    }
    await download();
    window.open(`https://wa.me/?text=${encodeURIComponent(ad.fields.caption || '')}`, '_blank', 'noopener');
  };
  const copyCaption = async () => {
    try { await navigator.clipboard.writeText(ad.fields.caption || ''); toast.success(t('adStudio.copied')); } catch { /* shown in the box */ }
  };

  const field = 'w-full rounded-lg border px-3 py-2 text-sm';
  const label = 'block text-xs font-semibold mb-1';
  const box = (k, rows = 1) => (
    <label className="block" key={k}>
      <span className={label} style={{ color: 'var(--ink)' }}>{t(`adStudio.field.${k}`)}</span>
      {rows > 1
        ? <textarea className={field} rows={rows} dir="auto" value={ad.fields[k] || ''} onChange={(e) => set(k, e.target.value)} data-testid={`ad-studio-${k}`} />
        : <input className={field} dir="auto" value={ad.fields[k] || ''} onChange={(e) => set(k, e.target.value)} data-testid={`ad-studio-${k}`} />}
    </label>
  );
  const chip = (on) => ({ className: 'px-3 py-1.5 rounded-full text-xs font-semibold border',
    style: on ? { background: '#000', color: '#fff', borderColor: '#000' } : { borderColor: 'var(--brand-border)', color: 'var(--ink)' } });

  return (
    <div className="space-y-5" data-testid="ad-studio">
      <div>
        <h2 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>{t('adStudio.title')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--brand-muted)' }}>{t('adStudio.intro')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['chat', 'showcase', 'photo'].map((d) => (
          <button key={d} type="button" onClick={() => setAd(freshAd(d, i18n.getFixedT(lang), lang))}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid={`ad-studio-new-${d}`}>
            <Plus size={14} /> {t(`adStudio.design.${d}`)}
          </button>
        ))}
      </div>

      {ads.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('adStudio.savedAds')}</p>
          <div className="flex flex-wrap gap-2">
            {ads.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1 rounded-full border ps-3 pe-1 py-1 text-xs"
                style={{ borderColor: ad?.id === a.id ? '#000' : 'var(--brand-border)' }}>
                <button type="button" onClick={() => setAd(a)} className="font-semibold" dir="auto" data-testid={`ad-studio-open-${a.id}`}>{a.name}</button>
                <button type="button" onClick={() => remove(a)} aria-label={t('adStudio.delete')} className="p-1 rounded-full hover:bg-[#F9FAFB]"><Trash2 size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {!ad && <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('adStudio.pickDesign')}</p>}

      {ad && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 min-w-0">
            <div className="flex gap-2">
              {['post', 'status'].map((s) => (
                <button key={s} type="button" onClick={() => setShape(s)} {...chip(shape === s)} data-testid={`ad-studio-shape-${s}`}>
                  {t(`adStudio.shape.${s}`)}
                </button>
              ))}
            </div>
            <div className="bg-[#F9FAFB] rounded-xl p-3 flex items-center justify-center min-h-[320px]">
              {preview ? <img src={preview} alt={t('adStudio.previewAlt')} className="max-h-[70vh] max-w-full w-auto rounded-lg shadow" data-testid="ad-studio-preview" />
                : <Loader2 className="animate-spin" size={24} aria-hidden="true" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={sendWhatsApp} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: '#000' }} data-testid="ad-studio-send">
                <Share2 size={15} /> {t('adStudio.send')}
              </button>
              <button type="button" onClick={download} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="ad-studio-download">
                <Download size={15} /> {t('adStudio.download')}
              </button>
            </div>
          </div>

          <div className="space-y-3 min-w-0">
            <label className="block">
              <span className={label} style={{ color: 'var(--ink)' }}>{t('adStudio.field.name')}</span>
              <input className={field} dir="auto" value={ad.name} onChange={(e) => setAd({ ...ad, name: e.target.value })} data-testid="ad-studio-name" />
            </label>
            {ad.design === 'chat' && [box('headline', 2), box('highlight'), box('group'), box('post', 2), box('messages', 6), box('pill')]}
            {ad.design === 'showcase' && (
              <>
                {box('line1')}
                {box('line2')}
                <div>
                  <span className={label} style={{ color: 'var(--ink)' }}>{t('adStudio.field.pages')}</span>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-2 mb-1.5">
                      <select className={field} value={PAGES.find((p) => ad.fields.pages[i] === `/ads/pages/${p}.jpg`) || ''}
                        onChange={(e) => set('pages', ad.fields.pages.map((u, j) => (j === i ? `/ads/pages/${e.target.value}.jpg` : u)))} data-testid={`ad-studio-page-${i}`}>
                        {!PAGES.some((p) => ad.fields.pages[i] === `/ads/pages/${p}.jpg`) && <option value="">{t('adStudio.uploadedPicture')}</option>}
                        {PAGES.map((p) => <option key={p} value={p}>{p.replace(/-/g, ' ')}</option>)}
                      </select>
                      <label className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold cursor-pointer" style={{ color: 'var(--brand-primary)' }}>
                        <Upload size={13} /> {t('adStudio.upload')}
                        <input type="file" accept="image/*" className="hidden"
                          onChange={(e) => upload(e.target.files?.[0], (url) => set('pages', ad.fields.pages.map((u, j) => (j === i ? url : u))))} />
                      </label>
                    </div>
                  ))}
                </div>
                {box('label')}
              </>
            )}
            {ad.design === 'photo' && (
              <>
                {box('headline', 2)}
                {box('highlight')}
                {box('sub', 2)}
                <label className="inline-flex items-center gap-1.5 text-sm font-semibold cursor-pointer" style={{ color: 'var(--brand-primary)' }}>
                  <Upload size={14} /> {ad.fields.photo ? t('adStudio.changePhoto') : t('adStudio.addPhoto')}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], (url) => set('photo', url))} data-testid="ad-studio-photo" />
                </label>
              </>
            )}
            {uploading && <p className="text-xs" style={{ color: 'var(--brand-muted)' }}><Loader2 className="inline animate-spin" size={12} /> {t('adStudio.uploading')}</p>}
            {[box('title'), box('line'), box('link')]}
            <div>
              {box('caption', 4)}
              <button type="button" onClick={copyCaption} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--brand-primary)' }} data-testid="ad-studio-copy">
                <Copy size={12} /> {t('adStudio.copy')}
              </button>
            </div>
            <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#000' }} data-testid="ad-studio-save">
              {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} {ad.id ? t('adStudio.saveChanges') : t('adStudio.save')}
            </button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
