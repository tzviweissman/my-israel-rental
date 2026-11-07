/**
 * The ad maker (Tzvi, 29 Oct 2026): a ready-to-post advert for a listing or
 * a business, in three shapes (square post, feed post, status/story) and
 * eleven designs, all shown at once as small previews, with the owner's own
 * short link and its QR code on it. The six that stand out (colour block,
 * big words, grid, side by side, sticky note, question) came from studying
 * 1 Nov 2026; the rules every design follows are in docs/static-ad-rules.md.
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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';
import { sharpCanvas, bestPhoto } from '../../utils/sharpCanvas';
import { adVideo } from '../../utils/adVideo';
import BackgroundGallery from './BackgroundGallery';
import axios from 'axios';
import { toast } from 'sonner';
import { Copy, Download, ExternalLink, Film, Layers, Loader2, Printer, RefreshCw, Save, Share2, X } from 'lucide-react';
import { regularShown, holidayShown, formatShownPrice, priceSymbol } from '../../utils/listingPrice';
import { areaLabel } from '../../utils/areaNames';

const SITE = 'https://myisraelrental.com';
const FORMATS = { square: [1080, 1080], feed: [1080, 1350], story: [1080, 1920] };
const INK = '#111827';
const MUTED = '#666666';
const ACCENT = '#167AB8';
const NONE = []; // one empty list, so effects that depend on it do not rerun forever

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = bestPhoto(src);
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
  paintGround(ctx, W, H);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  const start = rtl ? W - PAD : PAD;

  // Measure everything first: the text block, then the photos get what is
  // left, then whatever neither uses is shared out above and below so the
  // ad never has a hole in the middle.
  ctx.font = `600 ${px(64)}px ${head}`;
  const headLines = wrap(ctx, words.headline, textW, 2);
  const QR = format === 'square' ? 150 : px(190);
  const safe = format === 'story' ? 230 : 0; // a story's reply bar covers its bottom 230px (rules 8)
  const footH = QR + 48 + safe;
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
    const y0 = y;
    const photosTall = ch + (rowH ? gap + rowH : 0);
    part(ctx, 'product', [cx, y0, cw, photosTall], () => {
      if (gallery && cw >= W - 1) ctx.drawImage(cover, 0, y0, cw, ch);
      else {
        if (!dark) { ctx.shadowColor = 'rgba(17,24,39,.18)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12; }
        roundedImage(ctx, cover, cx, y0, cw, ch, 28);
        ctx.shadowColor = 'transparent';
      }
      if (rowH) {
        const ry = y0 + ch + gap;
        const widths = row.map((i) => Math.round(rowH * i.naturalWidth / i.naturalHeight));
        const total = widths.reduce((a, b) => a + b, 0) + gap * (row.length - 1);
        let x = (W - total) / 2;
        row.forEach((img, i) => { roundedImage(ctx, img, x, ry, widths[i], rowH, 18); x += widths[i] + gap; });
      }
    });
    y += photosTall + 40;
    if (gallery && cw >= W - 1) y += spare;
  }

  const wordsY = y;
  part(ctx, 'words', [PAD, wordsY, textW, blockH], () => {
  ctx.fillStyle = dark ? 'rgba(255,255,255,.7)' : MUTED;
  ctx.font = `600 ${px(30)}px ${body}`;
  ctx.fillText(wrap(ctx, eyebrow, textW, 1)[0] || '', start, y + px(30));
  y += px(44);
  ctx.fillStyle = dark ? '#FFFFFF' : INK;
  ctx.font = `600 ${px(64)}px ${head}`;
  headLines.forEach((l) => { y += px(76); keyLine(ctx, l, start, y - px(14), words.key, dark ? '#FFD600' : ACCENT); });

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
  });

  drawFooter(ctx, { W, PAD, QR, rtl, dark, cta, shortUrl, qr, body, px, start, textW, bottom: H - PAD - safe });
}

// The link and its code. The code sits on a white tile even on the dark
// design: scanners need dark modules on light.
function drawFooter(ctx, { W, PAD, QR, rtl, dark, cta, shortUrl, qr, body, px, start, textW, bottom }) {
  const qy = bottom - QR;
  const qx = rtl ? PAD : W - PAD - QR;
  qrTile(ctx, qr, qx, qy, QR, 10);
  const linkW = textW - QR - 40;
  ctx.font = `600 ${px(30)}px ${body}`;
  const urls = linkLines(ctx, shortUrl, linkW);
  const lift = (urls.length - 1) * px(20);
  linkPiece(ctx, { rtl, x: start, lines: [
    { text: cta, y: qy + QR / 2 - 6 - lift, font: `700 ${px(34)}px ${body}`, size: px(34), colour: dark ? '#FFFFFF' : INK, strong: INK },
    ...urls.map((text, i) => ({ text, y: qy + QR / 2 + px(40) - lift + i * px(38), font: `600 ${px(30)}px ${body}`, size: px(30), colour: dark ? 'rgba(255,255,255,.7)' : ACCENT, strong: ACCENT })),
  ], width: linkW });
}

// A link is never cut with a "…": with a business's name in it, it breaks after /p/ instead.
function linkLines(ctx, shortUrl, width) {
  const url = shortUrl.replace(/^https?:\/\//, '');
  if (ctx.measureText(url).width <= width) return [url];
  const at = url.indexOf('/p/') + 3;
  return [url.slice(0, at), url.slice(at)];
}

// The code on its white tile: never under the size that scans (rules 8).
function qrTile(ctx, qr, qx, qy, QR, m) {
  part(ctx, 'qr', [qx - m, qy - m, QR + m * 2, QR + m * 2], () => {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(qx - m, qy - m, QR + m * 2, QR + m * 2, 16);
    ctx.fill();
    if (qr) ctx.drawImage(qr, qx, qy, QR, QR);
  }, { later: true, minScale: 150 / QR });
}

// The call to action and short link. Moved off its band it brings a white
// plate, so it stays readable on any picture, and stays at least 30px.
function linkPiece(ctx, { rtl, x, lines, width, onPlate = false }) {
  // The action is a button (the pros' ads end on one, 7 Nov 2026), so it reads as the thing to do.
  const BTN = 22;
  const shown = lines.map((l, i) => {
    ctx.font = l.font;
    const text = wrap(ctx, l.text, width - (i ? 0 : BTN * 2), 1)[0] || '';
    return { ...l, text, w: ctx.measureText(text).width + (i ? 0 : BTN * 2) };
  });
  const w = Math.max(...shown.map((l) => l.w));
  const top = shown[0].y - shown[0].size * 1.2;
  const h = shown[shown.length - 1].y + 10 - top;
  const x0 = rtl ? x - w : x;
  part(ctx, 'link', [x0 - 18, top - 12, w + 36, h + 24], () => {
    const plate = onPlate || isMoved('link');
    if (plate) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(x0 - 18, top - 12, w + 36, h + 24, 14);
      ctx.fill();
    }
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = rtl ? 'right' : 'left';
    shown.forEach((l, i) => {
      ctx.font = l.font;
      // A link reads left to right on a Hebrew ad too, its slash in place.
      ctx.direction = dirOf(l.text, rtl);
      const colour = plate ? l.strong : l.colour;
      if (i === 0) {
        const light = lightColour(colour);
        ctx.fillStyle = light ? '#FFFFFF' : INK;
        ctx.beginPath();
        ctx.roundRect(rtl ? x - l.w : x, l.y - l.size * 1.12, l.w, l.size * 1.54, l.size * 0.77);
        ctx.fill();
        ctx.fillStyle = light ? INK : '#FFFFFF';
        ctx.fillText(l.text, rtl ? x - BTN : x + BTN, l.y);
        return;
      }
      ctx.fillStyle = colour;
      ctx.fillText(l.text, x, l.y);
    });
  }, { later: true, minScale: 1 });
}

// The average colour of a band along one side of a photo: the ground a
// photo is extended with when its shape differs from its box. Never a
// blurred copy, which read as "a weird grey area" (Tzvi, 27 Oct). Given a
// fallback, an uneven edge (half meat, half marble) returns the fallback:
// its average is a muddy colour that matches nothing (Blazin' Boards, 2 Nov).
function sideColour(img, side, fallback) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  const { naturalWidth: w, naturalHeight: h } = img;
  const bh = Math.max(1, Math.round(h * 0.04));
  const bw = Math.max(1, Math.round(w * 0.04));
  const src = { top: [0, 0, w, bh], bottom: [0, h - bh, w, bh], left: [0, 0, bw, h], right: [w - bw, 0, bw, h] }[side];
  ctx.drawImage(img, ...src, 0, 0, 16, 16);
  const d = ctx.getImageData(0, 0, 16, 16).data;
  let r = 0; let g = 0; let b = 0; let l2 = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]; g += d[i + 1]; b += d[i + 2];
    l2 += (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) ** 2;
  }
  const n = d.length / 4;
  const mean = (r * 0.3 + g * 0.59 + b * 0.11) / n;
  if (fallback && Math.sqrt(Math.max(0, l2 / n - mean * mean)) > 28) return fallback;
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}
const edgeColour = (img, fromTop) => sideColour(img, fromTop ? 'top' : 'bottom');

// A photo whole in a box, the rest of the box its own edge colours, or the
// ground where an edge is too uneven to extend.
function photoInBox(ctx, img, x, y, w, h, r = 0, ground = '#FFFFFF') {
  const [cw, ch] = fitIn(img, w, h);
  const ox = Math.round(x + (w - cw) / 2);
  const oy = Math.round(y + (h - ch) / 2);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  if (ch < h - 1) {
    ctx.fillStyle = sideColour(img, 'top', ground); ctx.fillRect(x, y, w, oy - y + 2);
    ctx.fillStyle = sideColour(img, 'bottom', ground); ctx.fillRect(x, oy + ch - 2, w, y + h - oy - ch + 2);
  }
  if (cw < w - 1) {
    ctx.fillStyle = sideColour(img, 'left', ground); ctx.fillRect(x, y, ox - x + 2, h);
    ctx.fillStyle = sideColour(img, 'right', ground); ctx.fillRect(ox + cw - 2, y, x + w - ox - cw + 2, h);
  }
  ctx.drawImage(img, ox, oy, cw, ch);
  ctx.restore();
  return [ox, oy, cw, ch];
}

const lum = (c) => {
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const rgb = (c) => `rgb(${c.map(Math.round).join(',')})`;
const tint = (c, t) => c.map((v) => v + (255 - v) * t);
const DEEP = [15, 94, 143];

// The photo's own strongest colour (docs/static-ad-rules.md 9b): the average
// of its most saturated pixels, darkened until white text on it passes
// 4.5:1. So two businesses never get the same ground.
function vividColour(img) {
  if (!img) return DEEP;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data;
  const pts = [];
  for (let i = 0; i < d.length; i += 4) {
    const mx = Math.max(d[i], d[i + 1], d[i + 2]);
    const mn = Math.min(d[i], d[i + 1], d[i + 2]);
    if (mx > 40 && mn < 225) pts.push([(mx - mn) / mx, d[i], d[i + 1], d[i + 2]]);
  }
  if (!pts.length) return DEEP;
  pts.sort((a, b) => b[0] - a[0]);
  const top = pts.slice(0, Math.max(8, Math.round(pts.length * 0.12)));
  let col = [1, 2, 3].map((k) => top.reduce((s, p) => s + p[k], 0) / top.length);
  while (1.05 / (lum(col) + 0.05) < 4.5) col = col.map((v) => v * 0.9);
  // Darkened yellow is olive (American Crust, 6 Nov 2026): yellow goes on warm black instead.
  const [r, g, bl] = col;
  if (r > g && g > bl * 1.4 && g > r * 0.72) return [28, 24, 16];
  return col;
}

// A headline line with its one key word in the accent colour (and, if given,
// another face): most of what makes a designed ad look designed. Hebrew runs
// from the right, English from the left.
// Headline on strips (the L'Oreal and sock ads, docs/inspo/ad-videos-2026-11-07): each line on a box of its
// own colour, the words in the opposite one, the key word on the accent. The owner's choice, every keyLine design.
const lightColour = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c || '') || null;
  const v = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : (String(c).match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  return lum(v) > 0.4;
};
function keyLine(ctx, line, x, y, key, accent, keyFont) {
  if (PARTS && PARTS.stats) PARTS.stats.strips = true;
  if (PARTS && PARTS.strips) { stripLine(ctx, line, x, y, key, accent || ctx.fillStyle, keyFont); return; }
  const at = key && accent ? line.indexOf(key) : -1;
  if (at < 0) { ctx.fillText(line, x, y); return; }
  const font = ctx.font;
  const align = ctx.textAlign;
  const ink = ctx.fillStyle;
  const rtl = ctx.direction === 'rtl';
  const bits = [[line.slice(0, at), false], [key, true], [line.slice(at + key.length), false]].filter(([s]) => s);
  const widths = bits.map(([s, isKey]) => { ctx.font = isKey && keyFont ? keyFont : font; return ctx.measureText(s).width; });
  const total = widths.reduce((a, b) => a + b, 0);
  const fromRight = align === 'right' || (align === 'start' && rtl) || (align === 'end' && !rtl);
  const left = align === 'center' ? x - total / 2 : (fromRight ? x - total : x);
  let cur = rtl ? left + total : left;
  ctx.textAlign = rtl ? 'right' : 'left';
  bits.forEach(([s, isKey], i) => {
    ctx.font = isKey && keyFont ? keyFont : font;
    ctx.fillStyle = isKey ? accent : ink;
    ctx.fillText(s, cur, y);
    cur += rtl ? -widths[i] : widths[i];
  });
  ctx.font = font;
  ctx.fillStyle = ink;
  ctx.textAlign = align;
}
function stripLine(ctx, line, x, y, key, accent, keyFont) {
  const font = ctx.font;
  const align = ctx.textAlign;
  const ink = ctx.fillStyle;
  const rtl = ctx.direction === 'rtl';
  const size = parseFloat(/([0-9.]+)px/.exec(font)[1]);
  const at = key ? line.indexOf(key) : -1;
  const bits = (at < 0 ? [[line, false]] : [[line.slice(0, at), false], [key, true], [line.slice(at + key.length), false]]).filter(([s]) => s);
  const widths = bits.map(([s, isKey]) => { ctx.font = isKey && keyFont ? keyFont : font; return ctx.measureText(s).width; });
  const total = widths.reduce((p, q) => p + q, 0);
  const fromRight = align === 'right' || (align === 'start' && rtl) || (align === 'end' && !rtl);
  const left = align === 'center' ? x - total / 2 : (fromRight ? x - total : x);
  const pad = size * 0.18;
  const box = (x0, w, fill) => { ctx.fillStyle = fill; ctx.fillRect(x0 - pad, y - size * 0.86, w + pad * 2, size * 1.1); };
  box(left, total, ink);
  let cur = rtl ? left + total : left;
  bits.forEach(([, isKey], i) => {
    if (isKey && accent !== ink) box(rtl ? cur - widths[i] : cur, widths[i], accent);
    cur += rtl ? -widths[i] : widths[i];
  });
  cur = rtl ? left + total : left;
  ctx.textAlign = rtl ? 'right' : 'left';
  bits.forEach(([s, isKey], i) => {
    ctx.font = isKey && keyFont ? keyFont : font;
    ctx.fillStyle = lightColour(isKey && accent !== ink ? accent : ink) ? INK : '#FFFFFF';
    ctx.fillText(s, cur, y);
    cur += rtl ? -widths[i] : widths[i];
  });
  ctx.font = font;
  ctx.fillStyle = ink;
  ctx.textAlign = align;
}
// The colour for that word on a look. None when the owner picked their own word colour.
const accentOf = (L) => {
  if (PARTS && PARTS.ink) return null;
  if (L.word !== L.text) return L.word;
  return L.text === INK ? (L.own !== INK ? L.own : null) : '#FFD600';
};
const colAccent = () => (inkOnCol() || (PARTS && PARTS.ink) ? null : '#FFD600');

const bodyFont = (rtl) => (rtl ? 'Assistant, system-ui, sans-serif' : 'Manrope, system-ui, sans-serif');
const headFont = (rtl) => (rtl ? '"Frank Ruhl Libre", Georgia, serif' : '"Playfair Display", Georgia, serif');
// Owner and customer words keep their own direction on an ad in the other language.
const dirOf = (text, rtl) => (/[֐-׿]/.test(text || '') ? 'rtl' : /[A-Za-z]/.test(text || '') ? 'ltr' : (rtl ? 'rtl' : 'ltr'));

function begin(canvas, format, rtl) {
  const [W, H] = FORMATS[format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  // The owner's font choice (FONTS), when the drawing is a gallery layout.
  const body = (PARTS && PARTS.font) || bodyFont(rtl);
  ctx.bodyFamily = body;
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  const k = format === 'story' ? 1.3 : 1;
  // A story keeps clear of the account name drawn over its top 220px.
  return { ctx, W, H, body, head: (PARTS && PARTS.font) || headFont(rtl), px: (n) => Math.round(n * k), top: format === 'story' ? 220 : 64 };
}

// The link and its code on a band across the foot, white unless a ground
// is given. On a story the band runs under the reply bar, its content above.
function footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body, ground = '#FFFFFF', dark = false }) {
  const QR = format === 'square' ? 150 : 170;
  const safe = format === 'story' ? 230 : 0;
  const top = H - safe - QR - 80;
  ctx.fillStyle = ground;
  ctx.fillRect(0, top, W, H - top);
  drawFooter(ctx, { W, PAD: 64, QR, rtl, dark, cta, shortUrl, qr, body, px: (n) => n,
    start: rtl ? W - 64 : 64, textW: W - 128, bottom: top + 40 + QR });
  return top;
}

function pricePill(ctx, { price, x, y, h, maxW, rtl, centre, size, W, bg = ACCENT, fg = '#FFFFFF' }) {
  ctx.font = `700 ${size}px ${ctx.bodyFamily}`;
  const pw = Math.min(ctx.measureText(price).width + 48, maxW);
  const x0 = centre ? (W - pw) / 2 : (rtl ? x - pw : x);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x0, y, pw, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
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
  paintGround(ctx, W, H);
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
  const safe = format === 'story' ? 230 : 0; // a story's reply bar covers its bottom 230px (rules 8)
  const footH = QR + 48 + safe;
  const tailH = px(44) + (price ? px(64) + 20 : 0);
  let y = format === 'story' ? 220 : PAD; // a story's account name covers its top 220px (rules 8)

  // The comment card, with a small tail pointing down at the photo.
  const cardY = y;
  part(ctx, 'words', [PAD, cardY, textW, cardH + 26], () => {
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
  });
  y = cardY + cardH + 60;

  // The photo, whole, in whatever room is left.
  const room = H - y - tailH - footH - PAD - 40;
  if (imgs[0] && room > 120) {
    const [cw, ch] = fitIn(imgs[0], textW, room);
    const py = y + (room - ch) / 2;
    part(ctx, 'product', [(W - cw) / 2, py, cw, ch], () => {
      ctx.shadowColor = 'rgba(17,24,39,.18)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
      roundedImage(ctx, imgs[0], (W - cw) / 2, py, cw, ch, 28);
      ctx.shadowColor = 'transparent';
    });
  }
  y = H - PAD - footH - tailH;
  const nameY = y;
  part(ctx, 'name', [PAD, nameY, textW, tailH], () => {
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillStyle = MUTED;
    ctx.font = `600 ${px(30)}px ${body}`;
    ctx.fillText(wrap(ctx, eyebrow, textW, 1)[0] || '', start, nameY + px(30));
    if (price) pricePill(ctx, { price, x: start, y: nameY + px(44) + 20, h: px(64), maxW: textW, rtl, size: px(38), W });
  });
  ctx.textAlign = rtl ? 'right' : 'left';
  drawFooter(ctx, { W, PAD, QR, rtl, dark: false, cta, shortUrl, qr, body, px, start, textW, bottom: H - PAD - safe });
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
  paintGround(ctx, W, H);
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
  lines.forEach((l, i) => wrap(ctx, l, textW - 56, i === 0 ? 2 : 1).forEach((line) => boxes.push(line)));
  const BH = 76;
  const GAP = 10;
  const QR = 170;
  const panelH = QR + 60;
  const panelTop = H - 230 - panelH;
  const stackH = boxes.length * (BH + GAP) + (price ? 92 : 0);
  let y = panelTop - 40 - stackH;
  part(ctx, 'words', [PAD, y, textW, stackH], () => {
    ctx.textAlign = 'center';
    boxes.forEach((line) => {
      ctx.font = `600 46px ${body}`;
      const w = Math.min(ctx.measureText(line).width + 56, textW);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect((W - w) / 2, y, w, BH, 12);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.fillText(line, W / 2, y + 52);
      y += BH + GAP;
    });
    if (price) pricePill(ctx, { price, y: y + 16, h: 76, maxW: textW, rtl, centre: true, size: 42, W });
  });

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(PAD - 24, panelTop, textW + 48, panelH, 28);
  ctx.fill();
  const px = (n) => n;
  drawFooter(ctx, { W, PAD: PAD + 16, QR, rtl, dark: false, cta, shortUrl, qr, body, px,
    start: rtl ? W - PAD - 16 : PAD + 16, textW: textW - 32, bottom: panelTop + 30 + QR });
}

// "Colour block" (docs/static-ad-rules.md 9b.1): the whole ad in the
// photo's own strongest colour, the headline large in white, the photo
// whole, the link on a white band.
function drawColour(canvas, { format, words, eyebrow, price, cta, shortUrl, rtl, imgs, qr }) {
  const { ctx, W, H, body, head, px, top } = begin(canvas, format, rtl);
  const col = (PARTS && PARTS.col) || vividColour(imgs[0]);
  ctx.fillStyle = rgb(col);
  paintGround(ctx, W, H);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body });
  const PAD = 64;
  const textW = W - PAD * 2;
  const start = rtl ? W - PAD : PAD;
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.font = `700 ${px(80)}px ${head}`;
  const lines = wrap(ctx, words.headline, textW, 3);
  const textH = px(44) + lines.length * px(92) + (price ? px(64) + 28 : 0);
  const room = footTop - top - textH - 48 - 40;
  const [cw, ch] = imgs[0] && room > 160 ? fitIn(imgs[0], textW, room) : [0, 0];
  let y = top + Math.max(0, (footTop - top - 48 - textH - (ch ? ch + 40 : 0)) / 2);
  const wordsY = y;
  const photoY = wordsY + textH + 40;
  if (ch) {
    part(ctx, 'product', [(W - cw) / 2, photoY, cw, ch], () => {
      ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
      roundedImage(ctx, imgs[0], (W - cw) / 2, photoY, cw, ch, 28);
      ctx.shadowColor = 'transparent';
    });
  }
  part(ctx, 'words', [PAD, wordsY, textW, textH], () => {
    ctx.fillStyle = fgSoft();
    ctx.font = `600 ${px(30)}px ${body}`;
    ctx.fillText(wrap(ctx, eyebrow, textW, 1)[0] || '', start, y + px(30));
    y += px(44);
    ctx.fillStyle = fg();
    ctx.font = `700 ${px(80)}px ${head}`;
    lines.forEach((l) => { y += px(92); keyLine(ctx, l, start, y - px(18), words.key, colAccent()); });
    if (price) pricePill(ctx, { price, x: start, y: y + 28, h: px(64), maxW: textW, rtl, size: px(38), W, ...pillOn(col) });
  });
}

// "Big words" (9b.4): the headline at the largest size that fits, on the
// photo's colour, over half the ad; the photo whole under it.
function drawBigWords(canvas, { format, words, eyebrow, price, cta, shortUrl, rtl, imgs, qr }) {
  const { ctx, W, H, body, px, top } = begin(canvas, format, rtl);
  const col = (PARTS && PARTS.col) || vividColour(imgs[0]);
  ctx.fillStyle = rgb(col);
  paintGround(ctx, W, H);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body });
  const PAD = 64;
  const textW = W - PAD * 2;
  const start = rtl ? W - PAD : PAD;
  const fixed = px(44) + (price ? px(64) + 32 : 0);
  // The words may take up to 55% of the room; the photo gets all the rest.
  const avail = (imgs[0] ? (footTop - top) * 0.55 : footTop - top) - fixed - 48;
  let size = 56;
  let lines = [];
  for (let s = 150; s >= 56; s -= 4) {
    ctx.font = `800 ${s}px ${body}`;
    lines = wrap(ctx, words.headline, textW, 99);
    if (lines.length <= 3 && lines.length * s * 1.1 <= avail && lines.every((l) => ctx.measureText(l).width <= textW)) { size = s; break; }
  }
  ctx.font = `800 ${size}px ${body}`;
  lines = wrap(ctx, words.headline, textW, 3);
  const blockH = fixed + lines.length * size * 1.1;
  const split = imgs[0] ? Math.round(top + blockH + 56) : footTop;
  if (imgs[0]) photoInBox(ctx, imgs[0], 0, split, W, footTop - split, 0, rgb(col));
  let y = imgs[0] ? top : top + Math.max(0, (avail - lines.length * size * 1.1) / 2);
  part(ctx, 'words', [PAD, y, textW, blockH], () => {
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillStyle = fgSoft();
    ctx.font = `600 ${px(30)}px ${body}`;
    ctx.fillText(wrap(ctx, eyebrow, textW, 1)[0] || '', start, y + px(30));
    y += px(44);
    ctx.fillStyle = fg();
    ctx.font = `800 ${size}px ${body}`;
    lines.forEach((l) => { y += size * 1.1; keyLine(ctx, l, start, y - size * 0.22, words.key, colAccent()); });
    if (price) pricePill(ctx, { price, x: start, y: y + 32, h: px(64), maxW: textW, rtl, size: px(38), W, ...pillOn(col) });
  });
}

// "Grid" (9b.2): three of the owner's photos and one tile in their colour
// with the headline, the price and the code.
function drawGrid(canvas, { format, words, eyebrow, price, cta, shortUrl, rtl, imgs, qr }) {
  const { ctx, W, H, body, head } = begin(canvas, format, rtl);
  const col = (PARTS && PARTS.col) || vividColour(imgs[0]);
  ctx.fillStyle = rgb(col);
  paintGround(ctx, W, H);
  const story = format === 'story';
  const gTop = story ? 220 : 0;
  const gBot = story ? H - 230 : H;
  const G = 10;
  const tw = (W - G) / 2;
  const th = (gBot - gTop - G) / 2;
  const cell = (i) => {
    const cx = i % 2; const cy = Math.floor(i / 2);
    return [(rtl ? 1 - cx : cx) * (tw + G), gTop + cy * (th + G)];
  };
  imgs.slice(0, 3).forEach((img, i) => { const [x, y] = cell(i); photoInBox(ctx, img, x, y, tw, th, 0, rgb(col)); });
  const [x0, y0] = cell(3);
  const P = 40;
  const iw = tw - P * 2;
  const s = rtl ? x0 + tw - P : x0 + P;
  ctx.textAlign = rtl ? 'right' : 'left';
  let y = y0 + P;
  const QR = 150;
  ctx.font = `600 30px ${body}`;
  const urls = linkLines(ctx, shortUrl, iw);
  const extra = (urls.length - 1) * 38;
  const bottomH = QR + 20 + 44 + 34 + extra;
  ctx.font = `700 50px ${head}`;
  const maxLines = Math.max(1, Math.floor((th - P * 2 - 40 - bottomH - (price ? 80 : 0)) / 60));
  const headLines = wrap(ctx, words.headline, iw, Math.min(4, maxLines));
  part(ctx, 'words', [x0 + P, y, iw, 40 + headLines.length * 60 + (price ? 76 : 0)], () => {
    ctx.fillStyle = fgSoft();
    ctx.font = `600 30px ${body}`;
    ctx.fillText(wrap(ctx, eyebrow, iw, 1)[0] || '', s, y + 26);
    y += 40;
    ctx.font = `700 50px ${head}`;
    ctx.fillStyle = fg();
    headLines.forEach((l) => { y += 60; keyLine(ctx, l, s, y - 14, words.key, colAccent()); });
    if (price) pricePill(ctx, { price, x: s, y: y + 20, h: 56, maxW: iw, rtl, size: 32, W });
  });
  const qy = y0 + th - P - 34 - QR - extra;
  const qx = rtl ? x0 + tw - P - QR : x0 + P;
  qrTile(ctx, qr, qx, qy, QR, 8);
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.font = `700 30px ${body}`;
  const ctaLines = wrap(ctx, cta, iw - QR - 28, 2);
  const ctaX = rtl ? qx - 28 : qx + QR + 28;
  const ctaW = Math.max(...ctaLines.map((l) => ctx.measureText(l).width));
  part(ctx, 'link', [(rtl ? ctaX - ctaW : ctaX) - 18, qy + QR / 2 - 42, ctaW + 36, ctaLines.length * 38 + 32], () => {
    const plate = isMoved('link');
    if (plate) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect((rtl ? ctaX - ctaW : ctaX) - 18, qy + QR / 2 - 42, ctaW + 36, ctaLines.length * 38 + 32, 14);
      ctx.fill();
    }
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.font = `700 30px ${body}`;
    ctx.fillStyle = plate ? INK : fg();
    ctaLines.forEach((l, i) => ctx.fillText(l, ctaX, qy + QR / 2 + i * 38));
  }, { later: true, minScale: 1 });
  // The short link has its own line here, so it goes with the code's tile on the ground.
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.fillStyle = fg();
  ctx.font = `600 30px ${body}`;
  ctx.direction = 'ltr';
  urls.forEach((l, i) => ctx.fillText(l, s, y0 + th - P - extra + i * 38));
}

// "Side by side" (9b.3): three of the business's own items, each with its
// photo, name and real price, each on a tint of its own colour.
function drawItems(canvas, { format, words, eyebrow, cta, shortUrl, rtl, items, qr }) {
  const { ctx, W, H, body, head, px, top } = begin(canvas, format, rtl);
  ctx.fillStyle = '#FFFFFF';
  paintGround(ctx, W, H);
  const col = vividColour(items[0].img);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body, ground: rgb(col), dark: true });
  const PAD = 48;
  const textW = W - PAD * 2;
  const start = rtl ? W - PAD : PAD;
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.font = `700 ${px(60)}px ${head}`;
  const headLines = wrap(ctx, words.headline, textW, 2);
  const headerH = px(40) + headLines.length * px(72);
  const GAP = 20;
  const shown = items.slice(0, 3);
  const nameH = 28 + px(34) * 2 + 20;
  const priceH = px(40) + 48;
  const room = footTop - 40 - top - headerH - 36;
  // Wide photos in narrow columns come out tiny (seen on Blazin' Boards,
  // 2 Nov): outside the square shape they get a row each, photo beside
  // the name and price.
  const wide = format !== 'square' && shown.every((it) => it.img.naturalWidth > it.img.naturalHeight * 1.1);
  const cw = (textW - GAP * 2) / 3;
  const rh = (room - GAP * 2) / 3;
  const sizes = shown.map((it) => (wide ? fitIn(it.img, textW * 0.55, rh - 32) : fitIn(it.img, cw - 32, room - nameH - priceH)));
  // Every column (or row) the same size; the whole block in the middle.
  const cH = wide ? Math.max(...sizes.map(([, h]) => h)) + 32 : nameH + Math.max(...sizes.map(([, h]) => h)) + priceH;
  const blockH = headerH + 36 + (wide ? cH * 3 + GAP * 2 : cH);
  const wordsY = top + Math.max(0, (footTop - 40 - top - blockH) / 2);
  part(ctx, 'words', [PAD, wordsY, textW, headerH], () => {
    let y = wordsY;
    ctx.fillStyle = MUTED;
    ctx.font = `600 ${px(30)}px ${body}`;
    ctx.fillText(wrap(ctx, eyebrow, textW, 1)[0] || '', start, y + px(28));
    y += px(40);
    ctx.fillStyle = INK;
    ctx.font = `700 ${px(60)}px ${head}`;
    headLines.forEach((l) => { y += px(72); ctx.fillText(l, start, y - px(16)); });
  });
  const cTop = wordsY + headerH + 36;
  if (wide) {
    part(ctx, 'product', [PAD, cTop, textW, cH * 3 + GAP * 2], () => shown.forEach((it, i) => {
      const ry = cTop + i * (cH + GAP);
      ctx.fillStyle = rgb(tint(vividColour(it.img), 0.8));
      ctx.beginPath();
      ctx.roundRect(PAD, ry, textW, cH, 28);
      ctx.fill();
      const [pw, ph] = sizes[i];
      const px0 = rtl ? W - PAD - 16 - pw : PAD + 16;
      roundedImage(ctx, it.img, px0, ry + (cH - ph) / 2, pw, ph, 18);
      const tw = textW - pw - 72;
      const tx = rtl ? px0 - 32 : px0 + pw + 32;
      ctx.direction = dirOf(it.name, rtl);
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.fillStyle = INK;
      ctx.font = `700 ${px(34)}px ${body}`;
      const names = wrap(ctx, it.name, tw, 2);
      const tBlock = names.length * px(42) + px(56);
      let ty = ry + (cH - tBlock) / 2;
      names.forEach((l) => { ty += px(42); ctx.fillText(l, tx, ty - px(8)); });
      ctx.direction = rtl ? 'rtl' : 'ltr';
      ctx.font = `800 ${px(44)}px ${body}`;
      ctx.fillText(it.priceText, tx, ty + px(52));
    }));
    return;
  }
  part(ctx, 'product', [PAD, cTop, textW, cH], () => shown.forEach((it, i) => {
    const x = rtl ? W - PAD - (i + 1) * cw - i * GAP : PAD + i * (cw + GAP);
    ctx.fillStyle = rgb(tint(vividColour(it.img), 0.8));
    ctx.beginPath();
    ctx.roundRect(x, cTop, cw, cH, 28);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.direction = dirOf(it.name, rtl);
    ctx.fillStyle = INK;
    ctx.font = `700 ${px(30)}px ${body}`;
    const names = wrap(ctx, it.name, cw - 40, 2);
    names.forEach((l, j) => ctx.fillText(l, x + cw / 2, cTop + 28 + px(34) * (j + 1)));
    ctx.direction = rtl ? 'rtl' : 'ltr';
    const [pw, ph] = sizes[i];
    roundedImage(ctx, it.img, x + (cw - pw) / 2, cTop + nameH + (cH - nameH - priceH - ph) / 2, pw, ph, 18);
    ctx.font = `800 ${px(40)}px ${body}`;
    ctx.fillText(it.priceText, x + cw / 2, cTop + cH - 36);
  }));
}

// "Sticky note" (9b.5): the photo whole, and a yellow note in a marker hand
// over its emptiest part, measured, so it never covers what the photo shows.
function drawNote(canvas, { format, words, price, cta, shortUrl, rtl, imgs, qr }) {
  const { ctx, W, H, body, px, top } = begin(canvas, format, rtl);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body });
  photoInBox(ctx, imgs[0], 0, 0, W, footTop);
  const hand = rtl ? '"Amatic SC", Assistant, sans-serif' : 'Caveat, Manrope, sans-serif';
  const nw = Math.round(W * 0.5);
  const P = 36;
  const size = rtl ? px(64) : px(58);
  ctx.font = `700 ${size}px ${hand}`;
  const lines = wrap(ctx, words.headline, nw - P * 2, 3);
  const nh = P * 2 + lines.length * size * 1.05 + (price ? size * 1.2 : 0) + 16;
  // The four corners of the photo, inset; the one with the least detail wins.
  const M = 56;
  const spots = [[M, top], [W - M - nw, top], [M, footTop - M - nh], [W - M - nw, footTop - M - nh]];
  const detail = ([x, y]) => {
    const d = ctx.getImageData(Math.max(0, x), Math.max(0, y), nw, Math.max(1, Math.round(nh))).data;
    let s = 0; let s2 = 0; let n = 0;
    for (let i = 0; i < d.length; i += 64) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; s += l; s2 += l * l; n += 1; }
    return s2 / n - (s / n) ** 2;
  };
  let [nx, ny] = spots.reduce((a, b) => (detail(b) < detail(a) ? b : a));
  // No plain corner (a busy photo, or one with its own words on it, like
  // Blazin' Boards' flyer, 2 Nov): the photo moves down and the note is
  // stuck along its top edge instead, covering only a sliver of it.
  if (detail([nx, ny]) > 400) {
    const py = Math.round(top + nh - 40);
    ctx.fillStyle = sideColour(imgs[0], 'top', '#FFFFFF');
    ctx.fillRect(0, 0, W, py + 2);
    photoInBox(ctx, imgs[0], 0, py, W, footTop - py);
    [nx, ny] = [rtl ? W - M - nw : M, top - 16];
  }
  part(ctx, 'words', [nx, ny, nw, nh], () => {
  ctx.save();
  ctx.translate(nx + nw / 2, ny + nh / 2);
  ctx.rotate(nx < W / 2 ? -0.035 : 0.035);
  ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#FFE66D';
  ctx.fillRect(-nw / 2, -nh / 2, nw, nh);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(-70, -nh / 2 - 18, 140, 36);
  ctx.fillStyle = '#1F2937';
  ctx.textAlign = 'center';
  ctx.font = `700 ${size}px ${hand}`;
  let y = -nh / 2 + P;
  lines.forEach((l) => { y += size * 1.05; ctx.fillText(l, 0, y - size * 0.2); });
  if (price) {
    y += size * 1.2;
    ctx.fillStyle = '#B42318';
    ctx.fillText(price, 0, y - size * 0.2);
  }
  ctx.restore();
  });
}

// "Question" (9b.6): one of the owner's own questions and answers from
// their page, in a story-style question box over the photo's lower part.
function drawQuestion(canvas, { format, faq, cta, shortUrl, rtl, imgs, qr }) {
  const { ctx, W, H, body, px, top } = begin(canvas, format, rtl);
  const col = (PARTS && PARTS.col) || vividColour(imgs[0]);
  ctx.fillStyle = rgb(col);
  paintGround(ctx, W, H);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body });
  if (imgs[0]) photoInBox(ctx, imgs[0], 0, 0, W, footTop, 0, rgb(col));
  const cw = W - 160;
  const P = 36;
  ctx.textAlign = 'center';
  ctx.direction = dirOf(faq.q, rtl);
  ctx.font = `700 ${px(42)}px ${body}`;
  const qLines = wrap(ctx, faq.q, cw - P * 2, 2);
  ctx.direction = dirOf(faq.a, rtl);
  ctx.font = `500 ${px(36)}px ${body}`;
  const aLines = wrap(ctx, faq.a, cw - P * 2, format === 'square' ? 2 : 3);
  const qH = P * 2 + qLines.length * px(52);
  const aH = P * 2 + aLines.length * px(48);
  const cy = Math.max(top, footTop - 48 - qH - aH);
  part(ctx, 'words', [80, cy, cw, qH + aH], () => {
  ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(80, cy, cw, qH + aH, 32);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = rgb(col);
  ctx.beginPath();
  ctx.roundRect(80, cy, cw, qH, [32, 32, 0, 0]);
  ctx.fill();
  ctx.fillStyle = fg();
  ctx.direction = dirOf(faq.q, rtl);
  ctx.font = `700 ${px(42)}px ${body}`;
  qLines.forEach((l, i) => ctx.fillText(l, W / 2, cy + P + px(52) * (i + 1) - px(12)));
  ctx.fillStyle = INK;
  ctx.direction = dirOf(faq.a, rtl);
  ctx.font = `500 ${px(36)}px ${body}`;
  aLines.forEach((l, i) => ctx.fillText(l, W / 2, cy + qH + P + px(48) * (i + 1) - px(12)));
  });
  ctx.direction = rtl ? 'rtl' : 'ltr';
}

// The three made-for-you ads (Tzvi, 2 Nov 2026: the others are "very
// basic"). Each carries one idea from the Pinterest library
// (docs/inspo/pinterest-ads-2026-11-02, ad rules 9d), drawn from the
// owner's own photo, items and words, so nothing in them is invented.

// "Phone screen" (fake app screen, 3.6/5): the reader's phone lights up
// with a message from the business; their photo is the wallpaper.
function drawPhone(canvas, { format, words, name, price, cta, shortUrl, rtl, imgs, qr, nowLabel }) {
  const { ctx, W, H, body, top } = begin(canvas, format, rtl);
  const col = (PARTS && PARTS.col) || vividColour(imgs[0]);
  ctx.fillStyle = rgb(col);
  paintGround(ctx, W, H);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body });
  // The phone stands on the foot band, its bottom cut by it, the way a
  // hand holds one up.
  const ph = footTop - top + 60;
  const pw = Math.min(W - 160, Math.round(ph * 0.6));
  const x = (W - pw) / 2;
  const y = top;
  part(ctx, 'product', [x, y, pw, footTop - y], () => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, footTop);
  ctx.clip();
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#0B0B0F';
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, 64);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const B = 16;
  const sx = x + B; const sy = y + B; const sw = pw - B * 2; const sh = ph - B * 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, 50);
  ctx.clip();
  ctx.fillStyle = rgb(col.map((v) => v * 0.55));
  ctx.fillRect(sx, sy, sw, sh);
  // The clock on top, the message under the photo: neither covers it.
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  ctx.font = `300 ${Math.round(sw * 0.24)}px ${body}`;
  const clockY = sy + 36 + Math.round(sw * 0.22);
  ctx.fillText('9:41', W / 2, clockY);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  const N = 22;
  const nw = sw - N * 2;
  const tSize = Math.max(30, Math.round(sw * 0.062));
  ctx.font = `700 ${tSize}px ${body}`;
  ctx.direction = dirOf(words.headline, rtl);
  const tLines = wrap(ctx, words.headline, nw - 56, 3);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  const sub = [price, words.points[0]].filter(Boolean).join(' · ');
  const nh = 28 + tSize + 20 + tLines.length * tSize * 1.25 + (sub ? tSize * 1.3 : 0) + 24;
  const ny = Math.min(sy + sh - nh - 90, footTop - nh - 40);
  const photoTop = clockY + 40;
  if (imgs[0] && ny - photoTop > 80) photoInBox(ctx, imgs[0], sx, photoTop, sw, ny - 24 - photoTop, 0, rgb(col.map((v) => v * 0.55)));
  ctx.fillStyle = 'rgba(255,255,255,.93)';
  ctx.beginPath();
  ctx.roundRect(sx + N, ny, nw, nh, 30);
  ctx.fill();
  const ix = rtl ? sx + N + nw - 28 - tSize : sx + N + 28;
  ctx.fillStyle = rgb(col);
  ctx.beginPath();
  ctx.roundRect(ix, ny + 24, tSize, tSize, 8);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = `800 ${Math.max(30, Math.round(tSize * 0.6))}px ${body}`;
  ctx.fillText((name || '?').trim()[0].toUpperCase(), ix + tSize / 2, ny + 24 + tSize * 0.72);
  ctx.textAlign = rtl ? 'right' : 'left';
  const tx = rtl ? sx + N + nw - 28 : sx + N + 28;
  ctx.fillStyle = MUTED;
  ctx.font = `600 ${Math.max(30, Math.round(tSize * 0.75))}px ${body}`;
  ctx.direction = dirOf(name, rtl);
  ctx.fillText(wrap(ctx, (name || '').toUpperCase(), nw - tSize - 160, 1)[0] || '', rtl ? ix - 16 : ix + tSize + 16, ny + 24 + tSize * 0.78);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'left' : 'right';
  ctx.fillText(nowLabel, rtl ? sx + N + 28 : sx + N + nw - 28, ny + 24 + tSize * 0.78);
  ctx.textAlign = rtl ? 'right' : 'left';
  let ty = ny + 28 + tSize + 20;
  ctx.fillStyle = INK;
  ctx.font = `700 ${tSize}px ${body}`;
  ctx.direction = dirOf(words.headline, rtl);
  tLines.forEach((l) => { ty += tSize * 1.25; ctx.fillText(l, tx, ty - tSize * 0.25); });
  ctx.direction = rtl ? 'rtl' : 'ltr';
  if (sub) {
    ctx.fillStyle = '#374151';
    ctx.font = `500 ${Math.max(30, Math.round(tSize * 0.9))}px ${body}`;
    ctx.fillText(wrap(ctx, sub, nw - 56, 1)[0], tx, ty + tSize * 1.05);
  }
  ctx.restore();
  ctx.fillStyle = '#0B0B0F';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 60, sy + 14, 120, 34, 17);
  ctx.fill();
  ctx.restore();
  });
}

// A torn edge across the ad, the same every time for the same width.
function tornEdge(W, y, seed, amp = 16) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const pts = [];
  for (let x = -20; x <= W + 20; x += 18 + rnd() * 22) pts.push([x, y + (rnd() - 0.5) * 2 * amp]);
  return pts;
}

function paperPiece(ctx, W, edge, side, fill, H) {
  const path = (pts, dy) => {
    ctx.beginPath();
    ctx.moveTo(-20, side === 'top' ? -20 : H + 20);
    pts.forEach(([x, y]) => ctx.lineTo(x, y + dy));
    ctx.lineTo(W + 20, side === 'top' ? -20 : H + 20);
    ctx.closePath();
  };
  // The paper's white core shows along a tear, a little past the colour.
  const core = edge.map(([x, y], i) => [x, y + (side === 'top' ? 1 : -1) * (6 + ((i * 7) % 5) * 2)]);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = side === 'top' ? 8 : -8;
  ctx.fillStyle = '#F4F1EA';
  path(core, 0);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fill;
  path(edge, 0);
  ctx.fill();
}

// "Torn paper" (picture inside the scene, 3.7/5): a page in the business's
// own colour torn open, and through the tear, their photo.
function drawTorn(canvas, { format, words, eyebrow, price, cta, shortUrl, rtl, imgs, qr }) {
  const { ctx, W, H, body, head, px, top } = begin(canvas, format, rtl);
  const col = (PARTS && PARTS.col) || vividColour(imgs[0]);
  const PAD = 64;
  const textW = W - PAD * 2;
  const start = rtl ? W - PAD : PAD;
  ctx.font = `700 ${px(84)}px ${head}`;
  const lines = wrap(ctx, words.headline, textW, 3);
  const textH = px(40) + lines.length * px(96) + (price ? px(64) + 28 : 0);
  const QR = format === 'square' ? 150 : 170;
  const footH = (format === 'story' ? 230 : 0) + QR + 80;
  const tearTop = top + textH + 56;
  const tearBot = H - footH - 30;
  ctx.fillStyle = '#FFFFFF';
  paintGround(ctx, W, H);
  if (imgs[0]) photoInBox(ctx, imgs[0], 0, tearTop - 30, W, tearBot - tearTop + 60, 0, '#FFFFFF');
  paperPiece(ctx, W, tornEdge(W, tearTop, 7), 'top', rgb(col), H);
  paperPiece(ctx, W, tornEdge(W, tearBot, 31, 12), 'bottom', rgb(col), H);
  let y = top;
  part(ctx, 'words', [PAD, y, textW, textH], () => {
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillStyle = fgSoft();
    ctx.font = `600 ${px(30)}px ${body}`;
    ctx.fillText(wrap(ctx, eyebrow, textW, 1)[0] || '', start, y + px(30));
    y += px(40);
    ctx.fillStyle = fg();
    ctx.font = `700 ${px(84)}px ${head}`;
    lines.forEach((l) => { y += px(96); keyLine(ctx, l, start, y - px(20), words.key, colAccent()); });
    if (price) pricePill(ctx, { price, x: start, y: y + 28, h: px(64), maxW: textW, rtl, size: px(38), W, ...pillOn(col) });
  });
  ctx.textAlign = rtl ? 'right' : 'left';
  drawFooter(ctx, { W, PAD, QR, rtl, dark: !inkOnCol(), cta, shortUrl, qr, body, px: (n) => n,
    start, textW, bottom: H - (format === 'story' ? 230 : 0) - 40 });
}

// The three made from the product cut out of its photo (utils/cutout.py),
// from the second look at the library (ad rules 9e): one product, huge,
// on one quiet ground, its own name and its own price once.
const CREAM = '#F6EFE4';

// The colour looks a layout can be drawn in (Tzvi, 3 Nov 2026: a gallery
// needs more than twelve ads). "own" takes the product's strongest colour,
// so no two businesses look alike; the others are fixed palettes.
export const LOOKS = ['own', 'cream', 'night', 'sun', 'navy'];
// Borrowed from the ad tools (Tzvi, 3 Nov 2026): Canva's brand kit becomes
// a "brand" look in the business's own brand colour, when it has set one,
// and its seasonal templates become a look for the next chag, offered in
// the weeks before it (nextHoliday).
export const HOLIDAYS = ['rosh', 'chanukah', 'purim', 'pesach', 'shavuot'];
const hexRgb = (h) => (/^#?[0-9a-f]{6}$/i.test(h || '') ? [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16)) : null);
// Whether words in the owner's colour are lost on what is behind them. The
// pixels of a word piece that are not the word colour are its background;
// their middle brightness against the word colour must reach 3:1 (large
// text). Returns black or white, whichever would read, or null when fine.
function lostWords(canvas, boxes, ink) {
  const c = hexRgb(ink);
  if (!c) return null;
  const ctx = canvas.getContext('2d');
  const L = lum(c);
  for (const name of ['word', 'words', 'name']) {
    const b = boxes[name];
    if (!b) continue;
    const x = Math.max(0, Math.floor(b[0]));
    const y = Math.max(0, Math.floor(b[1]));
    const w = Math.min(canvas.width - x, Math.ceil(b[2]));
    const h = Math.min(canvas.height - y, Math.ceil(b[3]));
    if (w < 4 || h < 4) continue;
    const d = ctx.getImageData(x, y, w, h).data;
    const ls = [];
    for (let i = 0; i < d.length; i += 16) {
      if (Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]) > 60) ls.push(lum([d[i], d[i + 1], d[i + 2]]));
    }
    // Hardly anything but the word colour: the words sit on their own colour.
    let bgL = L;
    if (ls.length > (d.length / 16) * 0.25) { ls.sort((p, q) => p - q); bgL = ls[ls.length >> 1]; }
    if ((Math.max(L, bgL) + 0.05) / (Math.min(L, bgL) + 0.05) < 3) return bgL > 0.18 ? INK : '#FFFFFF';
  }
  return null;
}

// Whether words on this ground read better in ink than in white.
const lightGround = (c) => (lum(c) + 0.05) / (lum([17, 24, 39]) + 0.05) > 1.05 / (lum(c) + 0.05);
// The fixed designs' words, on a colour the owner picked.
const inkOnCol = () => !!(PARTS && PARTS.col && lightGround(PARTS.col));
const fg = () => (inkOnCol() ? INK : '#FFFFFF');
const fgSoft = () => (inkOnCol() ? 'rgba(17,24,39,.75)' : 'rgba(255,255,255,.8)');
const pillOn = (col) => (inkOnCol() ? { bg: INK, fg: '#FFFFFF' } : { bg: '#FFFFFF', fg: rgb(col) });

function lookOf(name, brand, img) {
  const col = vividColour(img);
  const own = rgb(col);
  // The colour the owner chose is the colour on the ad, exactly and flat
  // (Tzvi, 6 Nov 2026: "isnt matching the color i chose"). It used to be
  // darkened until white words passed; now the words go black or white.
  const b = hexRgb(brand) || col;
  const inkOn = lightGround(b);
  const L = {
    brand: { bg: rgb(b), bg2: rgb(b), text: inkOn ? INK : '#FFFFFF', sub: inkOn ? 'rgba(17,24,39,.75)' : 'rgba(255,255,255,.8)', word: inkOn ? INK : '#FFFFFF',
      foot: INK, footDark: true, ring: inkOn ? '17,24,39' : '255,255,255', own: inkOn ? INK : rgb(b) },
    rosh: { bg: '#7A1022', bg2: '#3A0610', text: '#FFFFFF', sub: 'rgba(255,225,200,.85)', word: '#F5C542', foot: '#FFFFFF', footDark: false, ring: '245,197,66', own: '#7A1022' },
    chanukah: { bg: '#0E2A5C', bg2: '#06142E', text: '#FFFFFF', sub: 'rgba(220,235,255,.8)', word: '#F5C542', foot: '#FFFFFF', footDark: false, ring: '245,197,66', own: '#0E2A5C' },
    purim: { bg: '#4B1F7A', bg2: '#22093F', text: '#FFFFFF', sub: 'rgba(235,220,255,.85)', word: '#FFD600', foot: '#FFFFFF', footDark: false, ring: '255,214,0', own: '#4B1F7A' },
    pesach: { bg: '#EAF4E1', bg2: '#D5E8C4', text: INK, sub: '#4B5D3A', word: '#2F6B2F', foot: '#2F6B2F', footDark: true, ring: '47,107,47', own: '#2F6B2F' },
    shavuot: { bg: '#F4EBD0', bg2: '#E8D9A8', text: INK, sub: '#6B5B2E', word: '#4C7A2E', foot: '#4C7A2E', footDark: true, ring: '76,122,46', own: '#4C7A2E' },
    own: { bg: own, bg2: rgb(col.map((v) => v * 0.25)), text: '#FFFFFF', sub: 'rgba(255,255,255,.8)', word: '#FFFFFF', foot: INK, footDark: true, ring: '255,230,220', own },
    cream: { bg: CREAM, bg2: '#EADFCB', text: INK, sub: '#786E64', word: own, foot: own, footDark: true, ring: '17,24,39', own },
    night: { bg: '#17171A', bg2: '#000000', text: '#FFFFFF', sub: 'rgba(255,255,255,.7)', word: '#FFD600', foot: '#FFFFFF', footDark: false, ring: '255,214,0', own },
    sun: { bg: '#FFD600', bg2: '#F5B800', text: INK, sub: 'rgba(17,24,39,.7)', word: INK, foot: INK, footDark: true, ring: '17,24,39', own },
    navy: { bg: '#123B57', bg2: '#08192A', text: '#FFFFFF', sub: 'rgba(220,235,255,.8)', word: '#FFD600', foot: '#FFFFFF', footDark: false, ring: '220,235,255', own },
  }[name] || null;
  // The owner's word colour, when they picked one.
  return L && PARTS && PARTS.ink ? { ...L, text: PARTS.ink, word: PARTS.ink } : L;
}

// Fonts an owner can pick, each with Hebrew letters too (Google Fonts).
export const FONTS = [
  ['Manrope', 'Assistant'], ['Rubik', 'Rubik'], ['Heebo', 'Heebo'], ['Secular One', 'Secular One'],
  ['Suez One', 'Suez One'], ['Frank Ruhl Libre', 'Frank Ruhl Libre'], ['Amatic SC', 'Amatic SC'], ['Varela Round', 'Varela Round'],
];
export const FONT_URL = 'https://fonts.googleapis.com/css2?family=Rubik:wght@500;800&family=Heebo:wght@500;800&family=Secular+One&family=Suez+One&family=Amatic+SC:wght@700&family=Varela+Round&display=swap';

// The chag whose day falls within the next five weeks (or began this week),
// read from the browser's own Hebrew calendar, so no dates are typed in.
export function nextHoliday(today = new Date()) {
  const f = new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'long', day: 'numeric' });
  const day = { 'Tishri 1': 'rosh', 'Kislev 25': 'chanukah', 'Adar 14': 'purim', 'Adar II 14': 'purim', 'Nisan 15': 'pesach', 'Sivan 6': 'shavuot' };
  for (let i = -7; i <= 35; i += 1) {
    const d = new Date(today.getTime() + i * 86400000);
    const [n, m] = f.format(d).split(' ').reduce((acc, w) => (/^\d+$/.test(w) ? [w, acc[1]] : [acc[0], acc[1] ? `${acc[1]} ${w}` : w]), ['', '']);
    if (day[`${m} ${n}`]) return day[`${m} ${n}`];
  }
  return null;
}

// A ribbon across the top corner with the chag greeting. Not on a status,
// whose corners WhatsApp covers with the name and the close button.
function holidayRibbon(canvas, format, text, rtl) {
  if (!text || format === 'story') return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  ctx.save();
  ctx.translate(rtl ? 0 : W, 0);
  ctx.rotate(rtl ? -Math.PI / 4 : Math.PI / 4);
  ctx.fillStyle = '#F5C542';
  ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 12;
  ctx.fillRect(-260, 120, 520, 64);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.direction = dirOf(text, rtl);
  ctx.font = `800 30px ${bodyFont(rtl)}`;
  ctx.fillText(wrap(ctx, text, 330, 1)[0] || '', 0, 163);
  ctx.restore();
}
const footTopOf = (format, H) => H - (format === 'story' ? 230 : 0) - (format === 'square' ? 150 : 170) - 80;

// Drag and drop (Tzvi, 4 Nov 2026: "drag and drop like when you make a
// html"). The gallery layouts draw their movable pieces (the product, the
// price, the words) through part(): it moves and scales a piece by what the
// owner dragged (moves[name] = {x, y, s}) and notes where each piece ended
// up (boxes), which the preview uses to know what was grabbed. render()
// sets PARTS for the one drawing it is making; drawing is synchronous.
let PARTS = null;
// The design's ground. With a background photo picked, the photo fills the ad
// under a veil of the design's own colour, so its words keep reading.
function paintGround(ctx, W, H) {
  ctx.fillRect(0, 0, W, H);
  const img = PARTS && PARTS.photo;
  if (!img) return;
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  ctx.globalAlpha = 0.62;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}
function isMoved(name) {
  const m = PARTS && PARTS.moves[name];
  return !!m && (m.x !== 0 || m.y !== 0 || m.s !== 1);
}
// Moving ads (Tzvi, 6 Nov 2026: "so its not just a static ad"). With PARTS.anim set, part() plays each piece's
// way in at anim.t seconds. Everything is back in place by MOVE_ENDS, so the ad ends as the still (rules A10).
const MOVE_ENDS = 3.6;
// It opens on one word, big, on the ad's own colour (the "HEAT." and "HOLD MY RED BULL" openers in
// docs/inspo/ad-videos-2026-11-07), which then gives way to the ad as its pieces arrive.
const HOOK = 1;
const VIDEO_SECONDS = 6.5;
function hookCard(ctx, W, H, anim, a) {
  const words = a.words || {};
  const word = (words.key && words.headline?.includes(words.key) ? words.key
    : (words.headline || '').split(/\s+/).sort((p, q) => q.length - p.length)[0] || '').replace(/[?.!,:]+$/, '');
  ctx.save();
  ctx.globalAlpha = anim.cover;
  ctx.fillStyle = anim.ground || INK;
  ctx.fillRect(0, 0, W, H);
  const body = bodyFont(a.rtl);
  ctx.direction = dirOf(word, a.rtl);
  ctx.textAlign = 'center';
  let size = 380;
  ctx.font = `800 ${size}px ${body}`;
  while (size > 60 && ctx.measureText(word).width > W * 0.88) { size -= 8; ctx.font = `800 ${size}px ${body}`; }
  ctx.fillStyle = anim.groundLight ? INK : '#FFFFFF';
  ctx.translate(W / 2, H / 2);
  const s = 1 + (1 - anim.cover) * 0.25;
  ctx.scale(s, s);
  ctx.fillText(word, 0, size * 0.35);
  ctx.restore();
}
const progress = (t, from, len) => Math.max(0, Math.min(1, (t - from) / len));
const easeOut = (p) => 1 - (1 - p) ** 3;
const easeBack = (p) => 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2;
// Each design's own event; the rest drop in. The product is on the first frame: a chat shows that frame before anyone plays it.
const PRODUCT_MOVE = {
  ring: (t) => ({ r: (t < 0.6 || (t > 0.9 && t < 1.5) ? Math.sin(t * 40) * 0.05 : 0) }),
  shrink: (t) => ({ s: 1 + (1 - easeOut(progress(t, 0, 0.8))) * 0.9 }),
  pop: (t) => ({ s: 0.45 + 0.55 * easeBack(progress(t, 0, 0.7)) }),
  rise: (t, w, h) => ({ y: (1 - easeBack(progress(t, 0, 0.7))) * h * 0.35 }),
  side: (t, w, h, rtl) => ({ x: (1 - easeBack(progress(t, 0, 0.7))) * w * 0.6 * (rtl ? -1 : 1) }),
  drop: (t, w, h, rtl, H) => ({ y: (easeBack(progress(t, 0, 0.7)) - 1) * H * 0.16 }),
};
const PRODUCT_MOVE_OF = { calling: 'ring', giant: 'shrink', phonepop: 'pop', behind: 'rise', mirror: 'rise', split: 'side', versus: 'side' };
function pieceMove(name, { t, layout, rtl }, w, h, H) {
  if (name.startsWith('product')) return PRODUCT_MOVE[PRODUCT_MOVE_OF[layout] || 'drop'](t, w, h, rtl, H);
  if (name === 'price') {
    const p = progress(t, 1.25, 0.4);
    // Once more when all has landed: it is what the eye should end on.
    return { alpha: p > 0 ? 1 : 0, s: Math.max(0.01, easeBack(p)) * (1 + Math.sin(progress(t, 3.1, 0.5) * Math.PI) * 0.12) };
  }
  if (name === 'word') {
    const p = progress(t, 0, 0.5);
    return { alpha: 0.3 + 0.7 * p, s: 1 + (1 - easeOut(p)) * 0.35 };
  }
  if (name === 'qr' || name === 'link' || name === 'name' || name === 'labels' || name === 'review' || name === 'deal') {
    const p = progress(t, { qr: 1.55, link: 1.7, name: 1.1, labels: 0.9, review: 1.9, deal: 1.4 }[name], 0.4);
    return { alpha: p, y: (1 - easeOut(p)) * 60 };
  }
  return null;
}
// The words land one at a time, however the design lays them out: every line it writes goes through here.
function wordByWord(ctx, A, draw) {
  const write = CanvasRenderingContext2D.prototype.fillText;
  const LAND = 0.2;
  ctx.fillText = (text, x, y) => {
    const delay = Math.min(0.12, 1.2 / (A.total || 1));
    const bits = String(text).split(/(?<=\s)/);
    const first = A.n;
    A.n += bits.length;
    // The first word is there from the first frame.
    if (A.t >= (A.n - 1) * delay) { write.call(ctx, text, x, y); return; }
    const rtl = ctx.direction === 'rtl';
    const total = ctx.measureText(text).width;
    const al = ctx.textAlign;
    const fromRight = al === 'right' || (al === 'start' && rtl) || (al === 'end' && !rtl);
    const left = al === 'center' ? x - total / 2 : (fromRight ? x - total : x);
    let done = 0;
    bits.forEach((bit, i) => {
      const width = ctx.measureText(bit).width;
      const p = progress(A.t, (first + i) * delay - LAND, LAND);
      if (p > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect((rtl ? left + total - done - width : left + done) - 2, y - 4000, width + 4, 8000);
        ctx.clip();
        ctx.globalAlpha *= p;
        write.call(ctx, text, x, y + (1 - easeOut(p)) * 26);
        ctx.restore();
      }
      done += width;
    });
  };
  try { draw(); } finally { delete ctx.fillText; }
}
function part(ctx, name, [x, y, w, h], draw, { later = false, minScale = 0.3 } = {}) {
  const raw = (PARTS && PARTS.moves[name]) || { x: 0, y: 0, s: 1 };
  const moved = isMoved(name);
  const cx = x + w / 2;
  const cy = y + h / 2;
  let m = raw;
  // Words, price and code stay whole on the picture and clear of what a status
  // covers (rules 8). Only once moved: nothing shifts in a design left as made.
  if (moved && !name.startsWith('product')) {
    const sc = Math.max(minScale, Math.min(3, raw.s));
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const hold = (v, half, lo, hi) => (lo + half > hi - half ? (lo + hi) / 2 : Math.max(lo + half, Math.min(hi - half, v)));
    m = {
      s: sc,
      x: hold(cx + raw.x, (w * sc) / 2, 0, W) - cx,
      y: hold(cy + raw.y, (h * sc) / 2, H === 1920 ? 220 : 0, H === 1920 ? H - 230 : H) - cy,
    };
  }
  const paint = () => {
    const A = PARTS && PARTS.anim;
    const go = (A && pieceMove(name, A, w, h, ctx.canvas.height)) || {};
    if (go.alpha === 0) return;
    ctx.save();
    if (go.alpha !== undefined) ctx.globalAlpha *= go.alpha;
    ctx.translate(cx + m.x + (go.x || 0), cy + m.y + (go.y || 0));
    if (go.r) ctx.rotate(go.r);
    ctx.scale(m.s * (go.s || 1), m.s * (go.s || 1));
    ctx.translate(-cx, -cy);
    if (A && name === 'words') wordByWord(ctx, A, draw);
    else draw();
    ctx.restore();
  };
  // A moved code goes over whatever the design draws after its foot band.
  if (later && moved && PARTS) PARTS.later.push(paint);
  else paint();
  // The last three are where it really is, so the next drag starts from there.
  if (PARTS) PARTS.boxes[name] = [cx + m.x - (w * m.s) / 2, cy + m.y - (h * m.s) / 2, w * m.s, h * m.s, m.x, m.y, m.s];
}

// The round price sticker: the price of the item in the picture, "from"
// only when that item is the cheapest one the business sells (9e.8).
const nameAndPrice = (item) => [item.name, item.priceText].filter(Boolean).join(', ');
function sticker(ctx, given) {
  if (!given.item?.priceText) return; // the site itself has no price
  // Big enough that "from" stays 30px, the smallest text an ad may have (rules 8).
  const opts = { ...given, r: Math.max(given.r, 94) };
  part(ctx, 'price', [opts.x - opts.r, opts.y - opts.r, opts.r * 2, opts.r * 2], () => drawSticker(ctx, opts));
}
// Whether the ground just outside the sticker is yellow too, where a yellow
// sticker would vanish. Read in the picture's own pixels, through any move.
function onYellow(ctx, x, y, r) {
  try {
    const m = ctx.getTransform();
    const c = m.transformPoint(new DOMPoint(x, y));
    const k = Math.hypot(m.a, m.b) * r * 1.15;
    let n = 0;
    let hit = 0;
    for (let i = 0; i < 16; i += 1) {
      const px = Math.round(c.x + Math.cos((i / 8) * Math.PI) * k);
      const py = Math.round(c.y + Math.sin((i / 8) * Math.PI) * k);
      if (px < 0 || py < 0 || px >= ctx.canvas.width || py >= ctx.canvas.height) continue;
      const d = ctx.getImageData(px, py, 1, 1).data;
      n += 1;
      if (Math.abs(d[0] - 255) + Math.abs(d[1] - 214) + d[2] < 150) hit += 1;
    }
    return n > 0 && hit / n > 0.4;
  } catch {
    return false;
  }
}
function drawSticker(ctx, { x, y, r, item, fromWord, body }) {
  // Yellow, or black with white words where the ground is yellow too.
  // Read once where it ends up, so a moving sticker does not change colour on the way.
  const A = PARTS && PARTS.anim;
  const dark = A?.stickerDark ?? onYellow(ctx, x, y, r);
  if (A) A.stickerDark = dark;
  ctx.fillStyle = dark ? INK : '#FFD600';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark ? '#FFFFFF' : INK;
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  if (item.cheapest) {
    ctx.font = `600 ${Math.round(r * 0.32)}px ${body}`;
    ctx.direction = dirOf(fromWord, false); // "החל מ-" keeps its dash on the left
    ctx.fillText(fromWord, x, y - r * 0.22);
    ctx.direction = 'ltr';
  }
  ctx.font = `800 ${Math.round(r * (item.priceText.length > 5 ? 0.42 : 0.55))}px ${body}`;
  ctx.fillText(item.priceText, x, y + (item.cheapest ? r * 0.38 : r * 0.2));
}

function shadowed(ctx, img, x, y, w, h, blur = 40, dy = 24, { name = 'product', tilt = PARTS && PARTS.tilt } = {}) {
  part(ctx, name, [x, y, w, h], () => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    // Light behind it, so it stands off the ground.
    const r = Math.max(w, h) * 0.62;
    const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    glow.addColorStop(0, 'rgba(255,255,255,.2)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Dark where it touches, so it sits on something rather than floats.
    ctx.save();
    ctx.translate(cx, y + h * 0.96);
    ctx.scale(1, 0.16);
    const rest = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.46);
    rest.addColorStop(0, 'rgba(20,10,5,.45)');
    rest.addColorStop(0.7, 'rgba(20,10,5,.18)');
    rest.addColorStop(1, 'rgba(20,10,5,0)');
    ctx.fillStyle = rest;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.translate(cx, cy);
    ctx.rotate(tilt || 0);
    ctx.translate(-cx, -cy);
    ctx.shadowColor = 'rgba(30,15,8,.5)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = dy;
    ctx.drawImage(img, x, y, w, h);
  });
}

// "Words behind" (words locked with the subject, 4.0/5): one huge word with
// the product lying across its lower part, the headline under it.
function drawBehind(canvas, { format, words, eyebrow, cta, shortUrl, rtl, qr, item, fromWord, brand, look = 'cream' }) {
  const { ctx, W, H, body, px, top } = begin(canvas, format, rtl);
  const L = lookOf(look, brand, item.cut);
  ctx.fillStyle = L.bg;
  paintGround(ctx, W, H);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body, ground: L.foot, dark: L.footDark });
  ctx.textAlign = 'center';
  ctx.fillStyle = L.sub;
  ctx.font = `600 ${px(30)}px ${body}`;
  ctx.fillText(wrap(ctx, (eyebrow || '').toUpperCase(), W - 128, 1)[0] || '', W / 2, top + px(26));
  const word = (words.big_word || '').trim();
  let size = 80;
  for (let s = 420; s >= 80; s -= 6) {
    ctx.font = `800 ${s}px ${body}`;
    const m = ctx.measureText(word);
    if (m.width <= W - 80 && (m.actualBoundingBoxAscent || s * 0.72) <= (footTop - top) * 0.3) { size = s; break; }
  }
  ctx.font = `800 ${size}px ${body}`;
  const capH = ctx.measureText(word).actualBoundingBoxAscent || size * 0.72;
  const base = top + px(40) + capH;
  part(ctx, 'word', [40, base - capH, W - 80, capH * 1.08], () => {
    ctx.fillStyle = L.word;
    ctx.fillText(word, W / 2, base);
  });
  // The headline under the product, then the product in the room between.
  ctx.font = `800 ${px(46)}px ${body}`;
  const sub = wrap(ctx, words.headline, W - 140, 2);
  const subH = sub.length * px(58);
  const boardTop = base - capH * 0.32;
  const room = footTop - 36 - subH - 30 - boardTop;
  const [cw, ch] = fitIn(item.cut, W - 150, room);
  const bx = (W - cw) / 2;
  shadowed(ctx, item.cut, bx, boardTop, cw, ch);
  const r = Math.round(Math.min(110, W * 0.1));
  sticker(ctx, { x: rtl ? bx + r * 0.6 : bx + cw - r * 0.6, y: boardTop + ch - r * 0.7, r, item, fromWord, body });
  ctx.fillStyle = L.text;
  ctx.font = `800 ${px(46)}px ${body}`;
  ctx.direction = rtl ? 'rtl' : 'ltr';
  part(ctx, 'words', [70, boardTop + ch + 30, W - 140, sub.length * px(58) + 10],
    () => sub.forEach((l, i) => ctx.fillText(l, W / 2, boardTop + ch + 30 + px(46) + i * px(58))));
}

// "Out of the phone" (fake app screen and surprising scale, 3.6 and 4.1):
// the business's own item on a phone, its product leaping out of the top.
function drawPhonePop(canvas, { format, words, eyebrow, cta, shortUrl, rtl, qr, item, addLabel, brand, look = 'own' }) {
  const { ctx, W, H, body, px, top } = begin(canvas, format, rtl);
  const L = lookOf(look, brand, item.cut);
  const col = vividColour(item.cut);
  ctx.fillStyle = L.bg;
  paintGround(ctx, W, H);
  const footTop = footTopOf(format, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = L.sub;
  ctx.font = `600 ${px(30)}px ${body}`;
  ctx.fillText(wrap(ctx, (eyebrow || '').toUpperCase(), W - 128, 1)[0] || '', W / 2, top + px(26));
  ctx.fillStyle = L.text;
  ctx.font = `800 ${px(60)}px ${body}`;
  const head = wrap(ctx, words.headline, W - 128, 2);
  part(ctx, 'words', [64, top + px(40) + px(8), W - 128, head.length * px(72)],
    () => head.forEach((l, i) => ctx.fillText(l, W / 2, top + px(40) + px(60) + i * px(72))));
  const headBottom = top + px(40) + head.length * px(72);
  const pw = Math.round(Math.min(640, W * 0.6));
  const [cw, ch] = fitIn(item.cut, pw * 1.15, (footTop - headBottom) * 0.55);
  const py = headBottom + 40 + ch * 0.55;
  const px0 = (W - pw) / 2;
  ctx.fillStyle = '#0B0B0F';
  ctx.beginPath();
  ctx.roundRect(px0, py, pw, footTop + 120 - py, 60);
  ctx.fill();
  ctx.fillStyle = '#FAF7F2';
  ctx.beginPath();
  ctx.roundRect(px0 + 16, py + 16, pw - 32, footTop + 120 - py, 46);
  ctx.fill();
  shadowed(ctx, item.cut, (W - cw) / 2, py - ch * 0.55, cw, ch, 50, 36);
  // The item's own name and price on the screen, under the product.
  const s0 = rtl ? px0 + pw - 50 : px0 + 50;
  let y = py - ch * 0.55 + ch + 40;
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.direction = dirOf(item.name, rtl);
  ctx.fillStyle = INK;
  ctx.font = `800 ${px(34)}px ${body}`;
  const name = item.name.charAt(0).toUpperCase() + item.name.slice(1);
  wrap(ctx, name, pw - 100, 2).forEach((l) => { y += px(42); ctx.fillText(l, s0, y); });
  ctx.direction = 'ltr';
  ctx.fillStyle = rgb(col);
  ctx.font = `800 ${px(40)}px ${body}`;
  y += px(50);
  ctx.fillText(item.priceText, s0, y);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  y += 30;
  if (y + 70 < footTop) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(px0 + 50, y, pw - 100, 70, 35);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = `600 ${px(30)}px ${body}`;
    ctx.fillText(addLabel, W / 2, y + 46);
  }
  footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body, ground: L.foot, dark: L.footDark });
}

// "Is calling..." (the incoming-call screen, a repeated 5/5 in the library):
// the product as the caller; decline is the chore, accept is the order.
function drawCalling(canvas, { format, words, eyebrow, cta, shortUrl, rtl, qr, item, fromWord, callingLabel, acceptLabel, brand, look = 'own' }) {
  const { ctx, W, H, body, px, top } = begin(canvas, format, rtl);
  const L = lookOf(look, brand, item.cut);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, L.bg);
  g.addColorStop(1, L.bg2);
  ctx.fillStyle = g;
  paintGround(ctx, W, H);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body, ground: L.foot, dark: L.footDark });
  ctx.textAlign = 'center';
  ctx.fillStyle = L.text;
  const callerSize = format === 'square' ? 80 : px(104);
  ctx.font = `800 ${callerSize}px ${body}`;
  const callerLines = wrap(ctx, words.caller || '', W - 128, 2);
  let y = top + px(20);
  const y0 = y;
  part(ctx, 'words', [64, y0 + callerSize * 0.2, W - 128, callerLines.length * callerSize * 1.04],
    () => callerLines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + callerSize * 1.04 * (i + 1))));
  y += callerLines.length * callerSize * 1.04;
  ctx.fillStyle = L.sub;
  ctx.font = `500 ${px(44)}px ${body}`;
  y += px(64);
  ctx.fillText(callingLabel, W / 2, y);
  const btnR = Math.round(Math.min(70, W * 0.065));
  const btnY = footTop - 60 - px(40) - btnR;
  const lineY = btnY - btnR - 50;
  const room = lineY - 50 - (y + 50);
  const [cw, ch] = fitIn(item.cut, W * 0.62, room);
  const cy = y + 50 + room / 2;
  part(ctx, 'product', [(W - cw) / 2, cy - ch / 2, cw, ch], () => [1.12, 0.96, 0.8].forEach((k, i) => {
    ctx.strokeStyle = `rgba(${L.ring},${0.16 + i * 0.12})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(W / 2, cy, Math.max(cw, ch) * 0.5 * k, 0, Math.PI * 2);
    ctx.stroke();
  }));
  shadowed(ctx, item.cut, (W - cw) / 2, cy - ch / 2, cw, ch, 50, 30);
  ctx.fillStyle = L.sub;
  ctx.font = `600 ${px(36)}px ${body}`;
  const price = item.cheapest ? `${fromWord} ${item.priceText}` : item.priceText;
  ctx.fillText(wrap(ctx, price ? `${eyebrow} · ${price}` : eyebrow, W - 128, 1)[0], W / 2, lineY);
  [[-1, '#EB4034', words.decline || ''], [1, '#34C759', acceptLabel]].forEach(([side, fill, label]) => {
    const bx = W / 2 + side * (rtl ? -1 : 1) * Math.min(230, W * 0.22);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(bx, btnY, btnR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.round(btnR * 0.17);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const k = btnR * 0.36;
    if (side < 0) { ctx.moveTo(bx - k, btnY - k); ctx.lineTo(bx + k, btnY + k); ctx.moveTo(bx + k, btnY - k); ctx.lineTo(bx - k, btnY + k); } else { ctx.moveTo(bx - k, btnY); ctx.lineTo(bx - k * 0.2, btnY + k * 0.75); ctx.lineTo(bx + k, btnY - k * 0.65); }
    ctx.stroke();
    ctx.fillStyle = L.text;
    ctx.font = `600 ${px(32)}px ${body}`;
    ctx.fillText(wrap(ctx, label, W * 0.36, 1)[0] || '', bx, btnY + btnR + px(40));
  });
}

// Four more from the library's idea folders (docs/inspo/pinterest-ads-
// 2026-11-02: notify, search, toggle, checklist), for the gallery. Each
// shows the business's own product, cut out when it can be, with its own
// price, and words from the listing (POST /ads/make writes search,
// switches and checklist).
function product(ctx, item, x, y, w, h) {
  const img = item.cut || item.img;
  const [cw, ch] = fitIn(img, w, h);
  const cx = x + (w - cw) / 2;
  const cy = y + (h - ch) / 2;
  if (item.cut) shadowed(ctx, img, cx, cy, cw, ch);
  else part(ctx, 'product', [cx, cy, cw, ch], () => roundedImage(ctx, img, cx, cy, cw, ch, 24));
  return [cx, cy, cw, ch];
}
const lineList = (s) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean);
function say(ctx, s, x, y, { size, weight = 600, colour = INK, align = 'center', body, rtl, max = 0 }) {
  ctx.font = `${weight} ${size}px ${body}`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.direction = dirOf(s, rtl);
  ctx.fillText(max ? (wrap(ctx, s || '', max, 1)[0] || '') : (s || ''), x, y);
}

// "Notifications": a lock screen lighting up with the business's own
// news, one fact a card, the product under them.
function drawNotify(canvas, { format, words, eyebrow, cta, shortUrl, rtl, qr, item, todayLabel, brand, look = 'night' }) {
  const { ctx, W, H, body, px, top } = begin(canvas, format, rtl);
  const L = lookOf(look, brand, item.cut || item.img);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, L.bg);
  g.addColorStop(1, L.bg2);
  ctx.fillStyle = g;
  paintGround(ctx, W, H);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body, ground: L.foot, dark: L.footDark });
  let y = top + px(130);
  say(ctx, '9:41', W / 2, y, { size: px(150), weight: 300, colour: L.text, body, rtl: false });
  y += px(56);
  say(ctx, todayLabel, W / 2, y, { size: px(32), colour: L.sub, body, rtl });
  y += px(40);
  const notes = [words.headline, ...(words.points || []), nameAndPrice(item)].filter(Boolean).slice(0, 3);
  const I = px(58);
  const cards = notes.map((n) => {
    ctx.font = `500 ${px(30)}px ${body}`;
    ctx.direction = dirOf(n, rtl);
    const nl = wrap(ctx, n, W - 140 - I - 90, 2);
    return [nl, px(58) + nl.length * px(36) + 16];
  });
  const cardsH = cards.reduce((t, [, h]) => t + h + 14, 0);
  part(ctx, 'words', [70, y, W - 140, cardsH], () => cards.forEach(([nl, h]) => {
    ctx.fillStyle = 'rgba(255,255,255,.93)';
    ctx.beginPath();
    ctx.roundRect(70, y, W - 140, h, 30);
    ctx.fill();
    const ix = rtl ? W - 70 - 26 - I : 96;
    ctx.fillStyle = L.own;
    ctx.beginPath();
    ctx.roundRect(ix, y + 22, I, I, 14);
    ctx.fill();
    say(ctx, (eyebrow || '?').trim()[0].toUpperCase(), ix + I / 2, y + 22 + I * 0.7, { size: Math.round(I * 0.55), weight: 800, colour: '#FFFFFF', body, rtl: false });
    const tx = rtl ? ix - 22 : ix + I + 22;
    const al = rtl ? 'right' : 'left';
    say(ctx, eyebrow, tx, y + px(46), { size: px(30), weight: 800, align: al, body, rtl, max: W - 360 });
    nl.forEach((l, i) => say(ctx, l, tx, y + px(46) + (i + 1) * px(38), { size: px(30), weight: 500, colour: '#374151', align: al, body, rtl }));
    y += h + 14;
  }));
  if (footTop - 40 - (y + 20) > 140) product(ctx, item, 90, y + 20, W - 180, footTop - 40 - (y + 20));
}

// "Search": what someone would type to find it, and the business as the
// answer: its name, its headline, its product and price.
function drawSearch(canvas, { format, words, eyebrow, cta, shortUrl, rtl, qr, item, searchKicker, brand, look = 'cream' }) {
  const { ctx, W, H, body, px, top } = begin(canvas, format, rtl);
  const L = lookOf(look, brand, item.cut || item.img);
  ctx.fillStyle = L.bg;
  paintGround(ctx, W, H);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body, ground: L.foot, dark: L.footDark });
  let y = top + px(30);
  say(ctx, searchKicker, W / 2, y, { size: px(32), colour: L.sub, body, rtl });
  y += px(40);
  ctx.save();
  ctx.shadowColor = 'rgba(17,24,39,.18)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(70, y, W - 140, px(110), px(55));
  ctx.fill();
  ctx.restore();
  const q = words.search || '';
  const qr2 = dirOf(q, rtl) === 'rtl';
  const gx = qr2 ? W - 128 : 128;
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(gx, y + px(50), px(17), 0, Math.PI * 2);
  ctx.moveTo(gx + (qr2 ? -1 : 1) * px(12), y + px(62));
  ctx.lineTo(gx + (qr2 ? -1 : 1) * px(28), y + px(78));
  ctx.stroke();
  say(ctx, q, qr2 ? W - 175 : 175, y + px(68), { size: px(36), align: qr2 ? 'right' : 'left', body, rtl, max: W - 300 });
  y += px(110) + 40;
  const cardH = footTop - 50 - y;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(70, y, W - 140, cardH, 34);
  ctx.fill();
  const al = rtl ? 'right' : 'left';
  const tx = rtl ? W - 120 : 120;
  let ty = y + px(70);
  say(ctx, eyebrow, tx, ty, { size: px(40), weight: 800, colour: L.own, align: al, body, rtl, max: W - 240 });
  ctx.font = `600 ${px(32)}px ${body}`;
  ctx.direction = dirOf(words.headline, rtl);
  wrap(ctx, words.headline, W - 240, 2).forEach((l) => { ty += px(44); say(ctx, l, tx, ty, { size: px(32), colour: '#374151', align: al, body, rtl }); });
  ty += px(30);
  const [, cy, , ch] = product(ctx, item, 110, ty, W - 220, y + cardH - 40 - ty - px(60));
  say(ctx, nameAndPrice(item), W / 2, Math.min(cy + ch + px(52), y + cardH - 30), { size: px(32), weight: 800, body, rtl, max: W - 240 });
}

// "Switches": phone settings, the chores off and the business's offer on,
// the product under them with its price.
function drawToggle(canvas, { format, words, cta, shortUrl, rtl, qr, item, fromWord, brand, look = 'cream' }) {
  const { ctx, W, H, body, px, top } = begin(canvas, format, rtl);
  const L = lookOf(look, brand, item.cut || item.img);
  ctx.fillStyle = L.bg;
  paintGround(ctx, W, H);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body, ground: L.foot, dark: L.footDark });
  let y = top + px(20);
  ctx.font = `800 ${px(58)}px ${body}`;
  ctx.direction = dirOf(words.headline, rtl);
  const hl = wrap(ctx, words.headline, W - 140, 2);
  const hy = y;
  part(ctx, 'words', [70, hy + px(10), W - 140, hl.length * px(68)],
    () => hl.forEach((l, i) => say(ctx, l, W / 2, hy + px(68) * (i + 1), { size: px(58), weight: 800, colour: L.text, body, rtl })));
  y += hl.length * px(68);
  y += 40;
  const rows = lineList(words.switches).slice(0, 3).map((l) => [l.startsWith('+'), l.replace(/^[+-]\s*/, '')]);
  const rh = px(104);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(70, y, W - 140, rh * rows.length, 34);
  ctx.fill();
  rows.forEach(([on, label], i) => {
    const ry = y + i * rh;
    if (i) { ctx.fillStyle = '#E3E3E3'; ctx.fillRect(110, ry, W - 220, 2); }
    const r = dirOf(label, rtl) === 'rtl';
    say(ctx, label, r ? W - 110 : 110, ry + rh / 2 + px(12), { size: px(34), weight: on ? 800 : 500, colour: on ? INK : '#666666', align: r ? 'right' : 'left', body, rtl, max: W - 400 });
    const sw = px(112); const sh = px(64);
    const sx = r ? 110 : W - 110 - sw;
    const sy = ry + (rh - sh) / 2;
    ctx.fillStyle = on ? '#34C759' : '#D1D5DB';
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, sh, sh / 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(on !== r ? sx + sw - sh / 2 : sx + sh / 2, sy + sh / 2, sh / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
  });
  y += rh * rows.length + 30;
  if (footTop - 30 - y > 140) {
    const [cx, cy, cw, ch] = product(ctx, item, 90, y, W - 180, footTop - 30 - y);
    const r = Math.round(Math.min(100, ch * 0.32));
    sticker(ctx, { x: rtl ? cx + r * 0.6 : cx + cw - r * 0.6, y: cy + ch - r * 0.6, r, item, fromWord, body });
  }
}

