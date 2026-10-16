// -----------------------------------------
// CLOUDFLARE TURNSTILE (dark widget on the contact form, audit form and admin sign in)
// Any element with [data-turnstile] inside a form gets a widget. The site key comes from
// /api/turnstile-config, so nothing renders until both keys are set on the server.
// Cloudflare's script is only loaded on pages that have a form.
//   bwTurnstile.mount(root)  render widgets inside root (called again after page transitions)
//   bwTurnstile.token(form)  the current token for that form's widget ('' if none)
//   bwTurnstile.required(form) true when the form shows a widget
//   bwTurnstile.reset(form)  get a fresh token after a submission
// -----------------------------------------
(function () {
  var configPromise = null;
  var apiPromise = null;
  var widgets = new Map(); // element -> widget id

  function loadConfig() {
    if (!configPromise) {
      configPromise = fetch('/api/turnstile-config', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    }
    return configPromise;
  }

  function loadApi() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (!apiPromise) {
      apiPromise = new Promise(function (resolve, reject) {
        window.bwTurnstileReady = function () { resolve(window.turnstile); };
        var script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=bwTurnstileReady';
        script.onerror = function () { apiPromise = null; reject(new Error('Turnstile failed to load')); };
        document.head.appendChild(script);
      });
    }
    return apiPromise;
  }

  // Forget widgets whose page was swapped out by a transition
  function cleanup() {
    widgets.forEach(function (id, el) {
      if (document.contains(el)) return;
      try { if (window.turnstile) window.turnstile.remove(id); } catch (e) { /* already gone */ }
      widgets.delete(el);
    });
  }

  function mount(root) {
    cleanup();
    var scope = root && root.querySelectorAll ? root : document;
    var targets = Array.prototype.filter.call(scope.querySelectorAll('[data-turnstile]'), function (el) {
      // Skip widgets already drawn and forms that are hidden right now (e.g. the admin sign in before it shows)
      return !widgets.has(el) && (el.closest('form') || el).getClientRects().length > 0;
    });
    if (!targets.length) return Promise.resolve();

    return loadConfig().then(function (config) {
      if (!config || !config.siteKey) return;
      return loadApi().then(function (turnstile) {
        targets.forEach(function (el) {
          if (widgets.has(el) || !document.contains(el)) return;
          el.classList.add('is-active');
          var id = turnstile.render(el, {
            sitekey: config.siteKey,
            theme: 'dark',
            size: 'flexible',
            action: el.getAttribute('data-turnstile-action') || undefined
          });
          widgets.set(el, id);
        });
      });
    }).catch(function (err) {
      if (window.console) console.warn(err.message || err);
    });
  }

  function widgetFor(form) {
    var el = form && form.querySelector('[data-turnstile]');
    return el && widgets.has(el) ? widgets.get(el) : null;
  }

  function token(form) {
    var id = widgetFor(form);
    if (id === null || !window.turnstile) return '';
    return window.turnstile.getResponse(id) || '';
  }

  function required(form) {
    return widgetFor(form) !== null;
  }

  function reset(form) {
    var id = widgetFor(form);
    if (id === null || !window.turnstile) return;
    try { window.turnstile.reset(id); } catch (e) { /* widget removed */ }
  }

  window.bwTurnstile = { mount: mount, token: token, required: required, reset: reset };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mount(document); });
  } else {
    mount(document);
  }
})();
