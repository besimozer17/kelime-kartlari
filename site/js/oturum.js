// Çalışma oturumu motoru — saf (DOM / depo yok). Durum düz JSON: IndexedDB'ye yazılıp sürdürülebilir.
import { durum as kayitDurum, vadeli, oncelik } from './tekrar.js';

export const KIPLER = [
  { kod: 'et', ad: 'EN → TR yaz', ac: 'İngilizce sorulur, Türkçesini yazarsınız' },
  { kod: 'te', ad: 'TR → EN yaz', ac: 'Türkçe sorulur, İngilizcesini yazarsınız' },
  { kod: 'karisik', ad: 'Karışık yön', ac: 'İki yön karışık, yazarak' },
  { kod: 'bosluk', ad: 'Cümlede boşluk', ac: 'Örnek cümledeki boşluğu doldurun' },
  { kod: 'secmeli', ad: 'Çoktan seçmeli', ac: 'Dört şıktan birini seçin — hızlı' },
  { kod: 'cevir', ad: 'Kart çevir', ac: 'Kartı çevirip kendinizi değerlendirin' },
  { kod: 'hepsi', ad: 'Hepsi karışık', ac: 'Her kartta başka bir kip' },
];
export const SIRALAR = [
  { kod: 'karisik', ad: 'Karışık' }, { kod: 'kolay', ad: 'Kolaydan zora' }, { kod: 'zor', ad: 'Zordan kolaya' },
  { kod: 'onem', ad: 'Sınav önemine göre' }, { kod: 'alfabe', ad: 'Alfabetik' },
];
export const ORANLAR = { tekrar: 0.2, dengeli: 0.5, yeni: 0.8 };
export const YENIDEN_ARA = 3; // yanlış kart kaç kart sonra yeniden sorulur