// "Checklist": the reader's own to-do list, the last line ticked, which is
// getting this business's thing; the product beside the paper.
function drawChecklist(canvas, { format, words, cta, shortUrl, rtl, qr, item, fromWord, brand, look = 'sun' }) {
  const { ctx, W, H, body, head, px, top } = begin(canvas, format, rtl);
  const L = lookOf(look, brand, item.cut || item.img);
  ctx.fillStyle = L.bg;
  paintGround(ctx, W, H);
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body, ground: L.foot, dark: L.footDark });
  const all = lineList(words.checklist);
  const title = all[0] || '';
  let list = all.slice(1, 5).map((l) => [/^x\s/i.test(l), l.replace(/^x\s+/i, '')]);
  if (list.length && !list.some(([d]) => d)) list = list.map(([, l], i) => [i === list.length - 1, l]);
  const rh = px(78);
  const ph = px(120) + list.length * rh + px(40);
  const py = top + px(10);
  part(ctx, 'words', [80, py, W - 160, ph], () => {
  ctx.save();
  ctx.translate(W / 2, py + ph / 2);
  ctx.rotate(-0.02);
  ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-W / 2 + 80, -ph / 2, W - 160, ph);
  ctx.shadowColor = 'transparent';
  const r = dirOf(title + list.map(([, l]) => l).join(' '), rtl) === 'rtl';
  const L0 = -W / 2 + 130;
  const R0 = W / 2 - 130;
  let y = -ph / 2 + px(84);
  ctx.font = `700 ${px(50)}px ${head}`;
  ctx.fillStyle = INK;
  ctx.textAlign = r ? 'right' : 'left';
  ctx.direction = r ? 'rtl' : 'ltr';
  ctx.fillText(wrap(ctx, title, W - 260, 1)[0] || '', r ? R0 : L0, y);
  list.forEach(([done, label]) => {
    y += rh;
    const B = px(44);
    const bx = r ? R0 - B : L0;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeRect(bx, y - B + 6, B, B);
    if (done) {
      ctx.strokeStyle = '#1F8A50';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(bx + 8, y - B / 2 + 6); ctx.lineTo(bx + B * 0.42, y + 2); ctx.lineTo(bx + B + 10, y - B - 4);
      ctx.stroke();
    }
    const tx = r ? bx - 24 : bx + B + 24;
    ctx.font = `${done ? 800 : 500} ${px(36)}px ${body}`;
    ctx.fillStyle = done ? INK : '#555555';
    ctx.textAlign = r ? 'right' : 'left';
    ctx.direction = dirOf(label, rtl);
    const shown = wrap(ctx, label, W - 380, 1)[0] || '';
    ctx.fillText(shown, tx, y);
    if (!done) {
      const w = ctx.measureText(shown).width;
      ctx.strokeStyle = 'rgba(180,35,24,.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r ? tx - w : tx, y - px(11));
      ctx.lineTo(r ? tx : tx + w, y - px(11));
      ctx.stroke();
    }
  });
  ctx.restore();
  });
  const y2 = py + ph + 30;
  if (footTop - 30 - y2 > 140) {
    const [cx, cy, cw, ch] = product(ctx, item, 90, y2, W - 180, footTop - 30 - y2);
    const rr = Math.round(Math.min(100, ch * 0.32));
    sticker(ctx, { x: rtl ? cx + rr * 0.6 : cx + cw - rr * 0.6, y: cy + ch - rr * 0.6, r: rr, item, fromWord, body });
  }
}

