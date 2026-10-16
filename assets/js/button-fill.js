// -----------------------------------------
// SHARED BUTTON HOVER: circle fill from the cursor
// Gives every call-to-action the same hover as the hero "Let's Talk" button (.btn):
// a circle grows from where the cursor enters and shrinks back toward where it leaves.
// Colours per button live in webflow.css (.bw-fx / --bw-fill). Uses event delegation,
// so buttons added later (header booking button, slider component) work too.
// -----------------------------------------
(function () {
  // hover: element that receives the pointer; target: element that gets the fill (inside hover, or itself)
  var BUTTONS = [
    { hover: '.bw-calendly-btn' },
    { hover: '.footer_cta_btn' },
    { hover: '.footer_ref_subscribe_btn' },
    { hover: '.footer_news_btn' },
    { hover: '.service_content_button' },
    { hover: '.button_main_wrap', target: '.button_main_element.w-variant-e85564cd-af30-a478-692b-71732aefb3ab' },
    { hover: '.form_submit_button' },
    { hover: '.contact_modal_action_btn' },
    { hover: '.tp_ghost' }
  ];
  var HOVER_SELECTOR = BUTTONS.map(function (b) { return b.hover; }).join(',');

  function targetFor(hoverEl) {
    for (var i = 0; i < BUTTONS.length; i++) {
      if (!hoverEl.matches(BUTTONS[i].hover)) continue;
      return BUTTONS[i].target ? hoverEl.querySelector(BUTTONS[i].target) : hoverEl;
    }
    return null;
  }

  function ensureFill(target) {
    var fill = target.querySelector(':scope > .bw-fx-fill');
    if (!fill) {
      target.classList.add('bw-fx');
      fill = document.createElement('span');
      fill.className = 'bw-fx-fill';
      fill.setAttribute('aria-hidden', 'true');
      target.insertBefore(fill, target.firstChild);
    }
    return fill;
  }

  // Same geometry as the hero button: start at the cursor, and size the circle so it
  // covers the far edge (wider when entering near an end)
  function placeFill(target, fill, e) {
    var r = target.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var x = ((e.clientX - r.left) / r.width) * 100;
    var y = ((e.clientY - r.top) / r.height) * 100;
    var fromCentre = Math.abs(((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 50);
    fill.style.left = x.toFixed(1) + '%';
    fill.style.top = y.toFixed(1) + '%';
    fill.style.width = (115 + fromCentre * 2).toFixed(1) + '%';
  }

  document.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var hoverEl = e.target.closest && e.target.closest(HOVER_SELECTOR);
    if (!hoverEl || (e.relatedTarget && hoverEl.contains(e.relatedTarget))) return;
    var target = targetFor(hoverEl);
    if (!target) return;
    var fill = ensureFill(target);
    placeFill(target, fill, e);
    void fill.offsetWidth; // start from scale(0) at the new position
    target.classList.add('is-hovered');
  });

  document.addEventListener('pointerout', function (e) {
    if (e.pointerType !== 'mouse') return;
    var hoverEl = e.target.closest && e.target.closest(HOVER_SELECTOR);
    if (!hoverEl || (e.relatedTarget && hoverEl.contains(e.relatedTarget))) return;
    var target = targetFor(hoverEl);
    if (!target || !target.classList.contains('bw-fx')) return;
    placeFill(target, ensureFill(target), e);
    target.classList.remove('is-hovered');
  });
})();
