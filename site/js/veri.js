// Uygulama durumu: hazır kelime verisi + kullanıcı verisi (bellekte), dizinler, kalıcı yazma.
import * as depo from './depo.js';
import { gunNo, gunTarih, durum as kayitDurum, zorlandi, guncelle, oturumIciDogru } from './tekrar.js';
import { trKatli, enAnahtar } from './denetim.js';
import { aksansiz } from './metin.js';

export const UYGULAMA_SURUM = '1.1.0';
export const SEVIYELER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const TURLER = {
  noun: 'isim', verb: 'fiil', adj: 'sıfat', adv: 'zarf', phrasal: 'öbek fiil', baglac: 'bağlaç',
  edat: 'edat', deyim: 'deyim', esdizim: 'eşdizim', zamir: 'zamir', diger: 'diğer',
};
export const ZORLUK = { kolay: [1, 2], orta: [3], zor: [4, 5] };
export const zorlukAd = z => (z <= 2 ? 'kolay' : z === 3 ? 'orta' : 'zor');

const VARSAYILAN_AYAR = {
  tema: 'sistem', hedef: 20, aksan: 'en-US', hiz: 1, otoOku: false, tolerans: 'normal', boy: 20,
  kurulum: { kaynak: 'hepsi', sv: [], zor: [], deste: '', kip: 'et', sira: 'karisik', boy: 20, oran: 'dengeli' },
};

export const S = {
  hazir: false, veriDurum: 'yukleniyor', veriHata: null, surum: null,
  hazirKelimeler: [], desteler: [], ozel: new Map(), ozelDesteler: new Map(),
  ilerleme: new Map(), meta: new Map(), gunluk: new Map(), durumlar: new Map(),
  ayar: { ...VARSAYILAN_AYAR, ...depo.ayarOku() },
  tumu: [], byId: new Map(), _birlesik: new Map(),
  trHarita: new Map(), enKume: new Set(), trKume: new Set(),
};
S.ayar.kurulum = { ...VARSAYILAN_AYAR.kurulum, ...(S.ayar.kurulum || {}) };

/* ------------------------------------------------------------------ yükleme */

/** JSON getir: fetch, olmazsa XHR (Electron file:// için). */
export async function jsonGetir(yol, { sinyal } = {}) {
  try {
    const r = await fetch(yol, { signal: sinyal, cache: 'no-cache' });
    if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { durum: r.status });
    return await r.json();
  } catch (e) {
    if (e.name === 'AbortError' || e.durum === 404) throw e;
    if (location.protocol === 'http:' || location.protocol === 'https:') throw e;
    return new Promise((ok, red) => {
      const x = new XMLHttpRequest();
      x.open('GET', yol); x.responseType = 'json';
      x.onload = () => (x.response ? ok(x.response) : red(new Error('Okunamadı: ' + yol)));
      x.onerror = () => red(new Error('Okunamadı: ' + yol));
      x.send();
    });
  }
}

export async function yukle() {
  const [ac] = await Promise.all([depo.ac()]);
  const [ilerleme, meta, ozel, desteler, gunluk, durumlar] = await Promise.all(
    ['ilerleme', 'meta', 'ozel', 'desteler', 'gunluk', 'durum'].map(d => depo.hepsi(d).catch(() => [])));
  for (const x of ilerleme) S.ilerleme.set(x.k, x);
  for (const x of meta) S.meta.set(x.id, x);
  for (const x of ozel) S.ozel.set(x.id, x);
  for (const x of desteler) S.ozelDesteler.set(x.id, x);
  for (const x of gunluk) S.gunluk.set(x.gun, x);
  for (const x of durumlar) S.durumlar.set(x.k, x.v);
  if (!Object.keys(depo.ayarOku()).length && S.durumlar.get('ayar')) {
    S.ayar = { ...VARSAYILAN_AYAR, ...S.durumlar.get('ayar') };
  }
  try {
    const v = await jsonGetir('./veri/kelimeler.json');
    if (!v || !Array.isArray(v.kelimeler)) throw new Error('Beklenmeyen veri biçimi');
    S.surum = v.surum; S.desteler = v.desteler || []; S.hazirKelimeler = v.kelimeler;
    S.veriDurum = 'tamam';
  } catch (e) {
    S.veriDurum = e.durum === 404 ? 'yok' : 'hata'; S.veriHata = String(e.message || e);
  }
  dizinKur();
  S.hazir = true;
  return ac;
}