/** Belirlenimci rastgele üreteç (testlerde tohumlu). */
export function tohumlu(tohum = 1) {
  let s = tohum >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function karistir(dizi, rnd = Math.random) {
  const a = dizi.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const SV = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
export const seviyeNo = sv => SV[sv] || 0;

export function siraKarsilastir(sira) {
  switch (sira) {
    case 'kolay': return (a, b) => (a.zor - b.zor) || (seviyeNo(a.sv) - seviyeNo(b.sv)) || (b.zipf - a.zipf);
    case 'zor': return (a, b) => (b.zor - a.zor) || (seviyeNo(b.sv) - seviyeNo(a.sv)) || (a.zipf - b.zipf);
    case 'onem': return (a, b) => ((b.onem ?? -1) - (a.onem ?? -1)) || (b.zipf - a.zipf);
    case 'alfabe': return (a, b) => a.en.localeCompare(b.en, 'en');
    default: return null;
  }
}

/** Kartın bu kipte sorulup sorulamayacağı. */
export function uygunMu(k, kip) {
  if (kip === 'bosluk') return !!(k.oe && Array.isArray(k.ob));
  return !!(k.en && k.tr && k.tr.length);
}

function yonSec(k, kip, kayitAl, gun, rnd) {
  if (kip === 'et' || kip === 'te') return kip;
  if (kip === 'bosluk') return 'te';
  const ve = vadeli(kayitAl(k.id, 'et'), gun), vt = vadeli(kayitAl(k.id, 'te'), gun);
  if (ve !== vt) return ve ? 'et' : 'te';
  return rnd() < 0.5 ? 'et' : 'te';
}
function kipSec(k, kip, rnd) {
  if (kip === 'et' || kip === 'te' || kip === 'karisik') return 'yaz';
  if (kip !== 'hepsi') return kip;
  const secenek = ['yaz', 'yaz', 'secmeli', 'cevir'];
  if (uygunMu(k, 'bosluk')) secenek.push('bosluk', 'bosluk');
  return secenek[Math.floor(rnd() * secenek.length)];
}

/**
 * Oturum kuyruğunu kur.
 * @param {object[]} adaylar  kaynağa göre süzülmüş kelimeler
 * @param {{kip:string, sira:string, boy:number, oran:string, kaynak?:string}} ayar  boy 0 = sınırsız
 * @param {(id:string, yon:string)=>object|null} kayitAl
 * @returns {{id:string, yon:string, kip:string, t:number}[]}
 */
export function kuyrukKur(adaylar, ayar, kayitAl, gun, rnd = Math.random) {
  const kip = ayar.kip || 'et';
  const liste = adaylar.filter(k => uygunMu(k, kip === 'bosluk' ? 'bosluk' : 'x'));
  const ogeler = liste.map(k => {
    const yon = yonSec(k, kip, kayitAl, gun, rnd);
    const kayit = kayitAl(k.id, yon);
    const d = kayitDurum(kayit);
    return { k, yon, kayit, tip: d === 'yeni' ? 'yeni' : vadeli(kayit, gun) ? 'vade' : 'diger' };
  });
  const N = ayar.boy > 0 ? ayar.boy : ogeler.length;
  const kars = siraKarsilastir(ayar.sira);
  const sirala = a => (kars ? a.slice().sort((x, y) => kars(x.k, y.k)) : karistir(a, rnd));
  let secilen;
  if (ayar.kaynak === 'vade' || ayar.kaynak === 'zor') {
    const v = ogeler.filter(o => o.tip === 'vade').sort((a, b) => oncelik(b.kayit, gun) - oncelik(a.kayit, gun));
    const d = ayar.kaynak === 'zor' ? sirala(ogeler.filter(o => o.tip !== 'vade')) : [];
    secilen = [...v, ...d].slice(0, N);
  } else {
    const vade = ogeler.filter(o => o.tip === 'vade').sort((a, b) => oncelik(b.kayit, gun) - oncelik(a.kayit, gun));
    const yeni = sirala(ogeler.filter(o => o.tip === 'yeni'));
    const diger = ogeler.filter(o => o.tip === 'diger').sort((a, b) => (a.kayit.kutu - b.kayit.kutu) || (a.kayit.vade - b.kayit.vade));
    const oran = ORANLAR[ayar.oran] ?? ORANLAR.dengeli;
    let nYeni = Math.min(yeni.length, Math.round(N * oran));
    let nVade = Math.min(vade.length, N - nYeni);
    nYeni = Math.min(yeni.length, N - nVade);
    const v = vade.slice(0, nVade), y = yeni.slice(0, nYeni);
    const kalan = N - v.length - y.length;
    const d = kalan > 0 ? diger.slice(0, kalan) : [];
    // yenileri tekrarların arasına eşit dağıt
    const tekrarlar = [...v, ...d];
    secilen = [];
    const adim = y.length ? (tekrarlar.length + y.length) / y.length : Infinity;
    let yi = 0, ti = 0;
    for (let i = 0; i < tekrarlar.length + y.length; i++) {
      if (yi < y.length && (ti >= tekrarlar.length || i >= Math.floor(yi * adim))) secilen.push(y[yi++]);
      else secilen.push(tekrarlar[ti++]);
    }
  }
  if (kars) secilen.sort((x, y) => kars(x.k, y.k));
  else if (ayar.kaynak !== 'vade') secilen = karistir(secilen, rnd);
  return secilen.map(o => ({ id: o.k.id, yon: o.yon, kip: kipSec(o.k, kip, rnd), t: 0 }));
}

/** Yeni oturum durumu. */
export function oturumBaslat(sira, ayar, simdi = Date.now()) {
  return {
    v: 1, id: 'o' + simdi.toString(36), basla: simdi, ayar, sira, i: 0,
    puan: 0, seri: 0, enUzunSeri: 0, sayac: { dogru: 0, neredeyse: 0, yanlis: 0 },
    yanitlar: [], yanlislar: [], ilkSayi: sira.length, sure: 0,
  };
}

export const siradaki = o => o.sira[o.i] || null;
export const bittiMi = o => o.i >= o.sira.length;
const DOGRU_SAY = new Set(['dogru', 'kolay', 'esanlam']);
const KISMEN = new Set(['neredeyse', 'zor']);

/**
 * Yanıtı işle (yeni durum döner). Yanlışta kart YENIDEN_ARA kart sonra yeniden kuyruğa girer.
 * @param {string} sonuc dogru|kolay|neredeyse|zor|esanlam|yanlis
 */
export function yanitla(o, sonuc, puan = 0, ek = {}) {
  const s = structuredCloneSafe(o);
  const og = s.sira[s.i];
  if (!og) return s;
  const ilk = !og.t;
  s.yanitlar.push({ id: og.id, yon: og.yon, kip: og.kip, sonuc, puan, ipucu: ek.ipucu || 0, t: og.t, ms: ek.ms || 0 });
  s.puan += puan;
  if (sonuc === 'yanlis') {
    s.seri = 0;
    if (ilk) s.sayac.yanlis++;
    if (!s.yanlislar.some(y => y.id === og.id && y.yon === og.yon)) s.yanlislar.push({ id: og.id, yon: og.yon });
    const yer = Math.min(s.i + 1 + YENIDEN_ARA, s.sira.length);
    s.sira.splice(yer, 0, { ...og, t: og.t + 1 });
  } else {
    s.seri++;
    s.enUzunSeri = Math.max(s.enUzunSeri, s.seri);
    if (ilk) { if (DOGRU_SAY.has(sonuc)) s.sayac.dogru++; else if (KISMEN.has(sonuc)) s.sayac.neredeyse++; }
  }
  s.i++;
  return s;
}

/** Bu kartı atla: kuyruğun ilerisindeki yeniden sorulmaları da kaldır. */
export function atla(o) {
  const s = structuredCloneSafe(o);
  const og = s.sira[s.i];
  if (!og) return s;
  s.sira = s.sira.filter((x, j) => j <= s.i || !(x.id === og.id && x.yon === og.yon));
  s.i++;
  return s;
}

/** Bir kartı oturumdan tamamen çıkar (kart silindi / çıkarıldı). */
export function cikar(o, id) {
  const s = structuredCloneSafe(o);
  const once = s.sira.slice(0, s.i), sonra = s.sira.slice(s.i).filter(x => x.id !== id);
  s.sira = [...once, ...sonra];
  return s;
}

/** Oturum özeti. */
export function ozet(o, simdi = Date.now()) {
  const ilk = o.sayac.dogru + o.sayac.neredeyse + o.sayac.yanlis;
  return {
    puan: o.puan, dogru: o.sayac.dogru, neredeyse: o.sayac.neredeyse, yanlis: o.sayac.yanlis, toplam: ilk,
    oran: ilk ? Math.round(((o.sayac.dogru + o.sayac.neredeyse * 0.5) / ilk) * 100) : 0,
    sure: Math.max(0, Math.round((o.sure || (simdi - o.basla)) / 1000)), enUzunSeri: o.enUzunSeri, yanlislar: o.yanlislar,
  };
}

/**
 * Çoktan seçmeli şıklar: aynı tür + yakın seviye; karşılıkları doğru cevapla çakışmayan 3 çeldirici.
 * @returns {object[]} 4 kelime (doğru dahil, karışık)
 */
export function sikUret(k, havuz, rnd = Math.random) {
  const trKume = new Set(k.tr.map(t => t.toLocaleLowerCase('tr')));
  const sv = seviyeNo(k.sv);
  const uygun = x => x.id !== k.id && x.en !== k.en && x.tr && x.tr.length && !x.tr.some(t => trKume.has(t.toLocaleLowerCase('tr')));
  const kademeler = [
    x => x.tur === k.tur && Math.abs(seviyeNo(x.sv) - sv) <= 1,
    x => x.tur === k.tur,
    () => true,
  ];
  const secilen = [];
  const gorulen = new Set([k.en]);
  for (const kosul of kademeler) {
    if (secilen.length >= 3) break;
    // büyük havuzda tümünü taramak yerine rastgele örnekle
    const deneme = havuz.length > 400 ? Array.from({ length: 400 }, () => havuz[Math.floor(rnd() * havuz.length)]) : karistir(havuz, rnd);
    for (const x of deneme) {
      if (secilen.length >= 3) break;
      if (x && uygun(x) && kosul(x) && !gorulen.has(x.en)) { secilen.push(x); gorulen.add(x.en); }
    }
  }
  return karistir([k, ...secilen], rnd);
}

function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }

export { kayitDurum };
