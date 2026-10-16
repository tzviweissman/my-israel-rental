"""v3 (Tzvi, 16 Oct 2026: "very dark and hard to see and the words block a lot
of what's going on"; "nothing changes when choosing a different bowl"):
smaller chapter lines on a soft bottom shade only, no dark pools over the
film; a photo per bowl that swaps with the choice."""
import io

s = io.open('index.html', encoding='utf8').read()


def sub(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)


def cut(a, b, new):
    global s
    i = s.index(a)
    j = s.index(b, i)
    s = s[:i] + new + s[j:]


# the film's text: a soft shade along the bottom only, the words small and low
cut("  /* a dark pool behind every line, low and to the start side */", "  .chap { position: absolute;", """  /* only a soft shade along the bottom edge, under the words; the film above
     stays as bright as it was shot */
  .film .pool { position: absolute; inset: auto 0 0 0; height: 38%; pointer-events: none;
    background: linear-gradient(to top, rgb(18 10 5 / .78) 0%, rgb(18 10 5 / .45) 45%, rgb(18 10 5 / 0) 100%); }
  .film .top { position: absolute; inset: 0 0 auto 0; height: 110px; pointer-events: none; background: linear-gradient(to bottom, rgb(18 10 5 / .55), rgb(18 10 5 / 0)); }
""")
sub("""  .chap { position: absolute; inset: auto var(--gutter) clamp(2rem, 9vh, 5.5rem) var(--gutter); max-width: 46rem; color: #FFF6EA;""",
    """  .chap { position: absolute; inset: auto var(--gutter) clamp(1.4rem, 5vh, 3rem) var(--gutter); max-width: 34rem; color: #FFF6EA;""")
cut("  /* each line carries its own dark pool,", "  .chap .kick {", "")
sub("""  .chap h1, .chap h2 { font-size: clamp(2.8rem, 1.2rem + 5.4vw, 6.6rem); line-height: .96; color: #FFF6EA; text-wrap: balance; }""",
    """  .chap h1, .chap h2 { font-size: clamp(1.9rem, 1rem + 2.6vw, 3.6rem); line-height: 1.02; color: #FFF6EA; text-wrap: balance; text-shadow: 0 2px 18px rgb(18 10 5 / .55); }""")
sub("""  .chap p.line { margin: 1.1rem 0 1.5rem; color: #EADBC8; font-size: clamp(1rem, .9rem + .4vw, 1.25rem); max-width: 30rem; }""",
    """  .chap p.line { margin: .6rem 0 1rem; color: #F4E8DA; font-size: clamp(.95rem, .9rem + .2vw, 1.1rem); max-width: 28rem; text-shadow: 0 1px 10px rgb(18 10 5 / .6); }""")
sub("""  body.on-film .bar { background: linear-gradient(to bottom, rgb(18 10 5 / .88), rgb(18 10 5 / .55) 70%, rgb(18 10 5 / 0)); border-color: transparent; backdrop-filter: none; }""",
    """  body.on-film .bar { background: transparent; border-color: transparent; backdrop-filter: none; }""")
sub("""    .film .pool { background: linear-gradient(to top, rgb(18 10 5 / .88) 0%, rgb(18 10 5 / .55) 36%, rgb(18 10 5 / 0) 60%), linear-gradient(to bottom, rgb(18 10 5 / .5), rgb(18 10 5 / 0) 16%); }
    .chap { bottom: 1.6rem; }
    .chap h1, .chap h2 { font-size: clamp(2.3rem, 11vw, 3.2rem); }
    .chap p.line { margin: .7rem 0 1rem; font-size: 1rem; }""", """    .film .pool { height: 34%; }
    .chap { bottom: 1.2rem; }
    .chap h1, .chap h2 { font-size: clamp(1.7rem, 7.6vw, 2.2rem); }
    .chap p.line { margin: .5rem 0 .8rem; font-size: .95rem; }
    .chap .kick { display: none; }""")
sub("""      <div class="pool" aria-hidden="true"></div>""", """      <div class="top" aria-hidden="true"></div>
      <div class="pool" aria-hidden="true"></div>""")
# the first line: kicker, headline, button only (the proof moves to the kosher band below)
sub("""        <p class="line">Bowls, acai boards and brunch boxes, sugar free and almond milk based.</p>
        <a class="btn" href="order.html?add=Acai%20bowl">Order a bowl, <b>₪60</b> <span class="arw" aria-hidden="true">→</span></a>
        <p class="proof">Kosher, Vaad HaKashrus of Rabbi Shmuel Weiner</p>""", """        <a class="btn" href="order.html?add=Acai%20bowl">Order a bowl, <b>₪60</b> <span class="arw" aria-hidden="true">→</span></a>""")
sub("""        <h1>Acai bowls, <span class="acc">delivered</span> across Jerusalem</h1>""", """        <h1>Acai bowls, <span class="acc">delivered</span> across Jerusalem</h1>
        <p class="line">Sugar free and almond milk based.</p>""")

# a photo per bowl, swapped with the choice
sub("""          <img src="assets/menu/acai-bowl.webp" alt="One of our acai bowls in its clear bowl, topped with strawberries, green apple and granola" width="300" height="300" loading="lazy">""",
    """          <img id="pick-img" src="assets/bowls/classic.webp" alt="" width="300" height="300" loading="lazy">""")
sub("""  .card img { width: min(100%, 240px); aspect-ratio: 1; object-fit: cover; border-radius: 50%; margin: 0 auto 1.1rem; background: #fff; }""",
    """  .card img { width: min(100%, 320px); aspect-ratio: 1; object-fit: cover; border-radius: 24px; margin: 0 auto 1.1rem; background: #F4E9D8; transition: opacity 220ms ease-out, transform 320ms var(--out); }
  .card img.swap { opacity: 0; transform: scale(.96); }""")
sub("""    document.getElementById('pick-name').textContent = b[0];""", """    document.getElementById('pick-name').textContent = b[0];
    var img = document.getElementById('pick-img');
    if (img.dataset.k !== k) {
      img.classList.add('swap');
      setTimeout(function () { img.src = 'assets/bowls/' + k + '.webp'; img.alt = 'A ' + b[0].toLowerCase() + ': ' + b[2].join(', ').toLowerCase() + ' on our acai base'; img.dataset.k = k; img.onload = function () { img.classList.remove('swap'); }; }, still ? 0 : 160);
    }""")
sub("""  pick('classic');""", """  pick('classic');
  // the other bowls' photos are fetched now, so a choice swaps at once
  ['tropical', 'sunrise', 'superfruit', 'own'].forEach(function (k) { var i = new Image(); i.src = 'assets/bowls/' + k + '.webp'; });""")
io.open('index.html', 'w', encoding='utf8', newline='').write(s)
print('ok')