/** Birleşik liste ve aramaya / denetime yarayan dizinler. */
export function dizinKur() {
  S._birlesik.clear();
  S.tumu = [...S.hazirKelimeler, ...[...S.ozel.values()].map(ozelKelime)];
  S.byId = new Map(S.tumu.map(k => [k.id, k]));
  S.trHarita = new Map(); S.enKume = new Set(); S.trKume = new Set();
  for (const k0 of S.tumu) {
    const k = kelime(k0.id);
    S.enKume.add(enAnahtar(k.en));
    for (const t of k.tr || []) {
      const a = trKatli(t);
      S.trKume.add(a);
      if (!S.trHarita.has(a)) S.trHarita.set(a, new Set());
      S.trHarita.get(a).add(k.en);
    }
  }
}

function ozelKelime(o) {
  return {
    id: o.id, en: o.en, tur: o.tur || 'diger', ipa: o.ipa || null, sv: o.sv || null, svt: 0, zipf: o.zipf ?? 0, zor: o.zor || 3,
    tr: o.tr || [], tanim: o.tanim || null, oe: o.oe || null, ot: o.ot || null, otyz: 0, ob: o.ob || bulAralik(o.oe, o.en),
    es: o.es || [], d: [], onem: null, ozel: true, not: o.not || '', olusturma: o.olusturma,
  };
}

/** Örnek cümlede kelimenin (ya da basit çekiminin) yerini bul. */
export function bulAralik(oe, en) {
  if (!oe || !en) return null;
  const kok = en.toLowerCase().replace(/^to /, '');
  const kaliplar = [kok, kok.replace(/e$/, '') + 'ed', kok + 'ed', kok + 's', kok + 'es', kok.replace(/e$/, '') + 'ing', kok + 'ing', kok.replace(/y$/, 'ies'), kok.replace(/y$/, 'ied')];
  const kucuk = oe.toLowerCase();
  let en_iyi = null;
  for (const k of kaliplar) {
    const re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    const m = re.exec(kucuk);
    if (m && (!en_iyi || m[0].length > en_iyi[1] - en_iyi[0])) en_iyi = [m.index, m.index + m[0].length];
  }
  return en_iyi;
}

/** Kullanıcı düzeltmesi bindirilmiş kelime (önbellekli). */
export function kelime(id) {
  if (S._birlesik.has(id)) return S._birlesik.get(id);
  const k = S.byId.get(id);
  if (!k) return null;
  const m = S.meta.get(id);
  let sonuc = k;
  if (m && m.duzelt && Object.keys(m.duzelt).length) {
    sonuc = { ...k, ...m.duzelt, _orj: k };
    if (m.duzelt.oe !== undefined && m.duzelt.ob === undefined) sonuc.ob = bulAralik(sonuc.oe, sonuc.en);
  }
  S._birlesik.set(id, sonuc);
  return sonuc;
}

/* ------------------------------------------------------------------ ilerleme */

export const bugun = () => gunNo();
export const kayit = (id, yon) => S.ilerleme.get(id + '|' + yon) || null;

export function kayitYaz(id, yon, k) {
  const n = { ...k, k: id + '|' + yon, id, yon };
  S.ilerleme.set(n.k, n);
  depo.koy('ilerleme', n).catch(hataBildir);
  return n;
}

/** Bir yanıtı ilerlemeye işle. tekrarMi: aynı oturumda yeniden soruluyor. */
export function yanitKaydet(id, yon, sonuc, { tekrarMi = false } = {}) {
  const g = bugun();
  const once = kayit(id, yon);
  let k;
  if (tekrarMi) {
    k = sonuc === 'yanlis' ? (once || guncelle(null, 'yanlis', g)) : oturumIciDogru(once, g);
    if (!k) return null;
  } else {
    const s = sonuc === 'esanlam' ? 'dogru' : sonuc;
    k = guncelle(once, s, g);
  }
  return kayitYaz(id, yon, k);
}

