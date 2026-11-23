// Tıklanınca anlam baloncuğu. SÖZLEŞME (imzalar sabit):
//   enSar(metin, {gizle:[kelime…], vurgu:[bas,bit]}) → güvenli HTML; her İngilizce kelime <span class="kw" data-k="…">
//   balonKur() → bir kez çağrılır; belge düzeyinde .kw tıklama / dokunma dinleyicisi
//   balonKapat()   gizliAc(kap): yanıt verildikten sonra gizlenen (yanıtı ele veren) kelimeleri tıklanır yap
import { kac, ikon } from './ui.js';
import { oku } from './ses.js';
import { enAnah, cekimler, durakMi } from './sozluk_motor.js';
import { madde, kokBul, obekBul, desteBul, maddeBirlestir, turAd, hazirla, durum as sozlukDurum } from './sozluk.js';

/* ================================================================== enSar */
// Harf dizisi; iç kesme (don't, teacher's) ve tire (well-known) kelimenin parçası. Sayı / noktalama dışarıda kalır.
const KELIME_RE = /\p{L}+(?:['’]\p{L}+)*(?:-\p{L}+(?:['’]\p{L}+)*)*/gu;

/** Gizlenecek biçimler: kelime(ler)in kendisi + çekimleri (öbekte durak kelimeleri hariç her kelime). */
export function gizliKume(gizle) {
  const s = new Set();
  for (const g of gizle || []) {
    if (!g) continue;
    const ts = enAnah(g).split(/[\s/]+/).filter(Boolean);
    const icerik = ts.length > 1 ? ts.filter(t => !durakMi(t) && t !== 'to' && t !== "one's" && t !== 'someone' && t !== 'something') : ts;
    for (const t of icerik) for (const f of cekimler(t)) s.add(f);
  }
  return s;
}

/**
 * İngilizce metni tıklanabilir kelimelere böl. Çıktı HTML kaçışlıdır.
 * @param {string} metin
 * @param {{gizle?: string[], vurgu?: [number, number]|null}} o vurgu: UTF-16 [bas, bit) aralığı <mark> içinde
 */
