// Client testimonial videos (project pages and the Black Friday page):
//   <div class="testimonial_video_wrap">
//     <video data-testimonial-src="<Bunny Stream playlist.m3u8 or an .mp4/.mov link>" poster="..."
//       data-testimonial-name="..." data-testimonial-company="..." data-testimonial-duration="0:34"
//       controls preload="none" playsinline></video>
//   </div>
// The native controls are swapped for a cover (play button, client name, video length) styled in
// assets/css/testimonial-video.css; they come back once the video is playing.
// The video itself only downloads once the visitor presses play. Bunny Stream links play through hls.js so every
// browser gets a sharp adaptive stream (Firefox has no built-in HLS, and Chrome's built-in HLS sticks
// to the lowest quality); Safari and iPhone keep their own player.
// Only one testimonial plays at a time. Loaded on every page and set up again after each page
// transition, because the page transitions only swap the page content (not the scripts or the <head>).
(function () {
  var HLS_SCRIPT = 'https://cdn.jsdelivr.net/npm/hls.js@1';
  // A play triangle with soft, rounded corners (the round stroke rounds them)
  var PLAY_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' +
    '<path d="M8.5 6.6v10.8L17.4 12z" fill="currentColor" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/></svg>';
  var hlsReady = null;

  var ua = navigator.userAgent;
  var isAppleWebKit = /iPad|iPhone|iPod/.test(ua) ||
    (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(ua));

  function loadHls() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (!hlsReady) {
      hlsReady = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = HLS_SCRIPT;
        s.async = true;
        s.onload = function () { resolve(window.Hls); };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    return hlsReady;
  }

  // Attaches the video source once; returns a promise that resolves when the video can be played.
  function setup(video) {
    if (video._testimonialSetup) return video._testimonialSetup;

    var src = video.getAttribute('data-testimonial-src');
    var nativeHls = !!video.canPlayType('application/vnd.apple.mpegurl');

    if (!/\.m3u8(\?|$)/i.test(src) || (isAppleWebKit && nativeHls)) {
      video.src = src;
      video._testimonialAttached = true;
      video._testimonialSetup = Promise.resolve();
      return video._testimonialSetup;
    }

    video._testimonialSetup = loadHls().then(function (Hls) {
      if (!Hls || !Hls.isSupported()) throw new Error('hls.js unsupported');
      var hls = new Hls({ autoStartLoad: false, capLevelToPlayerSize: true, maxBufferLength: 20 });
      hls.loadSource(src);
      hls.attachMedia(video);
      video.addEventListener('play', function () { hls.startLoad(); }, { once: true });
    }).catch(function () {
      if (nativeHls) video.src = src;
    }).then(function () {
      video._testimonialAttached = true;
    });
    return video._testimonialSetup;
  }

  function addCover(video) {
    var wrap = video.parentNode;
    var name = video.getAttribute('data-testimonial-name') || '';
    var company = video.getAttribute('data-testimonial-company') || '';
    var duration = video.getAttribute('data-testimonial-duration') || '';

    var cover = document.createElement('button');
    cover.type = 'button';
    cover.className = 'testimonial_video_cover';
    cover.setAttribute('aria-label', name ? 'Play ' + name + '’s video testimonial' : 'Play video testimonial');
    cover.innerHTML = '<span class="testimonial_video_play"><span class="testimonial_video_play_core">' + PLAY_ICON + '</span></span>' +
      '<span class="testimonial_video_meta" aria-hidden="true"></span>';

    var meta = cover.querySelector('.testimonial_video_meta');
    function addText(parent, className, text) {
      if (!text) return;
      var el = document.createElement('span');
      el.className = className;
      el.textContent = text;
      parent.appendChild(el);
    }
    addText(meta, 'testimonial_video_name', name);
    if (company || duration) {
      var info = document.createElement('span');
      info.className = 'testimonial_video_info';
      addText(info, 'testimonial_video_company', company);
      addText(info, 'testimonial_video_duration', duration);
      meta.appendChild(info);
    }

    video.controls = false;
    wrap.appendChild(cover);

    function play() {
      var started = video.play();
      if (started && started.catch) {
        started.catch(function () { wrap.classList.remove('is-loading'); });
      }
    }

    cover.addEventListener('click', function () {
      wrap.classList.add('is-loading');
      var ready = setup(video);
      // Play straight away while the click still counts as a user gesture (Safari needs that);
      // only wait when hls.js hasn't finished loading yet.
      if (video._testimonialAttached) play();
      else ready.then(play);
    });

    // Starting one video pauses any other testimonial that is playing
    video.addEventListener('play', function () {
      Array.prototype.forEach.call(document.querySelectorAll('video[data-testimonial-src]'), function (other) {
        if (other !== video && !other.paused) other.pause();
      });
    });

    video.addEventListener('playing', function () {
      wrap.classList.remove('is-loading');
      wrap.classList.add('is-playing');
      video.controls = true;
    });

    video.addEventListener('error', function () {
      wrap.classList.remove('is-loading');
    });

    video.addEventListener('ended', function () {
      wrap.classList.remove('is-playing');
      video.controls = false;
    });
  }

  function init(root) {
    var videos = Array.prototype.filter.call(
      (root || document).querySelectorAll('video[data-testimonial-src]'),
      function (video) { return !video.hasAttribute('data-testimonial-ready'); }
    );
    if (!videos.length) return;

    videos.forEach(function (video) {
      video.setAttribute('data-testimonial-ready', '');
      addCover(video);
    });

    if (!('IntersectionObserver' in window)) {
      videos.forEach(setup);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        setup(entry.target);
      });
    }, { rootMargin: '600px 0px' });

    videos.forEach(function (video) { observer.observe(video); });
  }

  // Components that add videos later (the testimonial slider) call this once their HTML is in
  window.bwTestimonialVideos = { init: init };

  // After a page transition, set up the videos on the page that is coming in
  if (window.barba && window.barba.hooks) {
    window.barba.hooks.beforeEnter(function (data) {
      if (data && data.next && data.next.container) init(data.next.container);
    });
  }

  // Wait for DOMContentLoaded so the pages' own inline HLS scripts (which pick up every
  // <video> with an .m3u8 source) have already run and skipped these source-less videos.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
})();
