# The two "wow" pieces for The Whipped Cup (Tzvi, 19 Oct 2026: "doesn't seem
# so wow"). Imported by build.py.
# 1. HERO2: her strongest real photo full screen (four Caramel Cloud jars in
#    the Jerusalem sun), the headline over its shaded side.
# 2. POUR: her own "how do you use it?" as a pinned scroll scene. A glass
#    drawn in her menu card's illustrated style fills as you scroll: ice drops
#    in, cold milk rises, the whipped cloud lands and swirls into the milk.
#    A drawing like her card, never presented as a photo of the drink.

HERO2 = '''  <section class="hero2" id="open" aria-labelledby="h-open">
    <img class="bg" src="assets/caramel-window.webp" alt="Four jars of Caramel Cloud on a sunny windowsill in Jerusalem" width="1160" height="1122" fetchpriority="high">
    <div class="wrap">
      <p class="kick">Ramat Eshkol · Jerusalem</p>
      <h1 id="h-open"><span class="w">Whipped coffee</span> <span class="w">in a jar,</span> <span class="w soft">made fresh in Jerusalem</span></h1>
      <p class="lede">Cloud-like Dalgona coffee, hand-whipped to order and delivered to your door. Each jar makes 3 to 4 coffees.</p>
      <div class="act">
        <a class="btn light" href="order.html">Order your jars <span class="arw" aria-hidden="true">→</span></a>
        <p class="proof"><b>From ₪40</b> a jar<br>Kosher certified</p>
      </div>
    </div>
    <span class="scroll-hint" aria-hidden="true">Scroll</span>
  </section>
'''

POUR = '''  <section class="pour" id="pour" aria-labelledby="h-how">
    <div class="pour-stage">
      <div class="wrap pour-grid">
        <div class="pour-copy">
          <p class="kick">How do you use it?</p>
          <h2 id="h-how">Instant coffee whipped into a thick, creamy <span class="pink">cloud</span>, ready in your fridge.</h2>
          <ol class="pour-steps">
            <li data-s="0"><span class="n">1</span>Fill your glass with ice</li>
            <li data-s="1"><span class="n">2</span>Pour in cold milk</li>
            <li data-s="2"><span class="n">3</span>Add whipped coffee as desired</li>
          </ol>
          <p class="pour-note">Each jar makes 3 to 4 coffees.</p>
        </div>
        <svg class="glass" viewBox="0 0 300 420" role="img" aria-label="Drawing of an iced whipped coffee being made: ice, then milk, then the whipped coffee on top">
          <defs>
            <clipPath id="inside"><path d="M62 70 L238 70 L218 384 Q216 398 202 398 L98 398 Q84 398 82 384 Z"/></clipPath>
            <linearGradient id="milk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF8F2"/><stop offset="1" stop-color="#F3E3D8"/></linearGradient>
            <linearGradient id="cof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C98E5E"/><stop offset="1" stop-color="#8A5530"/></linearGradient>
          </defs>
          <ellipse cx="150" cy="404" rx="96" ry="9" fill="#33170C" opacity=".12"/>
          <g clip-path="url(#inside)">
            <rect id="milk-fill" x="40" y="400" width="220" height="340" fill="url(#milk)"/>
            <g id="swirl" opacity="0">
              <path d="M80 0 C 120 30, 70 60, 120 90 S 150 150, 110 190" stroke="#B9875E" stroke-width="10" fill="none" stroke-linecap="round" opacity=".55"/>
              <path d="M170 0 C 200 40, 150 80, 190 120 S 210 170, 170 220" stroke="#A8744A" stroke-width="8" fill="none" stroke-linecap="round" opacity=".5"/>
              <path d="M130 0 C 150 30, 120 70, 150 110" stroke="#C99569" stroke-width="7" fill="none" stroke-linecap="round" opacity=".45"/>
            </g>
            <g id="ice">
              <rect class="cube" x="86" y="300" width="58" height="54" rx="12"/>
              <rect class="cube" x="150" y="296" width="60" height="56" rx="12" transform="rotate(8 180 324)"/>
              <rect class="cube" x="110" y="244" width="56" height="52" rx="12" transform="rotate(-10 138 270)"/>
              <rect class="cube" x="164" y="236" width="52" height="50" rx="11" transform="rotate(14 190 261)"/>
              <rect class="cube" x="96" y="190" width="54" height="50" rx="11" transform="rotate(6 123 215)"/>
            </g>
          </g>
          <g id="cloud" transform="translate(0 -260)">
            <path d="M84 92 C 70 62, 104 40, 124 56 C 132 30, 176 28, 186 54 C 208 40, 236 62, 220 90 C 240 98, 232 122, 210 118 L 92 118 C 66 122, 62 98, 84 92 Z" fill="url(#cof)"/>
            <path d="M104 74 C 118 62, 140 70, 150 62 C 164 70, 184 60, 196 74" stroke="#E6B98C" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
          </g>
          <path d="M60 66 L240 66 L219 386 Q217 402 201 402 L99 402 Q83 402 81 386 Z" fill="none" stroke="#33170C" stroke-width="5" stroke-linejoin="round"/>
          <path d="M74 86 L90 360" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>
          <rect x="182" y="10" width="12" height="150" rx="6" fill="#F07DA4" transform="rotate(14 188 85)" id="straw" opacity="0"/>
        </svg>
      </div>
    </div>
  </section>
'''

