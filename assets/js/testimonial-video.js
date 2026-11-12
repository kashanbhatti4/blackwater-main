// Client testimonial videos on the project pages:
//   <video data-testimonial-src="<Bunny Stream playlist.m3u8 or an .mp4/.mov link>" poster="..." controls preload="none" playsinline>
// The video itself only downloads once the visitor presses play. Bunny Stream links play through hls.js so every
// browser gets a sharp adaptive stream (Firefox has no built-in HLS, and Chrome's built-in HLS sticks
// to the lowest quality); Safari and iPhone keep their own player.
(function () {
  var HLS_SCRIPT = 'https://cdn.jsdelivr.net/npm/hls.js@1';
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

  function setup(video) {
    var src = video.getAttribute('data-testimonial-src');
    var nativeHls = !!video.canPlayType('application/vnd.apple.mpegurl');

    if (!/\.m3u8(\?|$)/i.test(src) || (isAppleWebKit && nativeHls)) {
      video.src = src;
      return;
    }

    loadHls().then(function (Hls) {
      if (!Hls || !Hls.isSupported()) throw new Error('hls.js unsupported');
      var hls = new Hls({ autoStartLoad: false, capLevelToPlayerSize: true, maxBufferLength: 20 });
      hls.loadSource(src);
      hls.attachMedia(video);
      video.addEventListener('play', function () { hls.startLoad(); }, { once: true });
    }).catch(function () {
      if (nativeHls) video.src = src;
    });
  }

  function init() {
    var videos = document.querySelectorAll('video[data-testimonial-src]');
    if (!videos.length) return;

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(videos, setup);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        setup(entry.target);
      });
    }, { rootMargin: '600px 0px' });

    Array.prototype.forEach.call(videos, function (video) { observer.observe(video); });
  }

  // Wait for DOMContentLoaded so the pages' own inline HLS scripts (which pick up every
  // <video> with an .m3u8 source) have already run and skipped these source-less videos.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