// The layouts from docs/static-ad-rules.md 9f (4 Nov 2026): each is words
// the model wrote from the listing and its reviews, the business's own
// product and price, and the link band. Nothing generated.

// The look's ground and the link band, shared by these layouts.
function ground(canvas, a) {
  const g = begin(canvas, a.format, a.rtl);
  const L = lookOf(a.look, a.brand, a.item.cut || a.item.img);
  g.ctx.fillStyle = L.bg;
  paintGround(g.ctx, g.W, g.H);
  const footTop = footBand(g.ctx, { W: g.W, H: g.H, format: a.format, rtl: a.rtl, cta: a.cta, shortUrl: a.shortUrl, qr: a.qr,
    body: g.body, ground: L.foot, dark: L.footDark });
  return { ...g, L, footTop };
}
// The product and its own price in whatever room is left above the band.
function productBelow(ctx, a, y, footTop, W, body) {
  if (footTop - 30 - y <= 140) return;
  const [cx, cy, cw, ch] = product(ctx, a.item, 90, y, W - 180, footTop - 30 - y);
  const r = Math.round(Math.min(100, ch * 0.32));
  sticker(ctx, { x: a.rtl ? cx + r * 0.6 : cx + cw - r * 0.6, y: cy + ch - r * 0.6, r, item: a.item, fromWord: a.fromWord, body });
}
function card(ctx, x, y, w, h, r = 36) {
  ctx.save();
  ctx.shadowColor = 'rgba(17,24,39,.18)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}
// The photo itself (not the cut-out) in a box, with its price on a corner.
function photoWithPrice(ctx, a, x, y, w, h, body) {
  const img = a.item.img || a.item.cut;
  const [pw, ph] = fitIn(img, w, h);
  const px0 = x + (w - pw) / 2;
  part(ctx, 'product', [px0, y, pw, ph], () => roundedImage(ctx, img, px0, y, pw, ph, 28));
  const r = Math.round(Math.min(90, ph * 0.28));
  sticker(ctx, { x: a.rtl ? px0 + r * 0.7 : px0 + pw - r * 0.7, y: y + ph - r * 0.7, r, item: a.item, fromWord: a.fromWord, body });
}

// "A real moment" (9f.1, Levi Knox's situation formula): the moment
// someone needs this, then the plain answer, then the product.
function drawSituation(canvas, a) {
  const { ctx, W, body, px, top, L, footTop } = ground(canvas, a);
  const [setup = '', answer = ''] = (a.situation || '').split('|').map((x) => x.trim());
  ctx.font = `800 ${px(66)}px ${body}`;
  const s1 = wrap(ctx, setup, W - 140, 3);
  ctx.font = `800 ${px(56)}px ${body}`;
  const s2 = wrap(ctx, answer, W - 140, 2);
  const y0 = top + px(20);
  const h = s1.length * px(78) + px(30) + s2.length * px(68);
  part(ctx, 'words', [70, y0, W - 140, h], () => {
    s1.forEach((l, i) => say(ctx, l, W / 2, y0 + px(64) + i * px(78), { size: px(66), weight: 800, colour: L.text, body, rtl: a.rtl }));
    const y1 = y0 + s1.length * px(78) + px(30);
    s2.forEach((l, i) => say(ctx, l, W / 2, y1 + px(54) + i * px(68), { size: px(56), weight: 800, colour: L.word, body, rtl: a.rtl }));
  });
  productBelow(ctx, a, y0 + h + px(40), footTop, W, body);
}

// "Is this you?" (9f.2, Simon's "Rude teenager?"): a question naming the
// reader in crayon colours, three lines of their moment, then the product.
const CRAYON = ['#E5484D', '#E8590C', '#2F9E44', '#1C7ED6', '#AE3EC9'];
function drawMirror(canvas, a) {
  const { ctx, W, body, px, top, L, footTop } = ground(canvas, a);
  const [q = '', ...rest] = lineList(a.words.mirror);
  const size = px(92);
  ctx.font = `800 ${size}px ${body}`;
  const qs = wrap(ctx, q, W - 140, 2);
  ctx.font = `600 ${px(38)}px ${body}`;
  const ls = rest.slice(0, 3).flatMap((l) => wrap(ctx, l, W - 160, 2));
  const lh = px(52);
  const y0 = top + px(10);
  const h = qs.length * size * 1.08 + px(36) + ls.length * lh;
  part(ctx, 'words', [70, y0, W - 140, h], () => {
    let y = y0 + size * 0.92;
    let k = 0;
    qs.forEach((line) => {
      ctx.font = `800 ${size}px ${body}`;
      const r = dirOf(line, a.rtl) === 'rtl';
      const ws = line.split(' ').filter(Boolean);
      const gap = ctx.measureText(' ').width;
      const total = ws.reduce((t, w) => t + ctx.measureText(w).width, 0) + gap * (ws.length - 1);
      let x = r ? (W + total) / 2 : (W - total) / 2;
      ws.forEach((w) => {
        const colour = (PARTS && PARTS.ink) || CRAYON[k % CRAYON.length];
        say(ctx, w, x, y, { size, weight: 800, colour, align: r ? 'right' : 'left', body, rtl: a.rtl });
        const step = ctx.measureText(w).width + gap;
        x += r ? -step : step;
        k += 1;
      });
      y += size * 1.08;
    });
    y = y0 + qs.length * size * 1.08 + px(36) + px(38);
    ls.forEach((l) => { say(ctx, l, W / 2, y, { size: px(38), weight: 600, colour: L.text, body, rtl: a.rtl }); y += lh; });
  });
  productBelow(ctx, a, y0 + h + px(40), footTop, W, body);
}

// "Questions and answers" (9b.6, 9f.6): the owner's own questions and answers
// from their page, as messages, then their photo. Never a made-up exchange:
// a conversation that did not happen is a fake screenshot (rules 5).
function drawChat(canvas, a) {
  const { ctx, W, body, px, top, L, footTop } = ground(canvas, a);
  const msgs = lineList(a.words.chat).slice(0, 4);
  const x0 = 60;
  const w0 = W - 120;
  const y0 = top - px(10);
  card(ctx, x0, y0, w0, footTop - 30 - y0, 44);
  // The business at the top, like a chat's header.
  const av = px(78);
  ctx.fillStyle = a.brand || ACCENT;
  ctx.beginPath();
  ctx.arc(W / 2, y0 + px(26) + av / 2, av / 2, 0, Math.PI * 2);
  ctx.fill();
  say(ctx, (a.name || '?').trim().charAt(0).toUpperCase(), W / 2, y0 + px(26) + av / 2 + px(14), { size: px(38), weight: 800, colour: '#FFFFFF', body, rtl: a.rtl });
  say(ctx, a.name || '', W / 2, y0 + px(26) + av + px(38), { size: px(30), weight: 700, colour: INK, body, rtl: a.rtl, max: w0 - 80 });
  ctx.fillStyle = '#E3E3E3';
  ctx.fillRect(x0, y0 + av + px(84), w0, 2);
  let y = y0 + av + px(112);
  const pad = px(22);
  const fs = px(32);
  const boxes = [];
  msgs.forEach((m, i) => {
    const mine = i % 2 === 1;
    ctx.font = `500 ${fs}px ${body}`;
    const ls = wrap(ctx, m, w0 * 0.6, 4);
    const bw = Math.max(...ls.map((l) => ctx.measureText(l).width)) + pad * 2;
    const bh = ls.length * px(42) + pad * 1.6;
    // The business on the far side of whoever reads, in both directions.
    const right = mine !== a.rtl;
    boxes.push({ ls, bw, bh, y, mine, bx: right ? x0 + w0 - 34 - bw : x0 + 34 });
    y += bh + px(16);
  });
  part(ctx, 'words', [x0 + 20, y0 + av + px(100), w0 - 40, y - (y0 + av + px(100))], () => boxes.forEach(({ ls, bw, bh, y: by, mine, bx }) => {
    ctx.fillStyle = mine ? ACCENT : '#E9E9EB';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, px(30));
    ctx.fill();
    ls.forEach((l, j) => {
      const r = dirOf(l, a.rtl) === 'rtl';
      say(ctx, l, r ? bx + bw - pad : bx + pad, by + pad + px(30) + j * px(42), { size: fs, weight: 500, colour: mine ? '#FFFFFF' : INK, align: r ? 'right' : 'left', body, rtl: a.rtl });
    });
  }));
  const room = footTop - 60 - y;
  if (room > 160) {
    const w = w0 * 0.8;
    const bx = a.rtl ? x0 + 34 : x0 + w0 - 34 - w;
    photoWithPrice(ctx, a, bx, y + px(6), w, room - px(10), body);
  }
}

