// Yanıt denetimi — saf modül (DOM yok). Birim testleri: testler/denetim.test.mjs
// Sonuç: { sonuc: 'dogru'|'neredeyse'|'yanlis'|'esanlam'|'bos', eslesen, yazim, not }
//   eslesen: tutan beklenen karşılık (gösterim biçimi) · yazim: doğru yazım gösterilecekse · not: kısa kod
import { temizle, asciiKatla, parantezsiz, parantezli, parcala, uzaklik } from './metin.js';

/** Yazım hatası sınırı (uzunluğa göre izin verilen düzenleme sayısı). */
export const TOLERANS = {
  siki: () => 0,
  normal: n => (n >= 9 ? 2 : n >= 5 ? 1 : 0),
  hosgorulu: n => (n >= 12 ? 3 : n >= 8 ? 2 : n >= 4 ? 1 : 0),
};
const sinirAl = (t, n) => (TOLERANS[t] || TOLERANS.normal)(n);

const DERECE = { dogru: 3, esanlam: 2.5, neredeyse: 2, yanlis: 1, bos: 0 };
const iyisi = (a, b) => (!a || DERECE[b.sonuc] > DERECE[a.sonuc] ? b : a);

/* ------------------------------------------------------------------ Türkçe */

const YARDIMCI = new Set(['et', 'yap', 'ol', 'eyle', 'kıl', 'kil']);
const FIIL_TUR = new Set(['verb', 'phrasal', 'deyim', 'fiil']);

/** "-mek/-mak" ekini at (son sözcükte). */
export function mekAt(s) {
  return s.replace(/(\S{2,})m[ea]k$/, '$1');
}

/** Türkçe karşılaştırma anahtarı (küçük harf, noktalamasız). */
export const trAnahtar = s => temizle(s, 'tr');
/** ASCII katlanmış anahtar (yazım hatası ve "başka kelime" denetimi için). */
export const trKatli = s => asciiKatla(trAnahtar(s));

function trBicimler(t) {
  const out = new Set();
  for (const parca of String(t).split(/\s*[;/]\s*/)) {
    for (const v of [parca, parantezsiz(parca), parantezli(parca)]) {
      const a = trAnahtar(v);
      if (a) out.add(a);
    }
  }
  return [...out];
}

/**
 * EN→TR: kullanıcının Türkçe yanıtını karttaki karşılıklarla karşılaştır.
 * @param {string} yanit
 * @param {{tr:string[], tur?:string, kabulTr?:string[]}} kart
 * @param {{tolerans?:string, digerTr?:Set<string>}} b  digerTr: BAŞKA kartların karşılıkları (trKatli biçiminde)
 */
export function denetleTr(yanit, kart, b = {}) {
  const parcalar = parcala(yanit);
  const tum = trAnahtar(yanit);
  if (!tum) return { sonuc: 'bos', eslesen: kart.tr?.[0] ?? '', not: 'bos' };
  const beklenen = [...(kart.tr || []), ...(kart.kabulTr || [])];
  const fiil = FIIL_TUR.has(kart.tur) || !kart.tur;
  const kendi = new Set(beklenen.flatMap(trBicimler).map(asciiKatla));
  let en = null;
  const adaylar = parcalar.length > 1 ? [String(yanit), ...parcalar] : [String(yanit)];
  for (const ham of adaylar) {
    const u = trAnahtar(ham);
    if (!u) continue;
    for (const e of beklenen) {
      for (const bic of trBicimler(e)) {
        en = iyisi(en, trKiyas(u, bic, e, fiil, kendi, b));
        if (en.sonuc === 'dogru' && en.not === 'tam') return en;
      }
    }
  }
  return en && en.sonuc !== 'bos' ? en : { sonuc: 'yanlis', eslesen: kart.tr?.[0] ?? '', not: 'yanlis' };
}

