// -----------------------------------------
// CALENDLY "BOOK A FREE CONSULTATION" HEADER BUTTON + POPUP
// The popup markup (with the Calendly inline widget) sits at the end of every page
// and preloads invisibly; styles are in webflow.css. This adds the header button and
// the open/close behaviour.
// -----------------------------------------
(function () {
  var BUTTON_LABEL = 'Book a free Consultation';

  var CALENDAR_ICON =
    '<svg class="bw-calendly-btn__icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 2v4"/><path d="M16 2v4"/>' +
    '<path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/>' +
    '<path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/>' +
    '</svg>';

  var popup = null;
  var lastFocused = null;

  function setScrollLocked(locked) {
    document.body.classList.toggle('no-scroll', locked);
    if (typeof lenis !== 'undefined' && lenis) {
      if (locked && typeof lenis.stop === 'function') lenis.stop();
      if (!locked && typeof lenis.start === 'function') lenis.start();
    }
  }

  function openPopup() {
    lastFocused = document.activeElement;
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
    popup.removeAttribute('inert');
    setScrollLocked(true);
    popup.querySelector('.bw-calendly-popup__close').focus();
  }

  function closePopup() {
    if (!popup.classList.contains('is-open')) return;
    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
    popup.setAttribute('inert', '');
    setScrollLocked(false);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function buildButton() {
    var container = document.querySelector('.simple-navbar__container');
    var burgerBox = container && container.querySelector('.simple-navbar__burger-box');
    if (!container || !burgerBox || container.querySelector('.bw-calendly-btn')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bw-calendly-btn';
    btn.setAttribute('aria-label', BUTTON_LABEL);
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = '<span class="bw-calendly-btn__label">' + BUTTON_LABEL + '</span>' + CALENDAR_ICON;
    btn.addEventListener('click', openPopup);
    container.insertBefore(btn, burgerBox);
  }

  function init() {
    popup = document.getElementById('bw-calendly-popup');
    if (!popup) return;

    // Click on the blurred backdrop (anything outside the close button and the widget) closes
    popup.addEventListener('click', function (e) {
      if (!e.target.closest('.bw-calendly-popup__close, .calendly-inline-widget')) closePopup();
    });
    popup.querySelector('.bw-calendly-popup__close').addEventListener('click', closePopup);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePopup();
    });

    // Calendly reports its content height; size the popup to it so the card stays centred
    var panel = popup.querySelector('.bw-calendly-popup__panel');
    window.addEventListener('message', function (e) {
      if (e.origin !== 'https://calendly.com' || !e.data || e.data.event !== 'calendly.page_height') return;
      var height = parseInt(e.data.payload && e.data.payload.height, 10);
      // Ignore the tiny heights Calendly reports while it is still loading
      if (height >= 500) panel.style.setProperty('--bw-calendly-height', height + 'px');
    });

    // Any other element marked data-calendly-open (e.g. the footer button) opens the popup too
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-calendly-open]')) openPopup();
    });

    buildButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
