/**
 * Super Admin → Ads (Tzvi, 2 Nov 2026: "make me an area to create ads and
 * edit them to send on whatsapp").
 *
 * MyIsraelRental's own ads, nine designs (DESIGNS) from the ads that worked
 * (ad rules 9e). The first three: "Group chat" (your post sank in the
 * group), "Our pages" (three real custom pages on phones) and "Photo and
 * words"; the six after them are described above drawCall. Every word and picture
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
import { Copy, Download, Loader2, Save, Share2, Trash2, Upload } from 'lucide-react';
import { API } from '../../App';
import BackgroundGallery from '../dashboard/BackgroundGallery';
import { sharpCanvas, bestPhoto } from '../../utils/sharpCanvas';

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
      img.src = bestPhoto(src);
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
  // The title shrinks to fit on one line rather than being cut.
  let ts = 50;
  do { ctx.font = `700 ${ts}px ${ff.body}`; ts -= 2; } while (ts > 30 && ctx.measureText(f.title || '').width > tw);
  ctx.fillText(wrap(ctx, f.title, tw, 1)[0] || '', tx, top + 118);
  ctx.fillStyle = dark ? '#CFD8E3' : '#444444';
  ctx.font = `500 30px ${ff.body}`;
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
    ctx.font = `500 30px ${ff.body}`;
    const lines = wrap(ctx, m.text, sw * 0.7 - 36, 3);
    const bh = 22 + (m.who ? 34 : 0) + lines.length * 38;
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
      ctx.font = `700 30px ${ff.body}`;
      ty += 30;
      ctx.fillText(m.who, tx, ty);
    }
    ctx.fillStyle = INK;
    ctx.font = `500 30px ${ff.body}`;
    lines.forEach((l) => { ty += 38; ctx.fillText(l, tx, ty - 4); });
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
  ctx.font = `800 30px ${gf.body}`;
  ctx.fillText((f.group || '?').trim()[0] || '?', sx + 58, sy + 75);
  ctx.textAlign = isHe(f.group) ? 'right' : 'left';
  ctx.direction = isHe(f.group) ? 'rtl' : 'ltr';
  ctx.fillStyle = INK;
  ctx.font = `700 30px ${gf.body}`;
  ctx.fillText(f.group || '', isHe(f.group) ? sx + sw - 30 : sx + 104, sy + 72);
  if (f.pill) {
    const pf = fonts(f.pill);
    ctx.font = `700 30px ${pf.body}`;
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
    ctx.font = `700 30px ${lf.body}`;
    ctx.textAlign = 'center';
    ctx.direction = isHe(f.label) ? 'rtl' : 'ltr';
    ctx.fillText(f.label, W / 2, Math.min(cy + ph + 46, footTop - 14));
  }
  foot(ctx, { W, H, shape, f, logo, dark: false });
}

// "Photo and words": one picture, whole, under a headline.
// Scene ads (Tzvi, 12 Nov 2026: "all the ads for myisraelrental is a picture of 1 of our businesses just with small
// changes ... i want more ads like the one you just created it shows what we do and catches peoples eye"). One thing
// the site does per ad, as one surreal miniature scene on the same walnut desk and navy wall, our real screen on the
// phone: made by docs/ads/gen/myisraelrental-series-status and -automation-status (blueprints in docs/ads/blueprints),
// kept as /ads/scenes/<scene>-<shape>.jpg at the shape's full width, the words typed on top here.
export const SCENES = ['factory', 'moving', 'shop', 'inbox', 'press'];
function drawScene(ctx, W, H, shape, f, logo, bg) {
  ctx.fillStyle = '#1d2a3a';
  ctx.fillRect(0, 0, W, H);
  if (bg) ctx.drawImage(bg, 0, 0, W, (bg.naturalHeight * W) / bg.naturalWidth);
  const g = ctx.createLinearGradient(0, H - 520, 0, H);
  g.addColorStop(0, 'rgba(16,22,32,0)');
  g.addColorStop(0.45, 'rgba(16,22,32,.8)');
  g.addColorStop(1, 'rgba(16,22,32,.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 520, W, 520);
  const status = shape === 'status';
  const rtl = isHe(`${f.headline}${f.headline2}${f.sub}`);
  const ff = fonts(`${f.headline}${f.headline2}`);
  const x = rtl ? W - 64 : 64;
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textBaseline = 'alphabetic';
  let y = status ? 240 : 56;
  if (logo) {
    const L = 68;
    const lx = rtl ? W - 64 - L : 64;
    ctx.fillStyle = '#123B57';
    ctx.beginPath();
    ctx.roundRect(lx, y, L, L, 16);
    ctx.fill();
    ctx.drawImage(logo, lx + 9, y + 9, L - 18, L - 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 34px ${fonts('').body}`;
    ctx.direction = 'ltr';
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillText('MyIsraelRental', rtl ? lx - 16 : lx + L + 16, y + 46);
    ctx.direction = rtl ? 'rtl' : 'ltr';
  }
  y += status ? 92 : 80;
  const size = status ? 124 : 104;
  ctx.font = `800 ${size}px ${ff.head}`;
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 30;
  [[f.headline, '#FFFFFF'], [f.headline2, '#5CC0F0']].forEach(([line, colour]) => {
    if (!line) return;
    y += size * 1.02;
    ctx.fillStyle = colour;
    ctx.fillText(wrap(ctx, line, W - 128, 1)[0] || '', x, y);
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  if (f.sub) {
    ctx.font = `700 40px ${fonts(f.sub).body}`;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    y += 22;
    wrap(ctx, f.sub, W * 0.6, 2).forEach((l) => { y += 52; ctx.fillText(l, x, y); });
  }
  // The action and the link on a white plate at the foot, above a status's reply bar.
  const bottom = H - (status ? 250 : 56);
  const bf = fonts(f.title).body;
  ctx.font = `800 40px ${bf}`;
  const cta = wrap(ctx, f.title || '', W - 200, 1)[0] || '';
  const cw = ctx.measureText(cta).width + 52;
  ctx.font = `700 34px ${fonts('').body}`;
  const lw = ctx.measureText(f.link || '').width;
  const pw = Math.max(cw, lw) + 52;
  const ph = 168;
  const px = rtl ? W - 56 - pw : 56;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(px, bottom - ph, pw, ph, 18);
  ctx.fill();
  const ix = rtl ? px + pw - 26 : px + 26;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.roundRect(rtl ? ix - cw : ix, bottom - ph + 22, cw, 66, 33);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 40px ${bf}`;
  ctx.fillText(cta, rtl ? ix - 26 : ix + 26, bottom - ph + 70);
  ctx.fillStyle = ACCENT;
  ctx.font = `700 34px ${fonts('').body}`;
  ctx.direction = 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.fillText(f.link || '', ix, bottom - 30);
}

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

// "Photo background" (Tzvi, 4 Nov 2026): a photo from the background gallery
// fills the whole ad, the words large on it.
function drawBackdropPhoto(ctx, W, H, shape, f, logo, photo) {
  if (photo) {
    const s = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
    const w = photo.naturalWidth * s;
    const h = photo.naturalHeight * s;
    ctx.drawImage(photo, (W - w) / 2, (H - h) / 2, w, h);
  } else gradient(ctx, W, H, '#167AB8', '#111827');
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,.62)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  let y = headline(ctx, { text: f.headline, hl: f.highlight, y: shape === 'status' ? 240 : 64, size: 96, W, colour: '#FFFFFF', accent: '#FFD600' });
  if (f.sub) {
    const sf = fonts(f.sub);
    ctx.font = `600 36px ${sf.body}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.direction = isHe(f.sub) ? 'rtl' : 'ltr';
    wrap(ctx, f.sub, W - 160, 2).forEach((l) => { y += 50; ctx.fillText(l, W / 2, y); });
  }
  foot(ctx, { W, H, shape, f, logo, dark: true });
}

// The six added the next day (Tzvi, 3 Nov 2026: "make more ad options like
// 6"), each one of the phone-screen or list ideas from the library's idea
// folders (docs/inspo/pinterest-ads-2026-11-02: call, notify, search,
// toggle, checklist) and the before-and-after split.

const lines = (s) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean);
const topOf = (shape) => (shape === 'status' ? 240 : 64);
const footTopOf = (shape, H) => H - (shape === 'status' ? 230 : 0) - 300;

function text(ctx, s, x, y, { size = 30, weight = 600, colour = INK, align = 'center', head = false, max = 0 } = {}) {
  const f = fonts(s);
  ctx.font = `${weight} ${size}px ${head ? f.head : f.body}`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.direction = isHe(s) ? 'rtl' : 'ltr';
  ctx.fillText(max ? (wrap(ctx, s, max, 1)[0] || '') : (s || ''), x, y);
}

function gradient(ctx, W, H, a, b) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// "Incoming call": the next customer calling, decline or answer.
function drawCall(ctx, W, H, shape, f, logo) {
  gradient(ctx, W, H, '#1E5F8C', '#0B0F17');
  const footTop = footTopOf(shape, H);
  let y = topOf(shape) + 40;
  const cf = fonts(f.caller);
  ctx.font = `800 104px ${cf.body}`;
  ctx.direction = isHe(f.caller) ? 'rtl' : 'ltr';
  wrap(ctx, f.caller, W - 120, 2).forEach((l) => { y += 108; text(ctx, l, W / 2, y, { size: 104, weight: 800, colour: '#FFFFFF' }); });
  y += 70;
  text(ctx, f.calling, W / 2, y, { size: 44, weight: 500, colour: 'rgba(220,235,255,.85)' });
  const btnY = footTop - 150;
  const cy = (y + 60 + btnY - 110) / 2;
  const R = Math.min(190, (btnY - 110 - y - 60) / 2 - 30);
  [1.5, 1.28, 1.08].forEach((k, i) => {
    ctx.strokeStyle = `rgba(220,235,255,${0.12 + i * 0.1})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(W / 2, cy, R * k, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.fillStyle = '#123B57';
  ctx.beginPath();
  ctx.arc(W / 2, cy, R, 0, Math.PI * 2);
  ctx.fill();
  if (logo) ctx.drawImage(logo, W / 2 - R * 0.62, cy - R * 0.62, R * 1.24, R * 1.24);
  [[-1, '#EB4034', f.decline], [1, '#34C759', f.accept]].forEach(([side, fill, label]) => {
    const bx = W / 2 + side * 230;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(bx, btnY, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (side < 0) { ctx.moveTo(bx - 25, btnY - 25); ctx.lineTo(bx + 25, btnY + 25); ctx.moveTo(bx + 25, btnY - 25); ctx.lineTo(bx - 25, btnY + 25); } else { ctx.moveTo(bx - 26, btnY); ctx.lineTo(bx - 6, btnY + 20); ctx.lineTo(bx + 28, btnY - 20); }
    ctx.stroke();
    text(ctx, label, bx, btnY + 118, { size: 32, colour: '#FFFFFF', max: 380 });
  });
  foot(ctx, { W, H, shape, f, logo, dark: false });
}

// "Notifications": a lock screen lighting up, the page as the wallpaper.
function drawNotify(ctx, W, H, shape, f, logo, page) {
  ctx.fillStyle = '#0B0F17';
  ctx.fillRect(0, 0, W, H);
  if (page) {
    // Below the page's own menu bar, which would sit under the clock.
    const cut = page.naturalHeight * 0.07;
    const s = W / page.naturalWidth;
    // Blurred, as a lock screen's wallpaper sits behind its clock: the
    // page's own big words would otherwise fight the time.
    ctx.filter = `blur(${18 * (ctx.canvas.scale || 1)}px)`;
    ctx.drawImage(page, 0, cut, page.naturalWidth, page.naturalHeight - cut, 0, 0, W, (page.naturalHeight - cut) * s);
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(8,12,20,.7)';
    ctx.fillRect(0, 0, W, H);
  }
  const footTop = footTopOf(shape, H);
  let y = topOf(shape) + 150;
  text(ctx, f.time, W / 2, y, { size: 190, weight: 300, colour: '#FFFFFF' });
  y += 70;
  text(ctx, f.date, W / 2, y, { size: 38, weight: 600, colour: 'rgba(255,255,255,.85)' });
  y += 80;
  const ns = lines(f.notes).slice(0, 4).map((l) => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ['', l]; });
  ns.forEach(([title, body]) => {
    const bf = fonts(body);
    ctx.font = `500 30px ${bf.body}`;
    ctx.direction = isHe(body) ? 'rtl' : 'ltr';
    const bl = wrap(ctx, body, W - 300, 2);
    const h = 70 + bl.length * 40 + 20;
    if (y + h > footTop - 30) return;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath();
    ctx.roundRect(70, y, W - 140, h, 34);
    ctx.fill();
    const rtl = isHe(title + body);
    const ix = rtl ? W - 70 - 30 - 64 : 100;
    ctx.fillStyle = '#123B57';
    ctx.beginPath();
    ctx.roundRect(ix, y + 26, 64, 64, 16);
    ctx.fill();
    if (logo) ctx.drawImage(logo, ix + 8, y + 34, 48, 48);
    const tx = rtl ? ix - 24 : ix + 64 + 24;
    text(ctx, title, tx, y + 56, { size: 30, weight: 800, align: rtl ? 'right' : 'left', max: W - 340 });
    bl.forEach((l, i) => text(ctx, l, tx, y + 100 + i * 40, { size: 30, weight: 500, colour: '#374151', align: rtl ? 'right' : 'left' }));
    y += h + 18;
  });
  foot(ctx, { W, H, shape, f, logo, dark: false });
}

// "Search": the reader's own question in the box, the site as the answer.
function drawSearch(ctx, W, H, shape, f, logo, page) {
  ctx.fillStyle = '#F6EFE4';
  ctx.fillRect(0, 0, W, H);
  const footTop = footTopOf(shape, H);
  let y = topOf(shape) + 40;
  text(ctx, f.kicker, W / 2, y + 30, { size: 34, weight: 600, colour: '#786E64' });
  y += 80;
  // The search box.
  ctx.fillStyle = '#FFFFFF';
  ctx.save();
  ctx.shadowColor = 'rgba(17,24,39,.15)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  ctx.beginPath();
  ctx.roundRect(70, y, W - 140, 130, 65);
  ctx.fill();
  ctx.restore();
  const rtl = isHe(f.question);
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 6;
  const gx = rtl ? W - 130 : 130;
  ctx.beginPath();
  ctx.arc(gx, y + 60, 20, 0, Math.PI * 2);
  ctx.moveTo(gx + (rtl ? -14 : 14), y + 74);
  ctx.lineTo(gx + (rtl ? -32 : 32), y + 92);
  ctx.stroke();
  text(ctx, f.question, rtl ? W - 180 : 180, y + 78, { size: 38, weight: 600, align: rtl ? 'right' : 'left', max: W - 300 });
  y += 190;
  // The answer card, with the page on a small phone beside it.
  const cardH = footTop - 60 - y;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(70, y, W - 140, cardH, 36);
  ctx.fill();
  const pw = Math.min(300, cardH * 0.46 * 390 / 844 * 2);
  const ph = pw * 844 / 390;
  const php = Math.min(ph, cardH - 60);
  const pwx = php * 390 / 844;
  const prtl = isHe(f.answerTitle + f.answer);
  const pxx = prtl ? 110 : W - 110 - pwx;
  phoneFrame(ctx, page, pxx, y + 30, pwx, php, 36);
  const tx = prtl ? W - 110 : 110;
  const tw = W - 220 - pwx - 50;
  let ty = y + 90;
  text(ctx, f.answerTitle, tx, ty, { size: 46, weight: 800, colour: ACCENT, align: prtl ? 'right' : 'left', max: tw });
  const af = fonts(f.answer);
  ctx.font = `500 32px ${af.body}`;
  ctx.direction = isHe(f.answer) ? 'rtl' : 'ltr';
  wrap(ctx, f.answer, tw, 7).forEach((l) => { ty += 48; text(ctx, l, tx, ty, { size: 32, weight: 500, colour: '#374151', align: prtl ? 'right' : 'left' }); });
  foot(ctx, { W, H, shape, f, logo, dark: true });
}

// "Switches": phone settings toggles, the old way off and the new way on.
function drawToggles(ctx, W, H, shape, f, logo) {
  ctx.fillStyle = '#EEF2F6';
  ctx.fillRect(0, 0, W, H);
  const footTop = footTopOf(shape, H);
  let y = headline(ctx, { text: f.headline, hl: f.highlight, y: topOf(shape), size: 88, W, colour: INK, accent: ACCENT });
  const rows = lines(f.switches).slice(0, 5).map((l) => [l.startsWith('+'), l.replace(/^[+-]\s*/, '')]);
  const rh = Math.min(170, (footTop - y - 120) / Math.max(rows.length, 1));
  y += 70;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(70, y, W - 140, rh * rows.length, 40);
  ctx.fill();
  rows.forEach(([on, label], i) => {
    const ry = y + i * rh;
    if (i) { ctx.fillStyle = '#E3E3E3'; ctx.fillRect(110, ry, W - 220, 2); }
    const rtl = isHe(label);
    text(ctx, label, rtl ? W - 120 : 120, ry + rh / 2 + 14, { size: 42, weight: on ? 800 : 500, colour: on ? INK : '#666666', align: rtl ? 'right' : 'left', max: W - 460 });
    const sw = 150; const sh = 86;
    const sx = rtl ? 120 : W - 120 - sw;
    const sy = ry + (rh - sh) / 2;
    ctx.fillStyle = on ? '#34C759' : '#D1D5DB';
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, sh, sh / 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(on !== rtl ? sx + sw - sh / 2 : sx + sh / 2, sy + sh / 2, sh / 2 - 7, 0, Math.PI * 2);
    ctx.fill();
  });
  foot(ctx, { W, H, shape, f, logo, dark: true });
}