function trKiyas(u, e, gosterim, fiil, kendi, b) {
  const yanlis = { sonuc: 'yanlis', eslesen: gosterim, not: 'yanlis' };
  if (u === e) return { sonuc: 'dogru', eslesen: gosterim, not: 'tam' };
  const eMek = fiil && /m[ea]k$/.test(e);
  // -mek / -mak eksik ya da fazla
  if (eMek || (fiil && /m[ea]k$/.test(u))) {
    if (mekAt(u) === mekAt(e)) return { sonuc: 'dogru', eslesen: gosterim, not: 'mek' };
  }
  const ua = asciiKatla(u), ea = asciiKatla(e);
  if (ua === ea) return { sonuc: 'dogru', eslesen: gosterim, yazim: gosterim, not: 'ascii' };
  if (eMek && mekAt(ua) === mekAt(ea)) return { sonuc: 'dogru', eslesen: gosterim, yazim: gosterim, not: 'ascii' };
  // yardımcı fiil farkı: "yardım etmek" ~ "yardım yapmak"
  const us = ua.split(' '), es = ea.split(' ');
  if (us.length >= 2 && us.length === es.length) {
    const uy = mekAt(us[us.length - 1]), ey = mekAt(es[es.length - 1]);
    if (uy !== ey && YARDIMCI.has(uy) && YARDIMCI.has(ey) && us.slice(0, -1).join(' ') === es.slice(0, -1).join(' ')) {
      return { sonuc: 'neredeyse', eslesen: gosterim, yazim: gosterim, not: 'yardimci' };
    }
  }
  // yazım hatası toleransı
  const sinir = sinirAl(b.tolerans, [...ea].length);
  if (sinir > 0) {
    const d = Math.min(uzaklik(ua, ea, sinir), eMek ? uzaklik(mekAt(ua), mekAt(ea), sinir) : sinir + 1);
    if (d <= sinir) {
      // yanıt kendi başına başka bir geçerli kelime / başka kartın karşılığıysa yazım hatası sayılmaz
      if (!kendi.has(ua) && b.digerTr && (b.digerTr.has(ua) || (eMek && (b.digerTr.has(ua + 'mek') || b.digerTr.has(ua + 'mak'))))) {
        return { ...yanlis, not: 'baska' };
      }
      return { sonuc: 'neredeyse', eslesen: gosterim, yazim: gosterim, not: 'yazim' };
    }
  }
  return yanlis;
}

/* ------------------------------------------------------------------ İngilizce */