POUR_JS = '''<script>
// The pour: scroll drives three beats, one per step of her card. Reduced
// motion shows the finished glass and all three steps.
(function () {
  var sec = document.getElementById('pour'); if (!sec) return;
  var cubes = [].slice.call(sec.querySelectorAll('.cube')), milk = document.getElementById('milk-fill'), cloud = document.getElementById('cloud');
  var swirl = document.getElementById('swirl'), straw = document.getElementById('straw'), steps = [].slice.call(sec.querySelectorAll('.pour-steps li'));
  var clamp = function (v) { return Math.max(0, Math.min(1, v)); }, ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  var bounce = function (t) { t = clamp(t); var s = 1.4; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
  function draw(p) {
    cubes.forEach(function (c, i) {
      var t = bounce((p - i * .05) / .16);
      c.style.transform = 'translateY(' + ((1 - t) * -360) + 'px)'; c.style.opacity = t > 0 ? 1 : 0;
    });
    var m = ease(clamp((p - .36) / .26));
    milk.setAttribute('y', (400 - m * 250).toFixed(1));
    var c = bounce((p - .68) / .16);
    cloud.setAttribute('transform', 'translate(0 ' + ((1 - c) * -260 + c * 30).toFixed(1) + ')');
    var s = ease(clamp((p - .82) / .16));
    swirl.setAttribute('opacity', (s * .95).toFixed(2));
    swirl.setAttribute('transform', 'translate(0 ' + (150 + s * 40).toFixed(1) + ')');
    straw.setAttribute('opacity', ease(clamp((p - .9) / .08)).toFixed(2));
    var on = p < .34 ? 0 : p < .66 ? 1 : 2;
    steps.forEach(function (li, i) { li.classList.toggle('on', i === on); li.classList.toggle('done', i < on); });
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(1); steps.forEach(function (li) { li.classList.add('done'); }); return; }
  var tick = 0;
  function frame() { tick = 0; var r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight; draw(clamp(-r.top / Math.max(1, span))); }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true });
  addEventListener('resize', frame); frame();
})();
</script>
'''