/** Kelimenin genel durumu: görülen yönlerin en zayıfı. */
export function kelimeDurum(id) {
  const a = kayit(id, 'et'), b = kayit(id, 'te');
  const gor = [a, b].filter(x => x && x.son != null);
  if (!gor.length) return 'yeni';
  const enAz = gor.reduce((m, x) => (x.kutu < m.kutu ? x : m));
  return kayitDurum(enAz);
}
export function zorMu(id) {
  const m = S.meta.get(id);
  return zorlandi(kayit(id, 'et'), !!(m && m.zor)) || zorlandi(kayit(id, 'te'));
}
export function yanlisSayisi(id) {
  return (kayit(id, 'et')?.yanlis || 0) + (kayit(id, 'te')?.yanlis || 0);
}
export function sonCalisma(id) {
  return Math.max(kayit(id, 'et')?.son ?? -1, kayit(id, 'te')?.son ?? -1);
}

/* ------------------------------------------------------------------ meta (not, zor, kabul, düzeltme) */

export function meta(id) { return S.meta.get(id) || { id }; }
export function metaYaz(id, yama) {
  const m = { ...meta(id), ...yama, id };
  S.meta.set(id, m);
  S._birlesik.delete(id);
  depo.koy('meta', m).catch(hataBildir);
  return m;
}
export function kabulEkle(id, alan, deger) {
  const m = meta(id);
  const liste = [...new Set([...(m[alan] || []), deger.trim()])].filter(Boolean);
  return metaYaz(id, { [alan]: liste });
}
export function duzeltKaydet(id, duzelt) {
  const m = metaYaz(id, { duzelt });
  dizinKur();
  return m;
}
export function ozguneDon(id) { return duzeltKaydet(id, {}); }

/* ------------------------------------------------------------------ kendi kartları ve desteleri */

export const yeniId = (on = '~') => on + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export async function kartKaydet(o) {
  const simdi = Date.now();
  const n = { ...o, id: o.id || yeniId('~'), olusturma: o.olusturma || simdi, guncelleme: simdi };
  S.ozel.set(n.id, n);
  await depo.koy('ozel', n).catch(hataBildir);
  dizinKur();
  return n;
}
/** Çok kartı tek işlemde kaydet (toplu ekleme; dizin bir kez kurulur). */
export async function kartlarKaydet(liste) {
  const simdi = Date.now();
  const yeni = liste.map((o, i) => ({ ...o, id: o.id || yeniId('~'), olusturma: o.olusturma || simdi + i, guncelleme: simdi }));
  for (const n of yeni) S.ozel.set(n.id, n);
  await depo.toplu('ozel', yeni).catch(hataBildir);
  dizinKur();
  return yeni;
}
export async function kartSil(id) {
  const o = S.ozel.get(id);
  S.ozel.delete(id);
  await depo.sil('ozel', id).catch(hataBildir);
  dizinKur();
  return o;
}
export async function desteKaydet(d) {
  const n = { kelimeler: [], ...d, id: d.id || yeniId('d~'), olusturma: d.olusturma || Date.now() };
  S.ozelDesteler.set(n.id, n);
  await depo.koy('desteler', n).catch(hataBildir);
  return n;
}
export async function desteSil(id) {
  const d = S.ozelDesteler.get(id);
  S.ozelDesteler.delete(id);
  await depo.sil('desteler', id).catch(hataBildir);
  return d;
}
export async function desteyeEkle(desteId, ids) {
  const d = S.ozelDesteler.get(desteId);
  if (!d) return;
  d.kelimeler = [...new Set([...d.kelimeler, ...ids])];
  return desteKaydet(d);
}
export async function destedenCikar(desteId, id) {
  const d = S.ozelDesteler.get(desteId);
  if (!d) return;
  d.kelimeler = d.kelimeler.filter(x => x !== id);
  return desteKaydet(d);
}
/** Bütün desteler (hazır + kendi), seçim listeleri için. */
export function tumDesteler() {
  return [
    ...S.desteler.map((d, i) => ({ id: 'h' + i, kod: d.kod, ad: d.ad, adet: d.adet, grup: d.grup, hazir: true })),
    ...[...S.ozelDesteler.values()].map(d => ({ id: d.id, kod: d.id, ad: d.ad, adet: d.kelimeler.filter(x => S.byId.has(x)).length, grup: 'kendi', hazir: false })),
  ];
}
export function destedeMi(k, desteKod) {
  if (!desteKod) return true;
  if (desteKod.startsWith('d~')) return !!S.ozelDesteler.get(desteKod)?.kelimeler.includes(k.id);
  const i = S.desteler.findIndex(d => d.kod === desteKod);
  return i >= 0 && Array.isArray(k.d) && k.d.includes(i);
}