// "Social post" (9f.6): the business's own post, in its own voice, with
// its photo. No counts of likes or followers: those would be invented.
function drawPost(canvas, a) {
  const { ctx, W, body, px, top, footTop } = ground(canvas, a);
  const x0 = 60;
  const w0 = W - 120;
  const y0 = top - px(10);
  card(ctx, x0, y0, w0, footTop - 30 - y0, 36);
  const av = px(84);
  const r = a.rtl;
  const ax = r ? x0 + w0 - 40 - av / 2 : x0 + 40 + av / 2;
  ctx.fillStyle = a.brand || ACCENT;
  ctx.beginPath();
  ctx.arc(ax, y0 + 40 + av / 2, av / 2, 0, Math.PI * 2);
  ctx.fill();
  say(ctx, (a.name || '?').trim().charAt(0).toUpperCase(), ax, y0 + 40 + av / 2 + px(14), { size: px(40), weight: 800, colour: '#FFFFFF', body, rtl: r });
  const tx = r ? ax - av / 2 - 24 : ax + av / 2 + 24;
  say(ctx, a.name || '', tx, y0 + 40 + px(36), { size: px(34), weight: 800, align: r ? 'right' : 'left', body, rtl: r, max: w0 - av - 120 });
  say(ctx, a.nowLabel || '', tx, y0 + 40 + px(76), { size: px(30), weight: 500, colour: '#666666', align: r ? 'right' : 'left', body, rtl: r });
  const sx = r ? x0 + w0 - 40 : x0 + 40;
  ctx.font = `500 ${px(36)}px ${body}`;
  const ls = wrap(ctx, a.words.post || '', w0 - 80, 4);
  const ty = y0 + 40 + av + px(54);
  part(ctx, 'words', [x0 + 30, ty - px(40), w0 - 60, ls.length * px(48) + px(10)],
    () => ls.forEach((l, i) => say(ctx, l, sx, ty + i * px(48), { size: px(36), weight: 500, align: r ? 'right' : 'left', body, rtl: r })));
  const iy = ty + ls.length * px(48) + px(10);
  const actH = px(80);
  const room = footTop - 30 - actH - iy;
  if (room > 160) photoWithPrice(ctx, a, x0 + 40, iy, w0 - 80, room - 10, body);
  // Comment, share and like, drawn as outlines, no numbers.
  const ay = footTop - 30 - actH / 2 - 10;
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 4;
  [0.2, 0.5, 0.8].forEach((f, i) => {
    const cx = x0 + w0 * f;
    ctx.beginPath();
    if (i === 0) ctx.roundRect(cx - 20, ay - 16, 40, 30, 10);
    if (i === 1) { ctx.moveTo(cx - 18, ay + 14); ctx.lineTo(cx - 18, ay - 4); ctx.lineTo(cx + 16, ay - 4); ctx.moveTo(cx + 6, ay - 14); ctx.lineTo(cx + 16, ay - 4); ctx.lineTo(cx + 6, ay + 6); }
    if (i === 2) { ctx.moveTo(cx, ay + 16); ctx.bezierCurveTo(cx - 34, ay - 6, cx - 14, ay - 30, cx, ay - 12); ctx.bezierCurveTo(cx + 14, ay - 30, cx + 34, ay - 6, cx, ay + 16); }
    ctx.stroke();
  });
}

