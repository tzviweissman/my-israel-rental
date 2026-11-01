/**
 * The ad maker (Tzvi, 29 Oct 2026): a ready-to-post advert for a listing or
 * a business, in three shapes (square post, feed post, status/story) and
 * five designs (light, dark, more photos, a real review, story), with the
 * owner's own short link and its QR code on it. The rules every design
 * follows are in docs/static-ad-rules.md.
 *
 * The picture is drawn here, in the browser, from the owner's own photos:
 * no image is generated, so an ad never shows a place or a product that is
 * not theirs. Every photo is drawn whole at its own shape, never cropped;
 * the layout gives the text whatever room the photo leaves. The words come
 * from POST /ads/make (about a cent a call) and stay editable, because the
 * owner is the one posting them.
 *
 * The link is the target's short link (routes/short_links.py), the same one
 * as the owner's QR code, so visits from an ad show up in its scan count.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import { toast } from 'sonner';
import { Copy, Download, Loader2, RefreshCw, Share2, X } from 'lucide-react';
import { regularShown, holidayShown, formatShownPrice, priceSymbol } from '../../utils/listingPrice';
import { areaLabel } from '../../utils/areaNames';

const SITE = 'https://myisraelrental.com';
const FORMATS = { square: [1080, 1080], feed: [1080, 1350], story: [1080, 1920] };
const INK = '#111827';
const MUTED = '#666666';
const ACCENT = '#167AB8';

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

// Word-wrapped lines, the last one shortened with "…" if it does not fit.
function wrap(ctx, text, width, maxLines) {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = `${lines[maxLines - 1]}…`;
    while (last.length > 2 && ctx.measureText(last).width > width) last = `${last.slice(0, -2)}…`;
    lines[maxLines - 1] = last;
  }
  return lines;
}

// A photo whole inside a box: the largest size that fits, centred.
const fitIn = (img, w, h) => {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  return [Math.round(img.naturalWidth * s), Math.round(img.naturalHeight * s)];
};

function roundedImage(ctx, img, x, y, w, h, r) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function draw(canvas, { format, design, words, eyebrow, price, cta, shortUrl, rtl, imgs, qr }) {
  const [W, H] = FORMATS[format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const dark = design === 'night';
  const gallery = design === 'gallery';
  const PAD = 64;
  // A story is seen full-screen on a phone: bigger words, not more space.
  const k = format === 'story' ? 1.3 : 1;
  const px = (n) => Math.round(n * k);
  const head = rtl ? '"Frank Ruhl Libre", Georgia, serif' : '"Playfair Display", Georgia, serif';
  const body = rtl ? 'Assistant, system-ui, sans-serif' : 'Manrope, system-ui, sans-serif';
  const textW = W - PAD * 2;
  ctx.fillStyle = dark ? INK : '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  const start = rtl ? W - PAD : PAD;

  // Measure everything first: the text block, then the photos get what is
  // left, then whatever neither uses is shared out above and below so the
  // ad never has a hole in the middle.
  ctx.font = `600 ${px(64)}px ${head}`;
  const headLines = wrap(ctx, words.headline, textW, 2);
  const QR = format === 'square' ? 150 : px(190);
  const footH = QR + 48;
  const pointsH = 3 * px(54) + 16;
  const textH = px(44) + headLines.length * px(76) + (price ? px(64) + 20 : 0);
  const [cover, ...rest] = imgs;
  const withPoints = words.points.length > 0
    && (!cover || H - PAD * 2 - footH - textH - pointsH >= H * 0.42);
  const blockH = textH + (withPoints ? pointsH : 0);
  const gap = 16;
  const photoRoom = H - (gallery ? 0 : PAD) - blockH - footH - PAD - 40;

  let cw = 0; let ch = 0; let rowH = 0; let row = [];
  if (cover) {
    row = gallery ? rest.slice(0, 3) : [];
    if (row.length >= 2) {
      const ratios = row.map((i) => i.naturalWidth / i.naturalHeight);
      rowH = Math.min(Math.round((textW - gap * (row.length - 1)) / ratios.reduce((a, b) => a + b, 0)), Math.round(photoRoom * 0.35));
    } else row = [];
    [cw, ch] = fitIn(cover, gallery ? W : textW, photoRoom - (rowH ? rowH + gap : 0));
  }
  const photosH = cover ? ch + (rowH ? gap + rowH : 0) + 40 : 0;
  const spare = Math.max(0, H - (gallery ? 0 : PAD) - photosH - blockH - footH - PAD);
  // A full-width gallery cover stays on the top edge; otherwise centre.
  let y = (gallery && cw >= W - 1 ? 0 : PAD + spare / 2);

  if (cover) {
    const cx = (W - cw) / 2;
    if (gallery && cw >= W - 1) ctx.drawImage(cover, 0, 0, cw, ch);
    else {
      if (!dark) { ctx.shadowColor = 'rgba(17,24,39,.18)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12; }
      roundedImage(ctx, cover, cx, y, cw, ch, 28);
      ctx.shadowColor = 'transparent';
    }
    y += ch;
    if (rowH) {
      y += gap;
      const widths = row.map((i) => Math.round(rowH * i.naturalWidth / i.naturalHeight));
      const total = widths.reduce((a, b) => a + b, 0) + gap * (row.length - 1);
      let x = (W - total) / 2;
      row.forEach((img, i) => { roundedImage(ctx, img, x, y, widths[i], rowH, 18); x += widths[i] + gap; });
      y += rowH;
    }
    y += 40;
    if (gallery && cw >= W - 1) y += spare;
  }

  ctx.fillStyle = dark ? 'rgba(255,255,255,.7)' : MUTED;
  ctx.font = `600 ${px(30)}px ${body}`;
  ctx.fillText(wrap(ctx, eyebrow, textW, 1)[0] || '', start, y + px(30));
  y += px(44);
  ctx.fillStyle = dark ? '#FFFFFF' : INK;
  ctx.font = `600 ${px(64)}px ${head}`;
  headLines.forEach((l) => { y += px(76); ctx.fillText(l, start, y - px(14)); });

  if (price) {
    y += 20;
    const h = px(64);
    ctx.font = `700 ${px(38)}px ${body}`;
    const pw = Math.min(ctx.measureText(price).width + 48, textW);
    const x0 = rtl ? W - PAD - pw : PAD;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.roundRect(x0, y, pw, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(wrap(ctx, price, pw - 48, 1)[0], rtl ? x0 + pw - 24 : x0 + 24, y + h * 0.7);
    y += h;
  }

  if (withPoints) {
    y += 16;
    ctx.font = `500 ${px(36)}px ${body}`;
    words.points.forEach((pt) => {
      y += px(54);
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(rtl ? W - PAD - px(9) : PAD + px(9), y - px(12), px(9), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dark ? '#FFFFFF' : INK;
      ctx.fillText(wrap(ctx, pt, textW - px(36), 1)[0] || '', rtl ? W - PAD - px(34) : PAD + px(34), y);
    });
  }

  drawFooter(ctx, { W, PAD, QR, rtl, dark, cta, shortUrl, qr, body, px, start, textW, bottom: H - PAD });
}

// The link and its code. The code sits on a white tile even on the dark
// design: scanners need dark modules on light.
function drawFooter(ctx, { W, PAD, QR, rtl, dark, cta, shortUrl, qr, body, px, start, textW, bottom }) {
  const qy = bottom - QR;
  const qx = rtl ? PAD : W - PAD - QR;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(qx - 10, qy - 10, QR + 20, QR + 20, 16);
  ctx.fill();
  if (qr) ctx.drawImage(qr, qx, qy, QR, QR);
  const linkW = textW - QR - 40;
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.fillStyle = dark ? '#FFFFFF' : INK;
  ctx.font = `700 ${px(34)}px ${body}`;
  ctx.fillText(wrap(ctx, cta, linkW, 1)[0], start, qy + QR / 2 - 6);
  ctx.fillStyle = dark ? 'rgba(255,255,255,.7)' : ACCENT;
  ctx.font = `600 ${px(30)}px ${body}`;
  ctx.fillText(wrap(ctx, shortUrl.replace(/^https?:\/\//, ''), linkW, 1)[0], start, qy + QR / 2 + px(40));
}

// The average colour of a band of a photo's top or bottom rows: the ground
// the Story design puts above and below it. Never a blurred copy, which read
// as "a weird grey area" (Tzvi, 27 Oct).
function edgeColour(img, fromTop) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 1;
  const ctx = c.getContext('2d');
  const band = Math.max(1, Math.round(img.naturalHeight * 0.04));
  ctx.drawImage(img, 0, fromTop ? 0 : img.naturalHeight - band, img.naturalWidth, band, 0, 0, 16, 1);
  const d = ctx.getImageData(0, 0, 16, 1).data;
  let r = 0; let g = 0; let b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}

const bodyFont = (rtl) => (rtl ? 'Assistant, system-ui, sans-serif' : 'Manrope, system-ui, sans-serif');

function pricePill(ctx, { price, x, y, h, maxW, rtl, centre, size, W }) {
  ctx.font = `700 ${size}px ${ctx.bodyFamily}`;
  const pw = Math.min(ctx.measureText(price).width + 48, maxW);
  const x0 = centre ? (W - pw) / 2 : (rtl ? x - pw : x);
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.roundRect(x0, y, pw, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = centre ? 'center' : (rtl ? 'right' : 'left');
  const tx = centre ? W / 2 : (rtl ? x0 + pw - 24 : x0 + 24);
  ctx.fillText(wrap(ctx, price, pw - 48, 1)[0], tx, y + h * 0.68);
}

// "Review" (docs/static-ad-rules.md 9.1): a real review in the reviewer's
// own words, as a comment card on top; the photo under it; the price and
// the link. Shortened only by cutting, with "…". No heart or like count:
// nobody liked it, so the ad does not say so.
function drawReview(canvas, { format, review, eyebrow, price, cta, shortUrl, rtl, imgs, qr, sourceLabel }) {
  const [W, H] = FORMATS[format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const PAD = 64;
  const k = format === 'story' ? 1.3 : 1;
  const px = (n) => Math.round(n * k);
  const body = bodyFont(rtl);
  ctx.bodyFamily = body;
  const textW = W - PAD * 2;
  const start = rtl ? W - PAD : PAD;
  ctx.fillStyle = '#F9FAFB';
  ctx.fillRect(0, 0, W, H);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';

  const inner = textW - 72;
  // A review keeps the direction of its own words: an English review on a
  // Hebrew ad still reads left to right, with its quote marks in place.
  const qRtl = /[֐-׿]/.test(review.text);
  const qSize = format === 'square' ? 34 : 40;
  const qLine = format === 'square' ? 48 : 56;
  ctx.font = `500 ${px(qSize)}px ${body}`;
  ctx.direction = qRtl ? 'rtl' : 'ltr';
  const lines = wrap(ctx, `“${review.text}”`, inner, format === 'square' ? 3 : 4);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  const AV = px(72);
  const cardH = 36 + AV + 24 + lines.length * px(qLine) + 36;
  const QR = format === 'square' ? 150 : px(190);
  const footH = QR + 48;
  const tailH = px(44) + (price ? px(64) + 20 : 0);
  let y = PAD;

  // The comment card, with a small tail pointing down at the photo.
  ctx.shadowColor = 'rgba(17,24,39,.12)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(PAD, y, textW, cardH, 32);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const tailX = rtl ? W - PAD - 120 : PAD + 120;
  ctx.beginPath();
  ctx.moveTo(tailX - 22, y + cardH - 1); ctx.lineTo(tailX, y + cardH + 26); ctx.lineTo(tailX + 22, y + cardH - 1);
  ctx.fill();

  const name = review.name || '';
  const ax = rtl ? W - PAD - 36 - AV : PAD + 36;
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(ax + AV / 2, y + 36 + AV / 2, AV / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = `700 ${px(34)}px ${body}`;
  ctx.fillText((name.trim()[0] || '★').toUpperCase(), ax + AV / 2, y + 36 + AV / 2 + px(12));
  ctx.textAlign = rtl ? 'right' : 'left';
  const nx = rtl ? ax - 20 : ax + AV + 20;
  ctx.fillStyle = INK;
  ctx.font = `700 ${px(32)}px ${body}`;
  ctx.direction = /[֐-׿]/.test(name) || !/[A-Za-z]/.test(name) ? (rtl ? 'rtl' : 'ltr') : 'ltr';
  ctx.fillText(wrap(ctx, name, inner - AV - 20, 1)[0] || '', nx, y + 36 + px(30));
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.fillStyle = ACCENT;
  ctx.font = `400 ${px(30)}px ${body}`;
  const stars = '★'.repeat(Math.max(1, Math.min(5, Math.round(review.rating || 5))));
  ctx.fillText(sourceLabel ? `${stars}  ${sourceLabel}` : stars, nx, y + 36 + AV - 4);
  ctx.fillStyle = INK;
  ctx.font = `500 ${px(qSize)}px ${body}`;
  ctx.direction = qRtl ? 'rtl' : 'ltr';
  ctx.textAlign = qRtl ? 'right' : 'left';
  let ly = y + 36 + AV + 24;
  lines.forEach((l) => { ly += px(qLine); ctx.fillText(l, qRtl ? W - PAD - 36 : PAD + 36, ly - px(14)); });
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  y += cardH + 60;

  // The photo, whole, in whatever room is left.
  const room = H - y - tailH - footH - PAD - 40;
  if (imgs[0] && room > 120) {
    const [cw, ch] = fitIn(imgs[0], textW, room);
    ctx.shadowColor = 'rgba(17,24,39,.18)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
    roundedImage(ctx, imgs[0], (W - cw) / 2, y + (room - ch) / 2, cw, ch, 28);
    ctx.shadowColor = 'transparent';
  }
  y = H - PAD - footH - tailH;
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `600 ${px(30)}px ${body}`;
  ctx.fillText(wrap(ctx, eyebrow, textW, 1)[0] || '', start, y + px(30));
  y += px(44);
  if (price) pricePill(ctx, { price, x: start, y: y + 20, h: px(64), maxW: textW, rtl, size: px(38), W });
  drawFooter(ctx, { W, PAD, QR, rtl, dark: false, cta, shortUrl, qr, body, px, start, textW, bottom: H - PAD });
}

// "Story" (docs/static-ad-rules.md 9.2): the photo across the whole width,
// whole, on its own edge colours; the headline and up to two points in
// plain white boxes, the way people write on their own status; the link on
// a white panel. Kept clear of the top 220px and the bottom 230px, where
// Instagram and WhatsApp draw the account name and the reply bar.
function drawStory(canvas, { words, price, cta, shortUrl, rtl, imgs, qr }) {
  const [W, H] = FORMATS.story;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const PAD = 64;
  const body = bodyFont(rtl);
  ctx.bodyFamily = body;
  const textW = W - PAD * 2;
  const cover = imgs[0];
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  if (cover) {
    const [cw, ch] = fitIn(cover, W, H);
    // Just under the account name a story draws on top, not centred: a
    // centred landscape photo leaves a wide empty band over it.
    const cy = Math.min(Math.round((H - ch) / 2), 220);
    ctx.fillStyle = edgeColour(cover, true);
    ctx.fillRect(0, 0, W, cy + 2);
    ctx.fillStyle = edgeColour(cover, false);
    ctx.fillRect(0, cy + ch - 2, W, H - cy - ch + 2);
    ctx.drawImage(cover, (W - cw) / 2, cy, cw, ch);
  }
  ctx.direction = rtl ? 'rtl' : 'ltr';

  const lines = [words.headline, ...words.points.slice(0, 2)].filter((l) => (l || '').trim());
  ctx.font = `600 46px ${body}`;
  const boxes = [];
  lines.forEach((l, i) => wrap(ctx, l, textW - 56, i === 0 ? 2 : 1).forEach((part) => boxes.push(part)));
  const BH = 76;
  const GAP = 10;
  const QR = 170;
  const panelH = QR + 60;
  const panelTop = H - 230 - panelH;
  let y = panelTop - 40 - (boxes.length * (BH + GAP) + (price ? 92 : 0));
  ctx.textAlign = 'center';
  boxes.forEach((part) => {
    ctx.font = `600 46px ${body}`;
    const w = Math.min(ctx.measureText(part).width + 56, textW);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect((W - w) / 2, y, w, BH, 12);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.fillText(part, W / 2, y + 52);
    y += BH + GAP;
  });
  if (price) pricePill(ctx, { price, y: y + 16, h: 76, maxW: textW, rtl, centre: true, size: 42, W });

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(PAD - 24, panelTop, textW + 48, panelH, 28);
  ctx.fill();
  const px = (n) => n;
  drawFooter(ctx, { W, PAD: PAD + 16, QR, rtl, dark: false, cta, shortUrl, qr, body, px,
    start: rtl ? W - PAD - 16 : PAD + 16, textW: textW - 32, bottom: panelTop + 30 + QR });
}

export default function AdMaker({ API, token, targetType, target, onClose }) {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState(i18n.language?.startsWith('he') ? 'he' : 'en');
  const [format, setFormat] = useState('feed');
  const [design, setDesignRaw] = useState('clean');
  const [reviewIdx, setReviewIdx] = useState(0);
  // Story is drawn for the tall status shape only, so picking it picks the
  // shape, and picking another shape leaves it.
  const setDesign = (d) => { setDesignRaw(d); if (d === 'native') setFormat('story'); };
  const pickFormat = (f) => { setFormat(f); if (f !== 'story' && design === 'native') setDesignRaw('clean'); };
  const [ad, setAd] = useState(null);
  const [words, setWords] = useState(null);
  const [imgs, setImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const canvasRef = useRef(null);
  const qrRef = useRef(null);
  const lt = i18n.getFixedT(lang);
  const rtl = lang === 'he';

  const write = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/ads/make`,
        { target_type: targetType, target_id: target.id, lang },
        { headers: { Authorization: `Bearer ${token}` } });
      setAd(data);
      setWords({ headline: data.headline, points: data.points, caption: data.caption });
      const loaded = (await Promise.all((data.photos || []).slice(0, 4).map(loadImage))).filter(Boolean);
      setImgs(loaded);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('ads.failed', 'Could not write the ad. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  // Once per language: each call is paid, and React's development mode
  // runs effects twice.
  const wroteFor = useRef('');
  useEffect(() => {
    if (wroteFor.current === lang) return;
    wroteFor.current = lang;
    write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const shortUrl = ad ? `${SITE}${ad.link.path}` : SITE;
  let price = '';
  if (targetType === 'property') {
    price = formatShownPrice(regularShown(target) || holidayShown(target), lt) || '';
  } else if (ad?.from_price) {
    price = lt('ads.from', 'From {{price}}', { price: `${priceSymbol(ad.from_price.currency)}${Math.round(ad.from_price.amount).toLocaleString()}` });
  }
  const reviews = ad?.reviews || [];
  const eyebrow = targetType === 'property' ? areaLabel(target.area, lt) : target.name;
  const cta = targetType === 'property' ? lt('ads.ctaStay', 'See photos and book') : lt('ads.ctaBusiness', 'See more and order');

  useEffect(() => {
    if (!words || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      // The Hebrew and English faces load only when a page uses them, and
      // canvas text drawn before then falls back to a system font.
      const head = rtl ? 'Frank Ruhl Libre' : 'Playfair Display';
      const body = rtl ? 'Assistant' : 'Manrope';
      await Promise.all([`600 64px "${head}"`, `600 30px "${body}"`, `700 34px "${body}"`]
        .map((f) => document.fonts?.load(f).catch(() => null)));
      if (cancelled) return;
      const review = design === 'review' ? reviews[reviewIdx % reviews.length] : null;
      if (review) {
        drawReview(canvasRef.current, { format, review, eyebrow, price, cta, shortUrl, rtl, imgs, qr: qrRef.current,
          sourceLabel: review.source === 'google' ? lt('ads.googleReview', 'Google review') : '' });
      } else if (design === 'native') {
        drawStory(canvasRef.current, { words, price, cta, shortUrl, rtl, imgs, qr: qrRef.current });
      } else {
        draw(canvasRef.current, { format, design, words, eyebrow, price, cta, shortUrl, rtl, imgs, qr: qrRef.current });
      }
      setPreview(canvasRef.current.toDataURL('image/jpeg', 0.85));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, format, design, imgs, rtl, eyebrow, price, cta, shortUrl, reviews, reviewIdx]);

  const postText = words ? `${words.caption}\n\n${shortUrl}` : '';
  const copyText = async () => {
    try { await navigator.clipboard.writeText(postText); toast.success(t('ads.copied', 'Post text copied')); } catch { /* shown in the box */ }
  };
  const sharePicture = () => canvasRef.current.toBlob(async (blob) => {
    const file = new File([blob], `ad-${format}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: postText }).catch(() => {});
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      copyText();
    }
  }, 'image/jpeg', 0.92);

  const chip = (on) => `px-3 py-1.5 rounded-full text-xs font-semibold border ${on ? 'text-white border-transparent' : ''}`;
  const chipStyle = (on) => (on ? { background: '#000' } : { borderColor: 'var(--brand-border)', color: 'var(--ink)' });
  const Chips = ({ value, set, options }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([k, label, disabled]) => (
        <button key={k} type="button" disabled={disabled} onClick={() => set(k)} aria-pressed={value === k}
          className={`${chip(value === k)} disabled:opacity-40`} style={chipStyle(value === k)} data-testid={`ad-${k}`}>
          {label}
        </button>
      ))}
    </div>
  );
  const field = 'w-full rounded-lg border px-3 py-2 text-sm';

  // A portal: the listing card it opens from lifts on hover with a
  // transform, and a fixed overlay inside a transform is drawn inside the card.
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true"
      aria-label={t('ads.title', 'Make an ad')} onClick={onClose} data-testid="ad-maker">
      <div className="bg-white w-full sm:max-w-4xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>{t('ads.title', 'Make an ad')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')} className="p-3 rounded-full hover:bg-[#F9FAFB]"><X size={18} /></button>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="bg-[#F9FAFB] rounded-xl flex items-center justify-center p-3 min-h-[280px]">
            {preview && !busy
              ? <img src={preview} alt={t('ads.previewAlt', 'Your ad')} className="max-h-[60vh] w-auto rounded-lg shadow" data-testid="ad-preview" />
              : <Loader2 className="animate-spin" size={28} aria-label={t('ads.writing', 'Writing your ad…')} />}
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('ads.shape', 'Where will you post it?')}</p>
              <Chips value={format} set={pickFormat} options={[
                ['square', t('ads.square', 'Square post')], ['feed', t('ads.feed', 'Facebook / Instagram')], ['story', t('ads.story', 'WhatsApp status / story')]]} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('ads.design', 'Design')}</p>
              <Chips value={design} set={setDesign} options={[
                ['clean', t('ads.clean', 'Light')], ['night', t('ads.night', 'Dark')], ['gallery', t('ads.gallery', 'More photos'), imgs.length < 3],
                ['review', t('ads.review', 'A real review'), !reviews.length], ['native', t('ads.storyDesign', 'Story'), !imgs.length]]} />
              {design === 'review' && reviews.length > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--brand-muted)' }} data-testid="ad-review-note">
                  <span>{t('ads.reviewBy', 'A review by {{name}}, in their own words', { name: reviews[reviewIdx % reviews.length].name || '?' })}</span>
                  {reviews.length > 1 && (
                    <button type="button" onClick={() => setReviewIdx((i) => i + 1)} className="font-semibold shrink-0" style={{ color: 'var(--brand-primary)' }} data-testid="ad-next-review">
                      {t('ads.anotherReview', 'Another review')}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('ads.language', 'Language of the ad')}</p>
              <Chips value={lang} set={setLang} options={[['en', 'English'], ['he', 'עברית']]} />
            </div>
            {words && (
              <div className="space-y-2" dir={rtl ? 'rtl' : 'ltr'}>
                <div className="flex items-center justify-between" dir="auto">
                  <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('ads.words', 'The words (change anything)')}</p>
                  <button type="button" onClick={write} disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--brand-primary)' }} data-testid="ad-rewrite">
                    <RefreshCw size={12} /> {t('ads.rewrite', 'Write again')}
                  </button>
                </div>
                <input className={field} value={words.headline} maxLength={60} onChange={(e) => setWords({ ...words, headline: e.target.value })} aria-label={t('ads.headline', 'Headline')} />
                {words.points.map((p, i) => (
                  <input key={i} className={field} value={p} maxLength={40} aria-label={t('ads.point', 'Selling point')}
                    onChange={(e) => setWords({ ...words, points: words.points.map((q, j) => (j === i ? e.target.value : q)) })} />
                ))}
                <textarea className={field} rows={4} value={words.caption} onChange={(e) => setWords({ ...words, caption: e.target.value })} aria-label={t('ads.caption', 'Post text')} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={sharePicture} disabled={!preview || busy}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#000' }} data-testid="ad-share">
                {navigator.canShare ? <Share2 size={15} /> : <Download size={15} />} {t('ads.share', 'Post the picture')}
              </button>
              <button type="button" onClick={copyText} disabled={!words}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="ad-copy">
                <Copy size={15} /> {t('ads.copy', 'Copy the post text')}
              </button>
            </div>
            <p className="text-[11px] text-gray-600">{t('ads.hint', 'The link on the ad is your own short link, so you can see how many people opened it under "Share & QR code".')}</p>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="hidden"><QRCodeCanvas ref={qrRef} value={shortUrl} size={380} marginSize={2} level="M" fgColor={INK} /></div>
      </div>
    </div>,
    document.body,
  );
}