/* ------------------------------------------------------------------ günlük, XP, durum */

export function durumAl(k, v0 = null) { return S.durumlar.has(k) ? S.durumlar.get(k) : v0; }
export function durumYaz(k, v) {
  S.durumlar.set(k, v);
  depo.koy('durum', { k, v }).catch(hataBildir);
}
export function gunlukEkle(yama) {
  const g = gunTarih(bugun());
  const o = S.gunluk.get(g) || { gun: g, kart: 0, dogru: 0, neredeyse: 0, yanlis: 0, puan: 0, sure: 0, yeni: 0 };
  for (const [a, v] of Object.entries(yama)) o[a] = (o[a] || 0) + v;
  S.gunluk.set(g, o);
  depo.koy('gunluk', o).catch(hataBildir);
  return o;
}
export const bugunku = () => S.gunluk.get(gunTarih(bugun())) || { kart: 0, dogru: 0, puan: 0, yeni: 0, sure: 0 };
export const xp = () => durumAl('xp', 0);
export function xpEkle(n) { durumYaz('xp', xp() + n); }

/* ------------------------------------------------------------------ ayarlar */

export function ayarKaydet(yama) {
  S.ayar = { ...S.ayar, ...yama };
  depo.ayarYaz(S.ayar);
}

/* ------------------------------------------------------------------ süzme (liste + çalışma kaynağı) */

/** Aksansız arama metni (tembel). */
export function aramaMetni(k) {
  if (!k._ara) Object.defineProperty(k, '_ara', { value: aksansiz(k.en + ' \u0001 ' + (k.tr || []).join(' · ')), writable: true, enumerable: false });
  return k._ara;
}

/**
 * @param {{q?:string, sv?:string[], zor?:string[], tur?:string[], deste?:string, durum?:string[], ozel?:boolean, zorlar?:boolean, vade?:boolean, cikarHaric?:boolean}} f
 */
export function suz(f = {}) {
  const q = f.q ? aksansiz(f.q.trim()) : '';
  const sv = f.sv && f.sv.length ? new Set(f.sv) : null;
  // zorluk: 'kolay'|'orta'|'zor' ya da 1..5 dilim
  const zr = f.zor && f.zor.length ? new Set(f.zor.flatMap(z => ZORLUK[z] || [Number(z)])) : null;
  const tur = f.tur && f.tur.length ? new Set(f.tur) : null;
  const dur = f.durum && f.durum.length ? new Set(f.durum) : null;
  const g = bugun();
  const sonuc = [];
  for (const k0 of S.tumu) {
    const k = kelime(k0.id);
    if (f.cikarHaric && S.meta.get(k.id)?.cikar) continue;
    if (f.ozel && !k.ozel) continue;
    if (sv && !sv.has(k.sv)) continue;
    if (zr && !zr.has(k.zor)) continue;
    if (tur && !tur.has(k.tur)) continue;
    if (f.deste && !destedeMi(k, f.deste)) continue;
    if (f.zorlar && !zorMu(k.id)) continue;
    if (f.vade) {
      const a = kayit(k.id, 'et'), b = kayit(k.id, 'te');
      if (!((a && a.son != null && a.vade <= g) || (b && b.son != null && b.vade <= g))) continue;
    }
    if (dur) {
      const d = kelimeDurum(k.id);
      // 'ozel' (kendi kartlarım) ve 'cikar' (çıkarılanlar) da durum seçeneği; seçilenler VEYA ile birleşir
      if (!(dur.has(d) || (dur.has('zor') && zorMu(k.id)) || (dur.has('ozel') && k.ozel) || (dur.has('cikar') && S.meta.get(k.id)?.cikar))) continue;
    }
    if (q && !aramaMetni(k).includes(q)) continue;
    sonuc.push(k);
  }
  return sonuc;
}