// "Checklist": a to-do list, the last line the one that gets the tick.
function drawChecklist(ctx, W, H, shape, f, logo) {
  ctx.fillStyle = '#FFE66D';
  ctx.fillRect(0, 0, W, H);
  const footTop = footTopOf(shape, H);
  const items = lines(f.items).slice(0, 6).map((l) => [/^x\s/i.test(l), l.replace(/^x\s+/i, '')]);
  // A sheet of paper, slightly turned.
  const top = topOf(shape) + 10;
  const ph = footTop - top - 50;
  ctx.save();
  ctx.translate(W / 2, top + ph / 2);
  ctx.rotate(-0.02);
  ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-W / 2 + 80, -ph / 2, W - 160, ph);
  ctx.shadowColor = 'transparent';
  const L = -W / 2 + 140;
  const rtl = isHe(f.headline + f.items);
  let y = -ph / 2 + 110;
  text(ctx, f.headline, rtl ? W / 2 - 140 : L, y, { size: 64, weight: 700, head: true, align: rtl ? 'right' : 'left', max: W - 280 });
  y += 50;
  const rh = Math.min(120, (ph / 2 - y - 40) / Math.max(items.length, 1));
  items.forEach(([done, label]) => {
    y += rh;
    const bx = rtl ? W / 2 - 140 - 56 : L;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.strokeRect(bx, y - 46, 56, 56);
    if (done) {
      ctx.strokeStyle = '#1F8A50';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(bx + 10, y - 20); ctx.lineTo(bx + 26, y - 2); ctx.lineTo(bx + 62, y - 56);
      ctx.stroke();
    }
    const tx = rtl ? bx - 30 : bx + 86;
    const lf = fonts(label);
    ctx.font = `${done ? 800 : 500} 42px ${lf.body}`;
    ctx.direction = isHe(label) ? 'rtl' : 'ltr';
    const ll = wrap(ctx, label, W - 400, 2);
    ll.forEach((l, k) => text(ctx, l, tx, y + k * 52, { size: 42, weight: done ? 800 : 500, colour: done ? INK : '#555555', align: rtl ? 'right' : 'left' }));
    y += (ll.length - 1) * 52;
    if (!done) {
      const f2 = fonts(label);
      ctx.font = `500 42px ${f2.body}`;
      const w = Math.min(ctx.measureText(label).width, W - 400);
      ctx.strokeStyle = 'rgba(180,35,24,.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(rtl ? tx - w : tx, y - 14);
      ctx.lineTo(rtl ? tx : tx + w, y - 14);
      ctx.stroke();
    }
  });
  ctx.restore();
  foot(ctx, { W, H, shape, f, logo, dark: true });
}

