/*
 * Marks links converted by the Sovrn Commerce (VigLink) script as paid links.
 * VigLink rewrites an ordinary link to a redirect.viglink.com (or similar) URL
 * when a reader clicks it, which makes it an affiliate link. This adds
 * rel="sponsored" to any link whose href points at a VigLink/Sovrn redirect,
 * at load and whenever the href changes. It never changes, blocks or removes
 * a link, and it does not touch the VigLink script or its settings.
 */
(function () {
  var PAID = /^(https?:)?\/\/([a-z0-9-]+\.)*(viglink\.com|vglnk\.com|sovrn\.co|sovrn\.com)\//i;
  function mark(a) {
    if (!a || a.tagName !== 'A') return;
    var href = a.getAttribute('href') || '';
    if (!PAID.test(href)) return;
    var rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
    if (rel.indexOf('sponsored') === -1) {
      rel.push('sponsored');
      a.setAttribute('rel', rel.join(' '));
    }
  }
  function scan(root) {
    var links = (root || document).querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) mark(links[i]);
  }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === 'attributes') mark(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) {
          var n = r.addedNodes[j];
          if (n.nodeType === 1) { mark(n); scan(n); }
        }
      }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
  }
  // VigLink swaps the href on mousedown/click; mark it again right after.
  ['mousedown', 'click', 'auxclick', 'touchstart', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (a) setTimeout(function () { mark(a); }, 0);
    }, true);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scan(); });
  else scan();
})();