const OZEL_YAZIM = new Map(Object.entries({
  jewellery: 'jewelry', aluminium: 'aluminum', grey: 'gray', programme: 'program', catalogue: 'catalog',
  dialogue: 'dialog', analogue: 'analog', defence: 'defense', offence: 'offense', licence: 'license',
  pretence: 'pretense', practise: 'practice', pyjamas: 'pajamas', plough: 'plow', tyre: 'tire', mould: 'mold',
  moult: 'molt', smoulder: 'smolder', moustache: 'mustache', sceptical: 'skeptical', sceptic: 'skeptic',
  manoeuvre: 'maneuver', paediatric: 'pediatric', encyclopaedia: 'encyclopedia', anaesthetic: 'anesthetic',
  anaemia: 'anemia', haemorrhage: 'hemorrhage', oestrogen: 'estrogen', foetus: 'fetus', diarrhoea: 'diarrhea',
  ageing: 'aging', judgement: 'judgment', acknowledgement: 'acknowledgment', draught: 'draft', cheque: 'check',
  kerb: 'curb', storey: 'story', axe: 'ax', cosy: 'cozy', woollen: 'woolen', enquire: 'inquire', enquiry: 'inquiry',
  artefact: 'artifact', archaeology: 'archeology', mediaeval: 'medieval', fulfil: 'fulfill', enrol: 'enroll',
  instil: 'instill', distil: 'distill', skilful: 'skillful', wilful: 'willful', instalment: 'installment',
  enrolment: 'enrollment', fulfilment: 'fulfillment', gaol: 'jail', doughnut: 'donut', whisky: 'whiskey',
}));
const OUR_ISTISNA = new Set(['four', 'hour', 'your', 'tour', 'pour', 'sour', 'flour', 'dour', 'lour', 'devour', 'detour', 'contour', 'velour', 'paramour', 'troubadour', 'amour', 'scour', 'our', 'yours', 'ours', 'hours', 'tours', 'courage', 'journey']);
const ISE_ISTISNA = new Set(['advise', 'exercise', 'surprise', 'compromise', 'supervise', 'revise', 'televise', 'devise', 'despise', 'disguise', 'enterprise', 'franchise', 'merchandise', 'promise', 'rise', 'arise', 'wise', 'precise', 'concise', 'noise', 'praise', 'raise', 'premise', 'expertise', 'otherwise', 'likewise', 'clockwise', 'chastise', 'improvise', 'incise', 'excise', 'circumcise', 'apprise', 'comprise', 'demise', 'treatise', 'cruise', 'bruise', 'poise', 'paradise', 'anise', 'reprise', 'surmise', 'mortise', 'size', 'seize', 'prize', 'capsize', 'baize', 'maize', 'citizen', 'horizon']);
const RE_ISTISNA = new Set(['acre', 'massacre', 'mediocre', 'genre', 'ogre', 'lucre', 'cadre', 'padre', 'macabre', 'timbre', 'ochre', 'euchre', 'nacre', 'chancre']);

/** Tek sözcüğü İngiliz/Amerikan ortak biçimine indir (colour→color, realise→realize, centre→center, travelled→traveled). */
export function enKanonik(w) {
  let s = OZEL_YAZIM.get(w) ?? w;
  // -our → -or (colour, favourite, behavioural)
  if (!OUR_ISTISNA.has(s)) {
    s = s.replace(/^([a-z]{3,})our(s|ed|ing|ite|ites|able|ably|ful|al|ally|er|ers|less)?$/, (m, kok, ek = '') => (OUR_ISTISNA.has(kok + 'our') ? m : kok + 'or' + ek));
  }
  // -ise / -isation / -yse → -ize / -yze
  const iseKok = s.match(/^([a-z]{2,})is(e|es|ed|ing|ation|ations|er|ers)$/);
  if (iseKok && !ISE_ISTISNA.has(iseKok[1] + 'ise') && !ISE_ISTISNA.has(s)) s = iseKok[1] + 'iz' + iseKok[2];
  s = s.replace(/^([a-z]{3,})ys(e|es|ed|ing)$/, '$1yz$2');
  // -re → -er (centre, theatre, metre, fibre)
  if (!RE_ISTISNA.has(s)) s = s.replace(/^([a-z]{2,}[^aeiouy\s])re(s)?$/, (m, kok, ek = '') => kok + 'er' + ek);
  // -ll- → -l- (travelled, cancelling, labelled, enroll)
  if (s.length >= 6) s = s.replace(/ll/g, 'l');
  return s;
}

const YER_TUTUCU = new Set(['sth', 'sb', 'smb', 'smth', 'something', 'someone', 'somebody', 'oneself', "one's", 'ones', 'one']);

/** İngilizce karşılaştırma anahtarı: küçük harf, "to"/a/an/the ön ekleri, yer tutucular atılır, yazım ortaklanır. */
export function enAnahtar(s, yerTutucuAt = true) {
  let t = temizle(parantezsiz(s), 'en');
  t = t.replace(/^(to|a|an|the)\s+/, '');
  t = t.replace(/^(to|a|an|the)\s+/, '');
  let parca = t.split(' ').filter(Boolean);
  if (yerTutucuAt && parca.length > 1) {
    const p2 = parca.filter(w => !YER_TUTUCU.has(w));
    if (p2.length) parca = p2;
  }
  return parca.map(enKanonik).join(' ');
}