export function enSar(metin, { gizle = [], vurgu = null } = {}) {
  const s = metin == null ? '' : String(metin);
  if (!s) return '';
  const gz = gizle && gizle.length ? gizliKume(gizle) : null;
  const t = [];
  for (const m of s.matchAll(KELIME_RE)) t.push([m.index, m.index + m[0].length, m[0]]);
  let vb = -1, ve = -1;
  if (Array.isArray(vurgu) && vurgu.length === 2 && Number.isFinite(vurgu[0]) && vurgu[1] > vurgu[0]) {
    vb = Math.max(0, vurgu[0]); ve = Math.min(s.length, vurgu[1]);
    for (const [a, b] of t) { if (vb > a && vb < b) vb = a; if (ve > a && ve < b) ve = b; }
  }
  let acik = false, acildi = false;
  const olay = p => {
    let r = '';
    if (acik && p === ve) { r += '</mark>'; acik = false; }
    if (!acildi && p === vb && ve > vb) { r += '<mark>'; acik = true; acildi = true; }
    return r;
  };
  const ara = (a, b) => {
    let r = '', p = a;
    for (const q of [vb, ve].filter(q => q > a && q < b).sort((x, y) => x - y)) { r += kac(s.slice(p, q)) + olay(q); p = q; }
    return r + kac(s.slice(p, b));
  };
  let out = olay(0), son = 0, ilk = true;
  t.forEach(([a, b, w], i) => {
    out += ara(son, a) + olay(a);
    const sonraki = t[i + 1];
    const bitisik = sonraki && /^[ \t ]+$/.test(s.slice(b, sonraki[0])) ? ' data-s=""' : '';
    const tl = enAnah(w);
    const gizli = gz && (gz.has(tl) || gz.has(tl.replace(/'s$/, '')));
    const tab = !gizli && ilk ? '0' : '-1';
    if (!gizli) ilk = false;
    out += `<span class="${gizli ? 'kw-gizli' : 'kw'}" data-k="${kac(w)}" data-i="${i}" tabindex="${tab}"${bitisik}>${kac(w)}</span>`;
    son = b;
    out += olay(b);
  });
  out += ara(son, s.length) + olay(s.length);
  if (acik) out += '</mark>';
  return `<span class="ens">${out}</span>`;
}

/** Yanıt verildi: gizli kelimeleri aç. */
export function gizliAc(kap = document) {
  if (!kap || !kap.querySelectorAll) return;
  kap.querySelectorAll('.kw-gizli').forEach(e => { e.className = 'kw'; });
}

/* ================================================================== baloncuk */
let kurulu = false, balon = null, capa = null, sayac = 0, klavyeyle = false, acilisUst = 0, izleyici = 0, sonDokunma = 0;
const balonAcik = () => !!(balon && !balon.hidden);
const kwBul = t => {
  const el = t && (t.nodeType === 1 ? t : t.parentElement);
  return el && el.closest ? el.closest('.kw') : null;
};

function balonEl() {
  if (balon && balon.isConnected) return balon;
  balon = document.createElement('div');
  balon.className = 'balon'; balon.id = 'balon'; balon.hidden = true; balon.tabIndex = -1;
  balon.setAttribute('role', 'dialog'); balon.setAttribute('aria-label', 'Kelime anlamı');
  balon.innerHTML = '<span class="balon-ok" aria-hidden="true"></span><div class="bl-ic" aria-live="polite"></div>';
  document.body.append(balon);
  balon.addEventListener('click', e => {
    const o = e.target.closest('[data-bl-oku]');
    if (o) { e.preventDefault(); oku(o.dataset.blOku); return; }
    if (e.target.closest('a[href]')) setTimeout(balonKapat, 0);
  });
  return balon;
}

export function balonKapat() {
  sayac++;
  if (izleyici) { clearInterval(izleyici); izleyici = 0; }
  if (capa) { capa.classList.remove('kw-secili'); capa.removeAttribute('aria-expanded'); }
  capa = null;
  if (balon) { balon.hidden = true; balon.querySelector('.bl-ic').innerHTML = ''; }
}

function sinirlar() {
  const vv = window.visualViewport;
  return vv ? { ust: vv.offsetTop, sol: vv.offsetLeft, gen: vv.width, yuk: vv.height } : { ust: 0, sol: 0, gen: innerWidth, yuk: innerHeight };
}

/** Baloncuğu kelimenin altına (yer yoksa üstüne) yerleştir; ekran dışına taşmaz. */
function konumla() {
  if (!balonAcik() || !capa) return;
  if (!capa.isConnected) { balonKapat(); return; }
  const r = capa.getBoundingClientRect();
  const v = sinirlar(), K = 8, ARA = 10;
  const w = Math.min(360, v.gen - 2 * K);
  balon.style.width = w + 'px';
  balon.style.maxHeight = 'none';
  const h = balon.scrollHeight;
  const altBos = v.ust + v.yuk - r.bottom - ARA - K, ustBos = r.top - v.ust - ARA - K;
  const asagi = altBos >= Math.min(h, 240) || altBos >= ustBos;
  const maxH = Math.max(110, Math.floor(asagi ? altBos : ustBos));
  balon.style.maxHeight = maxH + 'px';
  const h2 = Math.min(h, maxH);
  let top = asagi ? r.bottom + ARA : r.top - ARA - h2;
  top = Math.max(v.ust + K, Math.min(top, v.ust + v.yuk - K - h2));
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(v.sol + K, Math.min(left, v.sol + v.gen - K - w));
  balon.style.top = Math.round(top) + 'px';
  balon.style.left = Math.round(left) + 'px';
  balon.dataset.yon = asagi ? 'alt' : 'ust';
  balon.style.setProperty('--ok-x', Math.round(Math.max(16, Math.min(w - 16, r.left + r.width / 2 - left))) + 'px');
}

const iskeletHtml = w => `<div class="bl-bas"><b class="bl-k" lang="en">${kac(w)}</b></div><div class="bl-iskelet" aria-label="Yükleniyor"><i></i><i></i><i style="width:60%"></i></div>`;

function maddeHtml(m, { baslik = true } = {}) {
  const gruplar = m.gruplar.filter(g => g.tr.length).slice(0, 3);
  const etiketler = [...new Set(m.gruplar.map(g => g.tur))].slice(0, 3).map(t => `<span class="etiket">${kac(turAd(t))}</span>`).join('');
  const sv = m.sv ? `<span class="etiket sv sv-${kac(m.sv)}${m.svt ? ' tahmin' : ''}">${m.svt ? '≈' : ''}${kac(m.sv)}</span>` : '';
  let govde = '';
  if (gruplar.length) {
    govde = `<ul class="bl-tr">${gruplar.map(g => `<li>${m.gruplar.length > 1 ? `<span class="bl-tur">${kac(turAd(g.tur))}</span> ` : ''}${kac(g.tr.slice(0, 5).join(', '))}</li>`).join('')}</ul>`;
  } else if (m.tanim) {
    govde = `<p class="bl-tanim" lang="en">${kac(m.tanim)}</p><p class="bl-not">Türkçe karşılığı yok; İngilizce tanım gösteriliyor.</p>`;
  } else govde = '<p class="bl-not">Bu maddede anlam bilgisi yok.</p>';
  return `${baslik ? `<div class="bl-bas"><b class="bl-k" lang="en">${kac(m.en)}</b>${m.ipa ? `<span class="ipa">${kac(m.ipa)}</span>` : ''}<button type="button" class="dg dg-k dg-ikon dg-hayalet ses-dg" data-bl-oku="${kac(m.en)}" aria-label="Sesli oku">${ikon('ses')}</button></div>
    <div class="bl-etiketler">${etiketler}${sv}</div>` : ''}${govde}`;
}

function eylemHtml(m, w) {
  const en = m ? m.en : w;
  const karta = m && m.id
    ? `<a class="dg dg-k" href="#/kelime/${encodeURIComponent(m.id)}">${ikon('kitap')} Kelimeyi aç</a>`
    : `<a class="dg dg-k" href="#/kart/yeni?en=${encodeURIComponent(en)}${m && m.tr.length ? '&tr=' + encodeURIComponent(m.tr.slice(0, 3).join(', ')) : ''}${m && m.turler[0] ? '&tur=' + encodeURIComponent(m.turler[0]) : ''}">${ikon('arti')} Karta ekle</a>`;
  return `<div class="bl-eylem">${karta}<a class="dg dg-k dg-hayalet" href="#/sozluk?q=${encodeURIComponent(en)}">${ikon('ara')} Sözlükte aç</a></div>`;
}

/** Tıklanan kelimenin çevresinden öbek adayları (yalnız boşlukla ayrılmış, gizli olmayan komşular). */
function obekAdaylari(k) {
  const kap = k.closest('.ens') || k.parentElement;
  const l = [...kap.querySelectorAll('.kw')];
  const i = l.indexOf(k);
  if (i < 0) return [];
  const bitisik = (a, b) => l[a].hasAttribute('data-s') && Number(l[b].dataset.i) === Number(l[a].dataset.i) + 1;
  let sol = i; while (sol > 0 && i - sol < 3 && bitisik(sol - 1, sol)) sol--;
  let sag = i; while (sag < l.length - 1 && sag - i < 3 && bitisik(sag, sag + 1)) sag++;
  const ad = [];
  for (let n = Math.min(4, sag - sol + 1); n >= 2; n--) {
    for (let b = Math.max(sol, i - n + 1); b <= Math.min(i, sag - n + 1); b++) ad.push(l.slice(b, b + n).map(x => x.dataset.k));
  }
  return ad;
}

async function icerikUret(k, goster) {
  const w = k.dataset.k;
  const deste = desteBul(w);
  if (deste.length) goster(maddeHtml(maddeBirlestir(w, deste, [], null, { parcaDurum: 'tamam' })) + '<div class="bl-iskelet kucuk"><i style="width:40%"></i></div>' + eylemHtml(maddeBirlestir(w, deste), w));
  hazirla().catch(() => {});
  const [obek, kokler, kendi] = await Promise.all([obekBul(obekAdaylari(k)), kokBul(w), madde(w)]);
  let ana = kendi, not = '', ayrica = '';
  // Kelimenin kendi maddesi öne: destedeyse ya da Türkçe karşılığı var ve kök destede değilse ("the" → "thee" olmasın)
  const kendiOne = kendi && (kendi.id || (kendi.tr.length && !desteBul(kokler[0] || '').length));
  if (kokler.length && !kendiOne) {
    const km = await madde(kokler[0]);
    if (km) {
      ana = km;
      not = `<p class="bl-not"><b lang="en">${kac(w)}</b>, <b lang="en">${kac(km.en)}</b> kelimesinin biçimi.${kokler.length > 1 ? ` Başka kök: ${kokler.slice(1, 3).map(x => `<a href="#/sozluk?q=${encodeURIComponent(x)}" lang="en">${kac(x)}</a>`).join(', ')}` : ''}</p>`;
      if (kendi && kendi.tr.length) ayrica = `<p class="bl-ayrica"><b lang="en">${kac(kendi.en)}</b> (${kac(turAd(kendi.turler[0]))}): ${kac(kendi.tr.slice(0, 3).join(', '))}</p>`;
    }
  } else if (kokler.length && kendi) {
    not = `<p class="bl-not">Ayrıca <a href="#/sozluk?q=${encodeURIComponent(kokler[0])}" lang="en">${kac(kokler[0])}</a> kelimesinin biçimi olabilir.</p>`;
  }
  let parcalar = '';
  if (!ana && w.includes('-')) {
    const ps = (await Promise.all(w.split('-').filter(Boolean).slice(0, 3).map(p => madde(p)))).filter(Boolean);
    parcalar = ps.map(m => `<div class="bl-parca">${maddeHtml(m)}</div>`).join('');
  }
  let ob = '';
  if (obek && enAnah(obek.en) !== enAnah(w)) {
    const om = await madde(obek.en);
    if (om) ob = `<div class="bl-obek"><span class="bl-ust">Öbek</span>${maddeHtml(om)}${eylemHtml(om)}</div>`;
  }
  const baglanti = (ana && ana.baglantiGerekli && !ana.tr.length) || (!ana && sozlukDurum.cekirdek === 'hata');
  let html;
  if (ana) html = ob + not + maddeHtml(ana) + ayrica + (baglanti ? '<p class="bl-uyari">Tam anlam için bağlantı gerekli.</p>' : '') + eylemHtml(ana, w);
  else if (parcalar) html = ob + parcalar + eylemHtml(null, w);
  else if (ob) html = ob;
  else html = `<div class="bl-bas"><b class="bl-k" lang="en">${kac(w)}</b></div>${baglanti || (typeof navigator !== 'undefined' && navigator.onLine === false)
    ? '<p class="bl-uyari">Anlam için bağlantı gerekli (sözlük bu cihaza henüz inmedi).</p>'
    : '<p class="bl-not">Sözlükte bulunamadı.</p>'}${eylemHtml(null, w)}`;
  goster(html);
}

async function ac(k, klavye) {
  if (capa === k && balonAcik()) { balonKapat(); return; }
  balonKapat();
  const b = balonEl();
  capa = k; klavyeyle = klavye;
  k.classList.add('kw-secili'); k.setAttribute('aria-expanded', 'true');
  b.hidden = false;
  const ic = b.querySelector('.bl-ic');
  ic.innerHTML = iskeletHtml(k.dataset.k);
  konumla();
  acilisUst = k.getBoundingClientRect().top;
  izleyici = setInterval(() => { if (capa && !capa.isConnected) balonKapat(); }, 250);
  const no = ++sayac;
  const goster = html => { if (no !== sayac || !balonAcik()) return; ic.innerHTML = html; konumla(); };
  try { await icerikUret(k, goster); }
  catch (e) { console.warn('Baloncuk', e); goster(`<div class="bl-bas"><b class="bl-k">${kac(k.dataset.k)}</b></div><p class="bl-uyari">Anlam yüklenemedi.</p>${eylemHtml(null, k.dataset.k)}`); }
  if (klavye && no === sayac && balonAcik()) b.focus({ preventScroll: true });
}

function secimVar(k) {
  try { const s = getSelection(); return !!s && !s.isCollapsed && s.toString().trim().length > 0 && s.containsNode(k, true); } catch { return false; }
}

export function balonKur() {
  if (kurulu || typeof document === 'undefined') return;
  kurulu = true;
  // Dokunma: tıklama olayını beklemeden aç; preventDefault ile odak (oturumdaki input) ve çift dokunma yakınlaştırması bozulmaz.
  let dokun = null;
  document.addEventListener('touchstart', e => {
    const k = kwBul(e.target);
    if (!k || e.touches.length > 1) { dokun = null; return; }
    const t = e.touches[0]; dokun = { k, x: t.clientX, y: t.clientY, z: Date.now() };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!dokun) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - dokun.x, t.clientY - dokun.y) > 10) dokun = null;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    const o = balonAcik() && e.target.closest && e.target.closest('#balon [data-bl-oku]');
    if (o) { e.preventDefault(); oku(o.dataset.blOku); return; }
    const d = dokun; dokun = null;
    if (!d || Date.now() - d.z > 450 || kwBul(e.target) !== d.k || secimVar(d.k)) return;
    e.preventDefault(); sonDokunma = Date.now();
    ac(d.k, false);
  }, { passive: false });
  // Fare: odak çalmasın (oturumdaki input'un klavyesi / Enter akışı bozulmasın)
  document.addEventListener('mousedown', e => {
    if (kwBul(e.target)) { e.preventDefault(); return; }
    if (balonAcik() && balon.contains(e.target) && !e.target.closest('input,textarea,select')) e.preventDefault();
  }, true);
  document.addEventListener('click', e => {
    const k = kwBul(e.target);
    if (!k) return;
    e.preventDefault();
    if (Date.now() - sonDokunma < 700 || secimVar(k)) return;
    ac(k, e.detail === 0);
  }, true);
  document.addEventListener('pointerdown', e => {
    if (!balonAcik() || balon.contains(e.target) || kwBul(e.target)) return;
    balonKapat();
  }, true);
  // Klavye: pencere yakalama evresinde (ekranların Enter kısayolundan önce)
  window.addEventListener('keydown', e => {
    const k = kwBul(e.target);
    if (k && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); ac(k, true); return; }
    if (k && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const l = [...(k.closest('.ens') || k.parentElement).querySelectorAll('.kw')];
      const y = l[l.indexOf(k) + (e.key === 'ArrowRight' ? 1 : -1)];
      if (y) { e.preventDefault(); e.stopPropagation(); k.tabIndex = -1; y.tabIndex = 0; y.focus(); }
      return;
    }
    if (e.key === 'Escape' && balonAcik()) {
      e.preventDefault(); e.stopPropagation();
      const c = capa, kl = klavyeyle || balon.contains(document.activeElement);
      balonKapat();
      if (kl && c && c.isConnected) c.focus({ preventScroll: true });
      return;
    }
    if (balonAcik() && balon.contains(e.target) && e.key === 'Enter') e.stopPropagation();
  }, true);
  window.addEventListener('scroll', e => {
    if (!balonAcik() || (e.target && e.target.nodeType === 1 && balon.contains(e.target))) return;
    if (!capa || Math.abs(capa.getBoundingClientRect().top - acilisUst) > 40) balonKapat(); else konumla();
  }, true);
  window.addEventListener('resize', konumla);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', konumla);
  window.addEventListener('hashchange', () => balonKapat());
}
