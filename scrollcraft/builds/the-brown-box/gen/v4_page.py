"""v4 (Tzvi, 16 Oct 2026, page rules 3i.2 and 3i.6): picking a bowl changes
the section's colour and its big picture; topping tiles float around the
menu heading, drifting with the scroll."""
import io

s = io.open('index.html', encoding='utf8').read()


def sub(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)


# A. the bowls section takes the chosen bowl's colour; the photo is the hero
sub("""  .card { background: var(--paper); border-radius: 28px; padding: clamp(1.2rem, 3vw, 2rem); box-shadow: var(--shadow); }
  .card img { width: min(100%, 320px); aspect-ratio: 1; object-fit: cover; border-radius: 24px; margin: 0 auto 1.1rem; background: #F4E9D8; transition: opacity 220ms ease-out, transform 320ms var(--out); }
  .card img.swap { opacity: 0; transform: scale(.96); }""", """  /* the chosen bowl colours the whole section (3i.2): its ground eases to a
     light wash of that bowl's colour, the heading's accent word takes it */
  #bowls { --tint: #F1E2EC; --c: #6E2A57; background: var(--tint); transition: background-color 500ms var(--out); }
  #bowls .acc { color: var(--c); transition: color 500ms var(--out); }
  .card { background: rgb(255 255 255 / .55); border-radius: 28px; padding: clamp(1.2rem, 3vw, 2rem); box-shadow: var(--shadow); }
  .card img { width: min(100%, 400px); aspect-ratio: 1; object-fit: cover; border-radius: 24px; margin: 0 auto 1.1rem; background: #F4E9D8; transition: opacity 260ms ease-out, transform 420ms var(--out); }
  .card img.swap { opacity: 0; transform: scale(.94) translateY(8px); }""")
sub("""    document.getElementById('pick-name').textContent = b[0];""", """    document.getElementById('pick-name').textContent = b[0];
    var sec = document.getElementById('bowls');
    sec.style.setProperty('--tint', TINT[k][0]); sec.style.setProperty('--c', TINT[k][1]);""")
sub("""  var opts = [].slice.call(document.querySelectorAll('#opts .opt'));""", """  // each bowl's colour: a light wash for the section, the deep one for words
  var TINT = { classic: ['#F1E2EC', '#6E2A57'], tropical: ['#FBE6CC', '#8A4708'], sunrise: ['#E5EFD6', '#3A5C14'], superfruit: ['#E0E6F6', '#2E4A9B'], own: ['#EFE3D4', '#4A2E17'] };
  var opts = [].slice.call(document.querySelectorAll('#opts .opt'));""")

# B. topping tiles around the menu heading
sub("""  .menu { background: var(--paper); }""", """  .menu { background: var(--paper); position: relative; overflow: hidden; }
  /* their toppings as floating tiles beside the heading (3i.6), one shoot,
     tilted, each drifting at its own pace as the menu scrolls past */
  .tops { position: absolute; z-index: 0; inset-block-start: clamp(1.5rem, 4vw, 3rem); inset-inline-end: var(--gutter); width: min(46vw, 560px); height: 300px; pointer-events: none; }
  .tops img { position: absolute; width: var(--w, 120px); aspect-ratio: 1; border-radius: 22px; object-fit: cover; box-shadow: 0 2px 4px rgb(58 37 19 / .08), 0 18px 34px -16px rgb(58 37 19 / .4);
    transform: translateY(calc(var(--k, 0) * var(--sp, 30px))) rotate(var(--r, 0deg)); will-change: transform; }
  .menu .wrap { position: relative; z-index: 1; }
  @media (max-width: 760px) {
    .tops { position: relative; inset: auto; width: 100%; height: 150px; margin: -.5rem 0 .4rem; }
    .tops img { --w: 84px; }
  }
  @media (prefers-reduced-motion: reduce) { .tops img { transform: rotate(var(--r, 0deg)); } }""")
sub("""  <section class="sec menu" id="menu" aria-labelledby="h-menu">
    <div class="wrap">
      <h2 id="h-menu" class="rev">The <span class="acc">menu</span></h2>
      <p class="lede rev">Tap anything to add it to your order.</p>""", """  <section class="sec menu" id="menu" aria-labelledby="h-menu">
    <div class="tops" id="tops" aria-hidden="true">
      <img src="assets/tops/banana.webp" alt="" width="240" height="240" loading="lazy" style="--w:140px;left:4%;top:8%;--r:-9deg;--sp:-26px">
      <img src="assets/tops/blueberry.webp" alt="" width="240" height="240" loading="lazy" style="--w:118px;left:30%;top:46%;--r:7deg;--sp:34px">
      <img src="assets/tops/granola.webp" alt="" width="240" height="240" loading="lazy" style="--w:132px;left:54%;top:2%;--r:-5deg;--sp:-40px">
      <img src="assets/tops/mango.webp" alt="" width="240" height="240" loading="lazy" style="--w:110px;left:76%;top:40%;--r:11deg;--sp:28px">
      <img src="assets/tops/kiwi.webp" alt="" width="240" height="240" loading="lazy" style="--w:104px;left:10%;top:62%;--r:6deg;--sp:44px">
      <img src="assets/tops/pineapple.webp" alt="" width="240" height="240" loading="lazy" style="--w:100px;left:78%;top:-2%;--r:-12deg;--sp:-22px">
    </div>
    <div class="wrap">
      <h2 id="h-menu" class="rev">The <span class="acc">menu</span></h2>
      <p class="lede rev">Tap anything to add it to your order.</p>""")
sub("""  // ── reveals, and the phone's order bar after the opening""", """  // ── the topping tiles drift as the menu scrolls past ──
  var tops = document.getElementById('tops'), menuEl = document.getElementById('menu');
  if (tops && !still) {
    var tr = 0;
    var drift = function () {
      tr = 0;
      var r = menuEl.getBoundingClientRect();
      var k = Math.max(-1, Math.min(1, (innerHeight / 2 - r.top) / innerHeight - .4));
      tops.style.setProperty('--k', k.toFixed(3));
      [].forEach.call(tops.children, function (im) { im.style.setProperty('--k', k.toFixed(3)); });
    };
    addEventListener('scroll', function () { if (!tr) tr = requestAnimationFrame(drift); }, { passive: true });
    drift();
  }

  // ── reveals, and the phone's order bar after the opening""")
io.open('index.html', 'w', encoding='utf8', newline='').write(s)
print('ok')
