// Kelime Kartı service worker — sürümlü uygulama kabuğu + kelime verisi; sözlük parçaları çalışma anında.
// Yeni sürüm: SURUM'u artır. Yeni SW beklemede kalır; sayfa "Yeni sürüm hazır" şeridiyle {tip:'atla'} gönderince devreye girer.
const SURUM = '1.1.1';
const KABUK = 'kk-kabuk-' + SURUM;
const VERI = 'kk-veri-v1';      // kelimeler.json (bayat-iken-yenile)
const SOZLUK = 'kk-sozluk-v1';  // sözlük parçaları (önce önbellek); Ayarlar'dan indirilenler de burada

const KABUK_DOSYALARI = [
  './', './index.html', './manifest.webmanifest', './css/uygulama.css',
  './js/app.js', './js/veri.js', './js/depo.js', './js/metin.js', './js/denetim.js', './js/tekrar.js',
  './js/puan.js', './js/oturum.js', './js/ui.js', './js/ses.js', './js/ekran/calis.js',
  './css/sozluk.css', './js/sozluk.js', './js/sozluk_motor.js', './js/balon.js', './js/ekran/sozluk.js',
  './js/ekran/liste.js', './js/ekran/kelime.js', './js/ekran/kart.js', './js/ekran/istatistik.js', './js/ekran/ayarlar.js',
  './simge/favicon.svg', './simge/apple-touch-icon.png', './simge/simge-192.png', './simge/simge-512.png', './simge/simge-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(KABUK);
    await c.addAll(KABUK_DOSYALARI);
    try { const v = await caches.open(VERI); await v.add('./veri/kelimeler.json'); } catch { /* veri yoksa kurulum yine de olur */ }
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const ad of await caches.keys()) if (ad.startsWith('kk-kabuk-') && ad !== KABUK) await caches.delete(ad);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data && e.data.tip === 'atla') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== location.origin) return;
  const yol = url.pathname;
  if (yol.includes('/veri/sozluk/')) { e.respondWith(oncelikOnbellek(r, SOZLUK)); return; }
  if (yol.endsWith('/veri/kelimeler.json') || yol.includes('/veri/')) { e.respondWith(bayatIkenYenile(r, VERI)); return; }
  if (r.mode === 'navigate') {
    e.respondWith((async () => (await caches.match('./index.html', { cacheName: KABUK })) || fetch(r))());
    return;
  }
  e.respondWith((async () => (await caches.match(r, { ignoreSearch: true })) || fetch(r))());
});

async function oncelikOnbellek(r, ad) {
  const c = await caches.open(ad);
  const var_ = await c.match(r, { ignoreSearch: true });
  if (var_) return var_;
  const y = await fetch(r);
  if (y.ok) c.put(r, y.clone());
  return y;
}

async function bayatIkenYenile(r, ad) {
  const c = await caches.open(ad);
  const var_ = await c.match(r, { ignoreSearch: true });
  const ag = fetch(r).then(y => { if (y.ok) c.put(r, y.clone()); return y; }).catch(() => null);
  return var_ || (await ag) || new Response('{"hata":"çevrimdışı"}', { status: 503, headers: { 'Content-Type': 'application/json' } });
}
