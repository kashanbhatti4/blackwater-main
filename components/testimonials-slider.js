/**
 * Testimonials Slider Component
 * Custom Element: <testimonials-slider></testimonials-slider>
 * Loads HTML & CSS from /components/testimonials-slider.html and runs the card stack:
 * arrows, left/right keys, swipe on touch screens, and a 01 / 05 progress line.
 * Loaded on every page, so it also works when a page arrives through a page transition.
 */
(function () {
  let cachedHtml = null;

  const reducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pad = n => String(n).padStart(2, '0');

  // Hand the new videos to the shared testimonial player (assets/js/testimonial-video.js).
  // If that script hasn't run yet, it picks them up itself once the page has loaded.
  function setUpVideos(root) {
    if (window.bwTestimonialVideos) window.bwTestimonialVideos.init(root);
  }

  class TestimonialsSlider extends HTMLElement {
    async connectedCallback() {
      if (this._initialized) return;
      this._initialized = true;

      try {
        if (!cachedHtml) {
          const res = await fetch('/components/testimonials-slider.html');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          cachedHtml = await res.text();
        }
        this.innerHTML = cachedHtml;
        setUpVideos(this);
        this.initSlider();
      } catch (err) {
        console.error('[TestimonialsSlider] Failed to load component HTML:', err);
      }
    }

    disconnectedCallback() {
      if (this._cleanup) this._cleanup();
    }

    initSlider() {
      const sliderList = this.querySelector('[data-slider="testimonials"]');
      const prevBtn = this.querySelector('[data-slider-prev="testimonials"]');
      const nextBtn = this.querySelector('[data-slider-next="testimonials"]');
      const section = this.querySelector('.testimonials') || this;
      const currentEl = this.querySelector('[data-slider-current]');
      const totalEl = this.querySelector('[data-slider-total]');
      const fillEl = this.querySelector('[data-slider-fill]');
      const statusEl = this.querySelector('[data-slider-status]');

      if (!sliderList || !prevBtn || !nextBtn) return;
      if (sliderList._hasHandler) return;
      sliderList._hasHandler = true;

      const items = Array.from(sliderList.children).filter(item => item.style.display !== 'none');
      if (items.length === 0) return;

      let currentIndex = 0;
      let isAnimating = false;

      // Every card gets the height of the tallest one, so the stack lines up
      function updateListHeight() {
        const cards = items.map(item => item.querySelector('.testimonials_card_wrap')).filter(Boolean);
        cards.forEach(card => { card.style.minHeight = ''; });
        const tallestCard = Math.max(0, ...cards.map(card => card.offsetHeight));
        cards.forEach(card => { card.style.minHeight = tallestCard + 'px'; });
        const tallestItem = Math.max(0, ...items.map(item => item.offsetHeight));
        if (tallestItem) sliderList.style.height = tallestItem + 'px';
      }

      setTimeout(updateListHeight, 100);
      // Width only: phones fire resize when the address bar moves
      let lastWidth = window.innerWidth;
      const onResize = () => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        updateListHeight();
      };
      window.addEventListener('resize', onResize);
      if (document.fonts) {
        document.fonts.ready.then(() => setTimeout(updateListHeight, 100));
      }

      function updateProgress() {
        if (currentEl) currentEl.textContent = pad(currentIndex + 1);
        if (totalEl) totalEl.textContent = pad(items.length);
        if (fillEl) fillEl.style.width = ((currentIndex + 1) / items.length) * 100 + '%';
        if (statusEl) {
          const label = items[currentIndex].getAttribute('aria-label') || '';
          statusEl.textContent = `Testimonial ${currentIndex + 1} of ${items.length}${label ? ': ' + label : ''}`;
        }
      }

      function updateStack() {
        items.forEach((item, index) => {
          item.classList.remove('is-falling', 'is-rising');
          const relativeIndex = (index - currentIndex + items.length) % items.length;

          item.style.zIndex = '';
          item.style.transform = '';
          item.style.opacity = '';
          item.style.transition = '';
          item.style.pointerEvents = '';

          // Only the front card can be reached by keyboard or screen reader
          const isFront = relativeIndex === 0;
          item.inert = !isFront;
          if (isFront) item.removeAttribute('aria-hidden');
          else item.setAttribute('aria-hidden', 'true');

          if (relativeIndex === 0) {
            item.style.zIndex = '60';
            item.style.transform = 'scale(1) translateY(0)';
          } else if (relativeIndex === 1) {
            item.style.zIndex = '50';
            item.style.transform = 'scale(0.95) translateY(-2%)';
          } else if (relativeIndex === 2) {
            item.style.zIndex = '40';
            item.style.transform = 'scale(0.90) translateY(-4%)';
          } else if (relativeIndex === 3) {
            item.style.zIndex = '30';
            item.style.transform = 'scale(0.85) translateY(-6%)';
          } else {
            item.style.zIndex = '0';
            item.style.transform = 'scale(0.80) translateY(-8%)';
            item.style.pointerEvents = 'none';
          }
        });
        updateProgress();
      }

      function pauseCurrent() {
        const video = items[currentIndex].querySelector('video');
        if (video && !video.paused) video.pause();
      }

      function goNext() {
        if (isAnimating) return;
        isAnimating = true;
        pauseCurrent();

        items[currentIndex].classList.add('is-falling');
        currentIndex = (currentIndex + 1) % items.length;
        updateProgress();

        setTimeout(() => {
          updateStack();
          isAnimating = false;
        }, 800);
      }

      function goPrev() {
        if (isAnimating) return;
        isAnimating = true;
        pauseCurrent();

        currentIndex = (currentIndex - 1 + items.length) % items.length;
        updateProgress();

        const newFrontCard = items[currentIndex];
        newFrontCard.style.transition = 'none';
        newFrontCard.style.transform = 'translateY(150vh) scale(0.8)';
        newFrontCard.style.zIndex = '100';
        newFrontCard.offsetHeight; // force reflow

        setTimeout(() => {
          newFrontCard.style.transition =
            'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.8s ease';
          newFrontCard.style.transform = 'scale(1) translateY(0)';
        }, 10);

        setTimeout(() => {
          updateStack();
          isAnimating = false;
        }, 800);
      }

      nextBtn.addEventListener('click', goNext);
      prevBtn.addEventListener('click', goPrev);

      // Left/right keys while the slider is on screen, except when typing or using a video's own controls
      const keyHandler = (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|VIDEO)$/.test(t.tagName))) return;
        const rect = section.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          if (e.key === 'ArrowRight') goNext();
          else goPrev();
        }
      };
      document.addEventListener('keydown', keyHandler);

      // Swipe left/right on touch screens
      let touchX = null;
      let touchY = null;
      sliderList.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
      }, { passive: true });
      sliderList.addEventListener('touchend', (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        const dy = e.changedTouches[0].clientY - touchY;
        touchX = touchY = null;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        if (dx < 0) goNext();
        else goPrev();
      }, { passive: true });

      // Mousemove 3D depth parallax
      const onMouseMove = (e) => {
        if (reducedMotion()) return;
        const rect = section.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
        const mouseY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);

        items.forEach((item, index) => {
          if (item.classList.contains('is-falling') || item.classList.contains('is-rising')) return;
          const depth = index * 0.15;
          const maxMove = 15;
          const moveX = mouseX * maxMove * (1 - depth);
          const moveY = mouseY * maxMove * (1 - depth);

          const scaleMatch = item.style.transform.match(/scale\(([^)]+)\)/);
          const translateYMatch = item.style.transform.match(/translateY\(([^)]+)\)/);
          const scale = scaleMatch ? scaleMatch[1] : '1';
          const translateY = translateYMatch ? translateYMatch[1] : '0';

          item.style.transition = 'transform 0.15s ease-out';
          item.style.transform = `scale(${scale}) translateY(${translateY}) translate(${moveX}px, ${moveY}px)`;
        });
      };
      section.addEventListener('mousemove', onMouseMove);

      section.addEventListener('mouseleave', () => {
        items.forEach((item) => {
          if (item.classList.contains('is-falling') || item.classList.contains('is-rising')) return;
          const scaleMatch = item.style.transform.match(/scale\(([^)]+)\)/);
          const translateYMatch = item.style.transform.match(/translateY\(([^)]+)\)/);
          const scale = scaleMatch ? scaleMatch[1] : '1';
          const translateY = translateYMatch ? translateYMatch[1] : '0';

          item.style.transition = 'transform 0.3s ease-out';
          item.style.transform = `scale(${scale}) translateY(${translateY}) translate(0px, 0px)`;
        });
      });

      // Stop listening on the document once the page changes
      this._cleanup = () => {
        document.removeEventListener('keydown', keyHandler);
        window.removeEventListener('resize', onResize);
      };

      updateStack();
    }
  }

  if (!customElements.get('testimonials-slider')) {
    customElements.define('testimonials-slider', TestimonialsSlider);
  }
})();
