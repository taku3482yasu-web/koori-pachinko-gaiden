// オフラインでも 遊べる ように (ホーム画面に 追加)。ファイルが かわったら VERSION を 上げる (tools/bump-version.sh)
const VERSION = 'gaiden-14';
const FILES = ['./', 'index.html', 'howto.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon-192.png',
    'js/config.js', 'js/art-legacy.js', 'js/art.js', 'js/customize.js', 'js/show.js', 'js/records.js', 'js/machine.js', 'js/physics.js', 'js/board.js',
    'js/render.js', 'js/lcd.js', 'js/cabinet.js', 'js/sound-heso.js', 'js/audio.js', 'js/bgm.js', 'js/main.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// ネットに つながる ときは 新しい ものを、つながらない ときは とっておいた ものを
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
