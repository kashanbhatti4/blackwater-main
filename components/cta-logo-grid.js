/**
 * CTA Logo Grid Component
 * Custom Element: <cta-logo-grid></cta-logo-grid>
 * Loads HTML & CSS from /components/cta-logo-grid.html and attaches delegated click handler.
 */
(function () {
  let cachedHtml = null;

  class CtaLogoGrid extends HTMLElement {
    async connectedCallback() {
      if (this._initialized) return;
      this._initialized = true;

      try {
        if (!cachedHtml) {
          const res = await fetch('/components/cta-logo-grid.html?v=3');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          cachedHtml = await res.text();
        }
        this.innerHTML = cachedHtml;
        this.initClickHandler();
        this.initIntro();
        this.initUniqueLogos();
      } catch (err) {
        console.error('[CtaLogoGrid] Failed to load component HTML:', err);
      }
    }

    initClickHandler() {
      const ctaWrap = this.querySelector('.cta_circles_wrap');
      if (ctaWrap && !ctaWrap._hasClickListener) {
        ctaWrap._hasClickListener = true;
        ctaWrap.addEventListener('click', function (e) {
          const img = e.target.closest('.cta_grid_circle_img');
          if (img) {
            const targetUrl = (img.dataset && img.dataset.url) ? img.dataset.url : 'https://blackwaterdigital.ie/';
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
          }
        });
      }
    }

    // Hide the tiles until the grid is on screen, then circle them in quickly with a short stagger
    initIntro() {
      const wrap = this.querySelector('.cta_circles_wrap');
      if (!wrap || !('IntersectionObserver' in window)) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const STAGGER_MS = 60;
      const DURATION_MS = 700;
      const tiles = Array.from(wrap.querySelectorAll('.cta_grid_circle')).filter((tile) => tile.offsetParent !== null);
      tiles.forEach((tile, i) => tile.style.setProperty('--intro-i', i));
      wrap.classList.add('is-intro');
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        wrap.classList.add('is-revealed');
        // Drop the intro classes afterwards so nothing keeps clipping the tiles
        setTimeout(() => wrap.classList.remove('is-intro', 'is-revealed'), tiles.length * STAGGER_MS + DURATION_MS + 100);
      }, { threshold: 0.25 });
      observer.observe(wrap);
    }
  }

  // Each image is revealed for the first half of the 19.2s imgCycle animation (see the HTML).
  // Shortly before an image is revealed, give it a logo that no other tile is showing, so the
  // same client never appears twice on screen at once. Timing is read from the running CSS
  // animation itself, so it stays in step with the delays set by the cd-1 … cd-5 classes.
  const CYCLE_MS = 19200;
  const VISIBLE_MS = CYCLE_MS / 2;
  const LEAD_MS = 400; // swap this long before the reveal, while the image is still hidden

  CtaLogoGrid.prototype.initUniqueLogos = function () {
    const imgs = Array.from(this.querySelectorAll('.cta_grid_circle_img'));
    if (!imgs.length || typeof imgs[0].getAnimations !== 'function') return;

    // Pool of distinct logos, taken from the markup (first link/alt seen for each file)
    const pool = [];
    const seen = new Set();
    imgs.forEach((img) => {
      const src = img.getAttribute('src');
      if (!src || seen.has(src)) return;
      seen.add(src);
      pool.push({ src, url: img.dataset.url || '', alt: img.getAttribute('alt') || '' });
      new Image().src = src; // warm the cache so swaps don't flash
    });

    const revealAt = new Map(); // img -> time its current logo is (or was) revealed
    const cycleOf = new Map(); // img -> which animation cycle it was last assigned for
    const lastUsed = new Map(); // src -> last time it was assigned anywhere

    const assign = (img, revealTime, now) => {
      const used = new Set();
      revealAt.forEach((time, other) => {
        if (other !== img && other.offsetParent && now - time < VISIBLE_MS) used.add(other.getAttribute('src'));
      });
      const free = pool.filter((logo) => !used.has(logo.src));
      const choices = free.length ? free : pool;
      // Least recently used first, with a little randomness among ties
      choices.sort((x, y) => (lastUsed.get(x.src) || 0) - (lastUsed.get(y.src) || 0) || Math.random() - 0.5);
      const logo = choices[0];
      if (img.getAttribute('src') !== logo.src) img.setAttribute('src', logo.src);
      img.dataset.url = logo.url;
      img.setAttribute('alt', logo.alt);
      revealAt.set(img, revealTime);
      lastUsed.set(logo.src, now);
    };

    const tick = () => {
      if (!this.isConnected) return clearInterval(timer);
      const now = performance.now();
      imgs.forEach((img) => {
        const anim = img.getAnimations().find((a) => a.animationName === 'imgCycle');
        if (!anim || anim.currentTime == null) return;
        const delay = anim.effect.getTiming().delay || 0;
        const elapsed = anim.currentTime - delay + LEAD_MS;
        if (elapsed < 0) return;
        const cycle = Math.floor(elapsed / CYCLE_MS);
        if (cycleOf.get(img) === cycle) return;
        const firstLook = !cycleOf.has(img);
        cycleOf.set(img, cycle);
        const intoCycle = elapsed % CYCLE_MS; // LEAD_MS here means "revealing right now"
        // Swap while the image is still hidden, just before its reveal
        if (intoCycle <= LEAD_MS) assign(img, now + (LEAD_MS - intoCycle), now);
        // The schedule starts mid-cycle, so on the first look some images are already showing:
        // give each a unique logo now, before the intro reveals the grid
        else if (firstLook && intoCycle < VISIBLE_MS + LEAD_MS) assign(img, now - (intoCycle - LEAD_MS), now);
        // Joined mid-cycle later on (a backgrounded tab): just record what is showing
        else revealAt.set(img, now - (intoCycle - LEAD_MS));
      });
    };
    const timer = setInterval(tick, 150);
    tick();
  };

  if (!customElements.get('cta-logo-grid')) {
    customElements.define('cta-logo-grid', CtaLogoGrid);
  }
})();