/** Tekrar zamanı gelen (kelime, yön) sayısı. */
export function vadeliSayisi() {
  const g = bugun();
  let n = 0;
  for (const x of S.ilerleme.values()) if (x.son != null && x.vade <= g && S.byId.has(x.id) && !S.meta.get(x.id)?.cikar) n++;
  return n;
}

/** Türkçe karşılığı taşıyan İngilizce kelimeler (eşanlam denetimi). */
export function trdenEn(t) { return [...(S.trHarita.get(trKatli(t)) || [])]; }

/* ------------------------------------------------------------------ yedek */

export async function yedekAl() {
  const [ilerleme, meta, ozel, desteler, gunluk, oturumlar, durum] = await Promise.all(
    ['ilerleme', 'meta', 'ozel', 'desteler', 'gunluk', 'oturumlar', 'durum'].map(d => depo.hepsi(d)));
  return {
    uygulama: 'kelime-karti', sema: depo.SEMA, uygulamaSurum: UYGULAMA_SURUM, veriSurum: S.surum, tarih: new Date().toISOString(),
    ayar: S.ayar, ilerleme, meta, ozel, desteler, gunluk, oturumlar, durum: durum.filter(d => d.k !== '_deneme' && d.k !== 'aktifOturum'),
  };
}

/** Yedek dosyasını doğrula; sorun varsa anlaşılır hata fırlatır. */
export function yedekDogrula(o) {
  if (!o || typeof o !== 'object') throw new Error('Dosya bir yedek değil (JSON nesnesi bekleniyordu).');
  if (o.uygulama !== 'kelime-karti') throw new Error('Bu dosya Kelime Kartı yedeği değil.');
  if (typeof o.sema !== 'number') throw new Error('Yedekte şema sürümü yok; dosya bozuk olabilir.');
  if (o.sema > depo.SEMA) throw new Error(`Yedek daha yeni bir uygulama sürümünden (şema ${o.sema}). Önce uygulamayı güncelleyin.`);
  for (const a of ['ilerleme', 'meta', 'ozel', 'desteler', 'gunluk']) {
    if (o[a] != null && !Array.isArray(o[a])) throw new Error(`Yedekteki "${a}" bölümü bozuk.`);
  }
  return {
    ilerleme: (o.ilerleme || []).length, ozel: (o.ozel || []).length, desteler: (o.desteler || []).length,
    gunluk: (o.gunluk || []).length, tarih: o.tarih,
  };
}

