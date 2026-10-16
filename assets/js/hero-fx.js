// -----------------------------------------
// HERO FX: cursor spotlight, dot-grid reveal and parallax for any .bw-hero-fx layer
// (the home hero). Mouse only, so phones and tablets just get the ambient animation.
// Listens on the document, so it keeps working after page transitions swap the content.
// -----------------------------------------
(function () {
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var EASE = 0.12; // share of the remaining distance covered each frame

  var fx = null; // the layer currently under the cursor
  var target = { x: 0, y: 0 };
  var current = { x: 0, y: 0 };
  var frame = 0;

  function layerFor(el) {
    var section = el && el.closest ? el.closest('section') : null;
    return section ? section.querySelector(':scope > .bw-hero-fx') : null;
  }

  function apply() {
    frame = 0;
    if (!fx || !fx.isConnected) return;
    var ease = reduceMotion.matches ? 1 : EASE;
    current.x += (target.x - current.x) * ease;
    current.y += (target.y - current.y) * ease;

    fx.style.setProperty('--mx', current.x.toFixed(1) + 'px');
    fx.style.setProperty('--my', current.y.toFixed(1) + 'px');
    var spot = fx.querySelector('.bw-fx-spot');
    if (spot) spot.style.transform = 'translate3d(' + current.x.toFixed(1) + 'px,' + current.y.toFixed(1) + 'px,0)';

    if (!reduceMotion.matches) {
      var rect = fx.getBoundingClientRect();
      var nx = rect.width ? current.x / rect.width - 0.5 : 0;
      var ny = rect.height ? current.y / rect.height - 0.5 : 0;
      fx.querySelectorAll('[data-depth]').forEach(function (layer) {
        var depth = Number(layer.getAttribute('data-depth')) || 0;
        layer.style.transform = 'translate3d(' + (nx * depth).toFixed(1) + 'px,' + (ny * depth).toFixed(1) + 'px,0)';
      });
    }

    if (Math.abs(target.x - current.x) > 0.4 || Math.abs(target.y - current.y) > 0.4) {
      frame = requestAnimationFrame(apply);
    }
  }

  function request() {
    if (!frame) frame = requestAnimationFrame(apply);
  }

  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || !finePointer.matches) return;
    var layer = layerFor(e.target);
    if (layer !== fx) {
      if (fx) fx.classList.remove('is-active');
      fx = layer;
      if (!fx) return;
      fx.classList.add('is-active');
      var r0 = fx.getBoundingClientRect();
      // Start where the cursor enters instead of sweeping in from the corner
      current.x = target.x = e.clientX - r0.left;
      current.y = target.y = e.clientY - r0.top;
    }
    if (!fx) return;
    var rect = fx.getBoundingClientRect();
    target.x = e.clientX - rect.left;
    target.y = e.clientY - rect.top;
    request();
  }, { passive: true });

  // Fade out when the mouse leaves the window
  document.addEventListener('pointerout', function (e) {
    if (!e.relatedTarget && fx) {
      fx.classList.remove('is-active');
      fx = null;
    }
  });
})();
