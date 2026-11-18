// -----------------------------------------
// BLACK FRIDAY 2026 PAGE (black-friday.html)
// Loaded on every page, so the Black Friday page works however it's reached: a direct visit,
// or a page transition from the menu or footer. Does nothing on other pages.
// - Fills in the places counter from the page's data-bf-claimed / data-bf-places / data-bf-closes
// - Closes the offer once every place is claimed or the closing time has passed
// - "Claim Option N" buttons (and ?option=N in a link) pick that option in the form
// - Sends the claim form to /api/send, which emails it to the team
// -----------------------------------------
(function () {
  var DEFAULTS = { claimed: 0, places: 25, closesAt: '2026-12-01T00:00:00Z' };
  var PHONE = '021 203 2041';

  function readOffer(page) {
    var settings = page.dataset;
    var places = Math.round(Number(settings.bfPlaces));
    if (!isFinite(places) || places < 1) places = DEFAULTS.places;
    var claimed = Math.round(Number(settings.bfClaimed));
    if (!isFinite(claimed) || claimed < 0) claimed = 0;
    claimed = Math.min(claimed, places);
    var closesAt = Date.parse(settings.bfCloses || DEFAULTS.closesAt);
    var soldOut = claimed >= places;
    var ended = !isNaN(closesAt) && Date.now() >= closesAt;
    return { claimed: claimed, places: places, left: places - claimed, soldOut: soldOut, closed: soldOut || ended };
  }

  function each(root, selector, fn) {
    Array.prototype.forEach.call(root.querySelectorAll(selector), fn);
  }

  function setText(root, key, value) {
    each(root, '[data-bf="' + key + '"]', function (el) { el.textContent = value; });
  }

  function renderCounts(page, offer) {
    setText(page, 'claimed', String(offer.claimed));
    setText(page, 'left', String(offer.left));
    setText(page, 'places', String(offer.places));
    setText(page, 'gone', offer.claimed === 0
      ? 'All ' + offer.places + ' places are still open.'
      : offer.claimed === 1 ? '1 place is already gone.' : offer.claimed + ' places are already gone.');

    each(page, '[data-bf-cells]', function (group) {
      // One block per place, whatever the total is set to
      while (group.children.length < offer.places) group.appendChild(document.createElement('span'));
      while (group.children.length > offer.places) group.removeChild(group.lastElementChild);
      Array.prototype.forEach.call(group.children, function (cell, i) {
        cell.classList.toggle('is-filled', i < offer.claimed);
      });
      group.setAttribute('aria-label', offer.claimed + ' of ' + offer.places + ' places claimed');
    });
  }

  function closeOffer(page, offer) {
    page.classList.add('is-closed');
    each(page, '[data-bf-open]', function (el) { el.hidden = true; });
    each(page, '[data-bf-closed]', function (el) { el.hidden = false; });
    setText(page, 'closed-reason', offer.soldOut
      ? 'All ' + offer.places + ' half-price places have been claimed.'
      : 'The offer ended at 11:59pm on Monday 30 November.');
    each(page, '[data-bf-left-label]', function (el) { el.textContent = 'Offer closed'; });
    each(page, '[data-bf-cta]', function (el) { el.textContent = 'Talk to us about a website'; });
    each(page, '[data-bf-cta-short]', function (el) { el.textContent = 'Talk to us'; });
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function scrollToEl(el) {
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function selectOption(page, value) {
    if (!/^[123]$/.test(String(value))) return null;
    var input = page.querySelector('input[name="option"][value="' + value + '"]');
    if (input) input.checked = true;
    return input;
  }

  // Same-page links (#claim, #options): scroll below the fixed navbar and offer bar, and keep the
  // site runtime's own anchor scrolling out of it (it doesn't allow for the fixed header)
  function initAnchorLinks(page) {
    each(page, 'a[href^="#"]', function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href').slice(1);
        var target = id && document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();

        var picked = link.hasAttribute('data-bf-option') ? selectOption(page, link.getAttribute('data-bf-option')) : null;
        scrollToEl(target);
        if (history.replaceState) history.replaceState(null, '', '#' + id);

        var focusTarget = picked && !page.classList.contains('is-closed') ? picked : target;
        if (focusTarget === target && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        focusTarget.focus({ preventScroll: true });
      });
    });
  }

  function chosenOption(form) {
    var input = form.querySelector('input[name="option"]:checked');
    if (!input) return null;
    return {
      number: input.value,
      name: input.getAttribute('data-name'),
      price: Number(input.getAttribute('data-price')),
    };
  }

  function trackLead(option) {
    try {
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Lead', { content_name: 'Black Friday: ' + option.name, value: option.price, currency: 'EUR' });
      }
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'generate_lead', { currency: 'EUR', value: option.price, lead_source: 'black_friday', item_name: option.name });
      }
    } catch (err) { /* tracking must never break the form */ }
  }

  function initForm(page) {
    var form = page.querySelector('[data-bf-form]');
    var done = page.querySelector('[data-bf-done]');
    if (!form || !done) return;

    var status = form.querySelector('[data-bf-status]');
    var button = form.querySelector('button[type="submit"]');
    var label = button.querySelector('[data-bf-submit-label]');
    var idleLabel = label.textContent;
    var sending = false;

    function showError(message) {
      status.textContent = message;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      showError('');

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var turnstile = window.bwTurnstile;
      var token = turnstile ? turnstile.token(form) : '';
      if (turnstile && turnstile.required(form) && !token) {
        showError('Please complete the security check.');
        return;
      }

      var option = chosenOption(form);
      var fields = form.elements;
      var payload = {
        type: 'black-friday',
        option: option ? option.number : '',
        name: fields.name.value,
        business: fields.business.value,
        email: fields.email.value,
        phone: fields.phone.value,
        website: fields.website.value,
        notes: fields.notes.value,
        turnstileToken: token,
      };

      sending = true;
      button.disabled = true;
      button.classList.add('is-sending');
      label.textContent = 'Sending…';

      fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (result) {
            if (!response.ok) {
              showError((result && result.error) || 'Something went wrong. Please try again, or call us on ' + PHONE + '.');
              return;
            }
            setText(done, 'done-name', payload.name.trim().split(/\s+/)[0] || payload.name.trim());
            setText(done, 'done-option', 'Option ' + option.number + ', ' + option.name + ' (€' + option.price.toLocaleString('en-IE') + ' ex VAT)');
            setText(done, 'done-email', payload.email.trim());
            form.hidden = true;
            done.hidden = false;
            scrollToEl(done);
            done.focus({ preventScroll: true });
            trackLead(option);
          });
        })
        .catch(function () {
          showError('Connection problem. Please check your internet and try again, or call us on ' + PHONE + '.');
        })
        .then(function () {
          sending = false;
          button.disabled = false;
          button.classList.remove('is-sending');
          label.textContent = idleLabel;
          if (turnstile) turnstile.reset(form);
        });
    });
  }

  function finePointer() {
    return window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  // Cards with a soft glow that follows the cursor (the CSS reads --mx / --my)
  function initSpotlights(page) {
    if (!finePointer()) return;
    each(page, '[data-bf-spot]', function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
        card.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
      });
    });
  }

  // Sections ease up into place as they scroll into view. Anything already on screen when the
  // page is set up just shows (no flicker); siblings follow each other with a short stagger.
  function initReveal(page) {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
    var items = page.querySelectorAll('.bf-reveal');
    if (!items.length) return;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    Array.prototype.forEach.call(items, function (el) {
      var group = Array.prototype.filter.call(el.parentNode.children, function (c) { return c.classList.contains('bf-reveal'); });
      el.style.setProperty('--bf-delay', Math.min(group.indexOf(el), 5) * 90 + 'ms');
      var r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) el.classList.add('is-shown');
      else observer.observe(el);
    });
    page.classList.add('bf-motion');
  }

  // A statement that lights up word by word as it scrolls up the screen
  function initWordReveal(page) {
    each(page, '[data-bf-words]', function (el) {
      if (el.classList.contains('is-words')) return;
      var words = [];
      (function split(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType === 1) { split(child); return; }
          if (child.nodeType !== 3) return;
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var span = document.createElement('span');
            span.className = 'bf-word';
            span.textContent = part;
            words.push(span);
            frag.appendChild(span);
          });
          node.replaceChild(frag, child);
        });
      })(el);
      if (prefersReducedMotion() || !words.length) return;

      el.classList.add('is-words');
      var ticking = false;
      function update() {
        ticking = false;
        if (!el.isConnected) { window.removeEventListener('scroll', onScroll); return; }
        var rect = el.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var progress = Math.max(0, Math.min(1, (vh * 0.9 - rect.top) / (vh * 0.45)));
        var lit = Math.round(progress * words.length);
        words.forEach(function (w, i) { w.classList.toggle('is-lit', i < lit); });
      }
      function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      update();
    });
  }

  // FAQ: one answer open at a time. Opening a question closes the one that was open, and both
  // slide smoothly instead of snapping (instantly when the visitor prefers reduced motion).
  function initFaq(page) {
    var controls = Array.prototype.map.call(page.querySelectorAll('.bf-faq__item'), function (item) {
      var answer = item.querySelector('.bf-faq__answer');
      var ctl = { item: item, open: item.open, anim: null };

      ctl.set = function (open) {
        ctl.open = open;
        if (prefersReducedMotion() || !answer || !answer.animate) {
          if (ctl.anim) ctl.anim.cancel();
          item.open = open;
          return;
        }
        var from = item.open ? answer.getBoundingClientRect().height : 0;
        if (open) item.open = true;
        var to = open ? answer.scrollHeight : 0;
        if (ctl.anim) ctl.anim.cancel();
        var anim = answer.animate(
          { height: [from + 'px', to + 'px'], opacity: [open ? 0.2 : 1, open ? 1 : 0] },
          { duration: open ? 420 : 320, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }
        );
        ctl.anim = anim;
        anim.onfinish = function () {
          if (ctl.anim === anim) ctl.anim = null;
          if (!ctl.open) item.open = false;
        };
      };
      return ctl;
    });

    controls.forEach(function (ctl) {
      var summary = ctl.item.querySelector('summary');
      if (!summary) return;
      summary.addEventListener('click', function (e) {
        e.preventDefault();
        var opening = !ctl.open;
        ctl.set(opening);
        if (!opening) return;
        controls.forEach(function (other) {
          if (other !== ctl && other.open) other.set(false);
        });
      });
    });
  }

  // ---------- Hero background: drifting tags, % signs and sparkles that react to the cursor ----------
  function initHeroFx(page) {
    var canvas = page.querySelector('[data-bf-fx]');
    if (!canvas || !canvas.getContext || canvas.getAttribute('data-bf-fx-ready')) return;
    canvas.setAttribute('data-bf-fx-ready', '1');
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var hero = canvas.parentNode;
    var still = prefersReducedMotion();
    var YELLOW = '#FFE32A';
    var CREAM = '#FFFCE1';
    var INK = '#0E100F';
    var LABELS = ['-50%', '50% OFF', 'SALE', 'HALF PRICE', '€750', 'BLACK FRIDAY', '25 ONLY', '-50%', 'DEAL'];
    var W = 0, H = 0, dpr = 1;
    var items = [], bursts = [], burstSprites = [];
    var pointer = { x: 0, y: 0, tx: 0, ty: 0, inside: false, glow: 0 };
    var raf = 0, last = 0, inView = true, started = false;
    var t0 = performance.now();
    var observers = [];

    function rand(a, b) { return a + Math.random() * (b - a); }

    function sprite(w, h) {
      var c = document.createElement('canvas');
      c.width = Math.ceil(w * dpr);
      c.height = Math.ceil(h * dpr);
      var x = c.getContext('2d');
      x.scale(dpr, dpr);
      return { c: c, x: x, w: w, h: h };
    }

    // Price tag with a pointed end and a punched hole. style: line | lineY | fill
    function tagSprite(label, size, style) {
      var font = '600 ' + size + 'px "Inter Tight", Inter, Arial, sans-serif';
      ctx.font = font;
      var tw = ctx.measureText(label).width;
      var h = size * 2.1, notch = h * 0.42, w = notch + size * 0.75 + tw + size * 0.9, pad = 3;
      var s = sprite(w + pad * 2, h + pad * 2), x = s.x, r = Math.min(8, h * 0.22);
      x.translate(pad, pad);
      x.beginPath();
      x.moveTo(notch, 0);
      x.lineTo(w - r, 0);
      x.quadraticCurveTo(w, 0, w, r);
      x.lineTo(w, h - r);
      x.quadraticCurveTo(w, h, w - r, h);
      x.lineTo(notch, h);
      x.lineTo(0, h / 2);
      x.closePath();
      var colour = style === 'line' ? CREAM : YELLOW;
      if (style === 'fill') { x.fillStyle = YELLOW; x.fill(); }
      else { x.lineWidth = 1.5; x.strokeStyle = colour; x.stroke(); }
      x.beginPath();
      x.arc(notch * 0.62, h / 2, h * 0.09, 0, Math.PI * 2);
      if (style === 'fill') {
        x.globalCompositeOperation = 'destination-out';
        x.fill();
        x.globalCompositeOperation = 'source-over';
      } else {
        x.stroke();
      }
      x.font = font;
      x.textBaseline = 'middle';
      x.fillStyle = style === 'fill' ? INK : colour;
      x.fillText(label, notch + size * 0.75, h / 2 + size * 0.05);
      return s;
    }

    function glyphSprite(ch, size, style) {
      var font = '700 ' + size + 'px "Inter Tight", Inter, Arial, sans-serif';
      ctx.font = font;
      var tw = ctx.measureText(ch).width;
      var s = sprite(tw + 8, size * 1.25 + 8), x = s.x;
      x.font = font;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      if (style === 'fill') { x.fillStyle = YELLOW; x.fillText(ch, s.w / 2, s.h / 2); }
      else { x.lineWidth = 1.5; x.strokeStyle = style === 'lineY' ? YELLOW : CREAM; x.strokeText(ch, s.w / 2, s.h / 2); }
      return s;
    }

    function sparkSprite(size, style) {
      var s = sprite(size + 4, size + 4), x = s.x, c = s.w / 2, r = size / 2;
      x.beginPath();
      x.moveTo(c, c - r);
      x.quadraticCurveTo(c, c, c + r, c);
      x.quadraticCurveTo(c, c, c, c + r);
      x.quadraticCurveTo(c, c, c - r, c);
      x.quadraticCurveTo(c, c, c, c - r);
      x.fillStyle = style === 'line' ? CREAM : YELLOW;
      x.fill();
      return s;
    }

    function makeItem() {
      var depth = rand(0.35, 1);
      var baseStyle = Math.random() < 0.28 ? 'lineY' : 'line';
      var roll = Math.random(), base, hot;
      if (roll < 0.5) {
        var label = LABELS[(Math.random() * LABELS.length) | 0];
        var size = Math.round(10 + depth * 9);
        base = tagSprite(label, size, baseStyle);
        hot = tagSprite(label, size, 'fill');
      } else if (roll < 0.72) {
        var gs = Math.round(26 + depth * 46);
        base = glyphSprite('%', gs, baseStyle);
        hot = glyphSprite('%', gs, 'fill');
      } else {
        var ss = Math.round(8 + depth * 14);
        base = sparkSprite(ss, baseStyle);
        hot = sparkSprite(ss, 'fill');
      }
      return {
        base: base, hot: hot, depth: depth,
        x: rand(0, W), y: rand(0, H),
        vy: rand(9, 20) * depth,
        sway: rand(6, 18), swaySpeed: rand(0.25, 0.6), phase: rand(0, Math.PI * 2),
        rot: rand(-0.5, 0.5), rotAmp: rand(0.08, 0.25), rotSpeed: rand(0.2, 0.5),
        alpha: 0.12 + depth * 0.2,
        ox: 0, oy: 0, heat: 0,
      };
    }

    function count() {
      return Math.round(Math.min(46, Math.max(16, (W * H) / 28000)));
    }

    function stamp(s, x, y, rot, scale, alpha) {
      if (alpha <= 0.004) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
      ctx.restore();
    }

    // Yellow glow and a dot grid that appear around the cursor
    function drawPointer() {
      if (pointer.glow < 0.01) return;
      var g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 300);
      g.addColorStop(0, 'rgba(255, 227, 42, ' + (0.11 * pointer.glow).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255, 227, 42, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(pointer.x - 300, pointer.y - 300, 600, 600);
      var S = 26, R = 220;
      var x0 = Math.floor((pointer.x - R) / S) * S, y0 = Math.floor((pointer.y - R) / S) * S;
      for (var gx = x0; gx <= pointer.x + R; gx += S) {
        for (var gy = y0; gy <= pointer.y + R; gy += S) {
          var dx = gx - pointer.x, dy = gy - pointer.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d > R) continue;
          var a = 1 - d / R;
          ctx.fillStyle = 'rgba(255, 252, 225, ' + (a * a * 0.5 * pointer.glow).toFixed(3) + ')';
          ctx.fillRect(gx - 1, gy - 1, 2, 2);
        }
      }
    }

    function drawStill() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      items.forEach(function (it) { stamp(it.base, it.x, it.y, it.rot, 1, it.alpha); });
    }

    function frame(now) {
      raf = 0;
      if (!canvas.isConnected) { teardown(); return; }
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      var t = (now - t0) / 1000;

      pointer.x += (pointer.tx - pointer.x) * 0.14;
      pointer.y += (pointer.ty - pointer.y) * 0.14;
      pointer.glow += ((pointer.inside ? 1 : 0) - pointer.glow) * 0.08;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawPointer();

      var px = W ? pointer.x / W - 0.5 : 0, py = H ? pointer.y / H - 0.5 : 0;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        it.y -= it.vy * dt;
        if (it.y < -90) { it.y = H + rand(20, 120); it.x = rand(0, W); }
        var bx = it.x + Math.sin(t * it.swaySpeed + it.phase) * it.sway - px * 34 * it.depth * pointer.glow;
        var by = it.y - py * 22 * it.depth * pointer.glow;

        var tx = 0, ty = 0, heat = 0;
        if (pointer.glow > 0.01) {
          var dx = bx - pointer.x, dy = by - pointer.y, d = Math.sqrt(dx * dx + dy * dy) || 1, R = 200;
          if (d < R) {
            var f = 1 - d / R;
            f *= f;
            tx = (dx / d) * f * 80 * it.depth;
            ty = (dy / d) * f * 80 * it.depth;
            heat = Math.min(1, f * 1.8) * pointer.glow;
          }
        }
        it.ox += (tx - it.ox) * 0.09;
        it.oy += (ty - it.oy) * 0.09;
        it.heat += (heat - it.heat) * 0.12;

        var rot = it.rot + Math.sin(t * it.rotSpeed + it.phase) * it.rotAmp + it.ox * 0.004;
        var scale = 1 + it.heat * 0.18;
        stamp(it.base, bx + it.ox, by + it.oy, rot, scale, it.alpha * (1 - it.heat * 0.7));
        if (it.heat > 0.02) stamp(it.hot, bx + it.ox, by + it.oy, rot, scale, (0.5 + it.alpha) * it.heat);
      }

      for (var b = bursts.length - 1; b >= 0; b--) {
        var p = bursts[b];
        p.life += dt;
        if (p.life >= p.ttl) { bursts.splice(b, 1); continue; }
        p.vy += 560 * dt;
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        var k = p.life / p.ttl;
        stamp(p.s, p.x, p.y, p.rot, p.scale, 1 - k * k);
      }

      schedule();
    }

    function schedule() {
      if (still || raf || !inView || document.hidden || !started) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function resize() {
      var r = hero.getBoundingClientRect();
      var nw = Math.round(r.width), nh = Math.round(r.height);
      if (!nw || !nh) return;
      var sx = W ? nw / W : 1, sy = H ? nh / H : 1;
      W = nw;
      H = nh;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      items.forEach(function (it) { it.x *= sx; it.y *= sy; });
      var want = count();
      while (items.length < want) items.push(makeItem());
      if (items.length > want) items.length = want;
      if (still) drawStill();
      else schedule();
    }

    function local(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function onMove(e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      var p = local(e);
      pointer.tx = p.x;
      pointer.ty = p.y;
      if (!pointer.inside) { pointer.x = p.x; pointer.y = p.y; }
      pointer.inside = true;
      schedule();
    }

    function onLeave() { pointer.inside = false; }

    // A click or tap on the background throws a handful of yellow tags
    function onClick(e) {
      if (still || e.target.closest('a, button, input, label, select, textarea')) return;
      var p = local(e);
      for (var i = 0; i < 14; i++) {
        var a = rand(0, Math.PI * 2), sp = rand(170, 430);
        bursts.push({
          s: burstSprites[(Math.random() * burstSprites.length) | 0],
          x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 170,
          rot: rand(-1, 1), vr: rand(-4, 4), life: 0, ttl: rand(1.0, 1.6), scale: rand(0.75, 1.1),
        });
      }
      if (bursts.length > 140) bursts.splice(0, bursts.length - 140);
      schedule();
    }

    function onVisibility() { schedule(); }

    function teardown() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      observers.forEach(function (o) { o.disconnect(); });
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
    }

    function start() {
      if (!canvas.isConnected) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      burstSprites = [
        tagSprite('-50%', 13, 'fill'), tagSprite('SALE', 12, 'fill'), tagSprite('50% OFF', 12, 'fill'),
        glyphSprite('%', 30, 'fill'), sparkSprite(16, 'fill'), sparkSprite(10, 'fill'),
      ];
      started = true;
      resize();
      canvas.classList.add('is-ready');

      if ('ResizeObserver' in window) {
        var ro = new ResizeObserver(resize);
        ro.observe(hero);
        observers.push(ro);
      } else {
        window.addEventListener('resize', resize);
      }
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          inView = entries[0].isIntersecting;
          schedule();
        });
        io.observe(hero);
        observers.push(io);
      }
      document.addEventListener('visibilitychange', onVisibility);
      if (!still) {
        hero.addEventListener('pointermove', onMove);
        hero.addEventListener('pointerleave', onLeave);
        hero.addEventListener('click', onClick);
      }
    }

    // Wait (briefly) for the display font so the tags are drawn in it
    var fontsReady = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('600 16px "Inter Tight"'), document.fonts.load('700 40px "Inter Tight"')]).catch(function () {})
      : Promise.resolve();
    Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1200); })]).then(start);
  }

  function init(root) {
    var page = (root || document).querySelector('[data-bf-page]');
    if (!page || page.getAttribute('data-bf-ready')) return;
    page.setAttribute('data-bf-ready', '1');

    var offer = readOffer(page);
    renderCounts(page, offer);
    if (offer.closed) closeOffer(page, offer);
    initAnchorLinks(page);
    initReveal(page);
    initSpotlights(page);
    initWordReveal(page);
    initFaq(page);
    initHeroFx(page);

    var preset = new URLSearchParams(window.location.search).get('option');
    if (preset) selectOption(page, preset);

    if (!offer.closed) initForm(page);
  }

  // Set the page up before it fades in, so the right count and open/closed state are there
  // from the first frame of the transition
  if (window.barba && window.barba.hooks) {
    window.barba.hooks.beforeEnter(function (data) {
      if (data && data.next && data.next.container) init(data.next.container);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
