/*
 * A designed page's questions and answers, in the owner's words, added
 * through "Ask for a change" in the dashboard (backend page_requests.py).
 * frontend/server.js adds this script and the list (#mir-live-faq) to any
 * page with a [data-mir-faq] element. The page supplies the look:
 *
 *   <section data-mir-faq hidden>
 *     <h2>...</h2>
 *     <div data-mir-qs></div>
 *     <template data-mir-q><details><summary data-f="q"></summary><p data-f="a"></p></details></template>
 *   </section>
 *
 * Text goes in as text, never as HTML. Hidden until there is a question.
 */
(function () {
  var holder = document.getElementById('mir-live-faq');
  if (!holder) return;
  var list;
  try { list = JSON.parse(holder.textContent || '[]'); } catch (e) { return; }
  if (!Array.isArray(list) || !list.length) return;
  [].forEach.call(document.querySelectorAll('[data-mir-faq]'), function (sec) {
    var box = sec.querySelector('[data-mir-qs]'), tpl = sec.querySelector('template[data-mir-q]');
    if (!box || !tpl) return;
    list.forEach(function (f) {
      if (!f || !f.q || !f.a) return;
      var node = tpl.content.firstElementChild.cloneNode(true);
      var q = node.querySelector('[data-f="q"]'), a = node.querySelector('[data-f="a"]');
      if (q) q.textContent = f.q;
      if (a) a.textContent = f.a;
      box.appendChild(node);
    });
    if (box.children.length) sec.hidden = false;
  });
})();