// "Before and after": the post in a chat, then the page it became.
function drawBeforeAfter(ctx, W, H, shape, f, logo, page) {
  ctx.fillStyle = '#F6EFE4';
  ctx.fillRect(0, 0, W, H);
  const footTop = footTopOf(shape, H);
  const y0 = headline(ctx, { text: f.headline, hl: f.highlight, y: topOf(shape), size: 80, W, colour: INK, accent: ACCENT }) + 40;
  const half = W / 2;
  ctx.fillStyle = '#EAE3D9';
  ctx.fillRect(0, y0, half, footTop - y0);
  ctx.fillStyle = '#123B57';
  ctx.fillRect(half, y0, half, footTop - y0);
  text(ctx, f.beforeLabel, half / 2, y0 + 70, { size: 34, weight: 800, colour: '#786E64' });
  text(ctx, f.afterLabel, half + half / 2, y0 + 70, { size: 34, weight: 800, colour: '#FFD600' });
  // Before: one grey bubble lost among others.
  const bf = fonts(f.before);
  ctx.font = `500 30px ${bf.body}`;
  ctx.direction = isHe(f.before) ? 'rtl' : 'ltr';
  const bl = wrap(ctx, f.before, half - 140, 5);
  let by = y0 + 130;
  [0.35, 1, 0.35, 0.35].forEach((alpha, i) => {
    const h = i === 1 ? 40 + bl.length * 40 : 90;
    ctx.fillStyle = i === 1 ? '#D9FDD3' : `rgba(255,255,255,${0.5 + alpha})`;
    ctx.beginPath();
    ctx.roundRect(50, by, half - 100, h, 24);
    ctx.fill();
    if (i === 1) bl.forEach((l, k) => text(ctx, l, isHe(f.before) ? half - 74 : 74, by + 50 + k * 40, { size: 30, weight: 500, align: isHe(f.before) ? 'right' : 'left' }));
    else { ctx.fillStyle = 'rgba(17,24,39,.15)'; ctx.fillRect(74, by + 30, half - 220, 14); ctx.fillRect(74, by + 54, half - 300, 14); }
    by += h + 22;
  });
  // After: the page on a phone.
  const room = footTop - y0 - 140;
  const ph = Math.min(room, 760);
  const pw = ph * 390 / 844;
  phoneFrame(ctx, page, half + (half - pw) / 2, y0 + 110, pw, ph, 40);
  foot(ctx, { W, H, shape, f, logo, dark: false });
}

