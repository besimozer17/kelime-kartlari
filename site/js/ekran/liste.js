// Kelime listesi (#/liste): sanal kaydırma (pencere kaydırması), arama, süzgeç, sıralama, çoklu seçim.
import { S, kelime, suz, tumDesteler, kelimeDurum, zorMu, sonCalisma, metaYaz, SEVIYELER, TURLER, aramaMetni } from '../veri.js';
import { DURUM_AD } from '../tekrar.js';
import { seviyeNo, siraKarsilastir } from '../oturum.js';
import { oturumKur } from './calis.js';
import { desteSec } from './kart.js';
import { aksansiz } from '../metin.js';
import { ikon, kac, bildir, pencere, geciktir, sayi, yolKimlik } from '../ui.js';

const SATIR = 64;
const VARSAYILAN = { q: '', sv: [], zor: [], tur: [], deste: '', durum: [], sira: 'alfabe', tohum: 1 };
export const SIRALAMA = [
  ['alfabe', 'Alfabetik'], ['seviye', 'Seviye (A1 → C2)'], ['kolay', 'Kolaydan zora'], ['zor', 'Zordan kolaya'],
  ['onem', 'Sınav önemi'], ['karisik', 'Karışık'], ['son', 'Son çalışılan'],
];
export const ZOR_DILIM = [['1', 'Çok kolay'], ['2', 'Kolay'], ['3', 'Orta'], ['4', 'Zor'], ['5', 'Çok zor']];
export const DURUMLAR = [['yeni', 'Yeni'], ['ogreniliyor', 'Öğreniliyor'], ['pekisiyor', 'Pekişiyor'], ['ogrenildi', 'Öğrenildi'], ['zor', 'Zorlandıklarım'], ['ozel', 'Kendi kartlarım'], ['cikar', 'Çıkarılanlar']];

function oku() {
  try { return { ...VARSAYILAN, ...JSON.parse(sessionStorage.getItem('kk.liste') || '{}') }; } catch { return { ...VARSAYILAN }; }
}
let F = oku();
let kaydirma = 0;
/** Son liste sırası (kelime ayrıntısında önceki / sonraki için). */
export let sonSira = [];
function kaydet() { try { sessionStorage.setItem('kk.liste', JSON.stringify(F)); } catch { /* */ } }
/** Başka ekrandan listeye süzgeçle gitmek için (ör. deste → "Listede göster"). */
export function listeSuzgec(yama) { F = { ...VARSAYILAN, ...yama }; kaydirma = 0; kaydet(); }

const harmanla = new Intl.Collator('en', { sensitivity: 'base' }).compare;
const svEtiket = k => k.sv ? `<span class="etiket sv sv-${k.sv}${k.svt ? ' tahmin' : ''}" title="${k.svt ? 'Tahmini seviye' : 'Seviye'}">${k.svt ? '≈' : ''}${k.sv}</span>` : '';
function karisikSira(id, tohum) { let h = tohum | 0; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761); return (h ^ (h >>> 15)) >>> 0; }
export const suzgecSayisi = f => f.sv.length + f.zor.length + f.tur.length + f.durum.length + (f.deste ? 1 : 0);

/** Süzgeci uygula ve sırala. */
export function listeHesapla(f) {
  const sonuc = suz({ q: f.q, sv: f.sv, zor: f.zor, tur: f.tur, deste: f.deste, durum: f.durum });
  let kars;
  switch (f.sira) {
    case 'seviye': kars = (a, b) => (seviyeNo(a.sv) - seviyeNo(b.sv)) || harmanla(a.en, b.en); break;
    case 'kolay': case 'zor': case 'onem': kars = siraKarsilastir(f.sira); break;
    case 'karisik': { const t = f.tohum || 1; kars = (a, b) => karisikSira(a.id, t) - karisikSira(b.id, t); break; }
    case 'son': kars = (a, b) => (sonCalisma(b.id) - sonCalisma(a.id)) || harmanla(a.en, b.en); break;
    default: kars = (a, b) => harmanla(a.en, b.en);
  }
  const q = f.q ? aksansiz(f.q.trim()) : '';
  if (q) {
    // önce isabet: tam eşleşme > önek > Türkçe önek > içerir
    const kat = k => {
      const e = aksansiz(k.en);
      if (e === q) return 0;
      if (e.startsWith(q)) return 1;
      const tr = aramaMetni(k).split('\u0001')[1] || '';
      if (tr.split(' · ').some(t => t.trim() === q)) return 2;
      if (tr.split(' · ').some(t => t.trim().startsWith(q))) return 3;
      return 4;
    };
    const kk = new Map(sonuc.map(k => [k.id, kat(k)]));
    sonuc.sort((a, b) => (kk.get(a.id) - kk.get(b.id)) || kars(a, b));
  } else sonuc.sort(kars);
  return sonuc;
}