/**
 * TR→EN: kullanıcının İngilizce yanıtını denetle.
 * @param {{en:string, es?:string[], kabulEn?:string[], tr?:string[]}} kart
 * @param {{tolerans?:string, enKume?:Set<string>, trdenEn?:(tr:string)=>string[]}} b
 *   enKume: bütün kelimelerin enAnahtar biçimi · trdenEn: Türkçe karşılığı taşıyan EN kelimeler
 */
export function denetleEn(yanit, kart, b = {}) {
  const parcalar = parcala(yanit);
  if (!enAnahtar(yanit, false) && !parcalar.length) return { sonuc: 'bos', eslesen: kart.en, not: 'bos' };
  const beklenen = [kart.en, ...(kart.kabulEn || [])].filter(Boolean);
  const adaylar = parcalar.length > 1 ? [String(yanit), ...parcalar] : [String(yanit)];
  let en = null;
  for (const ham of adaylar) {
    const u = enAnahtar(ham);
    if (!u) continue;
    for (const e of beklenen) {
      const ea = enAnahtar(e);
      if (u === ea) return { sonuc: 'dogru', eslesen: e, not: 'tam' };
      const sinir = sinirAl(b.tolerans, ea.length);
      if (sinir > 0 && uzaklik(u, ea, sinir) <= sinir && !(b.enKume && b.enKume.has(u))) {
        en = iyisi(en, { sonuc: 'neredeyse', eslesen: e, yazim: e, not: 'yazim' });
      }
    }
    if (!en || en.sonuc !== 'neredeyse') {
      if (esanlamMi(u, kart, b)) en = iyisi(en, { sonuc: 'esanlam', eslesen: kart.en, not: 'esanlam', yazilan: ham.trim() });
    }
  }
  return en || { sonuc: 'yanlis', eslesen: kart.en, not: 'yanlis' };
}

function esanlamMi(u, kart, b) {
  if (u === enAnahtar(kart.en)) return false;
  if ((kart.es || []).some(x => enAnahtar(x) === u)) return true;
  if (b.trdenEn) {
    for (const t of kart.tr || []) {
      if ((b.trdenEn(t) || []).some(x => enAnahtar(x) === u)) return true;
    }
  }
  return false;
}

/**
 * Boşluk doldurma: cümledeki çekimli biçim (ya da kök) beklenir.
 * @param {{en:string, oe:string, ob:[number,number]}} kart
 */
export function denetleBosluk(yanit, kart, b = {}) {
  const bicim = kart.ob ? kart.oe.slice(kart.ob[0], kart.ob[1]) : kart.en;
  if (!enAnahtar(yanit, false)) return { sonuc: 'bos', eslesen: bicim, not: 'bos' };
  const u = enAnahtar(yanit, false);
  const eb = enAnahtar(bicim, false), ek = enAnahtar(kart.en, false);
  if (u === eb) return { sonuc: 'dogru', eslesen: bicim, not: 'tam' };
  if (u === ek) return { sonuc: 'dogru', eslesen: bicim, yazim: bicim, not: 'kok' };
  const sinir = sinirAl(b.tolerans, eb.length);
  if (sinir > 0 && !(b.enKume && b.enKume.has(u) && u !== ek)) {
    if (uzaklik(u, eb, sinir) <= sinir || uzaklik(u, ek, sinir) <= sinir) return { sonuc: 'neredeyse', eslesen: bicim, yazim: bicim, not: 'yazim' };
  }
  return { sonuc: 'yanlis', eslesen: bicim, not: 'yanlis' };
}

/** Örnek cümlede kelimeyi boşlukla değiştir. */
export function boslukluCumle(oe, ob, isaret = '_____') {
  if (!oe || !ob) return null;
  return oe.slice(0, ob[0]) + isaret + oe.slice(ob[1]);
}