async function render(target, ad, shape, scale = 1) {
  const [W, H] = SHAPES[shape];
  const canvas = sharpCanvas(target, scale);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const f = ad.fields;
  const logo = await loadImage(LOGO);
  await Promise.all(['700 80px "Playfair Display"', '700 40px Manrope', '500 30px Manrope', '800 30px Manrope',
    '700 80px "Frank Ruhl Libre"', '700 40px Assistant'].map((x) => document.fonts?.load(x).catch(() => null)));
  // A Hebrew ad's scene is mirrored (its words sit on the right), its real screen laid on the right way round.
  if (SCENES.includes(ad.design)) {
    const rtl = isHe(`${f.headline}${f.headline2}${f.sub}`) ? '-rtl' : '';
    drawScene(ctx, W, H, shape, f, logo, await loadImage(`/ads/scenes/${ad.design}-${shape}${rtl}.jpg`));
  } else if (ad.design === 'chat') drawChat(ctx, W, H, shape, f, logo);
  else if (ad.design === 'call') drawCall(ctx, W, H, shape, f, logo);
  else if (ad.design === 'bgphoto') drawBackdropPhoto(ctx, W, H, shape, f, logo, f.photo ? await loadImage(f.photo) : null);
  else if (ad.design === 'notify') drawNotify(ctx, W, H, shape, f, logo, await loadImage(f.page));
  else if (ad.design === 'search') drawSearch(ctx, W, H, shape, f, logo, await loadImage(f.page));
  else if (ad.design === 'toggle') drawToggles(ctx, W, H, shape, f, logo);
  else if (ad.design === 'checklist') drawChecklist(ctx, W, H, shape, f, logo);
  else if (ad.design === 'beforeafter') drawBeforeAfter(ctx, W, H, shape, f, logo, await loadImage(f.page));
  else if (ad.design === 'showcase') {
    const pages = await Promise.all((f.pages || []).slice(0, 3).map(loadImage));
    drawShowcase(ctx, W, H, shape, f, logo, pages);
  } else drawPhoto(ctx, W, H, shape, f, logo, await loadImage(f.photo));
}