CSS = '''
/* ── the opening: her photo full screen (wow pass, 19 Oct 2026) ── */
.hero2 { position: relative; min-height: 100svh; display: grid; align-items: end; padding: calc(68px + 2rem) 0 clamp(2.5rem, 7vh, 5rem); overflow: hidden; color: var(--cream); isolation: isolate; }
.hero2 .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 60%; z-index: -2; animation: settle 2.4s var(--out) both; }
.hero2::before { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(90deg, rgb(42 20 11 / .82) 0%, rgb(42 20 11 / .55) 42%, rgb(42 20 11 / .05) 75%), linear-gradient(0deg, rgb(42 20 11 / .6), transparent 45%); }
@keyframes settle { from { transform: scale(1.12); filter: saturate(.7) brightness(.85); } to { transform: none; filter: none; } }
.hero2 .kick { background: rgb(255 255 255 / .16); color: var(--cream); backdrop-filter: blur(6px); }
.hero2 h1 { font-size: clamp(3rem, 7vw, 6.6rem); max-width: 12ch; color: var(--cream); line-height: .98; }
.hero2 h1 .w { display: inline-block; animation: rise 900ms var(--out) both; }
.hero2 h1 .w:nth-child(2) { animation-delay: 140ms; } .hero2 h1 .w:nth-child(3) { animation-delay: 280ms; }
.hero2 h1 .soft { font-style: italic; font-weight: 500; color: #F9C9D6; font-size: .62em; display: block; margin-top: .25em; }
@keyframes rise { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: none; } }
.hero2 .lede { margin: 1.2rem 0 1.8rem; max-width: 30rem; color: #F4E6E1; font-size: 1.15rem; }
.hero2 .proof { color: #F4E6E1; } .hero2 .proof b { color: #fff; }
.btn.light { background: var(--cream); color: var(--choc); }
.btn.light:hover { background: #fff; }
.scroll-hint { position: absolute; right: var(--gutter); bottom: 1.6rem; color: #F4E6E1; font: 700 .8rem/1 var(--font-body); letter-spacing: .2em; text-transform: uppercase; writing-mode: vertical-rl; }
.scroll-hint::after { content: ''; display: block; width: 1px; height: 48px; margin: .8rem auto 0; background: currentColor; animation: hint 1.8s ease-in-out infinite; transform-origin: top; }
@keyframes hint { 0%, 100% { transform: scaleY(.3); } 50% { transform: scaleY(1); } }
@media (max-width: 760px) { .hero2 .bg { object-position: 60% 50%; } .hero2::before { background: linear-gradient(0deg, rgb(42 20 11 / .88) 0%, rgb(42 20 11 / .5) 55%, rgb(42 20 11 / .1) 100%); } .scroll-hint { display: none; } }

/* ── the pour: her three steps, scroll-driven ── */
.pour { position: relative; height: 320svh; background: var(--blush); }
.pour-stage { position: sticky; top: 0; height: 100svh; display: grid; align-items: center; padding-top: 68px; overflow: hidden; }
.pour-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .9fr); gap: clamp(1.5rem, 5vw, 5rem); align-items: center; }
.pour h2 { font-size: clamp(1.9rem, 3.4vw, 3rem); margin-top: .8rem; max-width: 18ch; }
.pour-steps { list-style: none; margin: 1.8rem 0 0; padding: 0; display: grid; gap: .5rem; }
.pour-steps li { display: flex; align-items: center; gap: .9rem; padding: .8rem 1rem; border-radius: 16px; font: 700 1.15rem/1.3 var(--font-body); color: var(--soft);
  transition: background 300ms var(--out), color 300ms var(--out), transform 300ms var(--out); }
.pour-steps .n { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--paper); color: var(--choc); font: 700 1rem/1 var(--font-head); flex: none; transition: background 300ms; }
.pour-steps li.on { background: var(--paper); color: var(--choc); transform: translateX(8px); box-shadow: 0 12px 26px -18px rgb(51 23 12 / .5); }
.pour-steps li.on .n, .pour-steps li.done .n { background: var(--choc); color: var(--cream); }
.pour-steps li.done { color: var(--choc); }
.pour-note { margin: 1.2rem 0 0; color: var(--soft); }
.glass { width: 100%; max-width: min(380px, 62svh); margin-inline: auto; overflow: visible; }
.glass .cube { fill: rgb(255 255 255 / .55); stroke: rgb(51 23 12 / .25); stroke-width: 2; transform-box: fill-box; }
@media (max-width: 860px) {
  .pour-grid { grid-template-columns: 1fr; gap: .5rem; }
  .glass { order: -1; max-width: min(240px, 34svh); }
  .pour h2 { font-size: 1.45rem; } .pour .kick { display: none; }
  .pour-steps { margin-top: .8rem; } .pour-steps li { padding: .55rem .8rem; font-size: 1rem; } .pour-note { display: none; }
}
@media (prefers-reduced-motion: reduce) { .hero2 .bg, .hero2 h1 .w { animation: none; } .pour { height: auto; } .pour-stage { position: static; height: auto; padding-block: 5rem; } }
'''
