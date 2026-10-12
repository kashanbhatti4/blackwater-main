/**
 * Testimonials Slider Component
 * Custom Element: <testimonials-slider></testimonials-slider>
 * Loads HTML & CSS from /components/testimonials-slider.html and initializes card stack slider interactions.
 */
(function () {
  let cachedHtml = null;

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
        this.initSlider();
      } catch (err) {
        console.error('[TestimonialsSlider] Failed to load component HTML:', err);
      }
    }

    initSlider() {
      const sliderList = this.querySelector('[data-slider="testimonials"]');
      const prevBtn = this.querySelector('[data-slider-prev="testimonials"]');
      const nextBtn = this.querySelector('[data-slider-next="testimonials"]');
      const section = this.querySelector('.testimonials') || this;

      if (!sliderList || !prevBtn || !nextBtn) return;
      if (sliderList._hasHandler) return;
      sliderList._hasHandler = true;

      const items = Array.from(sliderList.children).filter(item => item.style.display !== 'none');
      if (items.length === 0) return;

      let currentIndex = 0;
      let isAnimating = false;

      // Update height dynamically
      function updateListHeight() {
        const firstItem = sliderList.querySelector('.testimonials_collection_item');
        if (firstItem) {
          sliderList.style.height = firstItem.offsetHeight + 'px';
        }
      }

      setTimeout(updateListHeight, 100);
      window.addEventListener('resize', updateListHeight);
      if (document.fonts) {
        document.fonts.ready.then(() => setTimeout(updateListHeight, 100));
      }

      function updateStack() {
        items.forEach((item, index) => {
          item.classList.remove('is-falling', 'is-rising');
          const relativeIndex = (index - currentIndex + items.length) % items.length;

          item.style.zIndex = '';
          item.style.transform = '';
          item.style.opacity = '';
          item.style.transition = '';

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
      }

      function goNext() {
        if (isAnimating) return;
        isAnimating = true;

        const currentItem = items[currentIndex];
        const currentVideo = currentItem.querySelector('video');
        if (currentVideo && !currentVideo.paused) currentVideo.pause();

        currentItem.classList.add('is-falling');
        currentIndex = (currentIndex + 1) % items.length;

        setTimeout(() => {
          updateStack();
          isAnimating = false;
        }, 800);
      }

      function goPrev() {
        if (isAnimating) return;
        isAnimating = true;

        const currentItem = items[currentIndex];
        const currentVideo = currentItem.querySelector('video');
        if (currentVideo && !currentVideo.paused) currentVideo.pause();

        currentIndex = (currentIndex - 1 + items.length) % items.length;

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

      // Keyboard navigation
      const keyHandler = (e) => {
        const rect = section.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          if (e.key === 'ArrowRight') goNext();
          if (e.key === 'ArrowLeft') goPrev();
        }
      };
      document.addEventListener('keydown', keyHandler);

      // Mousemove 3D depth parallax
      section.addEventListener('mousemove', (e) => {
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
      });

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

      updateStack();
    }
  }

  if (!customElements.get('testimonials-slider')) {
    customElements.define('testimonials-slider', TestimonialsSlider);
  }
})();