// A new ad of a design, in the dashboard's language (adStudio.defaults.*).
function freshAd(design, t, lang) {
  const d = (k) => t(`adStudio.defaults.${design}.${k}`);
  const common = { title: d('title'), line: d('line'), link: 'myisraelrental.com', caption: d('caption') };
  if (SCENES.includes(design)) {
    return { design, lang, name: d('name'), fields: { ...common, link: d('link'), headline: d('headline'), headline2: d('headline2'), sub: d('sub') } };
  }
  if (design === 'chat') {
    return { design, lang, name: d('name'), fields: { ...common, headline: d('headline'), highlight: d('highlight'),
      group: d('group'), post: d('post'), messages: d('messages'), pill: d('pill') } };
  }
  if (design === 'showcase') {
    return { design, lang, name: d('name'), fields: { ...common, line1: d('line1'), line2: d('line2'),
      label: d('label'), pages: PAGES.slice(0, 3).map((p) => `/ads/pages/${p}.jpg`) } };
  }
  if (design === 'photo') {
    return { design, lang, name: d('name'), fields: { ...common, headline: d('headline'), highlight: d('highlight'), sub: d('sub'), photo: `/ads/pages/${PAGES[1]}.jpg` } };
  }
  if (design === 'bgphoto') {
    return { design, lang, name: d('name'), fields: { ...common, headline: d('headline'), highlight: d('highlight'), sub: d('sub'), photo: '' } };
  }
  // The six from 3 Nov: their own words, and a page where they show one.
  const keys = { call: ['caller', 'calling', 'decline', 'accept'], notify: ['time', 'date', 'notes'],
    search: ['kicker', 'question', 'answerTitle', 'answer'], toggle: ['headline', 'highlight', 'switches'],
    checklist: ['headline', 'items'], beforeafter: ['headline', 'highlight', 'beforeLabel', 'before', 'afterLabel'] }[design];
  const fields = { ...common };
  keys.forEach((k) => { fields[k] = d(k); });
  if (['notify', 'search', 'beforeafter'].includes(design)) fields.page = `/ads/pages/${PAGES[0]}.jpg`;
  return { design, lang, name: d('name'), fields };
}