// "Us vs the usual way" (9f.6, Dr. Squatch's checklist): this business
// beside the usual way of getting the same thing, never a named rival.
function drawVersus(canvas, a) {
  const { ctx, W, body, px, top, L, footTop } = ground(canvas, a);
  const [usual = '', ...rest] = lineList(a.words.versus);
  const rows = rest.slice(0, 3).map((l) => l.split('|').map((x) => x.trim()));
  ctx.font = `800 ${px(56)}px ${body}`;
  const hl = wrap(ctx, a.words.headline || '', W - 140, 2);
  const y0 = top + px(10);
  const rh = px(104);
  const headH = px(84);
  const tableY = y0 + hl.length * px(66) + px(30);
  const tableH = headH + rows.length * rh;
  part(ctx, 'words', [60, y0, W - 120, tableY + tableH - y0], () => {
    hl.forEach((l, i) => say(ctx, l, W / 2, y0 + px(56) + i * px(66), { size: px(56), weight: 800, colour: L.text, body, rtl: a.rtl }));
    card(ctx, 60, tableY, W - 120, tableH, 32);
    const colW = (W - 120) / 2;
    // Ours on the reading side: left in English, right in Hebrew.
    const oursX = a.rtl ? 60 + colW : 60;
    const theirsX = a.rtl ? 60 : 60 + colW;
    ctx.fillStyle = a.brand || ACCENT;
    ctx.beginPath();
    ctx.roundRect(oursX + 14, tableY + 14, colW - 28, headH - 28, 18);
    ctx.fill();
    say(ctx, a.name || '', oursX + colW / 2, tableY + headH / 2 + px(12), { size: px(32), weight: 800, colour: '#FFFFFF', body, rtl: a.rtl, max: colW - 60 });
    say(ctx, usual, theirsX + colW / 2, tableY + headH / 2 + px(12), { size: px(32), weight: 700, colour: '#666666', body, rtl: a.rtl, max: colW - 40 });
    rows.forEach(([ours = '', theirs = ''], i) => {
      const ry = tableY + headH + i * rh;
      ctx.fillStyle = '#E3E3E3';
      ctx.fillRect(80, ry, W - 160, 2);
      [[oursX, ours, true], [theirsX, theirs, false]].forEach(([cx, text, good]) => {
        const mark = px(22);
        const mx = a.rtl ? cx + colW - 34 - mark : cx + 34 + mark;
        ctx.fillStyle = good ? '#1F8A50' : '#B42318';
        ctx.beginPath();
        ctx.arc(mx, ry + rh / 2, mark, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 5;
        ctx.beginPath();
        if (good) { ctx.moveTo(mx - 10, ry + rh / 2); ctx.lineTo(mx - 3, ry + rh / 2 + 8); ctx.lineTo(mx + 11, ry + rh / 2 - 9); } else { ctx.moveTo(mx - 8, ry + rh / 2 - 8); ctx.lineTo(mx + 8, ry + rh / 2 + 8); ctx.moveTo(mx + 8, ry + rh / 2 - 8); ctx.lineTo(mx - 8, ry + rh / 2 + 8); }
        ctx.stroke();
        const tw = colW - mark * 2 - 80;
        ctx.font = `${good ? 700 : 500} ${px(30)}px ${body}`;
        const tl = wrap(ctx, text, tw, 2);
        const tx = a.rtl ? mx - mark - 16 : mx + mark + 16;
        tl.forEach((l, j) => say(ctx, l, tx, ry + rh / 2 + px(10) - (tl.length - 1) * px(17) + j * px(34),
          { size: px(30), weight: good ? 700 : 500, colour: good ? INK : '#666666', align: a.rtl ? 'right' : 'left', body, rtl: a.rtl }));
      });
    });
  });
  productBelow(ctx, a, tableY + tableH + px(30), footTop, W, body);
}

// "Reasons" (9f, Tube Science's "five reasons"): a title and one reason a
// line, numbered, then the product. No notes-app chrome: that is a fake
// screenshot (rules 5).
function drawReasons(canvas, a) {
  const { ctx, W, body, px, top, L, footTop } = ground(canvas, a);
  const [title = '', ...rest] = lineList(a.words.reasons);
  const reasons = rest.slice(0, 5);
  const x0 = 70;
  const w0 = W - 140;
  const y0 = top;
  const r = dirOf(title + reasons.join(' '), a.rtl) === 'rtl';
  const sx = r ? x0 + w0 - 50 : x0 + 50;
  const al = r ? 'right' : 'left';
  ctx.font = `800 ${px(50)}px ${body}`;
  const tl = wrap(ctx, title, w0 - 100, 2);
  const lh = px(60);
  const h = px(10) + tl.length * px(60) + px(20) + reasons.length * lh + px(30);
  part(ctx, 'words', [x0, y0, w0, h], () => {
    card(ctx, x0, y0, w0, h, 30);
    let y = y0 + px(10);
    tl.forEach((l) => { y += px(60); say(ctx, l, sx, y - px(8), { size: px(50), weight: 800, align: al, body, rtl: a.rtl }); });
    y += px(20);
    reasons.forEach((l, i) => {
      y += lh;
      const n = `${i + 1}.`;
      say(ctx, n, sx, y - px(10), { size: px(36), weight: 800, colour: '#C99400', align: al, body, rtl: a.rtl });
      say(ctx, l, r ? sx - px(52) : sx + px(52), y - px(10), { size: px(36), weight: 500, colour: '#333333', align: al, body, rtl: a.rtl, max: w0 - 160 });
    });
  });
  productBelow(ctx, a, y0 + h + px(30), footTop, W, body);
}

// "Honest" (9f.4, Simon's "This stuff taste nasty"): a plain trade-off the
// listing itself states, why it is good for the reader, the product beside.
function drawHonest(canvas, a) {
  const { ctx, W, body, head, px, top, L, footTop } = ground(canvas, a);
  const [hl = '', ...rest] = lineList(a.words.honest);
  const r = dirOf(hl, a.rtl) === 'rtl';
  const al = r ? 'right' : 'left';
  const sx = r ? W - 80 : 80;
  ctx.font = `700 ${px(70)}px ${head}`;
  const hs = wrap(ctx, `“${hl}”`, W - 160, 3);
  const y0 = top + px(10);
  const hh = hs.length * px(80);
  part(ctx, 'words', [70, y0, W - 140, hh + px(10)], () => {
    hs.forEach((l, i) => {
      ctx.font = `700 ${px(70)}px ${head}`;
      ctx.fillStyle = L.text;
      ctx.textAlign = al;
      ctx.direction = r ? 'rtl' : 'ltr';
      ctx.fillText(l, sx, y0 + px(68) + i * px(80));
    });
  });
  ctx.font = `500 ${px(36)}px ${body}`;
  const ls = rest.slice(0, 3).flatMap((l) => wrap(ctx, l, W - 160, 2));
  const ly = y0 + hh + px(50);
  const lh = px(48);
  part(ctx, 'name', [80, ly - px(30), W - 160, ls.length * lh],
    () => ls.forEach((l, i) => say(ctx, l, sx, ly + i * lh, { size: px(36), weight: 500, colour: L.text, align: al, body, rtl: a.rtl })));
  productBelow(ctx, a, ly + ls.length * lh, footTop, W, body);
}

// "A moment in the day" (9f.8, the FLO ads): one serif line placing it in
// the reader's day, its key words in italic in the look's accent colour.
function drawMoment(canvas, a) {
  const { ctx, W, body, head, px, top, L, footTop } = ground(canvas, a);
  const raw = a.words.moment || '';
  const words = [];
  raw.split(/(\*[^*]+\*)/).forEach((seg) => {
    const acc = /^\*.*\*$/.test(seg);
    seg.replace(/\*/g, '').split(' ').filter(Boolean).forEach((w) => {
      // A full stop or comma alone stays with the word before it.
      if (/^[.,!?;:]+$/.test(w) && words.length) words[words.length - 1][0] += w;
      else words.push([w, acc]);
    });
  });
  const fontOf = (acc, size) => `${acc ? 'italic 600' : '600'} ${size}px ${head}`;
  let size = px(78);
  let lines = [];
  for (; size >= px(44); size -= 4) {
    lines = [[]];
    let width = 0;
    words.forEach(([w, acc]) => {
      ctx.font = fontOf(acc, size);
      const ww = ctx.measureText(`${w} `).width;
      if (width + ww > W - 140 && lines[lines.length - 1].length) { lines.push([]); width = 0; }
      lines[lines.length - 1].push([w, acc, ww]);
      width += ww;
    });
    if (lines.length <= 2) break;
  }
  const y0 = top + px(70);
  say(ctx, (a.eyebrow || '').toUpperCase(), W / 2, y0 - px(20), { size: px(30), weight: 700, colour: L.sub, body, rtl: a.rtl, max: W - 160 });
  const lh = size * 1.15;
  part(ctx, 'words', [70, y0, W - 140, lines.length * lh + px(10)], () => lines.forEach((ln, i) => {
    const r = dirOf(ln.map(([w]) => w).join(' '), a.rtl) === 'rtl';
    const total = ln.reduce((t, [, , ww]) => t + ww, 0);
    let x = r ? (W + total) / 2 : (W - total) / 2;
    ln.forEach(([w, acc, ww]) => {
      ctx.font = fontOf(acc, size);
      ctx.fillStyle = acc ? L.word : L.text;
      ctx.textAlign = r ? 'right' : 'left';
      ctx.direction = r ? 'rtl' : 'ltr';
      ctx.fillText(w, x, y0 + size + i * lh);
      x += r ? -ww : ww;
    });
  }));
  productBelow(ctx, a, y0 + lines.length * lh + px(50), footTop, W, body);
}

// "Make your own" (Tzvi, 4 Nov 2026): a background the owner picks (a
// photo from the search, one of their own, or one drawn here), with their
// product, their words and the price on it, each one draggable.
export const BACKDROPS = [
  ['sunset', ['#FF9A5A', '#C2185B']], ['sea', ['#2BC0E4', '#0F4C81']], ['mint', ['#D4F5E9', '#7BC8A4']],
  ['sand', ['#F6EFE4', '#E3CFAE']], ['night', ['#2B2D31', '#0B0B0F']], ['berry', ['#7F00FF', '#E100FF']],
  ['dots', ['#FFD600', '#FFD600'], 'dots'], ['stripes', ['#F7D9D0', '#F7D9D0'], 'stripes'],
];
function drawBackdrop(ctx, W, H, bg) {
  if (bg?.img) {
    // A background fills the whole ad, so it is cropped to it; the
    // owner's own product is never cropped (it sits on top, whole).
    const s = Math.max(W / bg.img.naturalWidth, H / bg.img.naturalHeight);
    const w = bg.img.naturalWidth * s; const h = bg.img.naturalHeight * s;
    ctx.drawImage(bg.img, (W - w) / 2, (H - h) / 2, w, h);
    return;
  }
  const [, [c1, c2], pattern] = BACKDROPS.find(([k]) => k === bg?.id) || BACKDROPS[3];
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  if (pattern === 'dots') for (let y = 20; y < H; y += 60) for (let x = (y / 60) % 2 ? 50 : 20; x < W; x += 60) { ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); }
  if (pattern === 'stripes') { ctx.save(); ctx.rotate(-Math.PI / 4); for (let x = -H; x < W + H; x += 70) ctx.fillRect(x, -H, 28, H * 3); ctx.restore(); }
}
export const backdropIsLight = (bg) => {
  if (bg?.img) return false;
  const c = hexRgb((BACKDROPS.find(([k]) => k === bg?.id) || BACKDROPS[3])[1][0]);
  return lum(c) > 0.45;
};

function drawCustom(canvas, { format, words, eyebrow, cta, shortUrl, rtl, qr, item, fromWord, bg }) {
  const { ctx, W, H, body, px, top } = begin(canvas, format, rtl);
  drawBackdrop(ctx, W, H, bg);
  const light = backdropIsLight(bg);
  const ink = (PARTS && PARTS.ink) || (light ? INK : '#FFFFFF');
  const footTop = footBand(ctx, { W, H, format, rtl, cta, shortUrl, qr, body, ground: light ? INK : '#FFFFFF', dark: light });
  ctx.textAlign = 'center';
  ctx.font = `800 ${px(70)}px ${body}`;
  ctx.direction = dirOf(words.headline, rtl);
  const head = wrap(ctx, words.headline, W - 140, 3);
  const y0 = top + px(20);
  part(ctx, 'words', [70, y0, W - 140, head.length * px(82) + 20], () => {
    // A soft shadow keeps the words readable on any photo.
    if (!light) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18; }
    ctx.fillStyle = ink;
    head.forEach((l, i) => keyLine(ctx, l, W / 2, y0 + px(82) * (i + 1), words.key, PARTS && PARTS.ink ? null : (light ? ACCENT : '#FFD600')));
  });
  const ey = y0 + head.length * px(82) + px(52);
  part(ctx, 'name', [70, ey - px(34), W - 140, px(44)], () => {
    if (!light) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 12; }
    say(ctx, (eyebrow || '').toUpperCase(), W / 2, ey, { size: px(30), weight: 700, colour: ink, body, rtl, max: W - 160 });
  });
  const py = ey + px(40);
  if (footTop - 40 - py > 140) {
    const [cx, cy, cw, ch] = product(ctx, item, 90, py, W - 180, footTop - 40 - py);
    const r = Math.round(Math.min(105, ch * 0.32));
    sticker(ctx, { x: rtl ? cx + r * 0.6 : cx + cw - r * 0.6, y: cy + ch - r * 0.6, r, item, fromWord, body });
  }
}

// The code in a corner with the link beside it, no band across the ad.
function cornerFoot(ctx, { W, H, format, rtl, cta, shortUrl, qr, body }) {
  const QR = 150;
  const m = 40;
  const qy = H - (format === 'story' ? 230 : 0) - m - QR;
  qrTile(ctx, qr, rtl ? m + 10 : W - m - 10 - QR, qy, QR, 10);
  const width = W - QR - m * 2 - 90;
  ctx.font = `600 30px ${body}`;
  const urls = linkLines(ctx, shortUrl, width);
  const lift = (urls.length - 1) * 20;
  linkPiece(ctx, { rtl, x: rtl ? W - m - 18 : m + 18, onPlate: true, width, lines: [
    { text: cta, y: qy + QR / 2 - 6 - lift, font: `700 34px ${body}`, size: 34, colour: INK, strong: INK },
    ...urls.map((text, i) => ({ text, y: qy + QR / 2 + 40 - lift + i * 38, font: `600 30px ${body}`, size: 30, colour: ACCENT, strong: ACCENT })),
  ] });
  return qy - 10;
}

// "Full photo" (cafe/a5037ab0, shop/012a9055): the owner's own photo is the
// whole ad, whole, on its own edge colours; the words on a shade over its top.
function drawFullPhoto(canvas, a) {
  const { ctx, W, H, body, head, px, top } = begin(canvas, a.format, a.rtl);
  const col = vividColour(a.item.img);
  // A photo of another shape: its own colours, blurred, fill the sides instead of flat bars (American Crust, 6 Nov 2026).
  const tiny = document.createElement('canvas');
  tiny.width = 12;
  tiny.height = 12;
  tiny.getContext('2d').drawImage(a.item.img, 0, 0, 12, 12);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tiny, 0, 0, W, H);
  // Moving: the photo itself eases back to size, since nothing sits on it to arrive.
  const zoom = PARTS?.anim ? 1 + (1 - easeOut(progress(PARTS.anim.t, 0, MOVE_ENDS))) * 0.14 : 1;
  const [fw0, fh0] = fitIn(a.item.img, W, H);
  const fw = fw0 * zoom;
  const fh = fh0 * zoom;
  ctx.drawImage(a.item.img, (W - fw) / 2, (H - fh) / 2, fw, fh);
  const shade = ctx.createLinearGradient(0, 0, 0, H * 0.42);
  shade.addColorStop(0, 'rgba(0,0,0,.9)');
  shade.addColorStop(0.65, 'rgba(0,0,0,.72)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H * 0.42);
  const PAD = 64;
  const start = a.rtl ? W - PAD : PAD;
  ctx.textAlign = a.rtl ? 'right' : 'left';
  ctx.font = `700 ${px(72)}px ${head}`;
  ctx.direction = dirOf(a.words.headline, a.rtl);
  const lines = wrap(ctx, a.words.headline, W - PAD * 2, 3);
  part(ctx, 'words', [PAD, top, W - PAD * 2, px(44) + lines.length * px(84)], () => {
    say(ctx, a.eyebrow, start, top + px(26), { size: px(30), colour: 'rgba(255,255,255,.85)', align: a.rtl ? 'right' : 'left', body, rtl: a.rtl, max: W - PAD * 2 });
    ctx.fillStyle = (PARTS && PARTS.ink) || '#FFFFFF';
    ctx.font = `700 ${px(72)}px ${head}`;
    ctx.direction = dirOf(a.words.headline, a.rtl);
    ctx.textAlign = a.rtl ? 'right' : 'left';
    lines.forEach((l, i) => keyLine(ctx, l, start, top + px(44) + px(84) * (i + 1) - px(18), a.words.key, PARTS && PARTS.ink ? null : '#FFD600'));
  });
  const footTop = cornerFoot(ctx, { W, H, format: a.format, rtl: a.rtl, cta: a.cta, shortUrl: a.shortUrl, qr: a.qr, body });
  sticker(ctx, { x: a.rtl ? 130 : W - 130, y: footTop - 120, r: 100, item: a.item, fromWord: a.fromWord, body });
}

// "Giant words" (food/63d54525 LEMONADE, food/8d1dcab0): the headline as large
// as the ad allows, and the product small beside its end: the words are the ad.
function drawGiant(canvas, a) {
  const { ctx, W, H, body, head, px, top } = begin(canvas, a.format, a.rtl);
  const L = lookOf(a.look, a.brand, a.item.cut || a.item.img);
  ctx.fillStyle = L.bg;
  paintGround(ctx, W, H);
  const footTop = cornerFoot(ctx, { W, H, format: a.format, rtl: a.rtl, cta: a.cta, shortUrl: a.shortUrl, qr: a.qr, body });
  const PAD = 56;
  const textW = W - PAD * 2;
  const start = a.rtl ? W - PAD : PAD;
  const room = (footTop - top) * 0.66 - px(44);
  ctx.direction = dirOf(a.words.headline, a.rtl);
  let size = 60;
  for (let t = 210; t >= 60; t -= 4) {
    ctx.font = `800 ${t}px ${body}`;
    const ls = wrap(ctx, a.words.headline, textW, 99);
    if (ls.length <= 4 && ls.length * t * 1.02 <= room && ls.every((l) => ctx.measureText(l).width <= textW)) { size = t; break; }
  }
  ctx.font = `800 ${size}px ${body}`;
  const lines = wrap(ctx, a.words.headline, textW, 4);
  const blockH = px(44) + lines.length * size * 1.02;
  part(ctx, 'words', [PAD, top, textW, blockH], () => {
    say(ctx, (a.eyebrow || '').toUpperCase(), start, top + px(26), { size: px(30), colour: L.sub, align: a.rtl ? 'right' : 'left', body, rtl: a.rtl, max: textW });
    ctx.font = `800 ${size}px ${body}`;
    ctx.direction = dirOf(a.words.headline, a.rtl);
    ctx.textAlign = a.rtl ? 'right' : 'left';
    lines.forEach((l, i) => {
      const hasKey = a.words.key && lines.some((x) => x.includes(a.words.key));
      ctx.fillStyle = !hasKey && i === lines.length - 1 ? L.word : L.text;
      keyLine(ctx, l, start, top + px(44) + size * (i + 0.82) * 1.02, a.words.key, accentOf(L), `700 ${size}px ${head}`);
    });
  });
  const y = top + blockH + 16;
  const pw = W * 0.42;
  if (footTop - 16 - y > 120) {
    const [cx, cy, cw, ch] = product(ctx, a.item, a.rtl ? PAD : W - PAD - pw, y, pw, footTop - 16 - y);
    const r = Math.round(Math.min(94, ch * 0.3));
    sticker(ctx, { x: a.rtl ? cx + cw + r * 0.5 : cx - r * 0.5, y: cy + ch / 2, r, item: a.item, fromWord: a.fromWord, body });
  }
}

// "Half and half" (shop/7a3e4d8e, the pack and the nuts meeting on the line):
// the ad cut in two colours on a slant, the product standing across the cut.
function drawSplit(canvas, a) {
  const { ctx, W, H, body, head, px, top } = begin(canvas, a.format, a.rtl);
  const L = lookOf(a.look, a.brand, a.item.cut || a.item.img);
  ctx.fillStyle = L.bg;
  paintGround(ctx, W, H);
  const PAD = 64;
  const start = a.rtl ? W - PAD : PAD;
  ctx.font = `700 ${px(76)}px ${head}`;
  ctx.direction = dirOf(a.words.headline, a.rtl);
  const lines = wrap(ctx, a.words.headline, W - PAD * 2, 3);
  const wordsH = px(44) + lines.length * px(88);
  const bottom = H - (a.format === 'story' ? 230 : 0) - 210;
  const pTop = top + wordsH + 24;
  const midY = (pTop + bottom) / 2;
  const tilt = W * 0.06;
  ctx.fillStyle = L.foot;
  ctx.beginPath();
  ctx.moveTo(0, midY + (a.rtl ? -tilt : tilt));
  ctx.lineTo(W, midY + (a.rtl ? tilt : -tilt));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
  part(ctx, 'words', [PAD, top, W - PAD * 2, wordsH], () => {
    say(ctx, a.eyebrow, start, top + px(26), { size: px(30), colour: L.sub, align: a.rtl ? 'right' : 'left', body, rtl: a.rtl, max: W - PAD * 2 });
    ctx.font = `700 ${px(76)}px ${head}`;
    ctx.direction = dirOf(a.words.headline, a.rtl);
    ctx.textAlign = a.rtl ? 'right' : 'left';
    ctx.fillStyle = L.text;
    lines.forEach((l, i) => keyLine(ctx, l, start, top + px(44) + px(88) * (i + 1) - px(20), a.words.key, accentOf(L)));
  });
  const [cx, cy, cw, ch] = product(ctx, a.item, 50, pTop, W - 100, bottom - pTop);
  const r = Math.round(Math.min(104, ch * 0.3));
  sticker(ctx, { x: a.rtl ? cx + r * 0.7 : cx + cw - r * 0.7, y: cy + ch - r * 0.7, r, item: a.item, fromWord: a.fromWord, body });
  cornerFoot(ctx, { W, H, format: a.format, rtl: a.rtl, cta: a.cta, shortUrl: a.shortUrl, qr: a.qr, body });
}

// "Several together" (events/6cf70271, "Your feast, catered."): three of the
// business's own products around the page, the words in the space they leave.
function drawFeast(canvas, a) {
  const { ctx, W, H, body, head, px, top } = begin(canvas, a.format, a.rtl);
  const L = lookOf(a.look, a.brand, a.item.cut || a.item.img);
  ctx.fillStyle = L.bg;
  paintGround(ctx, W, H);
  const footTop = cornerFoot(ctx, { W, H, format: a.format, rtl: a.rtl, cta: a.cta, shortUrl: a.shortUrl, qr: a.qr, body });
  const rest = (a.pool || []).filter((it) => it.name !== a.item.name);
  const three = [a.item, ...rest].slice(0, 3);
  const zone = footTop - top;
  const G = 28;
  const wordW = W * 0.5;
  const upH = zone * 0.44;
  const PAD = 56;
  const start = a.rtl ? W - PAD : PAD;
  // The first product beside the words; the other two in a row under them.
  const boxes = [
    [a.rtl ? PAD : W - PAD - (W - wordW - PAD * 2 - G), top, W - wordW - PAD * 2 - G, upH],
    [PAD, top + upH + G, (W - PAD * 2 - G) / 2, zone - upH - G * 2],
    [PAD + (W - PAD * 2 - G) / 2 + G, top + upH + G, (W - PAD * 2 - G) / 2, zone - upH - G * 2],
  ];
  three.forEach((it, i) => {
    const img = it.cut || it.img;
    const [b0, b1, b2, b3] = boxes[i];
    const [cw, ch] = fitIn(img, b2, b3);
    const x = b0 + (b2 - cw) / 2;
    const y = b1 + (b3 - ch) / 2;
    shadowed(ctx, img, x, y, cw, ch, 36, 18, { name: i ? `product${i + 1}` : 'product', tilt: [-0.05, 0.04, -0.03][i] });
  });
  ctx.font = `800 ${px(66)}px ${head}`;
  ctx.direction = dirOf(a.words.headline, a.rtl);
  const lines = wrap(ctx, a.words.headline, wordW, 5);
  const wordsH = px(44) + lines.length * px(78);
  const wy = top + Math.max(0, (upH - wordsH) / 2);
  part(ctx, 'words', [a.rtl ? W - PAD - wordW : PAD, wy, wordW, wordsH], () => {
    say(ctx, a.eyebrow, start, wy + px(26), { size: px(30), colour: L.sub, align: a.rtl ? 'right' : 'left', body, rtl: a.rtl, max: wordW });
    ctx.font = `800 ${px(66)}px ${head}`;
    ctx.direction = dirOf(a.words.headline, a.rtl);
    ctx.textAlign = a.rtl ? 'right' : 'left';
    lines.forEach((l, i) => {
      const hasKey = a.words.key && lines.some((x) => x.includes(a.words.key));
      ctx.fillStyle = !hasKey && i === lines.length - 1 ? L.word : L.text;
      keyLine(ctx, l, start, wy + px(44) + px(78) * (i + 1) - px(18), a.words.key, accentOf(L));
    });
  });
}

