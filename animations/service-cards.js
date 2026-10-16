/* Service card stack: <bw-service-cards service="web|seo|ads|social">
   One shared component for the four service sections (loaded inside the iframes in
   animations/*.html). Brand colours and type, the same card size in every section,
   autoplay while on screen, and drag / swipe with mouse, touch or pen. */
(() => {
  const SERVICES = {
    web: {
      name: 'Web design',
      cards: [
        ['Discovery call', 'We get clear on what you sell, who buys it, and what the site needs to do.', 'chat'],
        ['Sitemap, wireframes and design concepts', 'Structure agreed and direction chosen before we build anything.', 'layout'],
        ['Build on staging', 'You get a real link to click, not a surprise.', 'code'],
        ['Content, SEO and tracking', 'Copy in place and analytics wired in before launch.', 'chart'],
        ['Launch, training and 30 days of support', 'Live, handed over, and you know how to run it.', 'rocket']
      ]
    },
    seo: {
      name: 'SEO and AI search',
      cards: [
        ['Technical and on-page SEO', 'A site Google can crawl and rank, with the right pages built around the right keywords.', 'code'],
        ['Off-page and local SEO', 'Link building, digital PR, and Google Business Profile work so you show up nearby.', 'pin'],
        ['Content strategy', 'Pages and articles that answer real questions and match search intent.', 'layout'],
        ['AI visibility', 'Audit and track what ChatGPT, Gemini, and Google AI Overviews say about you versus competitors.', 'spark'],
        ['Entity and brand authority', 'Consistent, citable business information across the sources AI trusts.', 'network']
      ]
    },
    ads: {
      name: 'Paid advertising',
      cards: [
        ['Strategy first', 'We start with your funnel and margins, then build ads that fit, not just launch a campaign.', 'funnel'],
        ['Full funnel', 'Landing pages, tracking, and conversion measurement included, because clicks that do not convert are just spend.', 'layout'],
        ['Reporting you can read', 'One page a month in plain English, including what did not work.', 'chart'],
        ['Small senior team', 'The person who pitched you runs your campaigns, no handoff to a junior.', 'people'],
        ['You own everything', 'Your ad account, pixel, and history, documented and transferable if you leave.', 'code']
      ]
    },
    social: {
      name: 'Social media',
      cards: [
        ['Strategy and content pillars', 'What you say, to whom, and why it sells, agreed before anything posts.', 'layout'],
        ['Content creation', 'Short-form video first, shot, edited, and captioned for Reels, TikTok, and Shorts.', 'video'],
        ['Community management', 'Comments and DMs handled, enquiries routed to you fast.', 'chat'],
        ['Paid social amplification', 'The winners boosted to buyers, organic and paid as one funnel.', 'funnel'],
        ['Monthly reporting', 'Reach, engagement, and enquiries in plain English, plus what changes next.', 'chart']
      ]
    }
  };

  const ICONS = {
    chat: 'M4 5h16v12H9l-5 4V5z M8 10h1m3 0h1m3 0h1',
    layout: 'M3 3h18v18H3z M3 8h18 M10 8v13',
    code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',
    chart: 'M4 21V13h4v8m3 0V8h4v13m3 0V3h4v18',
    rocket: 'M8 15c0-8 5-12 13-12 0 8-4 13-12 13L8 15z M8 9H4l-2 7 6-1m7 1v4l-7 2 1-6M5 19l-3 3',
    funnel: 'M2 4h20l-8 10v7l-4-3v-4L2 4z',
    people: 'M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6m8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 21v-5a6 6 0 0 1 12 0v5m0-10a6 6 0 0 1 8 5v5',
    pin: 'M12 22S3 13 3 9a9 9 0 0 1 18 0c0 4-9 13-9 13z M12 6v5',
    spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
    network: 'M9 9h6v6H9zM2 2h4v4H2zm16 0h4v4h-4zM2 18h4v4H2zm16 0h4v4h-4zM6 6l3 3m6 6 3 3M6 18l3-3m6-6 3-3',
    video: 'M4 2h16v20H4z m5 5 7 5-7 5z'
  };

  const INTERVAL = 4500; // ms per card while autoplaying
  const DRAG_RATIO = 0.18; // drag this share of the card width to change card

  // Shadow DOM can't declare fonts, so the iframe document gets the site's self-hosted ones
  function ensureFonts() {
    if (document.getElementById('bw-service-cards-fonts')) return;
    const style = document.createElement('style');
    style.id = 'bw-service-cards-fonts';
    style.textContent = [
      ['Inter', 400, 'Inter-Regular'],
      ['Inter', 500, 'Inter-Medium'],
      ['Inter', 600, 'Inter-SemiBold'],
      ['Inter Tight', 600, 'InterTight-600']
    ].map(([family, weight, file]) =>
      `@font-face{font-family:"${family}";src:url("/assets/fonts/${file}.woff2") format("woff2");font-weight:${weight};font-style:normal;font-display:swap}`
    ).join('');
    document.head.appendChild(style);
  }

  const icon = (kind) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[kind]}"/></svg>`;

  // The illustration panel at the foot of each card
  function art(kind, i) {
    const grad = `<defs><linearGradient id="bwg${i}" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#FFF6B8"/><stop offset="1" stop-color="#FFE32A"/></linearGradient></defs>`;
    const visual = kind === 'chart'
      ? `<path d="M40 128V96h24v32m22 0V72h24v56m22 0V50h24v78m22 0V28h24v100" fill="none" stroke="url(#bwg${i})" stroke-width="16" stroke-linecap="round"/>`
      : `<g transform="translate(86 14) scale(4)" fill="none" stroke="url(#bwg${i})" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[kind]}"/></g>`;
    return `<svg viewBox="0 0 280 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${grad}${visual}<rect x="70" y="124" width="140" height="6" rx="3" fill="#FFFCE1" opacity=".16"/><rect x="100" y="136" width="80" height="6" rx="3" fill="#FFFCE1" opacity=".09"/></svg>`;
  }

  const CSS = `
    :host { display: block; width: 100%; height: 100%; }
    * { box-sizing: border-box; }

    .stage {
      position: relative; width: 100%; height: 100%; overflow: hidden;
      container-type: size; isolation: isolate;
      touch-action: pan-y; user-select: none; -webkit-user-select: none;
      cursor: grab; -webkit-tap-highlight-color: transparent;
    }
    .stage.is-dragging { cursor: grabbing; }

    /* Card size depends only on the frame, so every section shows the same card */
    .card {
      --w: min(50cqw, 62cqh);
      position: absolute; left: 50%; top: 45%;
      width: var(--w); aspect-ratio: 4 / 5;
      container-type: inline-size;
      display: flex; flex-direction: column;
      /* Measured from the card width (--w): cq units on the card itself would refer to the frame */
      padding: calc(var(--w) * 0.075) calc(var(--w) * 0.07) calc(var(--w) * 0.065);
      border-radius: clamp(16px, calc(var(--w) * 0.08), 28px);
      border: 1px solid rgba(255, 227, 42, 0.42);
      /* Glossy, brushed-metal finish in brand colours: near-black into bronze-gold, catching
         pale yellow light at the lower corner */
      background:
        linear-gradient(155deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0) 28%),
        linear-gradient(155deg, #070806 8%, #2B2706 50%, #B89A0C 79%, #FFF3B0 100%);
      color: #FFFCE1;
      box-shadow: 0 30px 60px -28px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      transform-origin: 50% 85%;
      transition: transform 0.85s cubic-bezier(0.22, 0.8, 0.22, 1), filter 0.85s ease, opacity 0.85s ease;
      will-change: transform;
    }
    .stage.is-dragging .card { transition: none; }

    .card_top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7cqi; }
    .icon {
      display: grid; place-items: center; flex: none;
      width: 14cqi; height: 14cqi; border-radius: 4cqi;
      background: #FFFCE1; color: #0E100F;
      box-shadow: 0 1cqi 3cqi rgba(0, 0, 0, 0.3);
    }
    .icon svg { width: 7.5cqi; height: 7.5cqi; }
    .step { font: 600 clamp(10px, 3.6cqi, 13px)/1 "Inter", system-ui, sans-serif; letter-spacing: 0.12em; color: rgba(255, 252, 225, 0.5); }

    .card h3 {
      margin: 0 0 3.5cqi;
      font: 600 clamp(16px, 9.5cqi, 32px)/1.15 "Inter Tight", "Inter", system-ui, sans-serif;
      letter-spacing: -0.015em; text-wrap: balance;
    }
    .card p {
      margin: 0;
      font: 400 clamp(13px, 5.8cqi, 18px)/1.5 "Inter", system-ui, sans-serif;
      color: #EFE6C6;
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden;
    }

    .art {
      flex: 0 1 34%; min-height: 0; margin-top: auto; padding-top: 1px;
      border-radius: 4.5cqi; overflow: hidden;
      border: 1px solid rgba(255, 227, 42, 0.22);
      background:
        radial-gradient(at 95% 0%, rgba(255, 227, 42, 0.75), rgba(255, 227, 42, 0) 62%),
        linear-gradient(140deg, #3A3306, #050505 80%);
      display: grid; place-items: center;
    }
    .art_inner { width: 100%; height: 100%; display: grid; place-items: center; }
    .art svg { width: 82%; height: 82%; display: block; }

    /* Controls */
    .controls {
      position: absolute; left: 50%; bottom: 3.5cqh; transform: translateX(-50%); z-index: 50;
      display: flex; align-items: center; gap: 10px; padding: 6px;
      border-radius: 999px; background: rgba(14, 16, 15, 0.84);
      border: 1px solid rgba(255, 252, 225, 0.08);
      -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
      cursor: default;
    }
    .ctl {
      width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%;
      display: grid; place-items: center; cursor: pointer;
      background: rgba(255, 252, 225, 0.1); color: #FFFCE1;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .ctl svg { width: 14px; height: 14px; display: block; }
    .ctl:focus-visible, .dot:focus-visible { outline: 2px solid #FFE32A; outline-offset: 2px; }
    @media (hover: hover) { .ctl:hover { background: #FFE32A; color: #0E100F; } }
    .dots { display: flex; align-items: center; gap: 6px; }
    .dot {
      position: relative; width: 7px; height: 7px; padding: 0; border: 0; border-radius: 999px; overflow: hidden;
      background: rgba(255, 252, 225, 0.32); cursor: pointer;
      transition: width 0.35s ease, background-color 0.2s ease;
    }
    .dot.is-active { width: 26px; background: rgba(255, 252, 225, 0.18); }
    .dot.is-active::after {
      content: ""; position: absolute; inset: 0; border-radius: inherit; background: #FFE32A;
      transform-origin: left center; transform: scaleX(1);
    }
    .stage.is-playing .dot.is-active::after { animation: bwFill var(--interval) linear both; }
    .stage.is-held .dot.is-active::after { animation-play-state: paused; }
    @keyframes bwFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }

    /* Narrow frames (phones): a wider card, smaller side peeks */
    @container (max-width: 520px) {
      .card { --w: min(60cqw, 64cqh); }
      .controls { gap: 8px; padding: 5px; }
      .ctl { width: 30px; height: 30px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .card { transition: none; }
      .dot.is-active::after { animation: none !important; }
    }
  `;

  const chevron = (dir) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir === 'prev' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}"/></svg>`;

  class ServiceCards extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;
      ensureFonts();
      const data = SERVICES[this.getAttribute('service')] || SERVICES.web;
      this.total = data.cards.length;
      this.index = 0;
      this.timer = null;
      this.held = false; // hovering or dragging
      this.inView = false;
      this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');

      const root = this.attachShadow({ mode: 'open' });
      const pad = (n) => String(n).padStart(2, '0');
      root.innerHTML = `<style>${CSS}</style>
        <section class="stage" aria-roledescription="carousel" aria-label="${data.name}" tabindex="0" style="--interval:${INTERVAL}ms">
          ${data.cards.map(([title, text, kind], i) => `
            <article class="card" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${this.total}">
              <div class="card_top"><span class="icon">${icon(kind)}</span><span class="step">${pad(i + 1)} / ${pad(this.total)}</span></div>
              <h3>${title}</h3>
              <p>${text}</p>
              <div class="art"><div class="art_inner">${art(kind, i)}</div></div>
            </article>`).join('')}
          <div class="controls">
            <button type="button" class="ctl" data-dir="prev" aria-label="Previous card">${chevron('prev')}</button>
            <div class="dots">${data.cards.map((_, i) => `<button type="button" class="dot" aria-label="Show card ${i + 1}"></button>`).join('')}</div>
            <button type="button" class="ctl" data-dir="next" aria-label="Next card">${chevron('next')}</button>
          </div>
        </section>`;

      this.stage = root.querySelector('.stage');
      this.cards = Array.from(root.querySelectorAll('.card'));
      this.dots = Array.from(root.querySelectorAll('.dot'));

      root.querySelector('[data-dir="prev"]').addEventListener('click', () => this.go(this.index - 1));
      root.querySelector('[data-dir="next"]').addEventListener('click', () => this.go(this.index + 1));
      this.dots.forEach((dot, i) => dot.addEventListener('click', () => this.go(i)));
      this.stage.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(this.index - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); this.go(this.index + 1); }
      });
      this.cards.forEach((card, i) => card.addEventListener('click', () => {
        if (this.suppressClick) return;
        if (i !== this.index) this.go(i);
      }));

      // Pause while a mouse is over the stack
      this.stage.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.hold(true); });
      this.stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !this.drag) this.hold(false); });

      this.initDrag();

      // Autoplay only while the stack is on screen (the observer sees the top page's viewport)
      this.observer = new IntersectionObserver((entries) => {
        this.inView = entries[entries.length - 1].isIntersecting;
        this.schedule();
      }, { threshold: 0.3 });
      this.observer.observe(this);
      this.onVisibility = () => this.schedule();
      document.addEventListener('visibilitychange', this.onVisibility);
      this.motion.addEventListener?.('change', this.onVisibility);

      this.render();
    }

    disconnectedCallback() {
      clearTimeout(this.timer);
      this.observer?.disconnect();
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.motion.removeEventListener?.('change', this.onVisibility);
    }

    // Offset of card i from the front card, wrapped to -2 … 2
    offsetOf(i) {
      let d = (i - this.index + this.total) % this.total;
      if (d > this.total / 2) d -= this.total;
      return d;
    }

    transformFor(d, dragX = 0) {
      const a = Math.abs(d);
      // A fan of five: two cards on each side, stepping out, down and rotating
      const narrow = this.stage.clientWidth < 520;
      const x = d * (narrow ? 15 : 17); // % of the card width
      const y = a * (narrow ? 3 : 4.5);
      const rot = d * 4.5;
      const scale = 1 - a * 0.085;
      return `translate(-50%, -50%) translateX(calc(${x}% + ${dragX}px)) translateY(${y}%) rotate(${rot}deg) scale(${scale})`;
    }

    render(dragX = 0) {
      this.cards.forEach((card, i) => {
        const d = this.offsetOf(i);
        const a = Math.abs(d);
        const front = d === 0;
        const follow = front ? dragX : dragX * 0.25;
        card.style.transform = this.transformFor(d, follow) + (front && dragX ? ` rotate(${dragX * 0.03}deg)` : '');
        card.style.zIndex = String(10 - a);
        // Back cards sit softly out of focus behind the front one
        card.style.opacity = front ? '1' : a === 1 ? '0.92' : '0.85';
        card.style.filter = front ? 'none' : `brightness(${a === 1 ? 0.7 : 0.6}) blur(${a === 1 ? 2.5 : 3.5}px)`;
        card.classList.toggle('is-front', front);
        card.setAttribute('aria-hidden', String(!front));
      });
      this.dots.forEach((dot, i) => {
        const active = i === this.index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
      // Restart the progress fill on the active dot
      const active = this.dots[this.index];
      if (active) { active.classList.remove('is-active'); void active.offsetWidth; active.classList.add('is-active'); }
    }

    go(i) {
      this.index = (i + this.total) % this.total;
      this.render();
      this.schedule();
    }

    hold(on) {
      this.held = on;
      this.schedule();
    }

    schedule() {
      clearTimeout(this.timer);
      const playing = this.inView && !this.held && !document.hidden && !this.motion.matches;
      this.stage.classList.toggle('is-playing', playing);
      this.stage.classList.toggle('is-held', this.held);
      if (playing) this.timer = setTimeout(() => this.go(this.index + 1), INTERVAL);
    }

    // Drag / swipe with mouse, touch or pen. The stage allows vertical page scrolling
    // (touch-action: pan-y), so a mostly-horizontal swipe moves the cards and a vertical
    // one scrolls the page as usual.
    initDrag() {
      const stage = this.stage;
      let start = null;
      stage.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('.controls')) return;
        start = { x: e.clientX, y: e.clientY, id: e.pointerId, decided: false, horizontal: false };
        this.drag = false;
      });
      stage.addEventListener('pointermove', (e) => {
        if (!start || e.pointerId !== start.id) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (!start.decided) {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          start.decided = true;
          start.horizontal = Math.abs(dx) > Math.abs(dy);
          if (!start.horizontal) { start = null; return; }
          this.drag = true;
          this.hold(true);
          stage.classList.add('is-dragging');
          try { stage.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
        }
        e.preventDefault();
        this.dragX = dx;
        this.render(dx);
      });
      const end = (e) => {
        if (!start || (e && e.pointerId !== start.id)) return;
        const wasDragging = this.drag;
        start = null;
        if (!wasDragging) return;
        this.drag = false;
        stage.classList.remove('is-dragging');
        const dx = this.dragX || 0;
        this.dragX = 0;
        const limit = (this.cards[this.index]?.offsetWidth || 300) * DRAG_RATIO;
        // A drag shouldn't also count as a click on a card
        this.suppressClick = true;
        setTimeout(() => { this.suppressClick = false; }, 0);
        if (Math.abs(dx) > limit) this.index = (this.index + (dx < 0 ? 1 : -1) + this.total) % this.total;
        this.render();
        const mouseStillOver = e && e.pointerType === 'mouse' && stage.matches(':hover');
        this.hold(mouseStillOver);
      };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);
      // Touch pointers start out captured by the card under the finger; moving the capture to
      // the stage fires lostpointercapture on that card. Only the stage losing it ends a drag
      // (reacting to the card's event is what used to cancel every swipe on phones).
      stage.addEventListener('lostpointercapture', (e) => { if (e.target === stage) end(e); });
    }
  }

  if (!customElements.get('bw-service-cards')) customElements.define('bw-service-cards', ServiceCards);
})();