export const DESIGNS = [...SCENES, 'bgphoto', 'chat', 'showcase', 'photo', 'call', 'notify', 'search', 'toggle', 'checklist', 'beforeafter'];

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
  // A picture of every design, and of every saved ad (Tzvi, 4 Nov 2026:
  // people do not know which kind will speak to them until they see it).
  const [thumbs, setThumbs] = useState({});
  const [savedThumbs, setSavedThumbs] = useState({});
  const small = async (big, a) => {
    await render(big, a, 'post');
    const c = document.createElement('canvas');
    c.width = 270;
    c.height = Math.round((270 * big.height) / big.width);
    c.getContext('2d').drawImage(big, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.75);
  };
  useEffect(() => {
    let gone = false;
    (async () => {
      const big = document.createElement('canvas');
      const out = {};
      for (const d of DESIGNS) {
        // eslint-disable-next-line no-await-in-loop
        out[d] = await small(big, freshAd(d, i18n.getFixedT(lang), lang));
        if (gone) return;
        setThumbs({ ...out });
      }
    })();
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  useEffect(() => {
    let gone = false;
    (async () => {
      const big = document.createElement('canvas');
      const out = {};
      for (const a of ads) {
        // eslint-disable-next-line no-await-in-loop
        out[a.id] = await small(big, a);
        if (gone) return;
        setSavedThumbs({ ...out });
      }
    })();
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads]);
  // Open on the first design, so there is always an ad to change.
  useEffect(() => { if (!ad) setAd(freshAd(DESIGNS[0], i18n.getFixedT(lang), lang)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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

  // A photo from the gallery fills a photo design, or opens one with it.
  const pickBg = (url) => {
    if (ad.design === 'photo' || ad.design === 'bgphoto') { set('photo', url); return; }
    const fresh = freshAd('bgphoto', i18n.getFixedT(lang), lang);
    setAd({ ...fresh, fields: { ...fresh.fields, photo: url } });
  };

  const fileName = () => `${(ad.name || 'ad').replace(/[^\w֐-׿-]+/g, '-')}-${shape}.jpg`;
  const blob = async () => {
    const big = document.createElement('canvas');
    await render(big, ad, shape, 2);
    return new Promise((r) => { big.toBlob(r, 'image/jpeg', 0.95); });
  };
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

      <div className="space-y-1.5">
        <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('adStudio.galleryTitle', 'Pick a look. Every word and picture can be changed after.')}</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2" data-testid="ad-studio-gallery">
          {DESIGNS.map((d) => {
            const on = ad && !ad.id && ad.design === d;
            return (
              <button key={d} type="button" onClick={() => setAd(freshAd(d, i18n.getFixedT(lang), lang))} aria-pressed={on}
                className="text-center min-w-0" data-testid={`ad-studio-new-${d}`}>
                <span className="block aspect-[4/5] rounded-lg overflow-hidden border-2 bg-[#F9FAFB] flex items-center justify-center"
                  style={{ borderColor: on ? '#000' : 'var(--brand-border)' }}>
                  {thumbs[d] ? <img src={thumbs[d]} alt="" className="w-full h-full object-cover" />
                    : <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
                </span>
                <span className="block mt-1 text-[11px] leading-tight font-semibold truncate" style={{ color: 'var(--ink)' }}>{t(`adStudio.design.${d}`)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {ads.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('adStudio.savedAds')}</p>
          <div className="flex gap-2 overflow-x-auto pb-1" data-testid="ad-studio-saved">
            {ads.map((a) => (
              <div key={a.id} className="relative shrink-0 w-[96px]">
                <button type="button" onClick={() => setAd(a)} aria-pressed={ad?.id === a.id} className="block w-full text-center" data-testid={`ad-studio-open-${a.id}`}>
                  <span className="block aspect-[4/5] rounded-lg overflow-hidden border-2 bg-[#F9FAFB] flex items-center justify-center"
                    style={{ borderColor: ad?.id === a.id ? '#000' : 'var(--brand-border)' }}>
                    {savedThumbs[a.id] ? <img src={savedThumbs[a.id]} alt="" className="w-full h-full object-cover" />
                      : <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
                  </span>
                  <span className="block mt-1 text-[11px] leading-tight font-semibold truncate" dir="auto" style={{ color: 'var(--ink)' }}>{a.name}</span>
                </button>
                <button type="button" onClick={() => remove(a)} aria-label={t('adStudio.delete')} className="absolute top-1 end-1 p-1 rounded-full bg-white/90"><Trash2 size={12} /></button>
              </div>
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
            {SCENES.includes(ad.design) && [box('headline'), box('headline2'), box('sub', 2)]}
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
            {ad.design === 'call' && [box('caller'), box('calling'), box('decline'), box('accept')]}
            {ad.design === 'notify' && [box('time'), box('date'), box('notes', 5)]}
            {ad.design === 'search' && [box('kicker'), box('question'), box('answerTitle'), box('answer', 3)]}
            {ad.design === 'toggle' && [box('headline', 2), box('highlight'), box('switches', 5)]}
            {ad.design === 'checklist' && [box('headline'), box('items', 6)]}
            {ad.design === 'beforeafter' && [box('headline', 2), box('highlight'), box('beforeLabel'), box('before', 3), box('afterLabel')]}
            {'page' in ad.fields && (
              <div className="flex items-end gap-2">
                <label className="block flex-1">
                  <span className={label} style={{ color: 'var(--ink)' }}>{t('adStudio.field.page')}</span>
                  <select className={field} value={PAGES.find((p) => ad.fields.page === `/ads/pages/${p}.jpg`) || ''}
                    onChange={(e) => set('page', `/ads/pages/${e.target.value}.jpg`)} data-testid="ad-studio-page">
                    {!PAGES.some((p) => ad.fields.page === `/ads/pages/${p}.jpg`) && <option value="">{t('adStudio.uploadedPicture')}</option>}
                    {PAGES.map((p) => <option key={p} value={p}>{p.replace(/-/g, ' ')}</option>)}
                  </select>
                </label>
                <label className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold cursor-pointer pb-2.5" style={{ color: 'var(--brand-primary)' }}>
                  <Upload size={13} /> {t('adStudio.upload')}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], (url) => set('page', url))} />
                </label>
              </div>
            )}
            <BackgroundGallery API={API} token={token} lang={lang} onPick={pickBg} />
            {(ad.design === 'photo' || ad.design === 'bgphoto') && (
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
