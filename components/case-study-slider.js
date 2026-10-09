/**
 * Case Study Slider Component
 * Custom Element: <case-study-slider></case-study-slider>
 * Loads HTML from /components/case-study-slider.html and initializes GSAP Draggable horizontal loop.
 */
(function() {
  // GSAP Helper function: horizontalLoop
  function horizontalLoop(items, config) {
    let timeline;
    items = gsap.utils.toArray(items);
    config = config || {};
    let ctx = gsap.context(() => {
      let onChange = config.onChange,
        lastIndex = 0,
        tl = gsap.timeline({
          repeat: config.repeat,
          onUpdate: onChange && function () {
            let i = tl.closestIndex();
            if (lastIndex !== i) {
              lastIndex = i;
              onChange(items[i], i);
            }
          },
          paused: config.paused,
          defaults: { ease: "none" },
          onReverseComplete: () => tl.totalTime(tl.rawTime() + tl.duration() * 100)
        }),
        length = items.length,
        startX = items[0].offsetLeft,
        times = [],
        widths = [],
        spaceBefore = [],
        xPercents = [],
        curIndex = 0,
        indexIsDirty = false,
        center = config.center,
        pixelsPerSecond = (config.speed || 1) * 100,
        snap = config.snap === false ? v => v : gsap.utils.snap(config.snap || 1),
        timeOffset = 0,
        container = center === true ? items[0].parentNode : gsap.utils.toArray(center)[0] || items[0].parentNode,
        totalWidth,
        getTotalWidth = () => items[length - 1].offsetLeft + xPercents[length - 1] / 100 * widths[length - 1] - startX + spaceBefore[0] + items[length - 1].offsetWidth * gsap.getProperty(items[length - 1], "scaleX") + (parseFloat(config.paddingRight) || 0),
        populateWidths = () => {
          let b1 = container.getBoundingClientRect(), b2;
          items.forEach((el, i) => {
            widths[i] = parseFloat(gsap.getProperty(el, "width", "px"));
            xPercents[i] = snap(parseFloat(gsap.getProperty(el, "x", "px")) / widths[i] * 100 + gsap.getProperty(el, "xPercent"));
            b2 = el.getBoundingClientRect();
            spaceBefore[i] = b2.left - (i ? b1.right : b1.left);
            b1 = b2;
          });
          gsap.set(items, { xPercent: i => xPercents[i] });
          totalWidth = getTotalWidth();
        },
        timeWrap,
        populateOffsets = () => {
          timeOffset = center ? tl.duration() * (container.offsetWidth / 2) / totalWidth : 0;
          center && times.forEach((t, i) => {
            times[i] = timeWrap(tl.labels["label" + i] + tl.duration() * widths[i] / 2 / totalWidth - timeOffset);
          });
        },
        getClosest = (values, value, wrap) => {
          let i = values.length, closest = 1e10, index = 0, d;
          while (i--) {
            d = Math.abs(values[i] - value);
            if (d > wrap / 2) d = wrap - d;
            if (d < closest) { closest = d; index = i; }
          }
          return index;
        },
        populateTimeline = () => {
          let i, item, curX, distanceToStart, distanceToLoop;
          tl.clear();
          for (i = 0; i < length; i++) {
            item = items[i];
            curX = xPercents[i] / 100 * widths[i];
            distanceToStart = item.offsetLeft + curX - startX + spaceBefore[0];
            distanceToLoop = distanceToStart + widths[i] * gsap.getProperty(item, "scaleX");
            tl.to(item, {
              xPercent: snap((curX - distanceToLoop) / widths[i] * 100),
              duration: distanceToLoop / pixelsPerSecond
            }, 0)
            .fromTo(item, {
              xPercent: snap((curX - distanceToLoop + totalWidth) / widths[i] * 100)
            }, {
              xPercent: xPercents[i],
              duration: (curX - distanceToLoop + totalWidth - curX) / pixelsPerSecond,
              immediateRender: false
            }, distanceToLoop / pixelsPerSecond)
            .add("label" + i, distanceToStart / pixelsPerSecond);
            times[i] = distanceToStart / pixelsPerSecond;
          }
          timeWrap = gsap.utils.wrap(0, tl.duration());
        },
        refresh = (deep) => {
          let progress = tl.progress();
          tl.progress(0, true);
          populateWidths();
          deep && populateTimeline();
          populateOffsets();
          deep && tl.draggable ? tl.time(times[curIndex], true) : tl.progress(progress, true);
        },
        onResize = () => refresh(true),
        proxy;

      gsap.set(items, { x: 0 });
      populateWidths();
      populateTimeline();
      populateOffsets();
      window.addEventListener("resize", onResize);

      function toIndex(index, vars) {
        vars = vars || {};
        (Math.abs(index - curIndex) > length / 2) && (index += index > curIndex ? -length : length);
        let newIndex = gsap.utils.wrap(0, length, index),
          time = times[newIndex];
        if (time > tl.time() !== index > curIndex && index !== curIndex) {
          time += tl.duration() * (index > curIndex ? 1 : -1);
        }
        if (time < 0 || time > tl.duration()) {
          vars.modifiers = { time: timeWrap };
        }
        curIndex = newIndex;
        vars.overwrite = true;
        gsap.killTweensOf(proxy);

        const oldUpdate = vars.onUpdate;
        vars.onUpdate = function () {
          if (oldUpdate) oldUpdate.apply(this, arguments);
          let i = tl.closestIndex();
          if (lastIndex !== i) {
            lastIndex = i;
            onChange && onChange(items[i], i);
          }
        };

        return vars.duration === 0 ? tl.time(timeWrap(time)) : tl.tweenTo(time, vars);
      }

      tl.toIndex = (index, vars) => toIndex(index, vars);
      tl.closestIndex = setCurrent => {
        let index = getClosest(times, tl.time(), tl.duration());
        if (setCurrent) {
          curIndex = index;
          indexIsDirty = false;
        }
        return index;
      };
      tl.current = () => indexIsDirty ? tl.closestIndex(true) : curIndex;
      tl.next = vars => toIndex(tl.current() + 1, vars);
      tl.previous = vars => toIndex(tl.current() - 1, vars);
      tl.times = times;
      tl.progress(1, true).progress(0, true);

      if (config.draggable && typeof (Draggable) === "function") {
        proxy = document.createElement("div");
        let wrap = gsap.utils.wrap(0, 1),
          ratio, startProgress, draggable;
        draggable = Draggable.create(proxy, {
          trigger: items[0].parentNode,
          type: "x",
          onPressInit() {
            let x = this.x;
            gsap.killTweensOf(tl);
            tl.pause();
            startProgress = tl.progress();
            refresh();
            ratio = 1 / totalWidth;
            this.startProgress = startProgress;
            gsap.set(this.target, { x: startProgress / -ratio });
          },
          onDrag: () => tl.progress(wrap(startProgress + (draggable.startX - draggable.x) * ratio)),
          onThrowUpdate: () => tl.progress(wrap(startProgress + (draggable.startX - draggable.x) * ratio)),
          inertia: true,
          snap: {
            x: value => {
              let time = -(value * ratio) * tl.duration(),
                wrappedTime = timeWrap(time),
                snapTime = times[getClosest(times, wrappedTime, tl.duration())],
                dif = snapTime - wrappedTime;
              if (Math.abs(dif) > tl.duration() / 2) {
                dif += dif < 0 ? tl.duration() : -tl.duration();
              }
              return (time + dif) / tl.duration() / -ratio;
            }
          },
          onRelease() {
            syncIndex();
            draggable.isThrowing && (indexIsDirty = true);
          },
          onThrowComplete: () => {
            syncIndex();
            wasPlaying && tl.play();
          }
        })[0];
        tl.draggable = draggable;
      }

      return tl;
    });

    return ctx.data[0];
  }

  let cachedHtml = null;

  class CaseStudySlider extends HTMLElement {
    async connectedCallback() {
      if (this._initialized) return;
      this._initialized = true;

      try {
        if (!cachedHtml) {
          const res = await fetch('/components/case-study-slider.html');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          cachedHtml = await res.text();
        }
        this.innerHTML = cachedHtml;

        // Small delay to ensure browser layout / dimensions are computed
        setTimeout(() => {
          this.initSlider();
        }, 150);
      } catch (err) {
        console.error('[CaseStudySlider] Failed to load component HTML:', err);
      }
    }

    initSlider() {
      const container = this;
      const wrapper = container.querySelector('[data-slider="list"]');
      if (!wrapper) return;

      const slides = gsap.utils.toArray(container.querySelectorAll('[data-slider="slide"]'));
      const nextButton = container.querySelector('[data-slider-button="next"]');
      const prevButton = container.querySelector('[data-slider-button="prev"]');
      const totalElement = container.querySelector('[data-slide-count="total"]');
      const stepElement = container.querySelector('[data-slide-count="step"]');

      if (!slides.length) return;

      const totalSlides = slides.length;
      if (totalElement) {
        totalElement.textContent = totalSlides < 10 ? `0${totalSlides}` : totalSlides;
      }
      if (stepElement) {
        stepElement.textContent = "01";
      }

      let activeElement = null;
      let currentIndex = 0;

      function applyActive(el, index, animateNumbers = true) {
        if (activeElement) activeElement.classList.remove('active');
        el.classList.add('active');
        activeElement = el;

        if (stepElement) {
          if (animateNumbers) {
            gsap.to(stepElement, {
              opacity: 0,
              y: -10,
              duration: 0.15,
              onComplete: () => {
                stepElement.textContent = index + 1 < 10 ? `0${index + 1}` : (index + 1);
                gsap.fromTo(stepElement, { y: 10 }, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" });
              }
            });
          } else {
            stepElement.textContent = index + 1 < 10 ? `0${index + 1}` : (index + 1);
            gsap.set(stepElement, { opacity: 1, y: 0 });
          }
        }
      }

      const loop = horizontalLoop(slides, {
        paused: true,
        draggable: true,
        center: false,
        onChange: (element, index) => {
          currentIndex = index;
          applyActive(element, index, true);
        }
      });

      function goToIndex(i) {
        if (!loop || !loop.toIndex) return;
        loop.toIndex(i, { ease: "power3", duration: 0.8 });
        let targetIndex = gsap.utils.wrap(0, totalSlides, i);
        currentIndex = targetIndex;
        if (slides[targetIndex]) {
          applyActive(slides[targetIndex], targetIndex, true);
        }
      }

      slides.forEach((slide, i) => {
        slide.addEventListener("click", () => {
          if (slide.classList.contains("active")) return;
          goToIndex(i);
        });
      });

      nextButton?.addEventListener("click", () => goToIndex(currentIndex + 1));
      prevButton?.addEventListener("click", () => goToIndex(currentIndex - 1));

      if (slides[0]) {
        applyActive(slides[0], 0, false);
      }
    }
  }

  if (!customElements.get('case-study-slider')) {
    customElements.define('case-study-slider', CaseStudySlider);
  }
})();
