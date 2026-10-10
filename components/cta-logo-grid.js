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
          const res = await fetch('/components/cta-logo-grid.html');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          cachedHtml = await res.text();
        }
        this.innerHTML = cachedHtml;
        this.initClickHandler();
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
  }

  if (!customElements.get('cta-logo-grid')) {
    customElements.define('cta-logo-grid', CtaLogoGrid);
  }
})();
