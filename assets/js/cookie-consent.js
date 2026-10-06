(function () {
  function initCookieConsent() {
    var consent = localStorage.getItem('bwd_cookie_consent');
    var banner = document.getElementById('cookie-consent-banner');
    if (!banner || consent) return;

    setTimeout(function () {
      banner.classList.add('is-visible');
      banner.setAttribute('aria-hidden', 'false');

      var waBtn = document.getElementById('whatsapp-button');
      if (waBtn && window.innerWidth < 768) {
        waBtn.style.transition = 'bottom 0.4s ease';
        waBtn.style.bottom = (banner.offsetHeight + 24) + 'px';
      }
    }, 600);

    var acceptBtn = document.getElementById('cookie-accept-btn');
    var declineBtn = document.getElementById('cookie-decline-btn');

    function closeConsent(choice) {
      localStorage.setItem('bwd_cookie_consent', choice);
      banner.classList.remove('is-visible');
      banner.setAttribute('aria-hidden', 'true');
      var waBtn = document.getElementById('whatsapp-button');
      if (waBtn && window.innerWidth < 768) {
        waBtn.style.bottom = '';
      }
    }

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        closeConsent('accepted');
      });
    }

    if (declineBtn) {
      declineBtn.addEventListener('click', function () {
        closeConsent('essential');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieConsent);
  } else {
    initCookieConsent();
  }
})();
