// Sözlük motoru — saf, DOM'suz. İki biçimde çalışır:
//  1) Web Worker (type:'module'): sozluk.js bunu işçi olarak açar; cekirdek.json (15,6 MB) ayrıştırma, dizin kurma
//     ve her tuştaki arama ana iş parçacığını kilitlemesin diye işçide yapılır.
//  2) Doğrudan içe aktarma: işçi açılamazsa (file:// vb.) ya da Node birim testlerinde.
// Veri biçimi (araclar/disa_aktar.py): parça / çekirdek = {g:[[kelime, tur, ipa, tr[], [[tanım, örnek]], eş[]]…], b:{biçim:"kök|kök2"}}
// tr_en.json = [[türkçe anahtar, [en…]]…]; dizin.json = {parcalar:{ab:{adet,bayt}}, tr_dizin, cekirdek}.
import { aksansiz, uzaklik } from './metin.js';

/* ================================================================== normalleştirme */

/** İngilizce arama anahtarı: küçük harf, aksansız, ’→', boşluk sadeleşir. ("Café" → "cafe") */
export function enAnah(s) {
  return String(s ?? '').replace(/[’‘ʼ`´]/g, "'").toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}
/** Türkçe arama anahtarı: Türkçe küçük harf + aksansız ("Işık" = "isik"). */
export function trAnah(s) { return aksansiz(String(s ?? '').replace(/\s+/g, ' ').trim()); }

/** Parça dosyası adı (disa_aktar.py parca_anahtari ile aynı). */
export function parcaAdi(kelime) {
  const s = String(kelime ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const k = c => (c && /[a-z0-9]/.test(c) ? c : '_');
  return k(s[0]) + k(s[1]);
}

export const TR_HARF = /[çğıöşüâîûÇĞİÖŞÜÂÎÛ]/;
const DURAK = new Set('a an the of to in on at by for with from up down out off over into onto about as and or but not no be is are was were been do does did have has had it its this that these those so than then too very i you he she we they me him her us them my your his our their'.split(' '));
export const durakMi = w => DURAK.has(w);

/* ================================================================== düzensiz biçimler */
// kök:biçim,biçim… (yalnız sık düzensizler; asıl kaynak sözlüğün biçim haritası `b`)
const DUZENSIZ_HAM = 'be:am,is,are,was,were,been,being|have:has,had,having|do:does,did,done|go:goes,went,gone|say:said|get:got,gotten|make:made|know:knew,known|think:thought|take:took,taken|see:saw,seen|come:came|give:gave,given|find:found|tell:told|become:became|leave:left|feel:felt|bring:brought|begin:began,begun|keep:kept|hold:held|write:wrote,written|stand:stood|hear:heard|let:let|mean:meant|set:set|meet:met|run:ran,running|pay:paid|sit:sat|speak:spoke,spoken|lie:lay,lain,lying|lead:led|read:read|grow:grew,grown|lose:lost|fall:fell,fallen|send:sent|build:built|understand:understood|draw:drew,drawn|break:broke,broken|spend:spent|cut:cut|rise:rose,risen|drive:drove,driven|buy:bought|wear:wore,worn|choose:chose,chosen|seek:sought|throw:threw,thrown|catch:caught|deal:dealt|win:won|forget:forgot,forgotten|sell:sold|fight:fought|teach:taught|eat:ate,eaten|sing:sang,sung|swim:swam,swum|drink:drank,drunk|fly:flew,flown,flies|sleep:slept|steal:stole,stolen|hide:hid,hidden|shake:shook,shaken|ride:rode,ridden|bite:bit,bitten|blow:blew,blown|feed:fed|freeze:froze,frozen|hang:hung|hit:hit|hurt:hurt|kneel:knelt|lay:laid|light:lit|prove:proven|put:put|quit:quit|shoot:shot|shut:shut|sink:sank,sunk|slide:slid|spin:spun|split:split|spread:spread|strike:struck|swear:swore,sworn|sweep:swept|swing:swung|tear:tore,torn|wake:woke,woken|weep:wept|wind:wound|withdraw:withdrew,withdrawn|forbid:forbade,forbidden|forgive:forgave,forgiven|bear:bore,borne|bind:bound|bend:bent|bet:bet|bleed:bled|breed:bred|burn:burnt|cling:clung|creep:crept|dig:dug|dive:dove|dream:dreamt|flee:fled|grind:ground|lend:lent|mislead:misled|overcome:overcame|ring:rang,rung|seek:sought|shine:shone|shrink:shrank,shrunk|stick:stuck|sting:stung|stink:stank|strive:strove,striven|undertake:undertook,undertaken|undergo:underwent,undergone|arise:arose,arisen|awake:awoke,awoken|child:children|man:men|woman:women|person:people|foot:feet|tooth:teeth|mouse:mice|goose:geese|ox:oxen|louse:lice|die:dice|analysis:analyses|crisis:crises|thesis:theses|hypothesis:hypotheses|basis:bases|criterion:criteria|phenomenon:phenomena|datum:data|medium:media|bacterium:bacteria|curriculum:curricula|stimulus:stimuli|nucleus:nuclei|cactus:cacti|fungus:fungi|appendix:appendices|index:indices|life:lives|wife:wives|knife:knives|leaf:leaves|half:halves|wolf:wolves|shelf:shelves|thief:thieves|self:selves|good:better,best|well:better,best|bad:worse,worst|badly:worse,worst|ill:worse,worst|far:farther,further,farthest,furthest|little:less,least|much:more,most|many:more,most|old:elder,eldest';
export const DUZENSIZ = new Map();     // biçim → [kök…]
export const DUZENSIZ_BICIM = new Map(); // kök → [biçim…]
for (const p of DUZENSIZ_HAM.split('|')) {
  const [kok, b] = p.split(':');
  const bl = b.split(',');
  DUZENSIZ_BICIM.set(kok, [...(DUZENSIZ_BICIM.get(kok) || []), ...bl]);
  for (const x of bl) if (x !== kok) DUZENSIZ.set(x, [...(DUZENSIZ.get(x) || []), kok]);
}

/** Bir kökün tahmini çekimleri (disa_aktar.py tahmini_cekimler + düzensizler). */
export function cekimler(w) {
  w = enAnah(w);
  const f = new Set([w, w + 's', w + 'es', w + 'ed', w + 'd', w + 'ing', w + 'er', w + 'est', w + "'s", w + "s'"]);
  if (w.length > 2 && w.endsWith('y')) for (const e of ['ies', 'ied', 'ier', 'iest', 'ily']) f.add(w.slice(0, -1) + e);
  if (w.endsWith('e')) { f.add(w.slice(0, -1) + 'ing'); f.add(w + 'd'); f.add(w + 'r'); f.add(w + 'st'); }
  if (w.length >= 3 && !'aeiouwxy'.includes(w.at(-1)) && 'aeiou'.includes(w.at(-2)) && !'aeiou'.includes(w.at(-3))) {
    for (const e of ['ed', 'ing', 'er', 'est']) f.add(w + w.at(-1) + e);
  }
  if (w.endsWith('f')) f.add(w.slice(0, -1) + 'ves');
  if (w.endsWith('fe')) f.add(w.slice(0, -2) + 'ves');
  if (w.endsWith('ic')) f.add(w + 'ally');
  f.add(w + 'ly');
  for (const x of DUZENSIZ_BICIM.get(w) || []) f.add(x);
  return f;
}

/** Çekimli biçimden kural tabanlı kök adayları (sözlükte varlığı ayrıca denetlenir). */
export function kokAdaylari(b) {
  b = enAnah(b);
  const a = new Set();
  const ek = (son, yeni = '') => { if (b.length > son.length + 1 && b.endsWith(son)) a.add(b.slice(0, -son.length) + yeni); };
  ek("'s"); ek("s'", ''); ek('ies', 'y'); ek('ied', 'y'); ek('ier', 'y'); ek('iest', 'y'); ek('ily', 'y');
  ek('ves', 'f'); ek('ves', 'fe'); ek('es'); ek('s'); ek('ed'); ek('ed', 'e'); ek('d'); ek('ing'); ek('ing', 'e');
  ek('er'); ek('er', 'e'); ek('est'); ek('est', 'e'); ek('ly'); ek('ally');
  // ikiz ünsüz: stopped → stop, bigger → big
  const m = /^(.*([bcdfgklmnprstvz]))\2(ed|ing|er|est)$/.exec(b);
  if (m) a.add(m[1]);
  a.delete(b); a.delete('');
  return [...a];
}

/* ================================================================== durum */
const M = {
  taban: '', getir: null,
  dizin: null, cek: null, cekS: null, tr: null, trS: null,
  kel: [], kelS: null, kelHarita: new Map(),
  parca: new Map(), parcaYuk: new Map(),
  olcum: {},
};

const sim = () => (globalThis.performance ? performance.now() : Date.now());

/** Satırlardan sıralı anahtar dizini kur: {a:[anahtar], i:Int32Array satır}. */
function sirala(satirlar, al) {
  const n = satirlar.length;
  const ara = new Array(n);
  for (let i = 0; i < n; i++) ara[i] = [al(satirlar[i]), i];
  ara.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1]));
  const a = new Array(n), ix = new Int32Array(n);
  for (let i = 0; i < n; i++) { a[i] = ara[i][0]; ix[i] = ara[i][1]; }
  return { a, i: ix };
}
function altSinir(a, x) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; }
function tamlar(S, x) { const r = []; for (let j = altSinir(S.a, x); j < S.a.length && S.a[j] === x; j++) r.push(S.i[j]); return r; }

export function cekirdekKur(json) {
  const t = sim();
  M.cek = { g: json.g || [], b: json.b || {} };
  M.cekS = sirala(M.cek.g, r => enAnah(r[0]));
  M.olcum.cekirdekDizinMs = Math.round(sim() - t);
  return { adet: M.cek.g.length };
}
export function trKur(json) {
  const t = sim();
  M.tr = Array.isArray(json) ? json : [];
  M.trS = sirala(M.tr, r => trAnah(r[0]));
  M.olcum.trDizinMs = Math.round(sim() - t);
  return { adet: M.tr.length };
}
export function parcaKur(ad, json) {
  const p = { g: json.g || [], b: json.b || {} };
  p.S = sirala(p.g, r => enAnah(r[0]));
  M.parca.set(ad, p);
  // bellek: en çok 8 parça tut (en büyüğü ~3 MB)
  if (M.parca.size > 8) M.parca.delete(M.parca.keys().next().value);
  return p;
}
/** Hazır deste + kendi kartları: [[en, tur, tr[], id, sv, ozel]…] */
export function kelimelerKur(liste) {
  M.kel = liste || [];
  M.kelHarita = new Map();
  M.kel.forEach((k, i) => { const a = enAnah(k[0]); if (!M.kelHarita.has(a)) M.kelHarita.set(a, []); M.kelHarita.get(a).push(i); });
  M.kelS = sirala(M.kel, k => enAnah(k[0]));
  return { adet: M.kel.length };
}
export function _sifirla() {
  Object.assign(M, { dizin: null, cek: null, cekS: null, tr: null, trS: null, kel: [], kelS: null, kelHarita: new Map(), parca: new Map(), parcaYuk: new Map() });
}

/* ================================================================== yükleme */
function xhr(url) {
  return new Promise((ok, red) => {
    const x = new XMLHttpRequest();
    x.open('GET', url); x.responseType = 'json';
    x.onload = () => (x.response ? ok(x.response) : red(new Error('Okunamadı: ' + url)));
    x.onerror = () => red(new Error('Okunamadı: ' + url));
    x.send();
  });
}
/** veri.js jsonGetir kalıbı: fetch, olmazsa (file://) XHR. */
async function getirVarsayilan(ad) {
  const url = M.taban + ad;
  try {
    const r = await fetch(url);
    if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { durum: r.status });
    return await r.json();
  } catch (e) {
    if (e.durum || /^https?:/i.test(url) || typeof XMLHttpRequest === 'undefined') throw Object.assign(e, { ag: !e.durum });
    return xhr(url);
  }
}
const getir = ad => (M.getir || getirVarsayilan)(ad);

const bekleyen = new Map();
function bir(ad, f) {
  if (!bekleyen.has(ad)) bekleyen.set(ad, f().catch(e => { bekleyen.delete(ad); throw e; }));
  return bekleyen.get(ad);
}
async function dizinYukle() {
  if (M.dizin) return M.dizin;
  return bir('dizin', async () => (M.dizin = await getir('dizin.json')));
}
export async function cekirdekYukle() {
  if (M.cek) return { adet: M.cek.g.length, olcum: M.olcum };
  return bir('cekirdek', async () => {
    let ad = 'cekirdek.json';
    try { ad = (await dizinYukle()).cekirdek || ad; } catch { /* dizin yoksa varsayılan ad */ }
    const t0 = sim();
    const j = await getir(ad);
    M.olcum.cekirdekGetirAyristirMs = Math.round(sim() - t0);
    cekirdekKur(j);
    return { adet: M.cek.g.length, olcum: M.olcum };
  });
}
export async function trYukle() {
  if (M.tr) return { adet: M.tr.length };
  return bir('tr', async () => {
    let ad = 'tr_en.json';
    try { ad = (await dizinYukle()).tr_dizin || ad; } catch { /* */ }
    const t0 = sim();
    trKur(await getir(ad));
    M.olcum.trGetirMs = Math.round(sim() - t0);
    return { adet: M.tr.length };
  });
}
/** Parçayı getir. Döner: parça | null (böyle parça yok). Ağ yoksa hata ({ag:true}). */
export async function parcaYukle(ad) {
  if (M.parca.has(ad)) return M.parca.get(ad);
  if (M.dizin === null) { try { await dizinYukle(); } catch { /* */ } }
  if (M.dizin && M.dizin.parcalar && !M.dizin.parcalar[ad]) return null;
  return bir('p:' + ad, async () => { const j = await getir(ad + '.json'); bekleyen.delete('p:' + ad); return parcaKur(ad, j); });
}

/* ================================================================== sorgular */
const satirlarParca = (p, a) => (p ? tamlar(p.S, a).map(i => p.g[i]) : []);

/** Anahtara (enAnah) uyan satırlar: deste [k…], çekirdek, yüklü parça. */
function anahtarBilgi(a, parcaDa = true) {
  const kel = (M.kelHarita.get(a) || []).map(i => M.kel[i]);
  const cek = M.cekS ? tamlar(M.cekS, a).map(i => M.cek.g[i]) : [];
  const p = parcaDa ? M.parca.get(parcaAdi(a)) : null;
  const par = satirlarParca(p, a);
  return { kel, cek, par };
}
const varMi = a => M.kelHarita.has(a) || (M.cekS && tamlar(M.cekS, a).length > 0) || satirlarParca(M.parca.get(parcaAdi(a)), a).length > 0;

/** Biçim haritasından kökler ("running" → ["run"]). Kendisi dahil edilmez. */
export function kokler(bicim) {
  let b = enAnah(bicim);
  const out = [];
  const ekle = x => { if (x && enAnah(x) !== b && !out.some(y => enAnah(y) === enAnah(x))) out.push(x); };
  const mm = /^(more|most) (.+)$/.exec(b);
  if (mm && !varMi(b)) { ekle(mm[2]); b = mm[2]; }
  // düzensizler önce: biçim haritasında "is" → "I|i|be…" gibi sıklık sırası yanıltıcı olabiliyor
  for (const x of DUZENSIZ.get(b) || []) ekle(x);
  if (M.cek && M.cek.b[b]) M.cek.b[b].split('|').forEach(ekle);
  const p = M.parca.get(parcaAdi(b));
  if (p && p.b[b]) p.b[b].split('|').forEach(ekle);
  if (!out.length || b.endsWith("'s") || b.endsWith("s'")) {
    for (const x of kokAdaylari(b)) if (varMi(x)) ekle(x);
  }
  // birden çok kök: destedekiler öne (sıra kararlı; "Tet" → tetracycline (deste) > tetanus)
  const d = x => (M.kelHarita.has(enAnah(x)) ? 1 : 0);
  return out.sort((x, y) => d(y) - d(x));
}

function bilgiOzet(a, kaynakTercih) {
  const { kel, cek, par } = anahtarBilgi(a);
  if (!kel.length && !cek.length && !par.length) return null;
  const turler = [], tr = [];
  const ekleTr = xs => { for (const t of xs || []) if (tr.length < 6 && !tr.includes(t)) tr.push(t); };
  for (const k of kel) { if (!turler.includes(k[1])) turler.push(k[1]); ekleTr(k[2]); }
  const satir = par.length ? par : cek;
  for (const r of satir) { if (!turler.includes(r[1])) turler.push(r[1]); ekleTr(r[3]); }
  if (!satir.length) for (const r of cek) ekleTr(r[3]);
  const en = kel.length ? kel[0][0] : (satir.find(r => r[0] === r[0].toLowerCase()) || satir[0])[0];
  let tanim = null;
  if (!tr.length) { for (const r of satir) if (r[4] && r[4][0]) { tanim = r[4][0][0]; break; } }
  return {
    en, tur: turler[0] || null, turler, tr, tanim,
    kaynak: kel.length ? (kel[0][5] ? 'ozel' : 'deste') : par.length ? 'parca' : kaynakTercih || 'cekirdek',
    id: kel.length ? kel[0][3] : null, sv: kel.length ? kel[0][4] : null,
  };
}

function* onekTara(S, q, sinir) {
  for (let j = altSinir(S.a, q), n = 0; j < S.a.length && n < sinir && S.a[j].startsWith(q); j++, n++) yield S.a[j];
}

/** İngilizce arama. Döner: [{…bilgi, eslesme, skor, bicim?}] */
export function araEn(q0, sinir = 20) {
  let q = enAnah(q0).replace(/^to /, '');
  if (!q) return [];
  const sonuc = new Map();
  const koy = (a, skor, eslesme, ek = {}) => {
    const v = sonuc.get(a);
    if (v && v.skor >= skor) return;
    const b = bilgiOzet(a);
    if (!b) return;
    if (b.kaynak === 'deste' || b.kaynak === 'ozel') skor += 30;
    if (b.tr.length) skor += 15;
    sonuc.set(a, { ...b, eslesme, skor, yon: 'en', ...ek });
  };
  // "more beautiful" → beautiful (tam öbek yoksa)
  const mm = /^(more|most) (.+)$/.exec(q);
  if (mm && !varMi(q)) q = mm[2];
  if (varMi(q)) koy(q, 1000, 'tam');
  for (const k of kokler(q)) koy(enAnah(k), 900, 'kok', { bicim: q0.trim() });
  // önek
  const p = M.parca.get(parcaAdi(q));
  const onekAday = new Set();
  if (M.kelS) for (const a of onekTara(M.kelS, q, 4000)) onekAday.add(a);
  if (M.cekS) for (const a of onekTara(M.cekS, q, 6000)) onekAday.add(a);
  if (p && q.length >= 2) for (const a of onekTara(p.S, q, 3000)) onekAday.add(a);
  onekAday.delete(q);
  for (const a of onekAday) koy(a, 600 - Math.min(80, (a.length - q.length) * 4) - (a.includes(' ') ? 40 : 0), 'onek');
  // öbek içinde kelime başı ("spite" → "in spite of")
  if (q.length >= 3 && sonuc.size < sinir * 2) {
    const ic = ' ' + q;
    const tara = S => { if (!S) return; for (const a of S.a) if (a.includes(ic) && (a.length - q.length) < 30) koy(a, 300 - Math.min(100, a.length - q.length), 'obek'); };
    tara(M.kelS); tara(M.cekS);
  }
  // yazım yakını
  if (q.length >= 3 && ![...sonuc.values()].some(x => x.eslesme === 'tam' || x.eslesme === 'kok')) {
    const sin = q.length <= 5 ? 1 : 2;
    const tara = S => {
      if (!S) return;
      let onceki = null;
      for (const a of S.a) {
        if (a === onceki) continue; onceki = a;
        if (Math.abs(a.length - q.length) > sin) continue;
        if (a[0] !== q[0] && a[1] !== q[1] && a[0] !== q[1]) continue;
        const d = uzaklik(a, q, sin);
        if (d <= sin) koy(a, 250 - d * 60, 'yakin', { uzaklik: d });
      }
    };
    tara(M.kelS); tara(M.cekS);
  }
  return [...sonuc.values()].sort((x, y) => y.skor - x.skor || x.en.length - y.en.length || (x.en < y.en ? -1 : 1)).slice(0, sinir);
}

/** Türkçe → İngilizce arama (tr_en ters dizini + deste Türkçeleri). */
export function araTr(q0, sinir = 20) {
  const q = trAnah(q0);
  if (!q) return [];
  const sonuc = new Map();
  const koy = (en, skor, eslesme, trKey) => {
    const a = enAnah(en);
    const v = sonuc.get(a);
    if (v && v.skor >= skor) return;
    const b = bilgiOzet(a) || { en, tur: null, turler: [], tr: [], kaynak: 'cekirdek', id: null, sv: null };
    if (b.kaynak === 'deste' || b.kaynak === 'ozel') skor += 30;
    sonuc.set(a, { ...b, eslesme, skor, yon: 'tr', trEslesen: trKey });
  };
  const S = M.trS;
  if (S) {
    let j = altSinir(S.a, q);
    for (let n = 0; j < S.a.length && n < 400 && S.a[j].startsWith(q); j++, n++) {
      const [key, ens] = M.tr[S.i[j]];
      const tam = S.a[j] === q;
      const birebir = tam && key === String(q0).trim().replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
      ens.forEach((en, sira) => koy(en, (tam ? 1000 + (birebir ? 20 : 0) : 600 - Math.min(80, (S.a[j].length - q.length) * 4)) - sira * 8, tam ? 'tam' : 'onek', key));
    }
    if (q.length >= 3 && sonuc.size < sinir) {
      const ic = ' ' + q;
      for (let k = 0; k < S.a.length; k++) {
        const a = S.a[k];
        if (a.includes(ic) && a.length - q.length < 25) { const [key, ens] = M.tr[S.i[k]]; ens.slice(0, 3).forEach((en, s) => koy(en, 300 - (a.length - q.length) - s * 8, 'obek', key)); }
      }
    }
    if (q.length >= 3 && ![...sonuc.values()].some(x => x.eslesme === 'tam')) {
      const sin = q.length <= 5 ? 1 : 2;
      let onceki = null;
      for (let k = 0; k < S.a.length; k++) {
        const a = S.a[k];
        if (a === onceki || Math.abs(a.length - q.length) > sin) continue; onceki = a;
        if (a[0] !== q[0] && a[1] !== q[1]) continue;
        const d = uzaklik(a, q, sin);
        if (d <= sin) { const [key, ens] = M.tr[S.i[k]]; ens.slice(0, 4).forEach((en, s) => koy(en, 250 - d * 60 - s * 8, 'yakin', key)); }
      }
    }
  }
  // deste kelimelerinin Türkçeleri (tr_en'de olmayan kendi kartları için de)
  for (const k of M.kel) {
    for (const t of k[2] || []) {
      const a = trAnah(t);
      if (a === q) koy(k[0], 990, 'tam', t);
      else if (a.startsWith(q) && q.length >= 2) koy(k[0], 560, 'onek', t);
    }
  }
  return [...sonuc.values()].sort((x, y) => y.skor - x.skor || (x.en < y.en ? -1 : 1)).slice(0, sinir);
}

/** Yön kararı + arama. Döner: {yon, sonuc, digerTam} */
export async function ara({ q, yon = 'oto', sinir = 20, parca = true } = {}) {
  q = String(q ?? '').slice(0, 80);
  if (!q.trim()) return { yon: yon === 'tr' ? 'tr' : 'en', sonuc: [], digerTam: false };
  const enQ = enAnah(q);
  const parcaHazirla = async () => {
    if (!parca || enQ.length < 2) return;
    try { await parcaYukle(parcaAdi(enQ)); } catch { /* çevrimdışı: çekirdekle yetin */ }
  };
  if (yon === 'tr' || (yon === 'oto' && TR_HARF.test(q))) {
    await trYukle().catch(() => {});
    return { yon: 'tr', sonuc: araTr(q, sinir), digerTam: false };
  }
  if (yon === 'en') {
    await cekirdekYukle().catch(() => {});
    await parcaHazirla();
    return { yon: 'en', sonuc: araEn(q, sinir), digerTam: false };
  }
  await Promise.all([cekirdekYukle().catch(() => {}), trYukle().catch(() => {}), parcaHazirla()]);
  const en = araEn(q, sinir), tr = araTr(q, sinir);
  const enTam = en.some(x => x.eslesme === 'tam' || x.eslesme === 'kok');
  const trTam = tr.some(x => x.eslesme === 'tam');
  // ikisi de tam ise: deste (sık kullanılan) kelimesi olan taraf kazanır ("ev" → house; "son" → oğul)
  const deste = x => x && (x.kaynak === 'deste' || x.kaynak === 'ozel');
  const enTamDeste = en.some(x => (x.eslesme === 'tam' || x.eslesme === 'kok') && deste(x));
  const trTamDeste = tr.some(x => x.eslesme === 'tam' && deste(x));
  if (enTam && trTam && trTamDeste && !enTamDeste) return { yon: 'tr', sonuc: tr, digerTam: true };
  if (enTam || (!trTam && (en.length || !tr.length))) return { yon: 'en', sonuc: en, digerTam: trTam };
  return { yon: 'tr', sonuc: tr, digerTam: enTam };
}

/** Madde satırları: {cek:[…], par:[…]|null, parcaDurum:'tamam'|'yok'|'ag'} */
export async function satirlar({ en, parca = true } = {}) {
  await cekirdekYukle().catch(() => {});
  const a = enAnah(en);
  let parcaDurum = 'yok';
  if (parca) {
    try { const p = await parcaYukle(parcaAdi(a)); parcaDurum = p ? 'tamam' : 'yok'; } catch { parcaDurum = 'ag'; }
  }
  const { cek, par } = anahtarBilgi(a);
  return { cek, par: parcaDurum === 'tamam' ? par : null, parcaDurum, cekirdek: !!M.cek };
}

/** Öbek yakala: adaylar = [[kelime…]…] (uzundan kısaya). İlk kelimenin kökleri de denenir ("looked after" → "look after"). */
export async function obek({ adaylar = [] } = {}) {
  await cekirdekYukle().catch(() => {});
  for (const ad of adaylar) {
    const t = ad.map(enAnah);
    if (t.length < 2 || t.every(durakMi)) continue;
    const denemeler = [t.join(' ')];
    for (let k = 0; k < t.length; k++) {
      if (durakMi(t[k])) continue;
      for (const r of kokler(t[k])) denemeler.push([...t.slice(0, k), enAnah(r), ...t.slice(k + 1)].join(' '));
    }
    for (const d of denemeler) {
      if (!varMi(d)) {
        try { await parcaYukle(parcaAdi(d)); } catch { /* */ }
        if (!varMi(d)) continue;
      }
      const b = bilgiOzet(d);
      if (b && (b.tr.length || b.tanim)) return { en: b.en, uzunluk: t.length };
    }
  }
  return null;
}

export async function koklerAsync({ bicim } = {}) {
  await cekirdekYukle().catch(() => {});
  const b = enAnah(bicim);
  try { await parcaYukle(parcaAdi(b)); } catch { /* */ }
  return kokler(b);
}

/* ================================================================== ileti arayüzü */
export async function istek(tip, arg = {}) {
  switch (tip) {
    case 'baslat': M.taban = arg.taban || M.taban; return { tamam: true, isci: ISCI };
    case 'cekirdek': return cekirdekYukle();
    case 'tr': return trYukle();
    case 'kelimeler': return kelimelerKur(arg.liste);
    case 'ara': return ara(arg);
    case 'satirlar': return satirlar(arg);
    case 'kokler': return koklerAsync(arg);
    case 'obek': return obek(arg);
    case 'olcum': return { ...M.olcum, cekirdek: !!M.cek, tr: !!M.tr, parca: [...M.parca.keys()] };
    default: throw new Error('Bilinmeyen istek: ' + tip);
  }
}
/** Testler için: getir işlevini değiştir (Node'da dosyadan okuma). */
export function getirAyarla(f) { M.getir = f; }

const ISCI = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;
if (ISCI) {
  self.onmessage = async e => {
    const { no, tip, arg } = e.data || {};
    try { self.postMessage({ no, r: await istek(tip, arg) }); }
    catch (h) { self.postMessage({ no, hata: String((h && h.message) || h), ag: !!(h && h.ag), durum: h && h.durum }); }
  };
}
