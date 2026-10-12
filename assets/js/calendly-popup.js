// -----------------------------------------
// CALENDLY "BOOK A FREE CONSULTATION" HEADER BUTTON + POPUP
// Injects the header button and a popup holding the Calendly inline widget.
// The widget is preloaded once the page is idle so the popup opens instantly.
// -----------------------------------------
(function () {
  var CALENDLY_URL = 'https://calendly.com/blackwater_digitalmarketing/30min?background_color=000000&text_color=ffffff&primary_color=ffe32a';
  var CALENDLY_SCRIPT = 'https://assets.calendly.com/assets/external/widget.js';
  var BUTTON_LABEL = 'Book a free Consultation';

  var CALENDAR_ICON =
    '<svg class="bw-calendly-btn__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 2v4"/><path d="M16 2v4"/>' +
    '<path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/>' +
    '<path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/>' +
    '</svg>';

  var STYLES =
    '.bw-calendly-btn{pointer-events:auto;margin-left:auto;display:inline-flex;align-items:center;gap:.6em;height:3rem;padding:0 1.4rem;border:0;border-radius:999px;background:#FFE32A;color:#0E100F;font-family:inherit;font-size:1rem;font-weight:500;line-height:1;white-space:nowrap;cursor:pointer;transition:background-color .25s ease,transform .25s ease;-webkit-tap-highlight-color:transparent}' +
    '.bw-calendly-btn:hover{background:#FFFCE1;transform:translateY(-1px)}' +
    '.bw-calendly-btn:focus-visible{outline:2px solid #FFFCE1;outline-offset:3px}' +
    '.bw-calendly-btn__icon{width:1.4em;height:1.4em;flex-shrink:0;display:block}' +
    '@media (max-width:767px){.bw-calendly-btn{width:2.75rem;height:2.75rem;padding:0;justify-content:center;font-size:.95rem}.bw-calendly-btn__label{display:none}}' +
    '.bw-calendly-popup{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;background:rgba(0,0,0,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .3s ease,visibility 0s linear .3s}' +
    '.bw-calendly-popup.is-open{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .3s ease}' +
    '.bw-calendly-popup__panel{position:relative;width:100%;max-width:1060px;height:min(700px,calc(100vh - 2rem));height:min(700px,calc(100dvh - 2rem));background:#000;border:1px solid #2A2B25;border-radius:16px;overflow:hidden;transform:translateY(16px);transition:transform .3s ease}' +
    '.bw-calendly-popup.is-open .bw-calendly-popup__panel{transform:translateY(0)}' +
    '.bw-calendly-popup__widget{width:100%;height:100%;min-width:0}' +
    '.bw-calendly-popup__widget iframe{display:block;width:100%;height:100%;border:0}' +
    '.bw-calendly-popup__close{position:absolute;top:.6rem;right:.6rem;z-index:2;width:2.5rem;height:2.5rem;display:flex;align-items:center;justify-content:center;padding:0;border:1px solid #2A2B25;border-radius:50%;background:#131615;color:#FFFCE1;cursor:pointer;transition:background-color .2s ease,color .2s ease}' +
    '.bw-calendly-popup__close:hover{background:#FFE32A;color:#0E100F}' +
    '.bw-calendly-popup__close svg{width:1.1rem;height:1.1rem;display:block}';

  var popup = null;
  var widgetEl = null;
  var widgetRequested = false;
  var lastFocused = null;

  function injectStyles() {
    if (document.getElementById('bw-calendly-styles')) return;
    var style = document.createElement('style');
    style.id = 'bw-calendly-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function initWidget() {
    if (!widgetEl || widgetEl.querySelector('iframe')) return;
    if (window.Calendly && typeof window.Calendly.initInlineWidget === 'function') {
      window.Calendly.initInlineWidget({ url: CALENDLY_URL, parentElement: widgetEl });
    }
  }

  // Loads Calendly's script once and renders the inline widget inside the popup
  function loadWidget() {
    if (widgetRequested) return;
    widgetRequested = true;
    if (window.Calendly) return initWidget();
    var script = document.createElement('script');
    script.src = CALENDLY_SCRIPT;
    script.async = true;
    script.onload = initWidget;
    script.onerror = function () { widgetRequested = false; };
    document.head.appendChild(script);
  }

  function setScrollLocked(locked) {
    document.body.classList.toggle('no-scroll', locked);
    if (typeof lenis !== 'undefined' && lenis) {
      if (locked && typeof lenis.stop === 'function') lenis.stop();
      if (!locked && typeof lenis.start === 'function') lenis.start();
    }
  }

  function openPopup() {
    loadWidget();
    lastFocused = document.activeElement;
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
    setScrollLocked(true);
    popup.querySelector('.bw-calendly-popup__close').focus();
  }

  function closePopup() {
    if (!popup.classList.contains('is-open')) return;
    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
    setScrollLocked(false);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function buildPopup() {
    popup = document.createElement('div');
    popup.id = 'bw-calendly-popup';
    popup.className = 'bw-calendly-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', BUTTON_LABEL);
    popup.setAttribute('aria-hidden', 'true');
    popup.setAttribute('data-lenis-prevent', '');
    popup.innerHTML =
      '<div class="bw-calendly-popup__panel">' +
      '<button type="button" class="bw-calendly-popup__close" aria-label="Close booking popup">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
      '</button>' +
      '<div class="bw-calendly-popup__widget"></div>' +
      '</div>';
    document.body.appendChild(popup);
    widgetEl = popup.querySelector('.bw-calendly-popup__widget');

    popup.addEventListener('click', function (e) {
      if (e.target === popup) closePopup();
    });
    popup.querySelector('.bw-calendly-popup__close').addEventListener('click', closePopup);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePopup();
    });
  }

  function buildButton() {
    var container = document.querySelector('.simple-navbar__container');
    var burgerBox = container && container.querySelector('.simple-navbar__burger-box');
    if (!container || !burgerBox) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bw-calendly-btn';
    btn.setAttribute('aria-label', BUTTON_LABEL);
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = '<span class="bw-calendly-btn__label">' + BUTTON_LABEL + '</span>' + CALENDAR_ICON;
    btn.addEventListener('click', openPopup);
    // Start loading on first intent in case the idle preload has not run yet
    btn.addEventListener('pointerenter', loadWidget, { once: true });
    container.insertBefore(btn, burgerBox);
  }

  function schedulePreload() {
    var preload = function () {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(loadWidget, { timeout: 4000 });
      } else {
        setTimeout(loadWidget, 2000);
      }
    };
    if (document.readyState === 'complete') preload();
    else window.addEventListener('load', preload, { once: true });
  }

  function init() {
    if (document.getElementById('bw-calendly-popup')) return;
    injectStyles();
    buildPopup();
    buildButton();
    schedulePreload();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
