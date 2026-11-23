// Sözlük verisi erişimi. SÖZLEŞME (imzalar sabit):
//   ara(q, {yon:'oto'|'en'|'tr', sinir}) → Promise<[{en, tur, tr[], kaynak, …}]> (dizide ek alanlar: .yon, .digerTam)
//   madde(en) → Promise<madde|null>   kokBul(bicim) → Promise<[kök…]>
//   indirmeDurumu() → {inen, toplam, bayt}   tumunuIndir(ilerlemeFn, {iptal}) → Promise   indirileniSil() → Promise
// Ağır iş (cekirdek.json 15,6 MB ayrıştırma + dizin + arama) sozluk_motor.js'te, mümkünse Web Worker içinde yapılır;
// işçi açılamazsa (file:// vb.) aynı motor ana iş parçacığında çalışır.
import { S, kelime, jsonGetir, TURLER, durumAl, durumYaz } from './veri.js';
import * as motorMod from './sozluk_motor.js';
import { enAnah, parcaAdi, DUZENSIZ } from './sozluk_motor.js';

export { enAnah, parcaAdi };
const ONBELLEK = 'kk-sozluk-v1';

const EK_TUR = {
  name: 'özel ad', prep: 'edat', conj: 'bağlaç', pron: 'zamir', intj: 'ünlem', det: 'belirleyici', num: 'sayı',
  abbrev: 'kısaltma', phrase: 'öbek', prefix: 'önek', suffix: 'sonek', particle: 'ilgeç', article: 'tanımlık',
  proverb: 'atasözü', prep_phrase: 'edat öbeği', symbol: 'simge', character: 'harf', contraction: 'kaynaşık biçim',
  adj_phrase: 'sıfat öbeği', adv_phrase: 'zarf öbeği', verb_phrase: 'fiil öbeği', noun_phrase: 'isim öbeği', idiom: 'deyim',
};
export const turAd = t => TURLER[t] || EK_TUR[t] || t || '';

/* ================================================================== motor (işçi ya da doğrudan) */
export const durum = { cekirdek: 'yok', hata: null, ag: false, ms: null, isci: null };
const dinleyiciler = new Set();
function durumBildir(y) {
  Object.assign(durum, y);
  for (const f of dinleyiciler) { try { f({ ...durum }); } catch { /* */ } }
}
/** Çekirdek yükleme durumunu dinle (gösterge için). Dinlemeyi bırakan işlev döner. */
export function durumDinle(f) { dinleyiciler.add(f); f({ ...durum }); return () => dinleyiciler.delete(f); }

const taban = () => new URL('./veri/sozluk/', document.baseURI).href;
let motorP = null, isciBozuk = false;

function isciAc(t) {
  return new Promise((ok, red) => {
    let w;
    try { w = new Worker(new URL('./sozluk_motor.js', import.meta.url), { type: 'module' }); } catch (e) { red(e); return; }
    const bek = new Map(); let no = 0, olu = false;
    const cagir = (tip, arg) => new Promise((o, r) => {
      if (olu) { r(new Error('Sözlük işçisi kapandı')); return; }
      const n = ++no; bek.set(n, { o, r }); w.postMessage({ no: n, tip, arg });
    });
    w.onmessage = e => {
      const { no: n, r, hata, ag } = e.data || {};
      const b = bek.get(n); if (!b) return; bek.delete(n);
      if (hata != null) b.r(Object.assign(new Error(hata), { ag })); else b.o(r);
    };
    w.onerror = e => {
      if (e && e.preventDefault) e.preventDefault();
      olu = true; isciBozuk = true; motorP = null;
      const h = new Error('Sözlük işçisi çalışmadı');
      for (const b of bek.values()) b.r(h);
      bek.clear(); red(h);
    };
    const zs = setTimeout(() => { olu = true; isciBozuk = true; try { w.terminate(); } catch { /* */ } red(new Error('Sözlük işçisi yanıt vermedi')); }, 8000);
    cagir('baslat', { taban: t }).then(() => { clearTimeout(zs); ok(cagir); }, red);
  });
}

function motorAc() {
  if (motorP) return motorP;
  motorP = (async () => {
    const t = taban();
    if (!isciBozuk && typeof Worker !== 'undefined' && /^(https?|app):$/.test(location.protocol)) {
      try { const c = await isciAc(t); durum.isci = true; return c; } catch (e) { console.warn('Sözlük işçisi açılamadı, ana iş parçacığında sürüyor:', e && e.message); }
    }
    await motorMod.istek('baslat', { taban: t });
    durum.isci = false;
    return (tip, arg) => motorMod.istek(tip, arg);
  })();
  return motorP;
}