export function listeEkrani(main) {
  let sonuc = [], secimKipi = false;
  const secili = new Set();
  const ozelSay = S.ozel.size;
  main.innerHTML = `<div class="ekran liste-ekran">
    <div class="ekran-bas"><h1>Kelimeler<span class="alt">${sayi(S.hazirKelimeler.length)} hazır kelime${ozelSay ? ` · ${sayi(ozelSay)} kendi kartı` : ''}</span></h1>
      <a class="dg dg-ikon dg-hayalet" href="#/desteler" aria-label="Desteler" title="Desteler">${ikon('deste')}</a>
      <a class="dg dg-ana" href="#/kart/yeni">${ikon('arti')}<span class="dar-gizle">Kart ekle</span></a></div>
    <div class="liste-ust">
      <div class="ara-kutu">${ikon('ara')}<input type="search" id="ara" placeholder="İngilizce ya da Türkçe ara" aria-label="Kelime ara" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"><button type="button" class="dg dg-ikon dg-hayalet temizle" id="araTemizle" aria-label="Aramayı temizle" hidden>${ikon('kapat')}</button></div>
      <div class="suzgec-cubuk" role="toolbar" aria-label="Hızlı süzgeçler">
        <button type="button" class="cip" id="suzgecDg">${ikon('suzgec', 'ikon-k')} Süzgeç <span class="say" id="suzSay"></span></button>
        <select id="sira" class="cip-sec" aria-label="Sıralama">${SIRALAMA.map(([v, a]) => `<option value="${v}">${a}</option>`).join('')}</select>
        ${SEVIYELER.map(s => `<button type="button" class="cip" data-hsv="${s}">${s}</button>`).join('')}
        <button type="button" class="cip" data-hdurum="zor">Zorlandıklarım</button>
        <button type="button" class="cip" data-hdurum="ozel">Kendi kartlarım</button>
      </div>
      <div class="liste-bilgi"><span class="yayil" aria-live="polite"><b id="sonucSay">…</b> <span id="sonucAd">kelime</span> <button type="button" class="dg dg-k dg-hayalet" id="hepsiniTemizle" hidden>Süzgeci temizle</button></span>
        <button type="button" class="dg dg-k" id="secDg" aria-pressed="false">${ikon('sec', 'ikon-k')} Seç</button>
        <button type="button" class="dg dg-k dg-ana" id="calisDg">${ikon('oynat', 'ikon-k')} Bu süzgeçle çalış</button></div>
    </div>
    <div class="sanal" id="sanal" role="list" aria-label="Kelimeler"><div class="sanal-ic" id="sanalIc"></div></div>
    <div id="bos" hidden></div>
    <div class="secim-cubuk" id="secimCubuk" hidden>
      <b id="seciliSay">0 seçili</b>
      <button type="button" class="dg dg-k" data-se="tum">Tümü</button>
      <button type="button" class="dg dg-k" data-se="deste">${ikon('deste', 'ikon-k')} Desteye</button>
      <button type="button" class="dg dg-k" data-se="zor">${ikon('bayrak', 'ikon-k')} Zor</button>
      <button type="button" class="dg dg-k" data-se="cikar">${ikon('sil', 'ikon-k')} Çıkar</button>
      <button type="button" class="dg dg-k" data-se="geri">Geri al</button>
      <button type="button" class="dg dg-k dg-ikon dg-hayalet" data-se="kapat" aria-label="Seçimi kapat">${ikon('kapat')}</button>
    </div>
  </div>`;
  const $ = s => main.querySelector(s);
  const sanal = $('#sanal'), ic = $('#sanalIc'), ara = $('#ara');
  ara.value = F.q; $('#sira').value = F.sira;
  let aralik = [-1, -1];

  function satir(k, i) {
    const m = S.meta.get(k.id);
    const sec = secili.has(k.id);
    const d = kelimeDurum(k.id);
    const sol = secimKipi ? `<span class="sec-kutu" aria-hidden="true">${sec ? ikon('dogru') : ''}</span>` : `<i class="nokta d-${d}" title="${DURUM_AD[d]}"></i>`;
    const rol = secimKipi ? `role="checkbox" aria-checked="${sec}"` : 'role="listitem"';
    return `<a class="ksatir${sec ? ' secili' : ''}${m && m.cikar ? ' cikmis' : ''}" href="#/kelime/${yolKimlik(k.id)}" data-id="${kac(k.id)}" style="top:${i * SATIR}px" ${rol} aria-posinset="${i + 1}" aria-setsize="${sonuc.length}">${sol}
      <span class="govde"><span class="k kesik">${kac(k.en)}<small>${kac(TURLER[k.tur] || k.tur || '')}</small></span><span class="a kesik">${kac((k.tr || []).join(', '))}</span></span>
      <span class="sag">${m && m.cikar ? '<span class="etiket">çıkarıldı</span>' : ''}${zorMu(k.id) ? `<span class="zor-isaret" title="Zorlandıklarım">${ikon('bayrak', 'ikon-k')}</span>` : ''}${k.ozel ? '<span class="etiket mor">kendi</span>' : ''}${svEtiket(k)}</span></a>`;
  }
  function ciz(zorla = false) {
    const r = sanal.getBoundingClientRect();
    const bas = Math.max(0, Math.floor(-r.top / SATIR) - 8);
    const bit = Math.min(sonuc.length, Math.ceil((innerHeight - r.top) / SATIR) + 8);
    if (!zorla && bas === aralik[0] && bit === aralik[1]) return;
    aralik = [bas, bit];
    let h = '';
    for (let i = bas; i < bit; i++) h += satir(sonuc[i], i);
    ic.innerHTML = h;
  }
  let bekleyen = false;
  const kaydir = () => { if (!bekleyen) { bekleyen = true; requestAnimationFrame(() => { bekleyen = false; ciz(); }); } };

  function cubuklar() {
    const n = suzgecSayisi(F);
    $('#suzSay').textContent = n ? n : '';
    $('#suzgecDg').setAttribute('aria-pressed', n > 0);
    main.querySelectorAll('[data-hsv]').forEach(b => b.setAttribute('aria-pressed', F.sv.includes(b.dataset.hsv)));
    main.querySelectorAll('[data-hdurum]').forEach(b => b.setAttribute('aria-pressed', F.durum.includes(b.dataset.hdurum)));
    $('#hepsiniTemizle').hidden = !(n || F.q);
    $('#araTemizle').hidden = !F.q;
  }
  function yenile({ basaDon = true } = {}) {
    kaydet();
    sonuc = listeHesapla(F);
    sonSira = sonuc.map(k => k.id);
    $('#sonucSay').textContent = sayi(sonuc.length);
    $('#sonucAd').textContent = F.q || suzgecSayisi(F) ? 'sonuç' : 'kelime';
    $('#calisDg').disabled = !sonuc.some(k => !S.meta.get(k.id)?.cikar);
    sanal.hidden = !sonuc.length;
    sanal.style.height = Math.max(1, sonuc.length) * SATIR + 'px';
    const bos = $('#bos');
    bos.hidden = !!sonuc.length;
    if (!sonuc.length) {
      const ozelBos = F.durum.length === 1 && F.durum[0] === 'ozel' && !F.q && !S.ozel.size;
      bos.innerHTML = ozelBos
        ? `<div class="kutu bos-durum">${ikon('arti')}<h2>Henüz kendi kartınız yok</h2><p>Kendi kelimelerinizi tek tek ya da bir listeden toplu ekleyebilirsiniz.</p><div class="satir"><a class="dg dg-ana" href="#/kart/yeni">Kart ekle</a><a class="dg" href="#/toplu">Toplu ekle</a></div></div>`
        : `<div class="kutu bos-durum">${ikon('ara')}<h2>Sonuç yok</h2><p>${F.q ? `"${kac(F.q)}" için ` : ''}bu süzgeçle eşleşen kelime bulunamadı.</p><div class="satir">${suzgecSayisi(F) ? '<button type="button" class="dg" data-bos="temizle">Süzgeci temizle</button>' : ''}${F.q ? `<a class="dg" href="#/sozluk?q=${encodeURIComponent(F.q)}">Sözlükte ara</a><a class="dg dg-ana" href="#/kart/yeni?en=${encodeURIComponent(F.q)}">"${kac(F.q)}" için kart ekle</a>` : ''}</div></div>`;
    }
    cubuklar();
    if (basaDon && scrollY > 0) scrollTo(0, 0);
    ciz(true);
  }
  function secimGuncelle() {
    $('#seciliSay').textContent = `${sayi(secili.size)} seçili`;
    const sec = [...secili];
    const hepsiCikmis = sec.length && sec.every(id => S.meta.get(id)?.cikar);
    main.querySelector('[data-se="cikar"]').hidden = hepsiCikmis;
    main.querySelector('[data-se="geri"]').hidden = !hepsiCikmis;
    main.querySelectorAll('[data-se="deste"],[data-se="zor"],[data-se="cikar"],[data-se="geri"]').forEach(b => { b.disabled = !secili.size; });
    main.querySelector('[data-se="tum"]').textContent = secili.size === sonuc.length && sonuc.length ? 'Hiçbiri' : 'Tümü';
    ciz(true);
  }
  function secimAc(ac) {
    secimKipi = ac; if (!ac) secili.clear();
    $('#secDg').setAttribute('aria-pressed', ac);
    $('#secimCubuk').hidden = !ac;
    main.querySelector('.liste-ekran').classList.toggle('secimde', ac);
    secimGuncelle();
  }

  const araGec = geciktir(() => { F.q = ara.value; yenile(); }, 140);
  ara.addEventListener('input', araGec);
  ara.addEventListener('keydown', e => { if (e.key === 'Escape' && ara.value) { ara.value = ''; F.q = ''; yenile(); } if (e.key === 'Enter') ara.blur(); });
  $('#sira').addEventListener('change', e => { F.sira = e.target.value; if (F.sira === 'karisik') F.tohum = (Math.random() * 1e9) | 0; yenile(); });

  main.addEventListener('click', async e => {
    const satirEl = e.target.closest('.ksatir');
    if (satirEl && secimKipi) {
      e.preventDefault();
      const id = satirEl.dataset.id;
      if (secili.has(id)) secili.delete(id); else secili.add(id);
      secimGuncelle(); return;
    }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.hsv) { const v = b.dataset.hsv; F.sv = F.sv.includes(v) ? F.sv.filter(x => x !== v) : [...F.sv, v]; return yenile(); }
    if (b.dataset.hdurum) { const v = b.dataset.hdurum; F.durum = F.durum.includes(v) ? F.durum.filter(x => x !== v) : [...F.durum, v]; return yenile(); }
    if (b.id === 'araTemizle') { ara.value = ''; F.q = ''; yenile(); ara.focus(); return; }
    if (b.id === 'hepsiniTemizle' || b.dataset.bos === 'temizle') { F = { ...VARSAYILAN, sira: F.sira, tohum: F.tohum }; ara.value = ''; return yenile(); }
    if (b.id === 'suzgecDg') return suzgecPenceresi();
    if (b.id === 'secDg') return secimAc(!secimKipi);
    if (b.id === 'calisDg') {
      const ad = sonuc.filter(k => !S.meta.get(k.id)?.cikar);
      // listenin sırası korunmak istenirse kurulumdaki sıra ayarı kullanılır
      return oturumKur({ ...S.ayar.kurulum, kaynak: 'hepsi' }, ad);
    }
    const se = b.dataset.se; if (!se) return;
    const ids = [...secili];
    if (se === 'kapat') return secimAc(false);
    if (se === 'tum') { if (secili.size === sonuc.length) secili.clear(); else sonuc.forEach(k => secili.add(k.id)); return secimGuncelle(); }
    if (se === 'deste') { const r = await desteSec(ids); if (r) bildir(r, { tur: 'tamam' }); return secimGuncelle(); }
    if (se === 'zor') {
      const hepsiZor = ids.every(id => S.meta.get(id)?.zor);
      ids.forEach(id => metaYaz(id, { zor: !hepsiZor }));
      bildir(hepsiZor ? `${ids.length} kelimeden zor işareti kaldırıldı.` : `${ids.length} kelime zor olarak işaretlendi.`, { tur: 'tamam' });
      return secimGuncelle();
    }
    if (se === 'cikar' || se === 'geri') {
      const cik = se === 'cikar';
      const onceki = ids.map(id => [id, !!S.meta.get(id)?.cikar]);
      ids.forEach(id => metaYaz(id, { cikar: cik }));
      bildir(cik ? `${ids.length} kelime çalışmadan çıkarıldı.` : `${ids.length} kelime çalışmaya geri alındı.`, { eylem: { ad: 'Geri al', f: () => { onceki.forEach(([id, v]) => metaYaz(id, { cikar: v })); yenile({ basaDon: false }); } } });
      secili.clear(); yenile({ basaDon: false }); return secimGuncelle();
    }
  });

  function suzgecPenceresi() {
    const g = document.createElement('div');
    const desteler = tumDesteler();
    const gruplar = [['sinav', 'Sınav desteleri'], ['tur', 'Türe göre'], ['seviye', 'Seviyeye göre'], ['ozel', 'Özel desteler'], ['kendi', 'Kendi destelerim']];
    const turler = [...new Set(S.tumu.map(k => k.tur))].filter(Boolean);
    const cipler = (alan, liste) => `<div class="cip-grup" data-alan="${alan}">${liste.map(([v, a]) => `<button type="button" class="cip" data-v="${kac(v)}" aria-pressed="${F[alan].includes(v)}">${kac(a)}</button>`).join('')}</div>`;
    g.innerHTML = `<div class="alan"><span>Seviye <small>(≈ işaretliler tahmini)</small></span>${cipler('sv', SEVIYELER.map(s => [s, s]))}</div>
      <div class="alan"><span>Zorluk</span>${cipler('zor', ZOR_DILIM)}</div>
      <div class="alan"><span>Durum</span>${cipler('durum', DURUMLAR)}</div>
      <div class="alan"><span>Tür</span>${cipler('tur', turler.map(t => [t, TURLER[t] || t]))}</div>
      <label class="alan"><span>Deste</span><select id="sDeste"><option value="">Bütün desteler</option>${gruplar.map(([gk, ga]) => { const d = desteler.filter(x => x.grup === gk); return d.length ? `<optgroup label="${ga}">${d.map(x => `<option value="${kac(x.kod)}" ${x.kod === F.deste ? 'selected' : ''}>${kac(x.ad)} (${x.adet})</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>`;
    const sonucYaz = () => { const d = g.closest('dialog'); const b = d && d.querySelector('.pencere-alt .dg-ana'); if (b) b.textContent = `${sayi(listeHesapla(F).length)} sonucu göster`; };
    g.addEventListener('click', e => {
      const b = e.target.closest('.cip'); if (!b) return;
      const a = b.closest('[data-alan]').dataset.alan, v = b.dataset.v;
      F[a] = F[a].includes(v) ? F[a].filter(x => x !== v) : [...F[a], v];
      b.setAttribute('aria-pressed', F[a].includes(v));
      sonucYaz();
    });
    g.querySelector('#sDeste').addEventListener('change', e => { F.deste = e.target.value; sonucYaz(); });
    const p = pencere({ baslik: 'Süzgeç', govde: g, genis: true, dugmeler: [{ ad: 'Temizle', deger: 'temizle', sinif: 'dg-hayalet' }, { ad: 'Göster', deger: 'tamam', sinif: 'dg-ana' }] });
    sonucYaz();
    p.then(r => { if (r === 'temizle') F = { ...VARSAYILAN, q: F.q, sira: F.sira, tohum: F.tohum }; yenile(); });
  }

  addEventListener('scroll', kaydir, { passive: true });
  addEventListener('resize', kaydir);
  const k0 = kaydirma;
  yenile({ basaDon: false });
  if (k0) { scrollTo(0, k0); ciz(true); }
  return () => { kaydirma = scrollY; removeEventListener('scroll', kaydir); removeEventListener('resize', kaydir); araGec.iptal(); };
}
