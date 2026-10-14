/* Adds drag / swipe, arrow and dot controls, autoplay progress and pause-on-hover to the
   service card cyclers (web-design.html, seo-ai-overview.html, paid-ads.html, social-media.html).
   Each page defines its own <*-cycler> element with an open shadow root and next(), previous(),
   render() and schedule() methods; this script layers the interactions on top without
   touching that code. */
(() => {
  const DRAG_THRESHOLD = 60; // px of horizontal drag needed to change card
  const DEFAULT_INTERVAL = 4000; // matches the cyclers' own default

  const css = `
    .stage { touch-action: pan-y; cursor: grab; user-select: none; -webkit-user-select: none; }
    .stage.is-dragging { cursor: grabbing; }
    .stage.is-dragging .card { transition: none !important; }
    .stage > button:not(.bw-ctl) { display: none !important; }
    .card { transition-property: transform, opacity, filter, box-shadow !important; }
    .card[aria-hidden="false"] {
      box-shadow: 0 2.5cqw 6cqw -2cqw rgba(247, 118, 24, 0.45), 0 1cqw 3cqw rgba(0, 0, 0, 0.35) !important;
    }

    .bw-controls {
      position: absolute; left: 50%; bottom: 2.5%; transform: translateX(-50%); z-index: 50;
      display: flex; align-items: center; gap: 10px; padding: 6px;
      border-radius: 999px; background: rgba(14, 16, 15, 0.78);
      -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
      box-shadow: 0 6px 20px -8px rgba(0, 0, 0, 0.5);
      cursor: default;
    }
    /* Undo the cyclers' own button rule (absolute, hidden until hover) for the new controls */
    .bw-controls button {
      position: relative; inset: auto; opacity: 1; margin: 0; font: inherit;
      border: 0; transition: background-color 0.2s ease, color 0.2s ease, width 0.35s ease;
    }
    .bw-ctl {
      width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%;
      display: grid; place-items: center; cursor: pointer;
      background: rgba(255, 252, 225, 0.1); color: #FFFCE1;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .bw-ctl:hover { background: #FFE32A; color: #0E100F; }
    .bw-ctl:focus-visible { outline: 2px solid #FFE32A; outline-offset: 2px; }
    .bw-ctl svg { width: 14px; height: 14px; display: block; }
    .bw-dots { display: flex; align-items: center; gap: 6px; }
    .bw-dot {
      position: relative; width: 7px; height: 7px; padding: 0; border: 0; border-radius: 999px;
      background: rgba(255, 252, 225, 0.35); cursor: pointer; overflow: hidden;
      transition: width 0.35s ease, background-color 0.2s ease;
    }
    .bw-dot:hover { background: rgba(255, 252, 225, 0.6); }
    .bw-dot.is-active { width: 26px; background: rgba(255, 252, 225, 0.25); }
    .bw-dot.is-active::after {
      content: ""; position: absolute; inset: 0; border-radius: inherit;
      background: linear-gradient(90deg, #ffb269, #f77618);
      transform-origin: left center; transform: scaleX(1);
    }
    .stage.is-playing .bw-dot.is-active::after { animation: bw-fill var(--bw-interval, 4000ms) linear both; }
    .stage.is-held .bw-dot.is-active::after { animation-play-state: paused; }
    @keyframes bw-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @media (prefers-reduced-motion: reduce) { .bw-dot.is-active::after { animation: none !important; } }
  `;

  const chevron = (dir) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir === 'prev' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}"/></svg>`;

  function enhance(el) {
    const root = el.shadowRoot;
    const stage = root && root.querySelector('.stage');
    if (!stage || stage.querySelector('.bw-controls')) return;
    const cards = () => Array.from(root.querySelectorAll('.card'));
    const count = cards().length;

    const style = document.createElement('style');
    style.textContent = css;
    root.appendChild(style);

    const label = stage.getAttribute('aria-label') || 'Cards';
    const controls = document.createElement('div');
    controls.className = 'bw-controls';
    controls.innerHTML =
      `<button type="button" class="bw-ctl" data-dir="prev" aria-label="Previous card">${chevron('prev')}</button>` +
      `<div class="bw-dots" role="tablist" aria-label="${label}">` +
      Array.from({ length: count }, (_, i) => `<button type="button" class="bw-dot" role="tab" aria-label="Card ${i + 1} of ${count}"></button>`).join('') +
      `</div>` +
      `<button type="button" class="bw-ctl" data-dir="next" aria-label="Next card">${chevron('next')}</button>`;
    stage.appendChild(controls);
    const dots = Array.from(controls.querySelectorAll('.bw-dot'));

    const interval = () => {
      const raw = Number(el.getAttribute('interval'));
      return Number.isFinite(raw) && raw >= 1500 ? raw : DEFAULT_INTERVAL;
    };
    stage.style.setProperty('--bw-interval', interval() + 'ms');

    // Keep dots in step with every render (autoplay, arrows, drag)
    const syncDots = () => {
      dots.forEach((dot, i) => {
        const active = i === el.index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', String(active));
      });
      // Restart the progress fill on the active dot
      const active = dots[el.index];
      if (active) { active.classList.remove('is-active'); void active.offsetWidth; active.classList.add('is-active'); }
    };
    const originalRender = el.render.bind(el);
    el.render = function () { originalRender(); syncDots(); };

    let held = false; // hovering or dragging
    const updatePlaying = () => {
      const playing = !el.hasAttribute('paused') && !(el.motion && el.motion.matches) && !held;
      stage.classList.toggle('is-playing', playing);
      stage.classList.toggle('is-held', held);
    };
    const hold = () => { held = true; clearInterval(el.timer); updatePlaying(); };
    const release = () => { held = false; el.schedule(); updatePlaying(); syncDots(); };

    const go = (fn) => { fn(); if (!held) el.schedule(); syncDots(); };
    controls.querySelector('[data-dir="prev"]').addEventListener('click', () => go(() => el.previous()));
    controls.querySelector('[data-dir="next"]').addEventListener('click', () => go(() => el.next()));
    dots.forEach((dot, i) => dot.addEventListener('click', () => go(() => { el.index = i; el.render(); })));

    // Pause while a mouse is over the cards
    stage.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hold(); });
    stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !dragging) release(); });

    // Drag / swipe
    let dragging = false, startX = 0, startY = 0, dx = 0, bases = [], decided = false, horizontal = false;
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.bw-controls')) return;
      dragging = true; decided = false; horizontal = false; dx = 0;
      startX = e.clientX; startY = e.clientY;
      bases = cards().map((c) => c.style.transform);
      hold();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const mx = e.clientX - startX, my = e.clientY - startY;
      if (!decided && (Math.abs(mx) > 6 || Math.abs(my) > 6)) {
        decided = true;
        horizontal = Math.abs(mx) > Math.abs(my);
        if (horizontal) { stage.classList.add('is-dragging'); stage.setPointerCapture(e.pointerId); }
        else { dragging = false; if (e.pointerType !== 'mouse') release(); return; }
      }
      if (!horizontal) return;
      dx = mx;
      cards().forEach((c, i) => {
        const front = c.getAttribute('aria-hidden') === 'false';
        const move = front ? dx : dx * 0.25;
        const tilt = front ? dx * 0.04 : 0;
        c.style.transform = `translateX(${move}px) rotate(${tilt}deg) ${bases[i]}`;
      });
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
      if (horizontal && Math.abs(dx) > DRAG_THRESHOLD) {
        dx < 0 ? el.next() : el.previous();
      } else {
        el.render(); // spring back
      }
      if (e.pointerType !== 'mouse' || !stage.matches(':hover')) release();
      else { syncDots(); updatePlaying(); }
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('lostpointercapture', endDrag);

    // Keyboard: arrows when focus is inside the cycler
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(() => el.previous()); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(() => el.next()); }
    });

    // The cycler's own schedule() also runs on visibility / intersection changes
    const originalSchedule = el.schedule.bind(el);
    el.schedule = function () {
      if (held) { clearInterval(this.timer); return; }
      originalSchedule();
      updatePlaying();
    };

    syncDots();
    updatePlaying();
  }

  function init() {
    document.querySelectorAll('*').forEach((node) => {
      if (node.tagName.toLowerCase().endsWith('-cycler') && node.shadowRoot) enhance(node);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