let gonderilen = null;
function kompakt() {
  return S.tumu.map(k0 => { const k = kelime(k0.id) || k0; return [k.en, k.tur, (k.tr || []).slice(0, 6), k.id, k.sv || null, k.ozel ? 1 : 0]; });
}
async function cagir(tip, arg) {
  const c = await motorAc();
  if (S.tumu !== gonderilen) { const l = kompakt(); gonderilen = S.tumu; await c('kelimeler', { liste: l }); }
  try { return await c(tip, arg); }
  catch (e) {
    if (!motorP && isciBozuk) { gonderilen = null; return cagir(tip, arg); } // işçi öldü: doğrudan kipte yeniden dene
    throw e;
  }
}

let hazirP = null;
/** Çekirdeği tembel yükle (ilk gereksinimde; bir kez). Sözlük ekranı açılınca çağrılır. */
export function hazirla() {
  if (hazirP) return hazirP;
  durumBildir({ cekirdek: 'yukleniyor', hata: null, ag: false });
  const t0 = performance.now();
  hazirP = cagir('cekirdek').then(r => {
    durumBildir({ cekirdek: 'hazir', ms: Math.round(performance.now() - t0), olcum: r && r.olcum });
    return r;
  }, e => {
    hazirP = null;
    const ag = !!(e && e.ag) || (typeof navigator !== 'undefined' && navigator.onLine === false);
    durumBildir({ cekirdek: 'hata', hata: String((e && e.message) || e), ag });
    throw e;
  });
  return hazirP;
}
export const olcum = () => cagir('olcum');

/* ================================================================== hazır deste */
let desteHarita = null, desteKaynak = null;
/** Hazır deste + kendi kartlarında bu kelime (büyük-küçük / aksan duyarsız). */
export function desteBul(en) {
  if (desteKaynak !== S.tumu) {
    desteKaynak = S.tumu; desteHarita = new Map();
    for (const k of S.tumu) { const a = enAnah(k.en); if (!desteHarita.has(a)) desteHarita.set(a, []); desteHarita.get(a).push(k.id); }
  }
  return (desteHarita.get(enAnah(en)) || []).map(id => kelime(id)).filter(Boolean);
}

/* ================================================================== arama */
export async function ara(q, { yon = 'oto', sinir = 20 } = {}) {
  hazirla().catch(() => {});
  const r = await cagir('ara', { q, yon, sinir });
  const sonuc = r.sonuc || [];
  sonuc.yon = r.yon; sonuc.digerTam = !!r.digerTam;
  return sonuc;
}

/** Çekimli biçimden kökler ("running" → ["run"], "better" → ["good","well"]). Kendisi dahil değil. */
export async function kokBul(bicim) {
  try { return await cagir('kokler', { bicim }); }
  catch { return [...(DUZENSIZ.get(enAnah(bicim)) || [])]; }
}

/** Tıklanan kelimenin çevresinde öbek ("look after", "in spite of"). adaylar: [[kelime…]…] uzundan kısaya. */
export async function obekBul(adaylar) {
  if (!adaylar || !adaylar.length) return null;
  try { return await cagir('obek', { adaylar }); } catch { return null; }
}

