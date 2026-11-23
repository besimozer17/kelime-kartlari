// Kalıcı depo: IndexedDB (şema sürümlü); açılamazsa bellek içi yedek (özel sekme vb.).
// Bütün kullanıcı verisi açılışta belleğe alınır (birkaç bin kayıt), yazmalar arka planda IndexedDB'ye gider.

export const DB_AD = 'kelime-karti';
export const SEMA = 1;
export const DEPOLAR = {
  ilerleme: 'k',      // { k: "id|yon", id, yon, ...tekrar kaydı }
  meta: 'id',         // { id, zor, not, kabulTr[], kabulEn[], duzelt{}, cikar, eklenme }
  ozel: 'id',         // kendi kartları: { id: "~xxxx", en, tr[], tur, sv, oe, ot, not, olusturma, guncelleme }
  desteler: 'id',     // kendi desteleri: { id: "d~xxxx", ad, kelimeler[], olusturma }
  gunluk: 'gun',      // { gun: "YYYY-AA-GG", kart, dogru, neredeyse, yanlis, puan, sure, yeni }
  oturumlar: 'no',    // oturum özetleri (autoIncrement)
  durum: 'k',         // { k, v } : aktifOturum, xp, enIyi, sonAramalar, ayar …
};

let db = null;
let bellek = null; // IndexedDB yoksa: { depo: Map }
export const bilgi = { kalici: false, bellekte: false, hata: null, persist: null };

function istek(r) {
  return new Promise((ok, red) => { r.onsuccess = () => ok(r.result); r.onerror = () => red(r.error); });
}

/** Depoyu aç. Hata vermez; bellek içi yedeğe düşer. */
export async function ac() {
  try {
    if (!('indexedDB' in globalThis) || !indexedDB) throw new Error('IndexedDB yok');
    db = await new Promise((ok, red) => {
      const r = indexedDB.open(DB_AD, SEMA);
      const zaman = setTimeout(() => red(new Error('IndexedDB yanıt vermedi')), 6000);
      r.onupgradeneeded = e => {
        const d = r.result;
        // Göç: e.oldVersion'a göre adım adım (şema 1 = ilk sürüm)
        if (e.oldVersion < 1) {
          for (const [ad, anahtar] of Object.entries(DEPOLAR)) {
            if (!d.objectStoreNames.contains(ad)) d.createObjectStore(ad, ad === 'oturumlar' ? { keyPath: anahtar, autoIncrement: true } : { keyPath: anahtar });
          }
        }
      };
      r.onsuccess = () => { clearTimeout(zaman); ok(r.result); };
      r.onerror = () => { clearTimeout(zaman); red(r.error); };
      r.onblocked = () => { clearTimeout(zaman); red(new Error('Veritabanı başka bir sekmede eski sürümle açık')); };
    });
    db.onversionchange = () => { db.close(); location.reload(); };
    // küçük bir yazma denemesi (Safari özel sekmesi vb. açar ama yazamaz)
    await koy('durum', { k: '_deneme', v: Date.now() });
    bilgi.kalici = true;
  } catch (e) {
    db = null;
    bellek = Object.fromEntries(Object.keys(DEPOLAR).map(k => [k, new Map()]));
    bilgi.bellekte = true; bilgi.hata = String(e && e.message || e);
  }
  try {
    if (navigator.storage && navigator.storage.persist) {
      bilgi.persist = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    }
  } catch { /* yok say */ }
  return bilgi;
}

function tx(ad, kip = 'readonly') { return db.transaction(ad, kip).objectStore(ad); }

export async function hepsi(ad) {
  if (!db) return [...bellek[ad].values()].map(x => structuredClone(x));
  return istek(tx(ad).getAll());
}
export async function al(ad, anahtar) {
  if (!db) { const v = bellek[ad].get(anahtar); return v ? structuredClone(v) : undefined; }
  return istek(tx(ad).get(anahtar));
}
export async function koy(ad, nesne) {
  if (!db) {
    if (ad === 'oturumlar' && nesne.no == null) nesne.no = bellek[ad].size + 1;
    bellek[ad].set(nesne[DEPOLAR[ad]], structuredClone(nesne)); return nesne[DEPOLAR[ad]];
  }
  // commit(): yazma hemen kesinleşsin (iOS / WebKit'te uygulama hemen kapatılırsa son yanıt kaybolmasın)
  const d = tx(ad, 'readwrite'), r = d.put(nesne);
  try { d.transaction.commit && d.transaction.commit(); } catch { /* eski tarayıcı */ }
  return istek(r);
}
export async function sil(ad, anahtar) {
  if (!db) { bellek[ad].delete(anahtar); return; }
  return istek(tx(ad, 'readwrite').delete(anahtar));
}
export async function temizle(ad) {
  if (!db) { bellek[ad].clear(); return; }
  return istek(tx(ad, 'readwrite').clear());
}
/** Çok kaydı tek işlemde yaz. */
export async function toplu(ad, nesneler) {
  if (!nesneler.length) return;
  if (!db) { for (const n of nesneler) await koy(ad, n); return; }
  await new Promise((ok, red) => {
    const t = db.transaction(ad, 'readwrite');
    const s = t.objectStore(ad);
    for (const n of nesneler) s.put(n);
    t.oncomplete = () => ok(); t.onerror = () => red(t.error); t.onabort = () => red(t.error);
  });
}

/* ---------- küçük ayarlar: localStorage (eşzamanlı okunur; tema ilk boyamada) */
const AYAR_ANAHTAR = 'kk.ayar';
export function ayarOku() {
  try { return JSON.parse(localStorage.getItem(AYAR_ANAHTAR) || '{}') || {}; } catch { return {}; }
}
export function ayarYaz(a) {
  try { localStorage.setItem(AYAR_ANAHTAR, JSON.stringify(a)); } catch { /* özel sekme */ }
  koy('durum', { k: 'ayar', v: a }).catch(() => {});
}
