// ?¤í”„?¼ì¸ ?¬ìš©???„í•œ ?œë¹„???Œì»¤ (?¤íŠ¸?Œí¬ ?°ì„ , ?¤íŒ¨ ??ìºì‹œ)
const CACHE = 'mpython-v1.2.0';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg',
  'vendor/codemirror.js', 'js/app.js', 'js/editor.js', 'js/terminal.js', 'js/transport.js',
  'js/repl.js', 'js/boards.js', 'js/storage.js', 'js/plugins/index.js', 'js/plugins/device-info.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