// Words that would contradict the picture (ad rules 9e.8): a price typed
// into the words that is not the price of the item in the ad.
export function adIssues(words, item) {
  if (!words) return [];
  const text = [words.headline, ...(words.points || []), words.big_word, words.caller, words.decline,
    words.search, words.switches, words.checklist, words.situations, words.mirror, words.chat, words.post,
    words.versus, words.reasons, words.honest, words.moment].join(' ');
  const prices = `${text} ${words.deal || ''}`.match(/[$€£₪]\s?\d[\d,.]*|\d[\d,.]*\s?(?:₪|ILS|NIS|USD|EUR|\$|ש"ח|שקל)/gi) || [];
  const own = item ? String(Math.round(item.price)) : null;
  return prices.filter((p) => p.replace(/[^\d]/g, '') !== own).length ? ['price'] : [];
}

// Every design, drawn the same way for the big picture and the small
// previews. `native` (Story) is drawn in the story shape only.
// A gallery design is "layout:look" (THEMED below); the rest are one look.
// The words each 9f layout reads, and edits in the panel.
const NEW_FIELDS = ['situations', 'mirror', 'chat', 'post', 'versus', 'reasons', 'honest', 'moment', 'people'];
const FIELD_OF = { situation: 'situations', mirror: 'mirror', chat: 'chat', post: 'post', versus: 'versus',
  reasons: 'reasons', honest: 'honest', moment: 'moment' };
// "Labels" (the bag and foot diagrams, docs/inspo/ad-videos-2026-11-07): the product in the middle, its listing's
// own facts pointing at it. docs/ads/blueprints/design-labels.md.
function drawLabels(canvas, a) {
  const { ctx, W, H, body, head, px, top } = begin(canvas, a.format, a.rtl);
  const L = lookOf(a.look, a.brand, a.item.cut || a.item.img);
  ctx.fillStyle = L.bg;
  paintGround(ctx, W, H);
  const footTop = cornerFoot(ctx, { W, H, format: a.format, rtl: a.rtl, cta: a.cta, shortUrl: a.shortUrl, qr: a.qr, body });
  const PAD = 56;
  const textW = W - PAD * 2;
  const start = a.rtl ? W - PAD : PAD;
  ctx.font = `700 ${px(64)}px ${head}`;
  ctx.direction = dirOf(a.words.headline, a.rtl);
  const lines = wrap(ctx, a.words.headline, textW, 2);
  const blockH = px(44) + lines.length * px(74);
  part(ctx, 'words', [PAD, top, textW, blockH], () => {
    say(ctx, (a.eyebrow || '').toUpperCase(), start, top + px(26), { size: px(30), colour: L.sub, align: a.rtl ? 'right' : 'left', body, rtl: a.rtl, max: textW });
    ctx.font = `700 ${px(64)}px ${head}`;
    ctx.direction = dirOf(a.words.headline, a.rtl);
    ctx.textAlign = a.rtl ? 'right' : 'left';
    ctx.fillStyle = L.text;
    lines.forEach((l, i) => keyLine(ctx, l, start, top + px(44) + px(74) * (i + 1) - px(16), a.words.key, accentOf(L)));
  });
  const y0 = top + blockH + 30;
  const pw = W * 0.4;
  const [cx, cy, cw, ch] = product(ctx, a.item, (W - pw) / 2, y0, pw, footTop - 30 - y0);
  const pts = (a.words.points || []).slice(0, 3);
  const colW = Math.max(200, (W - cw) / 2 - PAD - 30);
  const size = px(32);
  part(ctx, 'labels', [PAD, cy, W - PAD * 2, ch], () => pts.forEach((p, i) => {
    const left = (i % 2 === 0) !== a.rtl;
    const ty = cy + ch * (pts.length === 1 ? 0.5 : 0.18 + (0.64 * i) / (pts.length - 1));
    ctx.font = `600 ${size}px ${body}`;
    ctx.direction = dirOf(p, a.rtl);
    const ls = wrap(ctx, p, colW, 3);
    ctx.fillStyle = L.text;
    ctx.textAlign = left ? 'right' : 'left';
    const tx = left ? PAD + colW : W - PAD - colW;
    ls.forEach((l, j) => ctx.fillText(l, tx, ty + (j - (ls.length - 1) / 2) * size * 1.2 + size * 0.35));
    // A thin line from the words to the product, ending in a dot on it.
    const px0 = left ? tx + 14 : tx - 14;
    const px1 = left ? cx + cw * 0.22 : cx + cw * 0.78;
    ctx.strokeStyle = L.text;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px0, ty);
    ctx.lineTo(px1, ty);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px1, ty, 8, 0, Math.PI * 2);
    ctx.fill();
  }));
  const r = Math.round(Math.min(94, ch * 0.3));
  sticker(ctx, { x: a.rtl ? cx + r * 0.3 : cx + cw - r * 0.3, y: cy + ch - r * 0.4, r, item: a.item, fromWord: a.fromWord, body });
}
// A real review (public, 4 or 5 stars, the reviewer's own words) as a small bubble on any design, and the
// owner's real deal with its end date (rules A4.4, A4.3, A5.2). Both the owner's choice, both draggable.
function extras(canvas, a) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  const body = bodyFont(a.rtl);
  const story = a.format === 'story';
  if (a.deal) {
    // Top middle, where the business name was; a status keeps its top clear, so there it sits above the link.
    ctx.font = `800 32px ${body}`;
    ctx.direction = dirOf(a.deal, a.rtl);
    const text = wrap(ctx, a.deal, W * 0.7, 1)[0] || '';
    const w = ctx.measureText(text).width + 44;
    const h = 54;
    const x = (W - w) / 2;
    const y = story ? footTopOf(a.format, H) - h - 30 : 18;
    part(ctx, 'deal', [x, y, w, h], () => {
      ctx.fillStyle = '#FFD600';
      ctx.shadowColor = 'rgba(0,0,0,.25)';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.font = `800 32px ${body}`;
      ctx.fillText(text, x + w / 2, y + h * 0.68);
    });
  }
  const rv = a.reviewChip;
  if (rv) {
    const w = Math.min(600, W - 80);
    ctx.font = `600 32px ${body}`;
    ctx.direction = dirOf(rv.text, a.rtl);
    const lines = wrap(ctx, `“${rv.text}”`, w - 56, 2);
    const h = 70 + lines.length * 42;
    const x = a.rtl ? 40 : W - 40 - w;
    const y = footTopOf(a.format, H) - h - 24;
    part(ctx, 'review', [x, y, w, h], () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,.22)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 28);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      const tx = a.rtl ? x + w - 28 : x + 28;
      ctx.textAlign = a.rtl ? 'right' : 'left';
      ctx.fillStyle = '#B7791F';
      ctx.font = `700 30px ${body}`;
      ctx.direction = a.rtl ? 'rtl' : 'ltr';
      const stars = '★'.repeat(Math.max(1, Math.min(5, Math.round(rv.rating || 5))));
      const who = (rv.name || '').trim().split(/\s+/)[0] || '';
      ctx.fillText(who ? `${stars}  ${who}` : stars, tx, y + 46);
      ctx.fillStyle = INK;
      ctx.font = `600 32px ${body}`;
      ctx.direction = dirOf(rv.text, a.rtl);
      lines.forEach((l, i) => ctx.fillText(l, tx, y + 92 + i * 42));
    });
  }
}
const THEMED = { behind: drawBehind, phonepop: drawPhonePop, calling: drawCalling,
  notify: drawNotify, search: drawSearch, toggle: drawToggle, checklist: drawChecklist, custom: drawCustom,
  situation: drawSituation, mirror: drawMirror, chat: drawChat, post: drawPost, versus: drawVersus,
  reasons: drawReasons, honest: drawHonest, moment: drawMoment,
  fullphoto: drawFullPhoto, giant: drawGiant, split: drawSplit, feast: drawFeast, labels: drawLabels };
// Each layout opens in its own colour, so the gallery is not one ad repeated
// (Tzvi, 5 Nov 2026: "all very similar"). The owner's pick then replaces it.
const START_LOOK = { behind: 'cream', phonepop: 'own', calling: 'night', notify: 'navy', search: 'cream', toggle: 'sun',
  checklist: 'own', situation: 'night', mirror: 'cream', chat: 'navy', post: 'cream', versus: 'sun', reasons: 'own',
  honest: 'night', moment: 'navy', giant: 'sun', split: 'navy', feast: 'own', labels: 'cream' };
// The designs in the gallery, by family, most different first.
const FAMILIES = [
  ['lead', ['custom', 'fullphoto', 'giant', 'split', 'feast', 'behind', 'bigwords', 'torn', 'colour']],
  ['screens', ['phonepop', 'calling', 'phone', 'notify', 'search', 'toggle', 'checklist', 'chat', 'post']],
  ['words', ['situation', 'mirror', 'versus', 'reasons', 'honest', 'moment', 'question', 'review', 'note']],
  ['simple', ['clean', 'night', 'grid', 'gallery', 'items', 'native']],
];
// The fixed designs whose ground takes a colour; white words, so dark ones only.
// A slight turn, so a product does not sit square like a pasted picture.
const TILT = { behind: -0.035, giant: -0.07, split: 0.03, custom: -0.03, situation: 0.025, moment: -0.025 };
// Fine grain over the ad: a clean render reads as an ad. Never over an exact colour.
let grainTile = null;
function paintGrain(ctx, W, H) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 128;
    grainTile.height = 128;
    const x = grainTile.getContext('2d');
    const d = x.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() > 0.5 ? 255 : 0;
      d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v;
      d.data[i + 3] = Math.random() * 16;
    }
    x.putImageData(d, 0, 0);
  }
  ctx.save();
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
const CUT_ONLY = ['behind', 'phonepop', 'calling', 'split', 'feast'];
const COLOUR_FIXED = ['colour', 'bigwords', 'grid', 'torn', 'question', 'phone'];
const DARK_RGB = { night: [23, 23, 26], navy: [18, 59, 87] };
function render(target, design, a) {
  const canvas = sharpCanvas(target, a.scale || 1);
  const [layout, lookKey] = design.split(':');
  const look = lookKey || a.look;
  const anim = a.anim ? Object.assign(a.anim, { layout, rtl: a.rtl, total: a.anim.n || a.anim.total, n: 0 }) : null;
  const finish = (ctx) => {
    ctx.shadowColor = 'transparent';
    if (a.grain) paintGrain(ctx, canvas.width, canvas.height);
    PARTS.later.forEach((paint) => paint());
    if (anim && anim.cover > 0) hookCard(ctx, canvas.width, canvas.height, anim, a);
  };
  if (THEMED[layout]) {
    PARTS = { moves: a.moves || {}, boxes: a.boxes || {}, later: [], font: a.font || null, ink: a.ink || null, photo: a.photo || null, tilt: TILT[layout] || 0, anim, strips: !!a.strips, stats: a.stats || null };
    try {
      THEMED[layout](canvas, look ? { ...a, look } : a);
      extras(canvas, look ? { ...a, look } : a);
      finish(canvas.getContext('2d'));
    } finally {
      PARTS = null;
    }
    // "Make your own" has its own ground and words where the ribbon would sit.
    if (HOLIDAYS.includes(look) && layout !== 'custom') holidayRibbon(canvas, a.format, a.greeting, a.rtl);
    return undefined;
  }
  // One look each, so no font or word colour here; pieces move all the same.
  PARTS = { moves: a.moves || {}, boxes: a.boxes || {}, later: [], font: null, ink: null, photo: a.photo || null, col: a.col || null, anim, strips: !!a.strips, stats: a.stats || null };
  try {
    const fixed = { phone: drawPhone, torn: drawTorn, review: drawReview, native: drawStory, colour: drawColour,
      bigwords: drawBigWords, grid: drawGrid, items: drawItems, note: drawNote, question: drawQuestion }[design];
    if (fixed) fixed(canvas, a);
    else draw(canvas, { ...a, design });
    extras(canvas, design === 'review' ? { ...a, reviewChip: null } : a);
    finish(canvas.getContext('2d'));
  } finally {
    PARTS = null;
  }
  if (HOLIDAYS.includes(look)) holidayRibbon(canvas, a.format, a.greeting, a.rtl);
  return undefined;
}