/** Geri yükle. kip: 'birlestir' (yeni olan kazanır) | 'ustune' (önce her şeyi sil). */
export async function geriYukle(o, kip = 'birlestir') {
  yedekDogrula(o);
  // (şema göçleri burada: o.sema < depo.SEMA ise dönüştür)
  if (kip === 'ustune') await sifirla(true);
  const ilerleme = [];
  for (const x of o.ilerleme || []) {
    if (!x || !x.id || !x.yon) continue;
    const k = x.id + '|' + x.yon;
    const once = S.ilerleme.get(k);
    if (!once || (x.son ?? -1) > (once.son ?? -1) || ((x.son ?? -1) === (once.son ?? -1) && (x.gecmis?.length || 0) > (once.gecmis?.length || 0))) {
      const n = { ...x, k }; S.ilerleme.set(k, n); ilerleme.push(n);
    }
  }
  await depo.toplu('ilerleme', ilerleme);
  const metalar = [];
  for (const x of o.meta || []) {
    if (!x || !x.id) continue;
    const once = S.meta.get(x.id) || {};
    const n = { ...once, ...x, kabulTr: [...new Set([...(once.kabulTr || []), ...(x.kabulTr || [])])], kabulEn: [...new Set([...(once.kabulEn || []), ...(x.kabulEn || [])])] };
    S.meta.set(x.id, n); metalar.push(n);
  }
  await depo.toplu('meta', metalar);
  const ozel = [];
  for (const x of o.ozel || []) {
    if (!x || !x.id || !x.en) continue;
    const once = S.ozel.get(x.id);
    if (!once || (x.guncelleme || 0) >= (once.guncelleme || 0)) { S.ozel.set(x.id, x); ozel.push(x); }
  }
  await depo.toplu('ozel', ozel);
  const desteler = [];
  for (const x of o.desteler || []) {
    if (!x || !x.id) continue;
    const once = S.ozelDesteler.get(x.id);
    const n = once ? { ...once, ...x, kelimeler: [...new Set([...(once.kelimeler || []), ...(x.kelimeler || [])])] } : { kelimeler: [], ...x };
    S.ozelDesteler.set(n.id, n); desteler.push(n);
  }
  await depo.toplu('desteler', desteler);
  const gunler = [];
  for (const x of o.gunluk || []) {
    if (!x || !x.gun) continue;
    const once = S.gunluk.get(x.gun) || {};
    const n = { ...once };
    for (const [a, v] of Object.entries(x)) n[a] = typeof v === 'number' ? Math.max(v, once[a] || 0) : v;
    S.gunluk.set(x.gun, n); gunler.push(n);
  }
  await depo.toplu('gunluk', gunler);
  const varOlan = new Set((await depo.hepsi('oturumlar')).map(x => x.id));
  for (const x of o.oturumlar || []) {
    if (x && x.id && !varOlan.has(x.id)) { const { no, ...y } = x; await depo.koy('oturumlar', y); }
  }
  for (const x of o.durum || []) {
    if (!x || !x.k || x.k === 'ayar' || x.k === '_deneme') continue;
    if (x.k === 'xp') durumYaz('xp', Math.max(xp(), x.v | 0));
    else if (x.k === 'enIyi') durumYaz('enIyi', Math.max(durumAl('enIyi', 0) || 0, x.v || 0));
    else if (!S.durumlar.has(x.k)) durumYaz(x.k, x.v);
  }
  if (o.ayar && typeof o.ayar === 'object') ayarKaydet({ ...o.ayar });
  dizinKur();
  return { ilerleme: ilerleme.length, ozel: ozel.length, desteler: desteler.length, gunluk: gunler.length };
}

/** İlerlemeyi sıfırla. hepsi=true: kendi kartları ve desteleri de siler. */
export async function sifirla(hepsi = false) {
  const silinecek = hepsi ? ['ilerleme', 'meta', 'ozel', 'desteler', 'gunluk', 'oturumlar', 'durum'] : ['ilerleme', 'gunluk', 'oturumlar', 'durum'];
  for (const d of silinecek) await depo.temizle(d);
  S.ilerleme.clear(); S.gunluk.clear(); S.durumlar.clear();
  if (hepsi) { S.meta.clear(); S.ozel.clear(); S.ozelDesteler.clear(); }
  else {
    // zor işaretleri ilerlemeye sayılır; notlar ve düzeltmeler kalır
    for (const m of S.meta.values()) if (m.zor) metaYaz(m.id, { zor: false });
  }
  dizinKur();
}

/* ------------------------------------------------------------------ hata bildirimi */
let hataDinleyici = null;
export function hataDinle(f) { hataDinleyici = f; }
function hataBildir(e) { console.warn('Depo yazma hatası', e); if (hataDinleyici) hataDinleyici(e); }
