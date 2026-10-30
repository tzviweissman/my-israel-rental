// Pieces from the seven videos of 29 Oct 2026 (rules 3u). Copy the part a site uses into its site.js.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 3u.5 Arrival: plays once, on a page with no film opening, unless motion is off
  if (!still && document.querySelector('[data-arrive]')) document.documentElement.classList.add('arrive-go');

  // 3u.6 Depth: laptops with a mouse only; each piece moves at its own speed against the scroll
  const deep = [...document.querySelectorAll('[data-depth]')];
  if (deep.length && !still && matchMedia('(min-width: 1024px) and (pointer: fine)').matches) {
    let on = false;
    const move = () => { on = false; const y = scrollY; for (const el of deep) el.style.transform = `translate3d(0, ${(-(Number(el.dataset.depth) - 1) * y).toFixed(1)}px, 0)`; };
    addEventListener('scroll', () => { if (!on) { on = true; requestAnimationFrame(move); } }, { passive: true });
  }

  // 3u.7 One rotating word: <span class="rot" data-words="birthdays|weddings|Shabbat"></span>
  for (const rot of document.querySelectorAll('.rot[data-words]')) {
    const words = rot.dataset.words.split('|');
    rot.setAttribute('aria-hidden', 'true');
    const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = words.join(', ');
    rot.after(sr);
    rot.replaceChildren(...words.map((w, k) => { const s = document.createElement('span'); s.textContent = w; if (k) s.setAttribute('aria-hidden', 'true'); return s; }));
    const spans = [...rot.children];
    const fit = (s) => { rot.style.width = `calc(${s.getBoundingClientRect().width}px + .56em)`; };
    requestAnimationFrame(() => fit(spans[0]));
    if (still || words.length < 2) continue;
    let k = 0;
    setInterval(() => {
      if (document.hidden) return;
      const a = spans[k]; k = (k + 1) % spans.length; const b = spans[k];
      a.classList.add('out'); a.setAttribute('aria-hidden', 'true');
      b.classList.remove('out'); b.removeAttribute('aria-hidden'); fit(b);
      setTimeout(() => a.classList.remove('out'), 460);
    }, 2400);
  }
})();