/* ================================================================== madde */
/** Deste kelimeleri + sözlük satırlarını tek maddede birleştir (saf). */
export function maddeBirlestir(en, deste = [], cek = [], par = null, { parcaDurum = 'yok', cekirdek = true } = {}) {
  const satir = par && par.length ? par : (cek || []);
  if (!deste.length && !satir.length) return null;
  const gruplar = [];
  const grup = (kelime, tur) => {
    let g = gruplar.find(x => x.tur === tur && x.kelime === kelime);
    if (!g) { g = { kelime, tur: tur || 'diger', tr: [], tanimlar: [], es: [] }; gruplar.push(g); }
    return g;
  };
  const ekle = (dizi, xs, n = 99) => { for (const x of xs || []) if (x && dizi.length < n && !dizi.some(y => String(y).toLowerCase() === String(x).toLowerCase())) dizi.push(x); };
  let ipa = null;
  for (const k of deste) {
    const g = grup(k.en, k.tur);
    ekle(g.tr, k.tr); ekle(g.es, k.es);
    if (k.tanim && !g.tanimlar.some(t => t[0] === k.tanim)) g.tanimlar.push([k.tanim, null]);
    ipa = ipa || k.ipa;
  }
  for (const r of satir) {
    const g = deste.length && deste.some(k => k.tur === r[1] && enAnah(k.en) === enAnah(r[0])) ? grup(deste.find(k => k.tur === r[1] && enAnah(k.en) === enAnah(r[0])).en, r[1]) : grup(r[0], r[1]);
    ekle(g.tr, r[3], 10); ekle(g.es, r[5], 10);
    for (const t of r[4] || []) if (t && t[0] && !g.tanimlar.some(x => x[0] === t[0])) g.tanimlar.push([t[0], t[1] || null]);
    ipa = ipa || r[2];
  }
  const d0 = deste[0];
  const ana = d0 ? d0.en : (satir.find(r => r[0] === en) || satir.find(r => r[0] === r[0].toLowerCase()) || satir[0])[0];
  const tr = [], es = [];
  for (const g of gruplar) { ekle(tr, g.tr, 12); ekle(es, g.es, 12); }
  const ornekK = deste.find(k => k.oe);
  const kaynak = [];
  if (deste.some(k => !k.ozel)) kaynak.push('deste');
  if (deste.some(k => k.ozel)) kaynak.push('ozel');
  if (par && par.length) kaynak.push('parca'); else if (cek && cek.length) kaynak.push('cekirdek');
  return {
    en: ana, ipa: ipa || null, sv: d0 ? d0.sv : null, svt: d0 ? d0.svt : 0, id: d0 ? d0.id : null, ozel: !!(d0 && d0.ozel),
    turler: [...new Set(gruplar.map(g => g.tur))], gruplar, tr, es,
    tanim: (gruplar.find(g => g.tanimlar.length) || { tanimlar: [[null]] }).tanimlar[0][0],
    ornek: ornekK ? { oe: ornekK.oe, ot: ornekK.ot, ob: ornekK.ob, otyz: ornekK.otyz } : null,
    kaynak, tam: !!(par && par.length) || (parcaDurum === 'yok' && cekirdek),
    baglantiGerekli: parcaDurum === 'ag' || (!cekirdek && parcaDurum !== 'tamam'),
  };
}

/** Birleşik madde: önce kelimeler.json, sonra çekirdek, sonra ilgili iki harfli parça. */
export async function madde(en, { parca = true } = {}) {
  if (!en || !String(en).trim()) return null;
  const deste = desteBul(en);
  let r = { cek: [], par: null, parcaDurum: 'ag', cekirdek: false };
  try { r = await cagir('satirlar', { en, parca }); } catch { /* çevrimdışı ve önbellekte yok: yalnız deste */ }
  return maddeBirlestir(en, deste, r.cek, r.par, { parcaDurum: r.parcaDurum, cekirdek: r.cekirdek });
}

/* ================================================================== son aramalar */
export const sonAramalar = () => (durumAl('sonAramalar', []) || []).filter(x => typeof x === 'string');
export function sonAramaEkle(q) {
  q = String(q || '').trim(); if (!q) return;
  durumYaz('sonAramalar', [q, ...sonAramalar().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 20));
}
export function sonAramaTemizle() { durumYaz('sonAramalar', []); }

/* ================================================================== tam sözlüğü indirme (691 parça) */
const yerelMi = () => !/^https?:$/.test(location.protocol) || typeof caches === 'undefined';
let dizinP = null;
function dizinAl() {
  if (!dizinP) dizinP = jsonGetir(taban() + 'dizin.json').catch(e => { dizinP = null; throw e; });
  return dizinP;
}
const parcaAdiUrl = u => { try { return decodeURIComponent(new URL(u).pathname).split('/').pop().replace(/\.json$/, ''); } catch { return ''; } };
const kotaMi = e => !!e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota|kota|space/i.test(String(e.message)));
const mb = b => (b / 1048576).toFixed(0);
function kotaHatasi(gerek) {
  return Object.assign(new Error(`Cihazda yer kalmadı${gerek ? `: tam sözlük için yaklaşık ${mb(gerek)} MB boş alan gerekiyor` : ''}. İndirilen parçalar duruyor; yer açıp yeniden başlatırsanız kaldığı yerden sürer.`), { kota: true });
}

async function onbellekteki() {
  const c = await caches.open(ONBELLEK);
  const keys = await c.keys();
  return { c, var_: new Set(keys.map(r => parcaAdiUrl(r.url))) };
}