// A colour by its hex code first (Tzvi, 6 Nov 2026). A browser's own picker
// cannot be told to open in hex, so the code sits beside it, typed or pasted.
function HexPicker({ value, fallback, onChange, testid, label }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value]);
  const take = (raw) => {
    setDraft(raw);
    const v = raw.trim().replace(/^#?/, '#');
    const full = /^#[0-9a-f]{3}$/i.test(v) ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;
    if (/^#[0-9a-f]{6}$/i.test(full)) onChange(full.toUpperCase());
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={label}
        className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer" data-testid={testid} />
      <input type="text" value={draft} onChange={(e) => take(e.target.value)} placeholder={fallback} maxLength={7} dir="ltr" spellCheck={false}
        aria-label={`${label} (hex)`} className="w-[84px] rounded-lg border px-2 py-1.5 text-xs font-mono font-normal" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid={`${testid}-hex`} />
    </span>
  );
}

// Never an empty post text: the filter that drops unclaimed praise can take
// every sentence. Then it is the ad's own headline and points.
const withCaption = (w) => (w.caption?.trim() ? w : { ...w, caption: [w.headline, ...(w.points || [])].filter(Boolean).join('. ') });

export default function AdMaker({ API, token, targetType, target, onClose, start = null, inline = false }) {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState(start?.savedLang || (i18n.language?.startsWith('he') ? 'he' : 'en'));
  const [format, setFormat] = useState('feed');
  const [design, setDesignRaw] = useState('behind');
  // The owner's own choices (Tzvi, 4 Nov 2026): one card per layout in the
  // gallery, and the colour, font and word colour picked here instead.
  const [lookBy, setLookBy] = useState({});
  const [holidayPick, setHolidayPick] = useState(HOLIDAYS.includes(start?.look) ? start.look : '');
  const [customBy, setCustomBy] = useState({});
  const [photoBy, setPhotoBy] = useState({});
  const [pickBy, setPickBy] = useState({});
  const [fontIdx, setFontIdx] = useState(0);
  const [ink, setInk] = useState('');
  const [lost, setLost] = useState(null);
  // Saved ads (Canva's "your designs"): each reopens as it was left, and the
  // last one comes back when the maker opens, so no paid writing is repeated.
  const [saved, setSaved] = useState(null);
  const [savedId, setSavedId] = useState('');
  // A design or product asked for before it can be drawn (the cut-outs come
  // a moment after the words): taken as soon as it can.
  const wantDesign = useRef('behind');
  // A saved ad waiting for its design to be drawable: nothing overwrites it meanwhile.
  const savedPending = useRef('');
  const shownLang = useRef('');
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [cutsDone, setCutsDone] = useState(targetType !== 'business');
  // Dragged pieces, per design and shape: { 'behind|feed': { product: {x, y, s} } }.
  const [moves, setMoves] = useState({});
  const [boxes, setBoxes] = useState({});
  const [sel, setSel] = useState('');
  const [guides, setGuides] = useState({});
  // "Make your own": its background, and the photo search.
  const [bg, setBg] = useState({ id: 'sand' });
  const [reviewIdx, setReviewIdx] = useState(0);
  // Which "real moment" line the situation ad shows, and which reader the
  // words were written for (9f.1, 9f.7).
  const [situationIdx, setSituationIdx] = useState(0);
  const [forWhom, setForWhom] = useState('');
  const [faqIdx, setFaqIdx] = useState(0);
  const [itemImgs, setItemImgs] = useState([]);
  const [thumbs, setThumbs] = useState({});
  // Story is drawn for the tall status shape only, so picking it picks the
  // shape, and picking another shape leaves it.
  const setDesign = (d) => { wantDesign.current = ''; savedPending.current = ''; setDesignRaw(d); if (d === 'native') setFormat('story'); };
  const pickFormat = (f) => { setFormat(f); if (f !== 'story' && design === 'native') setDesignRaw('clean'); };
  const [ad, setAd] = useState(null);
  const [words, setWords] = useState(null);
  const [imgs, setImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const [video, setVideo] = useState(null);
  const [strips, setStrips] = useState(false);
  const [withReview, setWithReview] = useState(false);
  const [deal, setDeal] = useState({ text: '', until: '' });
  const [canStrip, setCanStrip] = useState(false);
  const [videoPct, setVideoPct] = useState(null);
  // The business's own items with their photos cut out (POST /ads/cutouts),
  // and which one the ad shows: its photo and its price always go together.
  const [cutItems, setCutItems] = useState([]);

  const canvasRef = useRef(null);
  const qrRef = useRef(null);
  const lt = i18n.getFixedT(lang);
  // The ad's language may not be the dashboard's, and is fetched on demand: until it lands, a Hebrew ad's labels came out in English.
  const [, setLangLoaded] = useState(0);
  useEffect(() => { i18n.loadLanguages(lang).then(() => setLangLoaded((n) => n + 1)); }, [lang, i18n]);
  const rtl = lang === 'he';

  // The language picked last wins: switching while the first ad is still
  // being written must not let the older reply land on top.
  const langNow = useRef(lang);
  langNow.current = lang;
  const write = async (row = null, who = forWhom) => {
    setBusy(true);
    setFailed(false);
    try {
      const { data } = await axios.post(`${API}/ads/make`,
        { target_type: targetType, target_id: target.id, lang, words: !row, for_whom: who },
        { headers: { Authorization: `Bearer ${token}` } });
      if (langNow.current !== lang) return;
      setAd(data);
      if (row) {
        setWords(withCaption({ ...row.words }));
        await applySaved(row);
      } else {
        setSavedId('');
        // The first idea leads; the plain headline stays one tap away.
        const lead = (data.ideas || [])[0];
        setWords(withCaption({ headline: lead?.text || data.headline, key: lead ? lead.key : data.headline_key || '', item: lead ? lead.item || '' : data.headline_item || '', plain: data.headline, plainKey: data.headline_key || '', plainItem: data.headline_item || '',
          ideas: data.ideas || [], points: data.points, caption: data.caption,
          big_word: data.big_word || '', caller: data.caller || '', decline: data.decline || '',
          search: data.search || '', switches: data.switches || '', checklist: data.checklist || '',
          ...Object.fromEntries(NEW_FIELDS.map((k) => [k, data[k] || ''])),
          chat: (data.faqs || []).slice(0, 2).flatMap((f) => [f.q, f.a]).join('\n') }));
      }
      const [loaded, its] = await Promise.all([
        Promise.all((data.photos || []).slice(0, 4).map(loadImage)),
        Promise.all((data.items || []).map(async (it) => ({ ...it, img: await loadImage(it.photo) }))),
      ]);
      setImgs(loaded.filter(Boolean));
      setItemImgs(its.filter((it) => it.img));
      if (targetType === 'site') setCutItems(its.filter((it) => it.img).map((it) => ({ ...it, cut: it.img })));
      shownLang.current = lang;
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('ads.failed', 'Could not write the ad. Try again.'));
      // Nothing drawn yet: say so with a way to retry. Switching language failed:
      // back to the language the words on screen are in.
      if (!shownLang.current) setFailed(true);
      else if (shownLang.current !== lang) { wroteFor.current = shownLang.current; setLang(shownLang.current); }
    } finally {
      setBusy(false);
    }
  };
  // Once per language: each call is paid, and React's development mode
  // runs effects twice.
  const wroteFor = useRef('');
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const loadSaved = () => axios.get(`${API}/ads/saved`, { ...auth, params: { target_type: targetType, target_id: target.id } })
    .then(({ data }) => { setSaved(data.ads || []); return data.ads || []; }).catch(() => null);
  const applySaved = async (row) => {
    const st = row.settings || {};
    setSavedId(row.id);
    wantDesign.current = row.design;
    savedPending.current = row.design;
    setDesignRaw(row.design);
    if (st.format) setFormat(st.format);
    const savedLayout = (row.design || '').split(':')[0];
    if (HOLIDAYS.includes(st.look)) { setHolidayPick(st.look); } else {
      setHolidayPick('');
      if (st.look) setLookBy((m) => ({ ...m, [savedLayout]: st.look }));
    }
    setCustomBy((m) => ({ ...m, [savedLayout]: st.customHex || '' }));
    setPickBy((m) => ({ ...m, [savedLayout]: row.item || undefined }));
    setReviewIdx(st.reviewIdx || 0);
    setFaqIdx(st.faqIdx || 0);
    setSituationIdx(st.situationIdx || 0);
    // A photo that fails to load keeps its address, so the next save does not lose it.
    const photo = st.photo ? await loadImage(st.photo) : null;
    setPhotoBy((m) => ({ ...m, [savedLayout]: st.photo ? { img: photo, src: st.photo } : null }));
    setFontIdx(st.fontIdx || 0);
    setInk(st.ink || '');
    setStrips(!!st.strips);
    setWithReview(!!st.withReview);
    setDeal(st.deal || { text: '', until: '' });
    setMoves(st.moves || {});
    const img = st.bg?.src ? await loadImage(st.bg.src) : null;
    setBg(img ? { img, src: st.bg.src } : { id: st.bg?.id || 'sand' });
  };
  useEffect(() => {
    if (wroteFor.current === lang) return;
    wroteFor.current = lang;
    (async () => {
      const list = saved || await loadSaved();
      // Could not read the saved ads: never pay for new words on a guess.
      if (!list) { wroteFor.current = ''; setFailed(true); return; }
      // Asked for something new from the dashboard: a fresh ad, not the last one.
      const last = start?.saved ? list.find((r) => r.id === start.saved) : !start && list.find((r) => r.lang === lang);
      // The last ad was in the other language: open that one in its own.
      if (!start && !last && !saved && list[0]) { wroteFor.current = ''; setLang(list[0].lang); return; }
      write(last || null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, retry]);

  // Cut-outs are made once per photo on the server (a few seconds the first
  // time), so they come after the words, without holding them up.
  useEffect(() => {
    if (targetType !== 'business') return undefined;
    let gone = false;
    axios.post(`${API}/ads/cutouts`, { target_type: targetType, target_id: target.id, first: start?.item || null },
      { headers: { Authorization: `Bearer ${token}` } })
      .then(async ({ data }) => {
        const loaded = await Promise.all((data.items || []).map(async (it) => ({
          ...it, cut: await loadImage(it.cutout), img: await loadImage(it.photo) })));
        if (!gone) setCutItems(loaded.filter((it) => it.cut && it.img));
      })
      .catch(() => {})
      .finally(() => { if (!gone) setCutsDone(true); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shortUrl = ad ? `${SITE}${ad.link.path}` : SITE;
  const money = (amount, currency) => `${priceSymbol(currency)}${Math.round(amount).toLocaleString()}`;
  const withPrice = (it) => it && ({ ...it, priceText: it.price ? money(it.price, it.currency) : '',
    cheapest: !!ad?.from_price && it.price > 0 && it.price <= ad.from_price.amount });
  // All the products, the cut-out ones first. Designs built on a cut-out use only those.
  const pool = [...cutItems, ...itemImgs.filter((i) => !cutItems.some((c) => c.name === i.name))];
  const poolFor = (l) => (CUT_ONLY.includes(l) && cutItems.length ? cutItems : pool);
  const layoutsInOrder = Object.keys(THEMED);
  // Each design starts on its own product, so the gallery is not one photo
  // repeated; the owner's pick for a design stays with that design.
  const itemFor = (d) => {
    const l = d.split(':')[0];
    const from = poolFor(l);
    if (!from.length) return null;
    // The owner's pick, else the product the headline talks about: never bagel words over a pizza photo.
    const asked = pickBy[l] || start?.item || words?.item;
    // A cut-out looks better than a boxed photo, so the layouts start on one; any product can still be picked.
    const first = THEMED[l] && l !== 'fullphoto' && cutItems.length ? cutItems : from;
    return withPrice(from.find((it) => it.name === asked) || first[Math.max(0, layoutsInOrder.indexOf(l)) % first.length]);
  };
  const featured = itemFor(design);
  // One price on an ad, and it is the price of the item in its picture
  // (ad rules 9e.8): a business's price is only shown beside that item's
  // own photo, never a lowest price beside whatever photo came first.
  const priceOf = (it) => {
    if (targetType === 'property') return formatShownPrice(regularShown(target) || holidayShown(target), lt) || '';
    if (!it || !it.priceText) return '';
    return it.cheapest ? lt('ads.from', 'From {{price}}', { price: it.priceText }) : it.priceText;
  };
  const imgsOf = (it) => (it ? [it.img, ...imgs.filter((i) => i.src !== it.img.src)] : imgs);
  const issues = adIssues(words && { ...words, deal: deal.text }, targetType === 'property' ? null : featured);
  // One message per ad (9f.3): a long headline is a sign of two.
  const headlineWords = (words?.headline || '').split(/\s+/).filter(Boolean).length;
  const reviews = ad?.reviews || NONE;
  const eyebrow = targetType === 'property' ? areaLabel(target.area, lt) : target.name;
  const cta = targetType === 'site' ? lt('ads.ctaSite', 'Add your business, free')
    : targetType === 'property' ? lt('ads.ctaStay', 'See photos and book') : lt('ads.ctaBusiness', 'See more and order');

  const faqs = ad?.faqs || NONE;
  const items = itemImgs.map((it) => ({ ...it, priceText: it.price ? money(it.price, it.currency) : '' }));
  // The gallery (Tzvi, 3 Nov 2026): seven layouts in five colour looks
  // each, then the single-look designs. [key, label, available, look].
  // Story is drawn in the story shape only.
  const cut = cutItems.length > 0;
  const LAYOUTS = [
    ['behind', t('ads.behind', 'Big word'), cut && !!words?.big_word],
    ['phonepop', t('ads.phonepop', 'Out of the phone'), cut],
    ['calling', t('ads.calling', 'Is calling'), cut && !!words?.caller],
    ['notify', t('ads.notifyL', 'Notifications'), !!featured],
    ['search', t('ads.searchL', 'Search'), !!featured && !!words?.search],
    ['toggle', t('ads.toggleL', 'Switches'), !!featured && lineList(words?.switches).length >= 2],
    // Offered only when the words came back as a real list, not one line.
    ['checklist', t('ads.checklistL', 'Checklist'), !!featured && lineList(words?.checklist).length >= 3],
    // From the 4 Nov videos (docs/static-ad-rules.md 9f).
    ['situation', t('ads.situationL', 'A real moment'), !!featured && lineList(words?.situations).length > 0],
    ['mirror', t('ads.mirrorL', 'Is this you?'), !!featured && lineList(words?.mirror).length >= 3],
    ['chat', t('ads.chatL', 'Questions and answers'), !!featured && lineList(words?.chat).length >= 2],
    ['post', t('ads.postL', 'Social post'), !!featured && !!words?.post],
    ['versus', t('ads.versusL', 'Us vs the usual'), !!featured && lineList(words?.versus).length >= 3],
    ['reasons', t('ads.reasonsL', 'Reasons list'), !!featured && lineList(words?.reasons).length >= 3],
    ['honest', t('ads.honestL', 'Honest'), !!featured && lineList(words?.honest).length >= 2],
    ['moment', t('ads.momentL', 'Moment in the day'), !!featured && !!words?.moment],
    // Different to look at, not another screen (Tzvi, 5 Nov 2026; docs/ads/blueprints/design-*.md).
    ['fullphoto', t('ads.fullphotoL', 'Full photo'), !!featured],
    ['giant', t('ads.giantL', 'Giant words'), !!featured],
    ['split', t('ads.splitL', 'Half and half'), cut],
    ['feast', t('ads.feastL', 'Several together'), cutItems.length >= 3],
    ['labels', t('ads.labelsL', 'Labels'), !!featured && (words?.points || []).length >= 2],
  ];
  const holiday = useMemo(() => nextHoliday(), []);
  const baseLooks = [...(target.brand_color ? ['brand'] : []), ...LOOKS];
  const designs = [
    ['custom', t('ads.custom', 'Make your own'), !!featured, 'mine'],
    // Clearing a field to retype it must not throw the owner out of the design.
    ...LAYOUTS.map(([k, label, ok]) => [k, label, ok || (k === design.split(':')[0] && (CUT_ONLY.includes(k) ? cut : !!featured)), 'layout']),
    ['phone', t('ads.phone', 'Phone screen'), imgs.length > 0, 'classic'],
    ['torn', t('ads.torn', 'Torn paper'), imgs.length > 0, 'classic'],
    ['clean', t('ads.clean', 'Light'), true, 'classic'],
    ['colour', t('ads.colour', 'Colour'), true, 'classic'],
    ['bigwords', t('ads.bigwords', 'Big words'), true, 'classic'],
    ['night', t('ads.night', 'Dark'), true, 'classic'],
    ['grid', t('ads.grid', 'Grid'), imgs.length >= 3, 'classic'],
    ['gallery', t('ads.gallery', 'More photos'), imgs.length >= 3, 'classic'],
    ['items', t('ads.items', 'Side by side'), items.length >= 3, 'classic'],
    ['note', t('ads.note', 'Sticky note'), imgs.length > 0, 'classic'],
    ['review', t('ads.review', 'A real review'), reviews.length > 0, 'classic'],
    ['question', t('ads.question', 'Question'), faqs.length > 0, 'classic'],
    ['native', t('ads.storyDesign', 'Story'), imgs.length > 0, 'classic'],
  ];
  // Visits per design, read from the short link (routes/short_links.py).
  const [visitCounts, setVisitCounts] = useState({});
  const [weekCounts, setWeekCounts] = useState({});
  const slug = ad?.link?.slug;
  useEffect(() => {
    if (!slug) return;
    axios.get(`${API}/short-links/${slug}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { setVisitCounts(data.ads || {}); setWeekCounts(data.ads_week || {}); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  const visits = Object.entries(visitCounts).sort((x, y) => y[1] - x[1]);
  const designName = (k) => {
    const [lay, lk] = k.split('-');
    const row = designs.find(([key]) => key === lay);
    return row ? (lk ? `${row[1]} (${t(`ads.look.${lk}`, lk)})` : row[1]) : k;
  };
  const shown = designs.filter(([, , ok]) => ok)
    .sort(([a], [b]) => FAMILIES.flatMap(([, keys]) => keys).indexOf(a) - FAMILIES.flatMap(([, keys]) => keys).indexOf(b));
  const layout = design.split(':')[0];
  const themed = !!THEMED[layout];
  const lookFor = (l) => holidayPick || lookBy[l] || START_LOOK[l] || 'cream';
  const look = lookFor(layout);
  const customHex = customBy[layout] || '';
  const setLook = (k) => { setHolidayPick(''); setLookBy((m) => ({ ...m, [layout]: k })); };
  const setCustomHex = (v) => { setHolidayPick(''); setCustomBy((m) => ({ ...m, [layout]: v })); };
  const brandHex = customHex || target.brand_color || null;
  const lookNow = customHex ? 'brand' : look;
  const fontPair = FONTS[fontIdx] || FONTS[0];
  const fontCss = `"${rtl ? fontPair[1] : fontPair[0]}", system-ui, sans-serif`;
  const moveKey = `${design}|${format}`;
  // The picked design may not be drawable yet (the cut-outs come a moment
  // after the words): fall back to the first one that is.
  const okKeys = designs.filter(([, , ok]) => ok).map(([k]) => k).join(',');
  useEffect(() => {
    const ok = okKeys.split(',');
    if (wantDesign.current && ok.includes(wantDesign.current)) {
      setDesignRaw(wantDesign.current);
      wantDesign.current = '';
      savedPending.current = '';
      return;
    }
    if (okKeys && !ok.includes(design)) setDesignRaw(ok.includes('behind') ? 'behind' : ok[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [okKeys]);
  const args = (d) => {
    const review = reviews.length ? reviews[reviewIdx % reviews.length] : null;
    const l = d.split(':')[0];
    const it = itemFor(d);
    const hex = customBy[l] || '';
    const lk = hex ? 'brand' : lookFor(l);
    // A fixed design's colour, only when the owner picked one for it.
    let col = null;
    if (COLOUR_FIXED.includes(l)) {
      if (hex) col = hexRgb(hex);
      else if (DARK_RGB[lookBy[l]]) col = DARK_RGB[lookBy[l]];
    }
    // The button names the thing in the picture when the name is short (the pros' "Shop pineapple coconut").
    const itemCta = targetType === 'business' && it?.name && it.price && it.name.length <= 20 ? lt('ads.ctaItem', 'Order {{item}}', { item: it.name }) : '';
    const today = new Date().toISOString().slice(0, 10);
    const dealOn = deal.text.trim() && deal.until && deal.until >= today;
    return {
      strips, reviewChip: withReview && review ? review : null,
      deal: dealOn ? `${deal.text.trim()} · ${lt('ads.dealUntil', 'until {{date}}', { date: new Date(`${deal.until}T12:00`).toLocaleDateString(rtl ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' }) })}` : '',
      // A deal takes the business name's place at the top: the name is in the link and the eyebrow sits where the deal goes.
      format: d === 'native' ? 'story' : format, words, eyebrow: dealOn ? '' : eyebrow, price: priceOf(it), cta: itemCta || cta, shortUrl, rtl, imgs: imgsOf(it), items, pool: poolFor(l), qr: qrRef.current,
      photo: l === 'custom' ? null : photoBy[l]?.img || null, col, grain: !hex,
      item: it, fromWord: lt('ads.fromWord', 'from'), addLabel: lt('ads.addToOrder', 'Add to order'),
      callingLabel: lt('ads.isCalling', 'is calling…'), acceptLabel: lt('ads.callAccept', 'Order'),
      todayLabel: lt('ads.today', 'Today'), brand: hex || target.brand_color || null, look: lk, bg,
      font: fontIdx ? fontCss : null, ink: ink || null,
      greeting: HOLIDAYS.includes(lk) ? lt(`ads.greeting.${lk}`) : '', searchKicker: lt('ads.searchKicker', 'Someone near you is searching for:'),
      review, faq: faqs.length ? faqs[faqIdx % faqs.length] : null,
      sourceLabel: review?.source === 'google' ? lt('ads.googleReview', 'Google review') : '',
      name: targetType === 'property' ? (target.title || '') : target.name,
      nowLabel: lt('ads.now', 'now'),
      situation: (() => { const all = lineList(words?.situations); return all.length ? all[situationIdx % all.length] : ''; })(),
    };
  };

  // The Hebrew and English faces, and the marker hands of the sticky note,
  // load only when a page uses them; canvas text drawn before then falls
  // back to a system font.
  const fontsReady = async () => {
    if (!document.getElementById('ad-hand-fonts')) {
      const link = document.createElement('link');
      link.id = 'ad-hand-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Caveat:wght@700&display=swap';
      document.head.appendChild(link);
      await new Promise((r) => { link.onload = r; link.onerror = r; });
    }
    if (fontIdx && !document.getElementById('ad-pick-fonts')) {
      const link = document.createElement('link');
      link.id = 'ad-pick-fonts';
      link.rel = 'stylesheet';
      link.href = FONT_URL;
      document.head.appendChild(link);
      await new Promise((r) => { link.onload = r; link.onerror = r; });
    }
    const head = rtl ? 'Frank Ruhl Libre' : 'Playfair Display';
    const body = rtl ? 'Assistant' : 'Manrope';
    const hand = rtl ? 'Amatic SC' : 'Caveat';
    const picked = rtl ? fontPair[1] : fontPair[0];
    await Promise.all([`600 64px "${head}"`, `700 64px "${head}"`, `600 30px "${body}"`, `700 34px "${body}"`,
      `800 90px "${body}"`, `700 60px "${hand}"`, `800 60px "${picked}"`, `500 30px "${picked}"`]
      .map((f) => document.fonts?.load(f, rtl ? 'אב' : 'ab').catch(() => null)));
  };

  useEffect(() => {
    if (!words || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      await fontsReady();
      if (cancelled) return;
      const on = designs.find(([k]) => k === design)?.[2];
      const got = {};
      const stats = {};
      render(canvasRef.current, on ? design : 'clean', { ...args(design), moves: moves[moveKey] || {}, boxes: got, stats });
      setCanStrip(!!stats.strips);
      setBoxes(got);
      setLost(ink ? lostWords(canvasRef.current, got, ink) : null);
      setPreview('drawn');
      // The ad changed, so a video made from it is out of date.
      setVideo(null);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, format, design, imgs, itemImgs, cutItems, pickBy, rtl, eyebrow, cta, shortUrl, reviews, reviewIdx, faqs, faqIdx,
    lookBy, holidayPick, customBy, photoBy, fontIdx, ink, bg, moves, situationIdx, strips, withReview, deal]);

  // Every design at once, small, so the owner picks one by eye (rules 9b).
  // A moment after typing stops: each preview is a full drawing.
  useEffect(() => {
    if (!words) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      await fontsReady();
      const big = document.createElement('canvas');
      const small = document.createElement('canvas');
      const out = {};
      const todo = designs.filter(([, , ok]) => ok).map(([k]) => k);
      // A few at a time, so the window stays responsive while some forty
      // full-size drawings are made.
      for (let i = 0; i < todo.length; i += 1) {
        if (cancelled) return;
        render(big, todo[i], args(todo[i]));
        small.width = 240;
        small.height = Math.round((240 * big.height) / big.width);
        small.getContext('2d').drawImage(big, 0, 0, small.width, small.height);
        out[todo[i]] = small.toDataURL('image/jpeg', 0.72);
        if (i % 4 === 3 || i === todo.length - 1) {
          setThumbs({ ...out });
          await new Promise((r) => { setTimeout(r, 0); });
        }
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, format, imgs, itemImgs, cutItems, pickBy, rtl, eyebrow, cta, shortUrl, reviews, reviewIdx, faqs, faqIdx,
    lookBy, holidayPick, customBy, photoBy, fontIdx, ink, bg]);

  // The QR code and the post's link name the design (/p/{slug}/{design}),
  // so the owner can see which design brought visits (borrowed from the ad
  // tools that score designs, but counted from real visits). The short
  // link printed on the picture stays short.
  const adName = themed && layout !== 'custom' ? `${layout}-${lookNow}` : layout;
  const adUrl = ad ? `${shortUrl}/${adName}` : shortUrl;
  // The QR uses the short random slug: fewer squares scan better. People read the name.
  const qrUrl = ad ? `${SITE}/p/${ad.link.slug}/${adName}` : shortUrl;
  const postText = words ? `${words.caption}\n\n${adUrl}` : '';
  const copyText = async () => {
    try { await navigator.clipboard.writeText(postText); toast.success(t('ads.copied', 'Post text copied')); } catch { /* shown in the box */ }
  };
  const sharePicture = () => { saveAd(true); adCanvas(format).toBlob(async (blob) => {
    const file = new File([blob], `ad-${format}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: postText }).catch((e) => { if (e?.name !== 'AbortError') saveFile(file); });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      copyText();
    }
  }, 'image/jpeg', 0.95); };

  // Every shape of the picked design in one tap (Canva's "resize"): the
  // square post, the feed post and the status, shared or saved together.
  const allShapes = async () => {
    saveAd(true);
    const files = [];
    for (const f of (design === 'native' ? ['story'] : ['square', 'feed', 'story'])) {
      const c = adCanvas(f);
      // eslint-disable-next-line no-await-in-loop
      const blob = await new Promise((r) => { c.toBlob(r, 'image/jpeg', 0.95); });
      files.push(new File([blob], `ad-${f}.jpg`, { type: 'image/jpeg' }));
    }
    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files, text: postText }).catch((e) => { if (e?.name !== 'AbortError') files.forEach(saveFile); });
      return;
    }
    files.forEach((file, i) => setTimeout(() => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, i * 400));
  };
  // Saving: the choices and words, and a small preview for the list. The
  // posting, printing and sharing buttons save quietly too, so every ad
  // that went out is in "Your ads" with its visits.
  // kept: the page keeping its first ad so a revisit does not pay for words again; the owner never saved it (Tzvi, 7 Nov 2026).
  const saveAd = async (quiet = false, asNew = false, kept = false) => {
    if (!words || !canvasRef.current) return;
    // Its design cannot be drawn yet (the cut-outs): a quiet save would overwrite it with the stand-in.
    if (quiet && savedPending.current && savedPending.current !== design) return;
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = Math.round((240 * canvasRef.current.height) / canvasRef.current.width);
    c.getContext('2d').drawImage(canvasRef.current, 0, 0, c.width, c.height);
    try {
      const { data } = await axios.post(`${API}/ads/saved`, {
        target_type: targetType, target_id: target.id, id: asNew ? null : (savedId || null), lang, design, kept,
        item: featured?.name || '', words, thumb: c.toDataURL('image/jpeg', 0.7),
        settings: { format, look, customHex, fontIdx, ink, strips, withReview, deal, moves, adName, bg: bg.src ? { src: bg.src } : { id: bg.id || 'sand' }, photo: photoBy[layout]?.src || null, reviewIdx, faqIdx, situationIdx },
      }, auth);
      setSavedId(data.id);
      loadSaved();
      if (!quiet) toast.success(t('ads.saved', 'Saved to your ads'));
    } catch (err) {
      if (!quiet) toast.error(err?.response?.data?.detail || t('ads.saveFailed', 'Could not save the ad. Try again.'));
    }
  };
  // On the page, the first ad is kept as soon as it is drawn: the page opens
  // with it next time, so just visiting never pays for the words again.
  const keptFirst = useRef('');
  useEffect(() => {
    if (!inline || !cutsDone || preview !== 'drawn' || busy || !words || savedId || !saved || saved.some((r) => r.lang === lang) || keptFirst.current === lang) return undefined;
    // After the cut-outs and photos are on the canvas, or it would keep the wrong design and a blank picture.
    const timer = setTimeout(() => { keptFirst.current = lang; saveAd(true, false, true); }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline, cutsDone, preview, busy, words, savedId, saved, lang, design, imgs, itemImgs, cutItems]);
  const removeSaved = async (id) => {
    await axios.delete(`${API}/ads/saved/${id}`, auth).catch(() => {});
    if (id === savedId) setSavedId('');
    loadSaved();
  };

  const adCanvas = (f) => {
    const c = document.createElement('canvas');
    render(c, design, { ...args(design), format: f, moves: moves[`${design}|${f}`] || moves[moveKey] || {}, scale: 2 });
    return c;
  };
  // The same ad, moving: its last frame is the picture above, with no paid generation.
  const makeVideo = async () => {
    saveAd(true);
    setVideoPct(0);
    try {
      const f = design === 'native' ? 'story' : format;
      const c = document.createElement('canvas');
      // Stays in one drawing mode: a browser switching modes mid-video shifted the grain, and the whole ad dimmed for two seconds.
      c.getContext('2d', { willReadFrequently: true });
      const a = { ...args(design), format: f, moves: moves[`${design}|${f}`] || moves[moveKey] || {} };
      const anim = { t: Infinity, n: 0, cover: 0 };
      render(c, design, { ...a, anim }); // counts the words and sizes the canvas
      // The opening word sits on the ad's own colour, read from its top corner.
      const [r, g, b] = c.getContext('2d').getImageData(12, 12, 1, 1).data;
      anim.ground = `rgb(${r},${g},${b})`;
      anim.groundLight = lum([r, g, b]) > 0.4;
      let still = false;
      const blob = await adVideo(c, (s) => {
        if (s < HOOK + MOVE_ENDS) {
          anim.t = s - HOOK;
          anim.cover = 1 - progress(s, HOOK * 0.75, HOOK * 0.4);
          render(c, design, { ...a, anim });
        } else if (!still) { render(c, design, a); still = true; }
      }, VIDEO_SECONDS, setVideoPct);
      const file = new File([blob], `ad-${f}.mp4`, { type: 'video/mp4' });
      setVideo({ url: URL.createObjectURL(file), file });
    } catch {
      toast.error(t('ads.videoFailed', 'This browser cannot make a video. Try Chrome or Safari.'));
    } finally {
      setVideoPct(null);
    }
  };
  const sendVideo = async () => {
    if (navigator.canShare && navigator.canShare({ files: [video.file] })) {
      await navigator.share({ files: [video.file], text: postText }).catch((e) => { if (e?.name !== 'AbortError') saveFile(video.file); });
    } else {
      saveFile(video.file);
      copyText();
    }
  };
  const saveFile = (file) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  // One tap to WhatsApp Status (Buffer's and Later's "post now"): the tall
  // shape, handed to the phone's share sheet with the post text.
  const shareStatus = async () => {
    saveAd(true);
    const blob = await new Promise((r) => { adCanvas('story').toBlob(r, 'image/jpeg', 0.95); });
    const file = new File([blob], 'ad-status.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: postText }).catch((e) => { if (e?.name !== 'AbortError') saveFile(file); });
    } else {
      saveFile(file);
      copyText();
    }
  };

  // Things to print (Vistaprint's range), each an A4 page at 150 dpi made
  // from the same ad, link and code.
  const PW = 1240;
  const PH = 1754;
  const page = () => {
    const c = document.createElement('canvas');
    c.width = PW;
    c.height = PH;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PW, PH);
    return [c, ctx];
  };
  const dashed = (ctx, draw) => {
    ctx.save();
    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = '#B8B8B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    draw();
    ctx.stroke();
    ctx.restore();
  };
  const PRINTS = {
    // The feed ad across the page, the name once under it. The ad's own
    // code is about 3cm wide on paper, enough to scan from a noticeboard.
    flyer: () => {
      const [c, ctx] = page();
      const ad = adCanvas('feed');
      const adH = Math.round((PW * ad.height) / ad.width);
      ctx.drawImage(ad, 0, 0, PW, adH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = rtl ? 'rtl' : 'ltr';
      ctx.fillStyle = INK;
      ctx.font = `800 64px ${fontIdx ? fontCss : bodyFont(rtl)}`;
      ctx.fillText(wrap(ctx, args(design).name || '', PW - 120, 1)[0] || '', PW / 2, adH + (PH - adH) / 2);
      return c;
    },
    // Folded across the middle to stand on a table: the top half upside
    // down, so it reads from both sides.
    table: () => {
      const [c, ctx] = page();
      const ad = adCanvas('square');
      const half = PH / 2;
      const sz = half - 80;
      ctx.drawImage(ad, (PW - sz) / 2, half + 40, sz, sz);
      ctx.save();
      ctx.translate(PW / 2, half / 2);
      ctx.rotate(Math.PI);
      ctx.drawImage(ad, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
      dashed(ctx, () => { ctx.moveTo(0, half); ctx.lineTo(PW, half); });
      return c;
    },
    // Ten 85 x 55mm cards: the name, what to do, the code and the link.
    cards: () => {
      const [c, ctx] = page();
      const cw = 502;
      const ch = 325;
      const x0 = (PW - cw * 2) / 2;
      const y0 = (PH - ch * 5) / 2;
      const font = fontIdx ? fontCss : bodyFont(rtl);
      const name = args(design).name || '';
      const q = 160;
      ctx.direction = rtl ? 'rtl' : 'ltr';
      ctx.textAlign = rtl ? 'right' : 'left';
      for (let i = 0; i < 10; i += 1) {
        const x = x0 + (i % 2) * cw;
        const y = y0 + Math.floor(i / 2) * ch;
        ctx.fillStyle = brandHex || ACCENT;
        ctx.fillRect(x, y, cw, 10);
        if (qrRef.current) ctx.drawImage(qrRef.current, rtl ? x + 24 : x + cw - 24 - q, y + 34, q, q);
        const tx = rtl ? x + cw - 28 : x + 28;
        const tw = cw - q - 80;
        ctx.fillStyle = INK;
        ctx.font = `800 34px ${font}`;
        wrap(ctx, name, tw, 2).forEach((l, j) => ctx.fillText(l, tx, y + 76 + j * 40));
        ctx.fillStyle = '#666666';
        ctx.font = `500 22px ${font}`;
        wrap(ctx, cta, tw, 2).forEach((l, j) => ctx.fillText(l, tx, y + 172 + j * 28));
        ctx.fillStyle = ACCENT;
        ctx.font = `600 22px ${font}`;
        ctx.fillText(shortUrl.replace(/^https?:\/\//, ''), tx, y + ch - 34);
        ctx.strokeStyle = '#D0D0D0';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cw, ch);
      }
      return c;
    },
    // The square ad 18.6cm wide with a line to cut along, for a window.
    sticker: () => {
      const [c, ctx] = page();
      const sz = 1100;
      const x = (PW - sz) / 2;
      const y = (PH - sz) / 2;
      ctx.drawImage(adCanvas('square'), x, y, sz, sz);
      dashed(ctx, () => ctx.rect(x - 20, y - 20, sz + 40, sz + 40));
      return c;
    },
  };
  const printIt = (kind) => {
    saveAd(true);
    const c = PRINTS[kind]();
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><title>${kind}</title><style>@page{size:A4;margin:0}html,body{margin:0}img{display:block;width:100vw;height:100vh;object-fit:contain}</style><img src="${c.toDataURL('image/jpeg', 0.95)}">`);
    doc.close();
    const img = doc.querySelector('img');
    const go = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 60000); };
    if (img.complete) go(); else img.onload = go;
  };
  // Real ads running now in the same field, from Meta's public Ad Library.
  const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=IL&q=${encodeURIComponent((words?.search || target.name || '').slice(0, 60))}`;

  // Dragging a piece on the preview. The boxes are in the picture's own
  // pixels; the preview is shown smaller, so a move is scaled back up.
  const drag = useRef(null);
  const onDown = (name, mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSel(name);
    const rect = canvasRef.current.getBoundingClientRect();
    const b = boxes[name] || [];
    const cur = { x: b[4] || 0, y: b[5] || 0, s: b[6] || 1 };
    drag.current = { name, mode, sx: e.clientX, sy: e.clientY, k: canvasRef.current.width / rect.width, cur, box: boxes[name] };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    let dx = (e.clientX - d.sx) * d.k;
    let dy = (e.clientY - d.sy) * d.k;
    if (d.mode === 'move') {
      // Snaps like Canva (Tzvi, 6 Nov 2026): the piece's edges and middle to the
      // middle of the ad and to the other pieces, with a line to show it.
      const others = Object.entries(boxes).filter(([n]) => n !== d.name).map(([, b]) => b);
      const snap = (start, size, delta, lines) => {
        let best = null;
        [0, size / 2, size].forEach((off) => lines.forEach((line) => {
          const gap = line - (start + delta + off);
          if (Math.abs(gap) <= 8 * d.k && (!best || Math.abs(gap) < Math.abs(best.gap))) best = { gap, line };
        }));
        return best;
      };
      const sx = snap(d.box[0], d.box[2], dx, [W0 / 2, ...others.flatMap((b) => [b[0], b[0] + b[2] / 2, b[0] + b[2]])]);
      const sy = snap(d.box[1], d.box[3], dy, [H0 / 2, ...others.flatMap((b) => [b[1], b[1] + b[3] / 2, b[1] + b[3]])]);
      if (sx) dx += sx.gap;
      if (sy) dy += sy.gap;
      setGuides({ x: sx ? sx.line : null, y: sy ? sy.line : null });
    }
    const next = d.mode === 'size'
      ? { ...d.cur, s: Math.max(0.3, Math.min(3, d.cur.s * (1 + (dx + dy) / (d.box[2] + d.box[3])))) }
      : { ...d.cur, x: d.cur.x + dx, y: d.cur.y + dy };
    setMoves((m) => ({ ...m, [moveKey]: { ...(m[moveKey] || {}), [d.name]: next } }));
  };
  const onUp = () => { drag.current = null; setGuides({}); };
  const resetMoves = () => { setMoves((m) => ({ ...m, [moveKey]: {} })); setSel(''); };
  const W0 = canvasRef.current?.width || 1080;
  const H0 = canvasRef.current?.height || 1350;

  // A photo from the gallery goes behind "Make your own", whichever design
  // the owner was looking at when they picked it.
  const pickBackground = async (url) => {
    const img = await loadImage(url);
    if (!img) return;
    if (layout === 'custom') setBg({ img, src: url });
    else setPhotoBy((m) => ({ ...m, [layout]: { img, src: url } }));
  };
  // Tzvi, 5 Nov 2026: "it sticks with channuka doesnt let me change it". The
  // holiday is its own named choice, any chag or none, not one more colour.
  const holidayNow = !customHex ? holidayPick : '';
  const holidays = holiday ? [holiday, ...HOLIDAYS.filter((h) => h !== holiday)] : HOLIDAYS;
  const pickHoliday = (k) => {
    setHolidayPick(k === 'noholiday' ? '' : k);
    if (k !== 'noholiday') setCustomBy((m) => ({ ...m, [layout]: '' }));
  };
  const swatch = (name) => {
    const L = lookOf(name, brandHex, featured?.cut || featured?.img);
    return L ? L.bg : '#ccc';
  };

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
  const panel = (
      <div className={inline ? 'bg-white w-full' : 'bg-white w-full sm:max-w-4xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-6'} onClick={(e) => e.stopPropagation()}>
        {!inline && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>{t('ads.title', 'Make an ad')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')} className="p-3 rounded-full hover:bg-[#F9FAFB]"><X size={18} /></button>
        </div>
        )}
        {saved?.some((r) => r.lang === lang && !r.kept) && (
          <div className="mb-4" data-testid="ad-saved">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--ink)' }}>{t('ads.savedTitle', 'Your saved ads')}</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {saved.filter((r) => r.lang === lang && !r.kept).map((r) => (
                <div key={r.id} className="relative shrink-0 w-[84px]">
                  <button type="button" onClick={() => write(r)} disabled={busy} aria-pressed={r.id === savedId}
                    className="block w-full rounded-lg overflow-hidden border-2" style={{ borderColor: r.id === savedId ? '#000' : 'var(--brand-border)' }} data-testid={`ad-saved-${r.id}`}>
                    <img src={r.thumb} alt={designName(r.settings?.adName || r.design)} className="w-full block" />
                  </button>
                  <span className="block mt-1 text-[10px] leading-tight text-center" style={{ color: 'var(--brand-muted)' }}>
                    {t('ads.weekVisits', 'Visits this week: {{count}}', { count: weekCounts[r.settings?.adName] || 0 })}
                  </span>
                  <button type="button" onClick={() => removeSaved(r.id)} aria-label={t('ads.deleteSaved', 'Delete this ad')}
                    className="absolute top-1 end-1 rounded-full bg-white/90 p-1" data-testid={`ad-saved-delete-${r.id}`}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {(() => {
          const used = new Set((saved || []).map((r) => (r.design || '').split(':')[0]));
          const next = used.size ? shown.find(([k]) => !used.has(k) && k !== design && k !== 'custom') : null;
          return next ? (
            <p className="text-xs mb-3" style={{ color: 'var(--brand-muted)' }} data-testid="ad-try-next">
              {t('ads.tryNextWhy', 'Different-looking ads reach more people than the same one again.')}{' '}
              <button type="button" onClick={() => setDesign(next[0])} className="font-semibold underline" style={{ color: 'var(--brand-primary)' }}>
                {t('ads.tryNext', 'Try {{name}}', { name: next[1] })}
              </button>
            </p>
          ) : null;
        })()}
        <div className="space-y-1.5 mb-4" data-testid="ad-holidays">
          <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('ads.holidayTitle', 'Holiday')}</p>
          <Chips value={holidayNow || 'noholiday'} set={pickHoliday} options={[
            ['noholiday', t('ads.noHoliday', 'No holiday')], ...holidays.map((h) => [h, t(`ads.look.${h}`)])]} />
        </div>
        {/* The gallery: every design, already made from this business. */}
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--ink)' }}>{t('ads.galleryTitle', 'Pick a look. Every ad is made from your own product, name and price.')}</p>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 max-h-[36vh] overflow-y-auto mb-5 pe-1" data-testid="ad-gallery">
          {shown.map(([k, label], at) => {
            const fam = FAMILIES.find(([, keys]) => keys.includes(k))?.[0];
            const newFam = !at || FAMILIES.find(([, keys]) => keys.includes(shown[at - 1][0]))?.[0] !== fam;
            return (
            <React.Fragment key={k}>
            {newFam && <p className="col-span-full text-xs font-semibold mt-1" style={{ color: 'var(--brand-muted)' }}>{t(`ads.family.${fam}`)}</p>}
            <button type="button" onClick={() => setDesign(k)} aria-pressed={design === k}
              className="text-center min-w-0" data-testid={`ad-g-${k}`}>
              <span className={`block rounded-lg overflow-hidden border-2 bg-[#F9FAFB] flex items-center justify-center ${format === 'square' ? 'aspect-square' : format === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}
                style={{ borderColor: design === k ? '#000' : 'var(--brand-border)' }}>
                {thumbs[k] ? <img src={thumbs[k]} alt={label} className="max-h-full max-w-full" />
                  : <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
              </span>
              <span className="block mt-1 text-[11px] leading-tight font-semibold truncate" style={{ color: 'var(--ink)' }}>{label}</span>
            </button>
            </React.Fragment>
            );
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Stays in view while the options beside or under it scroll (Tzvi, 5 Nov 2026). */}
          <div className={`min-w-0 space-y-2 sticky z-10 bg-white self-start ${inline ? 'top-24 sm:top-20' : 'top-0'}`} data-testid="ad-preview-column">
            <div className="bg-[#F9FAFB] rounded-xl flex items-center justify-center p-2 sm:p-3 min-h-[180px] sm:min-h-[280px]" onPointerDown={() => setSel('')}>
              {failed && (
                <div className="text-center text-sm space-y-2" role="alert" data-testid="ad-failed">
                  <p style={{ color: 'var(--ink)' }}>{t('ads.failed', 'Could not write the ad. Try again.')}</p>
                  <button type="button" onClick={() => { wroteFor.current = ''; setFailed(false); setRetry((n) => n + 1); }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#000' }} data-testid="ad-retry">
                    {t('ads.tryAgain', 'Try again')}
                  </button>
                </div>
              )}
              {!failed && (!preview || busy) && <Loader2 className="animate-spin" size={28} aria-label={t('ads.writing', 'Writing your ad…')} />}
              <div className={`relative ${!preview || busy ? 'hidden' : 'inline-block'}`} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                {guides.x != null && <div aria-hidden="true" data-testid="ad-guide-x" className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `${(guides.x / W0) * 100}%`, width: 1, background: '#167AB8', boxShadow: '0 0 0 1px rgba(255,255,255,.7)' }} />}
                {guides.y != null && <div aria-hidden="true" data-testid="ad-guide-y" className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${(guides.y / H0) * 100}%`, height: 1, background: '#167AB8', boxShadow: '0 0 0 1px rgba(255,255,255,.7)' }} />}
                <canvas ref={canvasRef} className="block max-h-[36vh] sm:max-h-[66vh] max-w-full w-auto h-auto rounded-lg shadow" role="img"
                  aria-label={t('ads.previewAlt', 'Your ad')} data-testid="ad-preview" />
                {video && (
                  <div className="absolute inset-0 z-20" onPointerDown={(e) => e.stopPropagation()}>
                    <video src={video.url} className="w-full h-full rounded-lg" autoPlay muted loop playsInline aria-label={t('ads.previewAlt', 'Your ad')} data-testid="ad-video-preview" />
                    <button type="button" onClick={() => setVideo(null)} aria-label={t('common.close', 'Close')} className="absolute top-2 end-2 p-2 rounded-full bg-white shadow" data-testid="ad-video-close"><X size={16} /></button>
                  </div>
                )}
                {Object.entries(boxes).sort(([a], [b]) => ['qr', 'link'].includes(a) - ['qr', 'link'].includes(b)).map(([name, [x, y, w, h]]) => (
                  <div key={name} onPointerDown={onDown(name, 'move')} data-testid={`ad-piece-${name}`}
                    className="absolute cursor-move" style={{ left: `${(x / W0) * 100}%`, top: `${(y / H0) * 100}%`, width: `${(w / W0) * 100}%`,
                      height: `${(h / H0) * 100}%`, touchAction: 'none', outline: sel === name ? '2px dashed #167AB8' : 'none' }}>
                    {sel === name && (
                      <span onPointerDown={onDown(name, 'size')} data-testid={`ad-size-${name}`}
                        className="absolute -bottom-2 -end-2 w-5 h-5 rounded-full border-2 border-white cursor-nwse-resize" style={{ background: '#167AB8', touchAction: 'none' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            {(
              <div className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
                <span className="hidden sm:inline">{t('ads.dragHint', 'Drag the product, the words, the price, the QR code or the link to move them. Pull the blue dot to resize.')}</span>
                {Object.keys(moves[moveKey] || {}).length > 0 && (
                  <button type="button" onClick={resetMoves} className="font-semibold shrink-0" style={{ color: 'var(--brand-primary)' }} data-testid="ad-reset-moves">
                    {t('ads.resetMoves', 'Put back')}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-4">
            {((themed && layout !== 'custom' && layout !== 'fullphoto') || COLOUR_FIXED.includes(layout)) && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('ads.colourTitle', 'Background colour')}</p>
                <div className="flex flex-wrap items-center gap-2" data-testid="ad-colours">
                  {(COLOUR_FIXED.includes(layout) ? ['own', 'night', 'navy'] : baseLooks).map((k) => (
                    <button key={k} type="button" onClick={() => { setLook(k); setCustomHex(''); }} aria-pressed={!customHex && look === k}
                      title={t(`ads.look.${k}`)} aria-label={t(`ads.look.${k}`)} data-testid={`ad-colour-${k}`}
                      className="w-8 h-8 rounded-full border-2" style={{ background: swatch(k), borderColor: !customHex && look === k ? '#000' : 'var(--brand-border)' }} />
                  ))}
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    {t('ads.anyColour', 'Any colour')}
                    <HexPicker value={customHex} fallback="#167AB8" onChange={setCustomHex} testid="ad-colour-custom" label={t('ads.anyColour', 'Any colour')} />
                  </span>
                </div>
              </div>
            )}
            {layout === 'custom' && (
              <div className="space-y-2" data-testid="ad-backgrounds">
                <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('ads.bgTitle', 'Background')}</p>
                <div className="flex flex-wrap gap-2">
                  {BACKDROPS.map(([k, [c1, c2]]) => (
                    <button key={k} type="button" onClick={() => setBg({ id: k })} aria-pressed={bg.id === k} aria-label={k} data-testid={`ad-bg-${k}`}
                      className="w-9 h-9 rounded-lg border-2" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, borderColor: bg.id === k ? '#000' : 'var(--brand-border)' }} />
                  ))}
                  {imgs.slice(0, 4).map((im) => (
                    <button key={im.src} type="button" onClick={() => setBg({ img: im, src: im.src })} aria-pressed={bg.src === im.src}
                      className="w-9 h-9 rounded-lg border-2 overflow-hidden" style={{ borderColor: bg.src === im.src ? '#000' : 'var(--brand-border)' }}>
                      <img src={im.src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {targetType !== 'property' && layout !== 'fullphoto' && (
              <div className="space-y-1.5">
                {photoBy[layout] && (
                  <button type="button" onClick={() => setPhotoBy((m) => ({ ...m, [layout]: null }))} className="text-xs font-semibold" style={{ color: 'var(--brand-primary)' }} data-testid="ad-bg-none">
                    {t('ads.bgNone', 'No photo')}
                  </button>
                )}
                <BackgroundGallery API={API} token={token} lang={lang} onPick={pickBackground} />
              </div>
            )}
            {themed && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  {t('ads.fontTitle', 'Font')}
                  <select className={`${field} mt-1`} value={fontIdx} onChange={(e) => setFontIdx(Number(e.target.value))} data-testid="ad-font">
                    {FONTS.map(([en, he], i) => <option key={en} value={i} style={{ fontFamily: `"${rtl ? he : en}"` }}>{rtl ? he : en}</option>)}
                  </select>
                </label>
                <div className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  {t('ads.inkTitle', 'Word colour')}
                  <div className="flex items-center gap-2 mt-1">
                    <HexPicker value={ink} fallback="#FFFFFF" onChange={setInk} testid="ad-ink" label={t('ads.inkTitle', 'Word colour')} />
                    {ink && <button type="button" onClick={() => setInk('')} className="font-semibold" style={{ color: 'var(--brand-primary)' }}>{t('ads.inkAuto', 'Automatic')}</button>}
                  </div>
                </div>
                {lost && (
                  <p className="col-span-2 text-xs font-semibold rounded-lg px-2.5 py-2" style={{ background: '#FFF4E5', color: '#7A4100' }} role="status" data-testid="ad-ink-warning">
                    {t('ads.inkWarning', 'Your words are hard to see on this background.')}{' '}
                    <button type="button" onClick={() => setInk(lost)} className="underline" data-testid="ad-ink-fix">{t('ads.inkFix', 'Fix it')}</button>
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2" data-testid="ad-extras">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                {canStrip && (
                  <label className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={strips} onChange={(e) => setStrips(e.target.checked)} data-testid="ad-strips" />
                    {t('ads.strips', 'Headline on strips')}
                  </label>
                )}
                {reviews.length > 0 && design !== 'review' && (
                  <label className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={withReview} onChange={(e) => setWithReview(e.target.checked)} data-testid="ad-with-review" />
                    {t('ads.withReview', 'Add a customer review')}
                  </label>
                )}
              </div>
              {targetType !== 'site' && (
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <label className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    {t('ads.deal', 'A real deal you are running (optional)')}
                    <input className={`${field} mt-1`} maxLength={30} value={deal.text} placeholder={t('ads.dealHint', 'Buy 2, get 1 free')}
                      onChange={(e) => setDeal((d) => ({ ...d, text: e.target.value }))} data-testid="ad-deal" />
                  </label>
                  <label className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    {t('ads.dealEnds', 'Ends on')}
                    <input type="date" className={`${field} mt-1`} value={deal.until} min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setDeal((d) => ({ ...d, until: e.target.value }))} data-testid="ad-deal-until" />
                  </label>
                  {deal.text.trim() && !deal.until && <p className="col-span-2 text-xs" style={{ color: 'var(--brand-muted)' }}>{t('ads.dealNeedsDate', 'A deal shows on the ad once it has an end date.')}</p>}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('ads.shape', 'Where will you post it?')}</p>
              <Chips value={format} set={pickFormat} options={[
                ['square', t('ads.square', 'Square post')], ['feed', t('ads.feed', 'Facebook / Instagram')], ['story', t('ads.story', 'WhatsApp status / story')]]} />
            </div>
            <div className="space-y-1.5">
              {design === 'question' && faqs.length > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
                  <span>{t('ads.questionNote', 'A question from your page, with your own answer')}</span>
                  {faqs.length > 1 && (
                    <button type="button" onClick={() => setFaqIdx((i) => i + 1)} className="font-semibold shrink-0" style={{ color: 'var(--brand-primary)' }} data-testid="ad-next-question">
                      {t('ads.anotherQuestion', 'Another question')}
                    </button>
                  )}
                </div>
              )}
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
            {lineList(words?.people).length > 0 && (
              <div className="space-y-1.5" data-testid="ad-who">
                <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('ads.whoTitle', 'Who is this ad for?')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {[['', t('ads.whoAll', 'Everyone')], ...lineList(words.people).map((x) => [x, x])].map(([k, label]) => (
                    <button key={k || 'all'} type="button" disabled={busy} aria-pressed={forWhom === k}
                      onClick={() => { setForWhom(k); write(null, k); }} className={`${chip(forWhom === k)} disabled:opacity-40`} style={chipStyle(forWhom === k)}
                      data-testid={`ad-who-${k ? 'p' : 'all'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {words && (
              <div className="space-y-2" dir={rtl ? 'rtl' : 'ltr'}>
                <div className="flex items-center justify-between" dir="auto">
                  <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('ads.words', 'The words (change anything)')}</p>
                  <button type="button" onClick={() => write(null, forWhom)} disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--brand-primary)' }} data-testid="ad-rewrite">
                    <RefreshCw size={12} /> {t('ads.rewrite', 'Write again')}
                  </button>
                </div>
                {poolFor(layout).length > 1 && (
                  <div className="space-y-1">
                    <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('ads.whichProduct', 'Which product is in the ad (its own price comes with it)')}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1" data-testid="ad-products">
                      {poolFor(layout).map((it, i) => (
                        <button key={it.name} type="button" onClick={() => setPickBy((m) => ({ ...m, [layout]: it.name }))} aria-pressed={featured?.name === it.name}
                          className="shrink-0 w-[72px] text-center" data-testid={`ad-product-${i}`}>
                          <img src={(it.cut || it.img).src} alt="" className="h-12 w-full object-contain rounded border-2"
                            style={{ borderColor: featured?.name === it.name ? '#000' : 'var(--brand-border)' }} />
                          <span className="block text-[10px] leading-tight truncate" dir="auto">{it.name}</span>
                          {it.price > 0 && <span className="block text-[10px] font-semibold">{money(it.price, it.currency)}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(words.ideas || []).length > 0 && (
                  <div className="space-y-1" data-testid="ad-ideas">
                    <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('ads.ideasTitle', 'Pick a headline, or write your own')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[...words.ideas, ...(words.plain ? [{ text: words.plain, key: words.plainKey || '', item: words.plainItem || '' }] : [])].map((o, i) => (
                        <button key={o.text} type="button" dir="auto" onClick={() => { setWords({ ...words, headline: o.text, key: o.key, item: o.item || '' }); if (o.item) setPickBy({}); }} aria-pressed={words.headline === o.text}
                          className={`${chip(words.headline === o.text)} text-start`} style={chipStyle(words.headline === o.text)} data-testid={`ad-idea-${i}`}>
                          {o.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <input className={field} value={words.headline} maxLength={60} onChange={(e) => setWords({ ...words, headline: e.target.value })} aria-label={t('ads.headline', 'Headline')} />
                {headlineWords > 9 && (
                  <p className="text-xs font-semibold rounded-lg px-2.5 py-2" style={{ background: '#FFF4E5', color: '#7A4100' }} data-testid="ad-one-message">
                    {t('ads.oneMessage', 'One idea per ad works best: try 9 words or fewer in the headline.')}
                  </p>
                )}
                {FIELD_OF[layout] && (
                  <textarea className={field} rows={FIELD_OF[layout] === 'post' || FIELD_OF[layout] === 'moment' ? 2 : 4} value={words[FIELD_OF[layout]] || ''}
                    onChange={(e) => setWords({ ...words, [FIELD_OF[layout]]: e.target.value })}
                    aria-label={t(`ads.${FIELD_OF[layout]}Field`)} placeholder={t(`ads.${FIELD_OF[layout]}Field`)} data-testid={`ad-field-${FIELD_OF[layout]}`} />
                )}
                {layout === 'situation' && lineList(words.situations).length > 1 && (
                  <button type="button" onClick={() => setSituationIdx((i) => i + 1)} className="text-xs font-semibold" style={{ color: 'var(--brand-primary)' }} data-testid="ad-next-situation">
                    {t('ads.anotherMoment', 'Another moment')}
                  </button>
                )}
                {layout === 'behind' && (
                  <input className={field} value={words.big_word} maxLength={12} onChange={(e) => setWords({ ...words, big_word: e.target.value })}
                    aria-label={t('ads.bigWordField', 'The big word')} placeholder={t('ads.bigWordField', 'The big word')} />
                )}
                {layout === 'search' && (
                  <input className={field} value={words.search} maxLength={60} onChange={(e) => setWords({ ...words, search: e.target.value })}
                    aria-label={t('ads.searchField', 'What they search for')} placeholder={t('ads.searchField', 'What they search for')} data-testid="ad-search-words" />
                )}
                {layout === 'toggle' && (
                  <textarea className={field} rows={3} value={words.switches} onChange={(e) => setWords({ ...words, switches: e.target.value })}
                    aria-label={t('ads.switchesField', 'Switches')} placeholder={t('ads.switchesField', 'Switches')} />
                )}
                {layout === 'checklist' && (
                  <textarea className={field} rows={4} value={words.checklist} onChange={(e) => setWords({ ...words, checklist: e.target.value })}
                    aria-label={t('ads.checklistField', 'The list')} placeholder={t('ads.checklistField', 'The list')} />
                )}
                {layout === 'calling' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input className={field} value={words.caller} maxLength={24} onChange={(e) => setWords({ ...words, caller: e.target.value })}
                      aria-label={t('ads.callerField', 'Who is calling')} placeholder={t('ads.callerField', 'Who is calling')} />
                    <input className={field} value={words.decline} maxLength={16} onChange={(e) => setWords({ ...words, decline: e.target.value })}
                      aria-label={t('ads.declineField', 'Under the red button')} placeholder={t('ads.declineField', 'Under the red button')} />
                  </div>
                )}
                {issues.length > 0 && (
                  <p className="text-xs font-semibold" style={{ color: '#B42318' }} role="alert" data-testid="ad-issue">
                    {t('ads.issuePrice', 'Take the price out of the words: the ad already shows the price of the product you picked, and two prices confuse people.')}
                  </p>
                )}
                {words.points.map((p, i) => (
                  <input key={i} className={field} value={p} maxLength={40} aria-label={t('ads.point', 'Selling point')}
                    onChange={(e) => setWords({ ...words, points: words.points.map((q, j) => (j === i ? e.target.value : q)) })} />
                ))}
                <label className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  {t('ads.captionLabel', 'Post text, for under the picture when you post')}
                  <textarea className={`${field} mt-1 font-normal`} rows={4} value={words.caption} onChange={(e) => setWords({ ...words, caption: e.target.value })} data-testid="ad-caption" />
                </label>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={shareStatus} disabled={!preview || busy || issues.length > 0}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#000' }} data-testid="ad-status">
                <Share2 size={15} /> {t('ads.status', 'Share to WhatsApp Status')}
              </button>
              <button type="button" onClick={video ? sendVideo : makeVideo} disabled={!preview || busy || issues.length > 0 || videoPct !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border disabled:opacity-60" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="ad-video">
                {videoPct !== null ? <Loader2 className="animate-spin" size={15} /> : <Film size={15} />}
                {videoPct !== null ? `${t('ads.videoBusy', 'Making your video')} ${videoPct}%`
                  : video ? (navigator.canShare ? t('ads.videoSend', 'Send the video') : t('ads.videoSave', 'Download the video')) : t('ads.videoMake', 'Make it move')}
              </button>
              <button type="button" onClick={() => saveAd()} disabled={!preview || busy}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border disabled:opacity-60" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="ad-save">
                <Save size={15} /> {t('ads.save', 'Save')}
              </button>
              <button type="button" onClick={sharePicture} disabled={!preview || busy || issues.length > 0}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border disabled:opacity-60" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="ad-share">
                {navigator.canShare ? <Share2 size={15} /> : <Download size={15} />} {t('ads.share', 'Post the picture')}
              </button>
              <button type="button" onClick={copyText} disabled={!words}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="ad-copy">
                <Copy size={15} /> {t('ads.copy', 'Copy the post text')}
              </button>
              <button type="button" onClick={allShapes} disabled={!preview || busy || issues.length > 0}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border disabled:opacity-60" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="ad-all-shapes">
                <Layers size={15} /> {t('ads.allShapes', 'All three shapes')}
              </button>
            </div>
            {savedId && (
              <button type="button" onClick={() => saveAd(false, true)} className="text-xs font-semibold" style={{ color: 'var(--brand-primary)' }} data-testid="ad-save-new">
                {t('ads.saveNew', 'Save as a new ad')}
              </button>
            )}
            {design !== 'native' && (
              <div className="flex flex-wrap items-center gap-1.5" data-testid="ad-print">
                <span className="inline-flex items-center gap-1 text-xs font-semibold me-1" style={{ color: 'var(--ink)' }}>
                  <Printer size={14} aria-hidden="true" /> {t('ads.printTitle', 'Print')}
                </span>
                {[['flyer', t('ads.printFlyer', 'A4 flyer')], ['table', t('ads.printTable', 'Table card')],
                  ['cards', t('ads.printCards', 'Business cards')], ['sticker', t('ads.printSticker', 'Window sticker')]].map(([k, label]) => (
                  <button key={k} type="button" onClick={() => printIt(k)} disabled={!preview || busy || issues.length > 0}
                    className={`${chip(false)} disabled:opacity-40`} style={chipStyle(false)} data-testid={`ad-print-${k}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {targetType === 'business' && (
              <a href={adLibraryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: 'var(--brand-primary)' }} data-testid="ad-library-link">
                <ExternalLink size={12} /> {t('ads.adLibrary', 'See real ads others in your field are running')}
              </a>
            )}
            {visits.length > 0 && (
              <div className="text-xs rounded-lg p-2.5" style={{ background: '#F9FAFB', color: 'var(--ink)' }} data-testid="ad-visits">
                <p className="flex justify-between gap-2 font-semibold mb-1">
                  <span>{t('ads.visitsTitle', 'Visits from your ads so far')}</span>
                  <span className="font-normal" style={{ color: 'var(--brand-muted)' }}>{t('ads.visitsWeekAll', 'this week · in all')}</span>
                </p>
                {visits.slice(0, 4).map(([k, n]) => (
                  <p key={k} className="flex justify-between gap-2"><span>{designName(k)}</span><span className="font-semibold">{weekCounts[k] || 0} · {n}</span></p>
                ))}
              </div>
            )}
            <p className="text-[11px] text-gray-600">{t('ads.hint', 'The link on the ad is your own short link, so you can see how many people opened it under "Share & QR code".')}</p>
          </div>
        </div>
        <div className="hidden"><QRCodeCanvas ref={qrRef} value={qrUrl} size={380} marginSize={2} level="M" fgColor={INK} /></div>
      </div>
  );
  // On the Advertising page the whole maker sits on the page itself (Tzvi, 5 Nov 2026).
  if (inline) return <div data-testid="ad-maker">{panel}</div>;
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true"
      aria-label={t('ads.title', 'Make an ad')} onClick={onClose} data-testid="ad-maker">
      {panel}
    </div>,
    document.body,
  );
}
