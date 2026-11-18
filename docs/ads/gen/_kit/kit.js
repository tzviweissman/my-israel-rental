// The moving-ad kit (A10.9, Tzvi 16 Nov 2026): what every hand-made moving ad redrew by hand. A page loads it with
// <script src="../_kit/kit.js"></script>; node scripts/new-moving-ad.mjs writes such a page. Recorded by
// node scripts/record-moving-ad.mjs, which awaits window.render(t), so a clip frame is decoded before the shot.
(() => {
  const cl = (x) => Math.max(0, Math.min(1, x));
  const K = {
    cl,
    at: (t, start, dur) => cl((t - start) / dur),                    // 0 before start, 1 after start+dur
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    // A generated clip, kept as frames in clip/0001.jpg... (new-moving-ad.mjs --clip), shown at time t from `from` seconds.
    // Frames, not <video>: the recorder's Chromium plays no H.264, and a seeked video is not frame-exact.
    async clip(img, t, { from = 0, fps = 30, frames }) {
      const n = Math.max(1, Math.min(frames, Math.floor((t - from) * fps) + 1));
      const src = `clip/${String(n).padStart(4, '0')}.jpg`;
      if (!img.src.endsWith(src)) { img.src = src; await img.decode().catch(() => {}); }
    },
  };
  // The business block every ad ends on: name, two short lines, link, QR, logo. From window.AD (written by the kit script).
  K.foot = () => {
    const a = window.AD, ad = document.getElementById('ad');
    ad.insertAdjacentHTML('beforeend', `
      <div id="foot"><div class="n"></div>${a.lines.map(() => '<div class="s"></div>').join('')}<div class="u"></div></div>
      <div id="qr"><img src="qr.png" alt=""></div>${a.logo ? '<img id="logo" src="' + a.logo + '" alt="">' : ''}`);
    document.querySelector('#foot .n').textContent = a.name;
    document.querySelectorAll('#foot .s').forEach((el, i) => { el.textContent = a.lines[i]; });
    document.querySelector('#foot .u').textContent = a.link;
  };
  // Words wait (M6, A10.13): the name, link and QR rise in at `start` and are whole 0.4 s later. 4.2 keeps the QR still
  // for over 3 s in an 8 s ad (A10.3); the logo stays. check-moving-ad.py fails a QR readable in the first two seconds.
  K.footIn = (t, start = 4.2) => {
    const k = K.outCubic(K.at(t, start, 0.4));
    for (const id of ['foot', 'qr']) {
      const el = document.getElementById(id);
      el.style.opacity = k;
      el.style.transform = `translateY(${(1 - k) * 40}px)`;
    }
  };
  window.K = K;
})();
