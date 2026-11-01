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

  // ---- 31 Oct 2026 pieces (rules 3v): options, a site copies only what it uses ----
  const mouse = matchMedia('(pointer: fine)').matches;
  const seen = (els, fn, opts) => { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { fn(e.target); io.unobserve(e.target); } }), opts || { threshold: 0.4 }); els.forEach((el) => io.observe(el)); };

  // 3v.8 Light on the cards: one listener on the row, so the neighbours' borders light up too
  if (mouse) for (const row of document.querySelectorAll('.glow-cards')) {
    row.addEventListener('pointermove', (e) => {
      for (const c of row.children) { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`); }
    });
  }

  // 3v.9 Fanned photos: the mouse across the section spreads them; without a mouse they spread once in view
  for (const fan of document.querySelectorAll('.fan')) {
    const imgs = [...fan.children], mid = (imgs.length - 1) / 2;
    imgs.forEach((im, k) => { im.style.setProperty('--i', (k - mid).toFixed(2)); im.style.zIndex = String(100 - Math.round(Math.abs(k - mid) * 10)); });
    if (still) { fan.style.setProperty('--s', '0.7'); continue; }
    const zone = fan.closest('section, header, .hero') || fan;
    if (mouse) zone.addEventListener('pointermove', (e) => { const r = zone.getBoundingClientRect(); fan.style.setProperty('--s', (0.25 + 0.75 * (e.clientX - r.left) / r.width).toFixed(3)); });
    else seen([fan], () => fan.style.setProperty('--s', '0.8'));
  }

  // 3v.10 Rolling letters: <a><span class="roll">Order</span></a>. Hebrew rolls word by word.
  for (const el of document.querySelectorAll('.roll')) {
    const text = el.textContent, he = /[֐-׿]/.test(text);
    el.setAttribute('aria-label', text);
    el.replaceChildren(...(he ? text.split(/(\s+)/) : [...text]).map((ch, k) => { const s = document.createElement('span'); s.textContent = ch; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--k', k); return s; }));
  }

  // 3v.11 Circle reveal: opens from where the mouse enters; a tap toggles it on a phone
  for (const fig of document.querySelectorAll('.iris')) {
    fig.addEventListener('pointerenter', (e) => { const r = fig.getBoundingClientRect(); fig.style.setProperty('--x', `${e.clientX - r.left}px`); fig.style.setProperty('--y', `${e.clientY - r.top}px`); });
    if (!mouse) fig.addEventListener('click', () => fig.classList.toggle('on'));
  }

  // 3v.12 Curtain between the site's own pages. Never for new tabs, other sites, #spots or downloads.
  if (!still) {
    const cur = document.createElement('div'); cur.className = 'curtain'; cur.setAttribute('aria-hidden', 'true');
    cur.append(...[0, 1, 2, 3].map((k) => { const i = document.createElement('i'); i.style.setProperty('--k', k); return i; }));
    document.body.append(cur);
    const html = document.documentElement;
    try { if (sessionStorage.getItem('curtain')) { sessionStorage.removeItem('curtain'); html.classList.add('arriving'); setTimeout(() => html.classList.remove('arriving'), 1000); } } catch (_) {}
    addEventListener('pageshow', () => html.classList.remove('leaving'));
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash) || !/\.html$|\/$/.test(url.pathname)) return;
      e.preventDefault();
      try { sessionStorage.setItem('curtain', '1'); } catch (_) {}
      html.classList.add('leaving');
      setTimeout(() => { location.href = url.href; }, 650);
    });
  }

  // 3v.13 Picture chips: <div class="chips"><button data-pic="1"> beside <div class="swap"><img>…
  for (const chips of document.querySelectorAll('.chips[data-for]')) {
    const imgs = [...document.getElementById(chips.dataset.for).children];
    const btns = [...chips.querySelectorAll('button')];
    btns.forEach((b, k) => b.addEventListener('click', () => {
      btns.forEach((x, j) => x.setAttribute('aria-pressed', String(j === k)));
      imgs.forEach((im, j) => im.classList.toggle('on', j === k));
    }));
  }

})();