export async function indirmeDurumu() {
  let d;
  try { d = await dizinAl(); } catch { return { inen: 0, toplam: 0, bayt: 0, toplamBayt: 0, hata: true }; }
  const ps = d.parcalar || {}; const adlar = Object.keys(ps);
  const toplam = adlar.length, toplamBayt = adlar.reduce((s, a) => s + (ps[a].bayt || 0), 0);
  if (yerelMi()) return { inen: toplam, toplam, bayt: toplamBayt, toplamBayt, yerel: true };
  const { var_ } = await onbellekteki();
  let inen = 0, bayt = 0;
  for (const a of adlar) if (var_.has(a)) { inen++; bayt += ps[a].bayt || 0; }
  return { inen, toplam, bayt, toplamBayt };
}

/**
 * Bütün parçaları önbelleğe indir. Kaldığı yerden sürer (önbellekte olanlar atlanır).
 * @param {(d:{inen,toplam,bayt,toplamBayt})=>void} ilerlemeFn
 * @param {{iptal?: AbortSignal|(()=>boolean), eszaman?: number}} o
 */
export async function tumunuIndir(ilerlemeFn, { iptal = null, eszaman = 4 } = {}) {
  if (yerelMi()) { const d = await indirmeDurumu(); if (ilerlemeFn) ilerlemeFn(d); return d; }
  const d = await dizinAl();
  const ps = d.parcalar || {}; const adlar = Object.keys(ps).sort();
  const toplam = adlar.length, toplamBayt = adlar.reduce((s, a) => s + (ps[a].bayt || 0), 0);
  const { c, var_ } = await onbellekteki();
  const eksik = adlar.filter(a => !var_.has(a));
  let inen = toplam - eksik.length, bayt = adlar.filter(a => var_.has(a)).reduce((s, a) => s + (ps[a].bayt || 0), 0);
  const bildirim = son => { if (ilerlemeFn) { try { ilerlemeFn({ inen, toplam, bayt, toplamBayt, son }); } catch { /* */ } } };
  bildirim(null);
  if (!eksik.length) return { inen, toplam, bayt, toplamBayt };
  const gerek = eksik.reduce((s, a) => s + (ps[a].bayt || 0), 0);
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { quota, usage } = await navigator.storage.estimate();
      if (quota && usage != null && quota - usage < gerek) throw kotaHatasi(gerek);
    }
  } catch (e) { if (e.kota) throw e; }
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch { /* */ }
  const sinyal = iptal && typeof iptal === 'object' && 'aborted' in iptal ? iptal : undefined;
  const iptalMi = () => (typeof iptal === 'function' ? !!iptal() : !!(sinyal && sinyal.aborted));
  let i = 0, hata = null;
  const bekle = ms => new Promise(r => setTimeout(r, ms));
  const isci = async () => {
    while (!hata && i < eksik.length && !iptalMi()) {
      const a = eksik[i++];
      const url = taban() + a + '.json';
      let y = null;
      for (let deneme = 0; ; deneme++) {
        try {
          y = await fetch(url, { signal: sinyal, cache: 'no-store' });
          if (!y.ok) throw Object.assign(new Error('HTTP ' + y.status), { durum: y.status });
          break;
        } catch (e) {
          if (e.name === 'AbortError' || iptalMi()) return;
          if (deneme >= 2) { hata = Object.assign(new Error('Bağlantı kesildi; indirilen parçalar saklandı. Yeniden başlatınca kaldığı yerden sürer.'), { ag: true }); return; }
          await bekle(700 * (deneme + 1));
        }
      }
      try { await c.put(url, y); } catch (e) { hata = kotaMi(e) ? kotaHatasi(gerek) : e; return; }
      inen++; bayt += ps[a].bayt || 0;
      bildirim(a);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(8, eszaman)) }, isci));
  if (hata) throw hata;
  return { inen, toplam, bayt, toplamBayt, iptal: iptalMi() };
}

/** İndirilen parçaları sil (çekirdek ve dizinler kalır). Silinen parça sayısını döndürür. */
export async function indirileniSil() {
  if (yerelMi()) return 0;
  const c = await caches.open(ONBELLEK);
  let n = 0;
  for (const r of await c.keys()) {
    const a = parcaAdiUrl(r.url);
    if (/^[a-z0-9_]{2}$/.test(a)) { await c.delete(r); n++; }
  }
  return n;
}
