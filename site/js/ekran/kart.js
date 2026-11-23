// Kendi kartı formu (#/kart/yeni, #/kart/<id>), toplu ekleme (#/toplu), deste yönetimi (#/desteler).
import { S, kelime, kartKaydet, kartlarKaydet, kartSil, desteKaydet, desteSil, desteyeEkle, destedenCikar, tumDesteler, destedeMi, suz, SEVIYELER, TURLER, bulAralik } from '../veri.js';
import { enAnahtar } from '../denetim.js';
import { madde } from '../sozluk.js';
import { oturumKur } from './calis.js';
import { ikon, kac, bildir, pencere, onay, geciktir, dosyaSec, dosyaKaydet, sayi, yolKimlik, enterAnaDugme, geriGit } from '../ui.js';

export const SINIR = { en: 80, tr: 80, trAdet: 12, oe: 300, ot: 300, not: 1000, desteAd: 60 };
const bosMu = s => !String(s ?? '').trim();
const sade = s => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Aynı İngilizce kelime zaten var mı (hazır ya da kendi)? */
export function yinelenen(en, haric = null) {
  const a = enAnahtar(sade(en));
  if (!a) return [];
  return S.tumu.filter(k => k.id !== haric && enAnahtar(k.en) === a);
}

/* ================================================================== deste seçimi (ortak) */
/** ids'yi kendi destelerine ekle / çıkar. Dönüş: bildirim metni ya da null. */
export async function desteSec(ids) {
  if (!ids.length) return null;
  const kendi = [...S.ozelDesteler.values()];
  const ilk = new Map(kendi.map(d => [d.id, ids.every(id => d.kelimeler.includes(id))]));
  const g = document.createElement('div');
  g.innerHTML = `${ids.length > 1 ? `<p class="soluk">${sayi(ids.length)} kelime seçili.</p>` : ''}
    ${kendi.length ? `<div class="secim-liste">${kendi.map(d => `<label><input type="checkbox" value="${kac(d.id)}" ${ilk.get(d.id) ? 'checked' : ''}><span class="yayil">${kac(d.ad)}</span><span class="soluk kucuk">${d.kelimeler.length}</span></label>`).join('')}</div>` : '<p class="soluk">Henüz kendi desteniz yok; aşağıdan oluşturun.</p>'}
    <label class="alan"><span>Yeni deste</span><input type="text" id="yeniDeste" maxlength="${SINIR.desteAd}" placeholder="Deste adı (isteğe bağlı)"></label>`;
  enterAnaDugme(g);
  const r = await pencere({ baslik: 'Desteye ekle', govde: g, dugmeler: [{ ad: 'Vazgeç', deger: '' }, { ad: 'Kaydet', deger: 'e', sinif: 'dg-ana' }] });
  if (r !== 'e') return null;
  let eklenen = 0, cikan = 0;
  for (const c of g.querySelectorAll('input[type=checkbox]')) {
    const once = ilk.get(c.value);
    if (c.checked && !once) { await desteyeEkle(c.value, ids); eklenen++; }
    if (!c.checked && once) { for (const id of ids) await destedenCikar(c.value, id); cikan++; }
  }
  const ad = sade(g.querySelector('#yeniDeste').value);
  if (ad) { await desteKaydet({ ad: ad.slice(0, SINIR.desteAd), kelimeler: [...ids] }); eklenen++; }
  if (!eklenen && !cikan) return null;
  return [eklenen && `${eklenen} desteye eklendi`, cikan && `${cikan} desteden çıkarıldı`].filter(Boolean).join(', ') + '.';
}

/* ================================================================== etiket girişi */
function etiketGiris(kap, degerler, degisti) {
  kap.innerHTML = '<input type="text" autocapitalize="off" spellcheck="false" enterkeyhint="next" aria-label="Türkçe karşılık ekle" placeholder="yazıp Enter ya da virgül">';
  const inp = kap.querySelector('input');
  const ciz = () => {
    kap.querySelectorAll('.et').forEach(e => e.remove());
    degerler.forEach((d, i) => {
      const s = document.createElement('span'); s.className = 'et';
      s.innerHTML = `<span>${kac(d)}</span><button type="button" aria-label="${kac(d)} sil" data-sil="${i}">${ikon('kapat')}</button>`;
      kap.insertBefore(s, inp);
    });
    inp.placeholder = degerler.length ? '' : 'yazıp Enter ya da virgül';
    degisti();
  };
  const ekle = metin => {
    let eklendi = false;
    for (const p of String(metin).split(/[,;\n]/)) {
      const t = sade(p).slice(0, SINIR.tr);
      if (t && !degerler.some(d => d.toLocaleLowerCase('tr') === t.toLocaleLowerCase('tr')) && degerler.length < SINIR.trAdet) { degerler.push(t); eklendi = true; }
    }
    if (eklendi) ciz();
  };
  inp.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ',') && !e.isComposing) { if (inp.value.trim()) { e.preventDefault(); ekle(inp.value); inp.value = ''; } else if (e.key === ',') e.preventDefault(); }
    else if (e.key === 'Backspace' && !inp.value && degerler.length) { degerler.pop(); ciz(); }
  });
  inp.addEventListener('input', () => { if (/[,;]/.test(inp.value)) { ekle(inp.value); inp.value = ''; } degisti(); });
  inp.addEventListener('blur', () => { if (inp.value.trim()) { ekle(inp.value); inp.value = ''; } });
  kap.addEventListener('click', e => { const b = e.target.closest('[data-sil]'); if (b) { degerler.splice(Number(b.dataset.sil), 1); ciz(); inp.focus(); } else if (e.target === kap) inp.focus(); });
  ciz();
  return { ekle, bekleyen: () => inp.value, temizle: () => { inp.value = ''; }, ciz };
}

/** Sözlük maddesinden öneri (SOZLUK ajanının biçimine karşı savunmalı). */
function maddeOneri(m) {
  if (!m || typeof m !== 'object') return null;
  const ilkTur = Array.isArray(m.turler) ? m.turler[0] : Array.isArray(m.anlamlar) ? m.anlamlar[0] : null;
  const al = (...a) => a.find(x => x != null && x !== '' && !(Array.isArray(x) && !x.length));
  const tr = al(m.tr, ilkTur && ilkTur.tr) || [];
  const tanimHam = al(m.tanim, ilkTur && ilkTur.tanim, ilkTur && ilkTur.tanimlar && ilkTur.tanimlar[0], m.tanimlar && m.tanimlar[0]);
  const tanim = Array.isArray(tanimHam) ? tanimHam[0] : (tanimHam && typeof tanimHam === 'object' ? tanimHam.t || tanimHam.metin : tanimHam);
  const o = { tr: (Array.isArray(tr) ? tr : [tr]).filter(x => typeof x === 'string').slice(0, 6), tur: al(m.tur, ilkTur && ilkTur.tur) || '', ipa: al(m.ipa, ilkTur && ilkTur.ipa) || '', tanim: typeof tanim === 'string' ? tanim : '' };
  return o.tr.length || o.tanim ? o : null;
}

/* ================================================================== kart formu */
export function kartEkrani(main, parca = [], prm = new URLSearchParams()) {
  const duzenId = parca[1] && parca[1] !== 'yeni' ? decodeURIComponent(parca[1]) : null;
  const orj = duzenId ? S.ozel.get(duzenId) : null;
  if (duzenId && !orj) {
    main.innerHTML = `<div class="ekran ekran-dar"><div class="kutu bos-durum">${ikon('bilgi')}<h2>Kart bulunamadı</h2><p>Silinmiş olabilir.</p><div class="satir"><a class="dg dg-ana" href="#/kart/yeni">Yeni kart</a><a class="dg" href="#/liste">Listeye dön</a></div></div></div>`;
    return;
  }
  // ?en=…&tr=a,b&tur=noun&sv=B1 : baloncuk / sözlük "Karta ekle" ön doldurması
  const prmTr = (prm.get('tr') || '').split(/[,;]/).map(sade).filter(Boolean).map(x => x.slice(0, SINIR.tr)).slice(0, SINIR.trAdet);
  const prmTur = TURLER[prm.get('tur')] ? prm.get('tur') : '';
  const prmSv = SEVIYELER.includes(prm.get('sv')) ? prm.get('sv') : '';
  const v = { en: orj?.en || sade(prm.get('en') || '').slice(0, SINIR.en), tr: [...(orj?.tr || prmTr)], tur: orj?.tur || prmTur, sv: orj?.sv || prmSv, oe: orj?.oe || '', ot: orj?.ot || '', not: orj?.not || '', ipa: orj?.ipa || '', tanim: orj?.tanim || '' };
  const ilkDeste = prm.get('deste') || '';
  const kendi = [...S.ozelDesteler.values()];
  main.innerHTML = `<div class="ekran ekran-dar">
    <div class="ekran-bas"><button type="button" class="dg dg-ikon dg-hayalet" id="geri" aria-label="Geri">${ikon('geri')}</button><h1>${orj ? 'Kartı düzenle' : 'Yeni kart'}<span class="alt">${orj ? 'Kendi kartınız' : 'Kendi kelimenizi ekleyin'}</span></h1>${orj ? '' : `<a class="dg dg-k dg-hayalet" href="#/toplu">${ikon('dosya', 'ikon-k')} Toplu ekle</a>`}</div>
    <form class="kart-form" novalidate>
      <div class="kutu form-izgara iki">
        <label class="alan tam-sutun"><span>İngilizce <b class="zorunlu" aria-hidden="true">*</b></span><input type="text" id="fEn" maxlength="${SINIR.en + 20}" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" required aria-describedby="hEn"><small id="hEn" class="hata-yazi" aria-live="polite"></small></label>
        <div id="oneri" class="tam-sutun" hidden></div>
        <div class="alan tam-sutun"><span id="lTr">Türkçe karşılıklar <b class="zorunlu" aria-hidden="true">*</b></span><div class="etiket-giris" id="fTr" role="group" aria-labelledby="lTr"></div><small id="hTr" class="hata-yazi" aria-live="polite">En az bir karşılık; Enter ya da virgülle ayırın.</small></div>
        <label class="alan"><span>Tür</span><select id="fTur"><option value="">Belirtilmemiş</option>${Object.entries(TURLER).map(([k, a]) => `<option value="${k}">${a}</option>`).join('')}</select></label>
        <label class="alan"><span>Seviye</span><select id="fSv"><option value="">Seviyesiz</option>${SEVIYELER.map(s => `<option>${s}</option>`).join('')}</select></label>
        <label class="alan tam-sutun"><span>Örnek cümle (İngilizce)</span><textarea id="fOe" rows="2" maxlength="${SINIR.oe}" autocapitalize="sentences" spellcheck="false"></textarea></label>
        <label class="alan tam-sutun"><span>Örneğin Türkçesi</span><textarea id="fOt" rows="2" maxlength="${SINIR.ot}"></textarea></label>
        <label class="alan tam-sutun"><span>Not</span><textarea id="fNot" rows="2" maxlength="${SINIR.not}" placeholder="Hatırlatıcı, ipucu…"></textarea></label>
        <label class="alan tam-sutun"><span>Deste</span><select id="fDeste"><option value="">Desteye ekleme</option>${kendi.map(d => `<option value="${kac(d.id)}" ${d.id === ilkDeste ? 'selected' : ''}>${kac(d.ad)}</option>`).join('')}<option value="+">+ Yeni deste…</option></select></label>
        <label class="alan tam-sutun" id="yeniDesteAlan" hidden><span>Yeni deste adı</span><input type="text" id="fYeniDeste" maxlength="${SINIR.desteAd}"></label>
      </div>
      <h2 class="bolum-bas">Önizleme</h2>
      <div class="kutu onizleme-kart" id="onizleme" aria-live="off"></div>
      <div class="form-alt">
        ${orj ? `<button type="button" class="dg dg-tehlike" id="sil">${ikon('sil')} Sil</button>` : ''}
        <span class="yayil"></span>
        ${orj ? '' : '<button type="button" class="dg" id="kaydetYeni">Kaydet ve yeni ekle</button>'}
        <button type="submit" class="dg dg-ana" id="kaydet">${ikon('dogru')} Kaydet</button>
      </div>
    </form></div>`;
  const $ = s => main.querySelector(s);
  const form = $('form');
  $('#fEn').value = v.en; $('#fTur').value = v.tur; $('#fSv').value = v.sv; $('#fOe').value = v.oe; $('#fOt').value = v.ot; $('#fNot').value = v.not;
  let yineOnay = false, denendi = false;
  const etk = etiketGiris($('#fTr'), v.tr, () => { onizle(); if (denendi) dogrula(); });

  function oku() {
    v.en = sade($('#fEn').value); v.tur = $('#fTur').value; v.sv = $('#fSv').value;
    v.oe = sade($('#fOe').value); v.ot = sade($('#fOt').value); v.not = $('#fNot').value.trim();
  }
  function dogrula() {
    oku();
    const h = {};
    if (!v.en) h.en = 'İngilizce kelime boş olamaz.';
    else if (v.en.length > SINIR.en) h.en = `En çok ${SINIR.en} karakter (şu an ${v.en.length}).`;
    else if (!/[a-z]/i.test(v.en)) h.en = 'İngilizce harf içermeli.';
    const yin = v.en ? yinelenen(v.en, duzenId) : [];
    if (!h.en && yin.length && !yineOnay) h.en = 'Bu kelime zaten var.';
    if (!v.tr.length && !etk.bekleyen().trim()) h.tr = 'En az bir Türkçe karşılık yazın.';
    $('#hEn').textContent = h.en || '';
    $('#hTr').textContent = h.tr || 'En az bir karşılık; Enter ya da virgülle ayırın.';
    $('#hTr').classList.toggle('hata', !!h.tr);
    $('#fEn').setAttribute('aria-invalid', !!h.en);
    $('#fTr').classList.toggle('hatali', !!h.tr);
    return h;
  }
  function onizle() {
    oku();
    const ob = v.oe ? bulAralik(v.oe, v.en) : null;
    const ornek = v.oe ? `<div class="ornek">${ob ? kac(v.oe.slice(0, ob[0])) + '<mark>' + kac(v.oe.slice(ob[0], ob[1])) + '</mark>' + kac(v.oe.slice(ob[1])) : kac(v.oe)}${v.ot ? `<span class="tr">${kac(v.ot)}</span>` : ''}</div>` : '';
    $('#onizleme').innerHTML = v.en || v.tr.length ? `<div class="gb-kelime"><span class="k">${kac(v.en || '…')}</span>${v.sv ? `<span class="etiket sv sv-${v.sv}">${v.sv}</span>` : ''}${v.tur ? `<span class="etiket">${kac(TURLER[v.tur])}</span>` : ''}</div>
      <div class="anlamlar">${kac(v.tr.join(', ') || '…')}</div>${ornek}${v.oe && !ob && v.en ? '<p class="kucuk soluk">Örnekte kelime bulunamadı; boşluk doldurma kipinde sorulmaz.</p>' : ''}`
      : '<p class="soluk">Yazdıkça kartın nasıl görüneceği burada belirir.</p>';
  }
  let sonAranan = '';
  const oneriAra = geciktir(async () => {
    oku();
    const kutu = $('#oneri');
    if (!v.en) { kutu.hidden = true; return; }
    const yin = yinelenen(v.en, duzenId);
    let h = '';
    if (yin.length) {
      const k = yin[0];
      h += `<div class="uyari-kutu">${ikon('bilgi')}<div class="yayil"><b>"${kac(k.en)}" zaten ${k.ozel ? 'kendi kartlarınızda' : 'hazır listede'} var</b><div class="kucuk soluk">${kac((k.tr || []).join(', '))}</div>
        <div class="satir" style="margin-top:8px"><a class="dg dg-k" href="#/kelime/${yolKimlik(k.id)}">Aç</a>${!k.ozel && !v.tr.length ? '<button type="button" class="dg dg-k" data-doldur="hazir">Karşılıklarını kullan</button>' : ''}
        <label class="satir kucuk"><input type="checkbox" id="yineOnay" ${yineOnay ? 'checked' : ''}> Yine de ekle</label></div></div></div>`;
    }
    kutu.innerHTML = h; kutu.hidden = !h;
    kutu._hazir = yin[0] || null;
    if (sonAranan === v.en) return;
    sonAranan = v.en;
    let m = null;
    try { m = maddeOneri(await madde(v.en)); } catch { m = null; }
    if (!m || sade($('#fEn').value) !== v.en) return;
    kutu._madde = m;
    const ek = document.createElement('div'); ek.className = 'oneri-kutu';
    ek.innerHTML = `<div><b>Sözlükte:</b> ${kac(m.tr.join(', ') || m.tanim)}</div><div class="satir"><button type="button" class="dg dg-k dg-ana" data-doldur="sozluk">Boş alanları doldur</button></div>`;
    kutu.append(ek); kutu.hidden = false;
  }, 350);

  main.addEventListener('input', e => {
    if (e.target.id === 'fEn') { yineOnay = false; oneriAra(); }
    onizle(); if (denendi) dogrula();
  });
  main.addEventListener('change', e => {
    if (e.target.id === 'yineOnay') { yineOnay = e.target.checked; if (denendi) dogrula(); }
    if (e.target.id === 'fDeste') { $('#yeniDesteAlan').hidden = e.target.value !== '+'; if (e.target.value === '+') $('#fYeniDeste').focus(); }
    onizle();
  });
  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'geri') { geriGit('#/liste'); return; }
    if (b.dataset.doldur) {
      const kaynak = b.dataset.doldur === 'hazir' ? $('#oneri')._hazir : $('#oneri')._madde;
      if (!kaynak) return;
      if (!v.tr.length && kaynak.tr) { (kaynak.tr || []).slice(0, 6).forEach(t => etk.ekle(t)); }
      if (!$('#fTur').value && kaynak.tur && TURLER[kaynak.tur]) $('#fTur').value = kaynak.tur;
      if (!$('#fSv').value && kaynak.sv) $('#fSv').value = kaynak.sv;
      if (!$('#fOe').value && kaynak.oe) { $('#fOe').value = kaynak.oe; if (kaynak.ot) $('#fOt').value = kaynak.ot; }
      if (!v.ipa && kaynak.ipa) v.ipa = kaynak.ipa;
      if (!v.tanim && kaynak.tanim) v.tanim = kaynak.tanim;
      onizle(); bildir('Boş alanlar dolduruldu; dilediğiniz gibi düzeltin.');
      return;
    }
    if (b.id === 'kaydetYeni') return kaydet(true);
    if (b.id === 'sil') {
      if (!await onay(`"${orj.en}" kartı silinsin mi? İlerleme kayıtları da kullanılmaz olur.`, { baslik: 'Kartı sil', tamam: 'Sil', tehlike: true })) return;
      const o = await kartSil(orj.id);
      location.replace('#/liste');
      bildir(`"${o.en}" silindi.`, { eylem: { ad: 'Geri al', f: async () => { await kartKaydet(o); bildir('Kart geri getirildi.', { tur: 'tamam' }); if (location.hash.startsWith('#/liste')) dispatchEvent(new HashChangeEvent('hashchange')); } } });
    }
  });
  form.addEventListener('submit', e => { e.preventDefault(); kaydet(false); });

  async function kaydet(yeniden) {
    denendi = true;
    if (etk.bekleyen().trim()) { etk.ekle(etk.bekleyen()); etk.temizle(); }
    const h = dogrula();
    if (Object.keys(h).length) { (h.en ? $('#fEn') : $('#fTr input')).focus(); if (h.en === 'Bu kelime zaten var.') oneriAra(); return; }
    const kayit = { ...(orj || {}), en: v.en, tr: [...v.tr], tur: v.tur || 'diger', sv: v.sv || null, oe: v.oe || null, ot: v.ot || null, not: v.not, ipa: v.ipa || null, tanim: v.tanim || null };
    kayit.ob = kayit.oe ? bulAralik(kayit.oe, kayit.en) : null;
    const n = await kartKaydet(kayit);
    let ds = $('#fDeste').value;
    if (ds === '+') {
      const ad = sade($('#fYeniDeste').value);
      if (ad) ds = (await desteKaydet({ ad: ad.slice(0, SINIR.desteAd), kelimeler: [] })).id; else ds = '';
    }
    if (ds) await desteyeEkle(ds, [n.id]);
    if (yeniden) {
      bildir(`"${n.en}" eklendi.`, { tur: 'tamam', eylem: { ad: 'Aç', f: () => { location.hash = '#/kelime/' + yolKimlik(n.id); } } });
      const yeniPrm = new URLSearchParams(); if (ds) yeniPrm.set('deste', ds);
      main.innerHTML = ''; const m2 = main.cloneNode(false); main.replaceWith(m2);
      kartEkrani(m2, ['kart', 'yeni'], yeniPrm); m2.querySelector('#fEn').focus();
      return;
    }
    bildir(orj ? 'Kart güncellendi.' : `"${n.en}" eklendi.`, { tur: 'tamam' });
    location.replace('#/kelime/' + yolKimlik(n.id));
  }
  onizle();
  if (v.en) oneriAra();
  if (!orj && matchMedia('(pointer: fine)').matches) $('#fEn').focus();
}

/* ================================================================== toplu ekleme */
const AYRACLAR = [['oto', 'Otomatik'], ['\t', 'Sekme'], [';', 'Noktalı virgül ( ; )'], [',', 'Virgül ( , )'], [' - ', 'Tire ( - )'], [' = ', 'Eşittir ( = )'], [':', 'İki nokta ( : )']];
const BASLIK = /^(en|eng|english|ingilizce|word|kelime|terim|term)$/i;

/** Bir satırı ayraçla böl (tırnaklı CSV alanlarını tanır). */
export function satirBol(satir, ayrac) {
  if (ayrac === ' - ') return satir.split(/\s+[-–—]\s+/);
  if (ayrac === ' = ') return satir.split(/\s*=\s*/);
  const alanlar = []; let al = '', tirnak = false;
  for (let i = 0; i < satir.length; i++) {
    const c = satir[i];
    if (tirnak) { if (c === '"') { if (satir[i + 1] === '"') { al += '"'; i++; } else tirnak = false; } else al += c; }
    else if (c === '"' && !al.trim()) { tirnak = true; al = ''; }
    else if (c === ayrac) { alanlar.push(al); al = ''; }
    else al += c;
  }
  alanlar.push(al);
  return alanlar;
}
/** Ayraç kestirimi: satırların çoğunda geçen ilk aday. */
export function ayracBul(satirlar) {
  const dolu = satirlar.filter(s => s.trim()).slice(0, 200);
  if (!dolu.length) return '\t';
  for (const a of ['\t', ';', ' = ', ' - ', ':', ',']) {
    const re = a === ' - ' ? /\s[-–—]\s/ : a === ' = ' ? /=/ : null;
    const n = dolu.filter(s => (re ? re.test(s) : s.includes(a))).length;
    if (n / dolu.length >= 0.6) return a;
  }
  return '\t';
}
/** Metni satır nesnelerine çevir ve denetle. */
export function topluAyristir(metin, ayracSec = 'oto') {
  const satirlar = String(metin).replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const ayrac = ayracSec === 'oto' ? ayracBul(satirlar) : ayracSec;
  const sonuc = [];
  const goruldu = new Map();
  satirlar.forEach((ham, no) => {
    if (!ham.trim() || /^\s*(#|\/\/)/.test(ham)) return;
    const a = satirBol(ham, ayrac).map(sade);
    if (!sonuc.length && BASLIK.test(a[0] || '')) return; // başlık satırı
    const en = a[0] || '';
    const trHam = a.length > 3 && ayrac === ',' ? a.slice(1).join(', ') : (a[1] || '');
    const tr = [...new Set(trHam.split(/[,;\/|]/).map(sade).filter(Boolean))].slice(0, SINIR.trAdet);
    const oe = ayrac === ',' && a.length > 3 ? '' : (a[2] || '');
    const ot = ayrac === ',' && a.length > 3 ? '' : (a[3] || '');
    const s = { no: no + 1, en, tr, oe, ot, hata: '', uyari: '', sec: true };
    if (!en) s.hata = 'İngilizce boş';
    else if (en.length > SINIR.en) s.hata = 'İngilizce çok uzun';
    else if (!/[a-z]/i.test(en)) s.hata = 'İngilizce harf yok';
    else if (!tr.length) s.hata = 'Türkçe karşılık yok';
    else if (tr.some(t => t.length > SINIR.tr)) s.hata = 'Karşılık çok uzun';
    else if (oe.length > SINIR.oe) s.hata = 'Örnek çok uzun';
    if (!s.hata) {
      const anahtar = enAnahtar(en);
      if (goruldu.has(anahtar)) s.uyari = `Dosyada yinelenen (satır ${goruldu.get(anahtar)})`;
      else {
        goruldu.set(anahtar, s.no);
        const y = yinelenen(en);
        if (y.length) s.uyari = y[0].ozel ? 'Kendi kartlarınızda var' : 'Hazır listede var';
      }
    }
    s.sec = !s.hata && !s.uyari;
    sonuc.push(s);
  });
  return { ayrac, satirlar: sonuc };
}
const ayracAd = a => (AYRACLAR.find(x => x[0] === a) || [, a])[1];

export function topluEkrani(main, parca = [], prm = new URLSearchParams()) {
  const kendi = [...S.ozelDesteler.values()];
  main.innerHTML = `<div class="ekran ekran-dar">
    <div class="ekran-bas"><button type="button" class="dg dg-ikon dg-hayalet" id="geri" aria-label="Geri">${ikon('geri')}</button><h1>Toplu ekle<span class="alt">Her satıra bir kelime: <code>ingilizce ; türkçe1, türkçe2 ; örnek cümle</code></span></h1></div>
    <div class="kutu" style="display:grid;gap:12px">
      <textarea id="metin" rows="7" spellcheck="false" autocapitalize="off" aria-label="Kelime listesi" placeholder="apple ; elma&#10;run out of - tükenmek, bitmek&#10;negotiate&#9;müzakere etmek"></textarea>
      <div class="satir"><button type="button" class="dg dg-k" id="dosya">${ikon('yukle', 'ikon-k')} Dosyadan (.txt .csv .tsv)</button>
        <label class="satir kucuk"><span class="soluk">Ayraç</span><select id="ayrac" style="width:auto;min-height:38px">${AYRACLAR.map(([v, a]) => `<option value="${kac(v)}">${a}</option>`).join('')}</select></label>
        <span class="soluk kucuk" id="ayracBilgi"></span></div>
      <p class="kucuk soluk">Ayraç kendiliğinden bulunur: sekme, <b>;</b> <b>,</b> <b>-</b> <b>=</b> <b>:</b>. Türkçe karşılıkları virgülle ayırın. # ile başlayan satırlar atlanır. Excel'den kopyalayıp yapıştırabilirsiniz.</p>
    </div>
    <div id="sonuc"></div></div>`;
  const $ = s => main.querySelector(s);
  let veri = { ayrac: '\t', satirlar: [] };
  const ciz = () => {
    const S2 = veri.satirlar;
    $('#ayracBilgi').textContent = S2.length && $('#ayrac').value === 'oto' ? `bulunan: ${ayracAd(veri.ayrac)}` : '';
    if (!S2.length) { $('#sonuc').innerHTML = ''; return; }
    const hatali = S2.filter(s => s.hata).length, yin = S2.filter(s => s.uyari).length, sec = S2.filter(s => s.sec).length;
    $('#sonuc').innerHTML = `<h2 class="bolum-bas">Önizleme · ${sayi(S2.length)} satır</h2>
      <div class="satir kucuk" style="margin-bottom:8px"><span class="etiket yesil">${sayi(sec)} eklenecek</span>${hatali ? `<span class="etiket kirmizi">${sayi(hatali)} hatalı</span>` : ''}${yin ? `<span class="etiket sari">${sayi(yin)} yinelenen</span>` : ''}</div>
      <div class="onizleme"><table><thead><tr><th><span class="gizli-metin">Ekle</span></th><th>#</th><th>İngilizce</th><th>Türkçe</th><th>Durum</th></tr></thead><tbody>
      ${S2.slice(0, 1000).map((s, i) => `<tr class="${s.hata ? 'hata' : s.uyari ? 'uyari' : ''}"><td><input type="checkbox" data-i="${i}" ${s.sec ? 'checked' : ''} ${s.hata ? 'disabled' : ''} aria-label="Satır ${s.no} ekle"></td><td class="soluk">${s.no}</td><td class="kir">${kac(s.en)}${s.oe ? `<div class="kucuk soluk">${kac(s.oe)}</div>` : ''}</td><td class="kir">${kac(s.tr.join(', '))}</td><td class="kucuk">${kac(s.hata || s.uyari || 'tamam')}</td></tr>`).join('')}
      </tbody></table></div>${S2.length > 1000 ? '<p class="kucuk soluk">İlk 1000 satır gösteriliyor; hepsi eklenir.</p>' : ''}
      <div class="kutu" style="margin-top:14px;display:grid;gap:12px">
        <label class="alan"><span>Hedef deste</span><select id="hedef"><option value="">Desteye ekleme</option>${kendi.map(d => `<option value="${kac(d.id)}">${kac(d.ad)}</option>`).join('')}<option value="+" selected>+ Yeni deste</option></select></label>
        <label class="alan" id="yeniAdAlan"><span>Yeni deste adı</span><input type="text" id="yeniAd" maxlength="${SINIR.desteAd}" value="İçe aktarılan ${new Date().toLocaleDateString('tr-TR')}"></label>
        <button type="button" class="dg dg-ana dg-buyuk" id="aktar" ${sec ? '' : 'disabled'}>${ikon('indir')} ${sayi(sec)} kartı ekle</button>
      </div>`;
    if (prm.get('deste') && kendi.some(d => d.id === prm.get('deste'))) { $('#hedef').value = prm.get('deste'); $('#yeniAdAlan').hidden = true; }
  };
  const ayristir = geciktir(() => { veri = topluAyristir($('#metin').value, $('#ayrac').value); ciz(); }, 250);
  $('#metin').addEventListener('input', ayristir);
  $('#ayrac').addEventListener('change', () => { ayristir(); });
  main.addEventListener('change', e => {
    if (e.target.dataset.i != null) { veri.satirlar[Number(e.target.dataset.i)].sec = e.target.checked; const n = veri.satirlar.filter(s => s.sec).length; $('#aktar').innerHTML = `${ikon('indir')} ${sayi(n)} kartı ekle`; $('#aktar').disabled = !n; }
    if (e.target.id === 'hedef') $('#yeniAdAlan').hidden = e.target.value !== '+';
  });
  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'geri') { geriGit('#/liste'); return; }
    if (b.id === 'dosya') {
      const f = await dosyaSec('.txt,.csv,.tsv,text/plain,text/csv,text/tab-separated-values');
      if (!f) return;
      if (f.size > 3 * 1048576) { bildir('Dosya çok büyük (en çok 3 MB).', { tur: 'hata' }); return; }
      const tampon = await f.arrayBuffer();
      let metin = new TextDecoder('utf-8').decode(tampon);
      if (metin.includes('�')) { try { metin = new TextDecoder('windows-1254').decode(tampon); } catch { /* */ } }
      if (/\.tsv$/i.test(f.name)) $('#ayrac').value = '\t';
      $('#metin').value = metin; ayristir(); ayristir.iptal(); veri = topluAyristir(metin, $('#ayrac').value); ciz();
      return;
    }
    if (b.id === 'aktar') {
      const secilen = veri.satirlar.filter(s => s.sec && !s.hata);
      if (!secilen.length) return;
      b.disabled = true;
      const yeni = await kartlarKaydet(secilen.map(s => ({ en: s.en, tr: s.tr, tur: 'diger', sv: null, oe: s.oe || null, ot: s.ot || null, ob: s.oe ? bulAralik(s.oe, s.en) : null, not: '' })));
      let hedef = $('#hedef').value, desteAd = '';
      if (hedef === '+') { const ad = sade($('#yeniAd').value) || 'İçe aktarılanlar'; const d = await desteKaydet({ ad: ad.slice(0, SINIR.desteAd), kelimeler: yeni.map(k => k.id) }); hedef = d.id; desteAd = d.ad; }
      else if (hedef) { await desteyeEkle(hedef, yeni.map(k => k.id)); desteAd = S.ozelDesteler.get(hedef)?.ad || ''; }
      const atlanan = veri.satirlar.length - secilen.length;
      $('#metin').value = ''; veri = { ayrac: veri.ayrac, satirlar: [] };
      $('#sonuc').innerHTML = `<div class="kutu bos-durum" role="status">${ikon('dogru')}<h2>${sayi(yeni.length)} kart eklendi</h2><p>${atlanan ? `${sayi(atlanan)} satır atlandı. ` : ''}${desteAd ? `"${kac(desteAd)}" destesine kondu.` : ''}</p>
        <div class="satir">${hedef ? `<button type="button" class="dg dg-ana" id="calisHedef" data-deste="${kac(hedef)}">${ikon('oynat')} Şimdi çalış</button>` : ''}<a class="dg" href="#/liste" id="listeGit">Listede gör</a></div></div>`;
      return;
    }
    if (b.id === 'calisHedef') oturumKur({ ...S.ayar.kurulum, kaynak: 'hepsi', sv: [], zor: [], deste: b.dataset.deste });
  });
}

/* ================================================================== deste yönetimi */
const csvAlan = s => { s = String(s ?? ''); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function desteCsv(kod) {
  const liste = suz({ deste: kod });
  const satirlar = [['en', 'tr', 'tur', 'seviye', 'ornek', 'ceviri'], ...liste.map(k => [k.en, (k.tr || []).join(', '), TURLER[k.tur] || k.tur || '', k.sv || '', k.oe || '', k.ot || ''])];
  return '﻿' + satirlar.map(r => r.map(csvAlan).join(',')).join('\r\n') + '\r\n';
}
const dosyaAdi = ad => (ad || 'deste').toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '') || 'deste';

export function destelerEkrani(main) {
  const ciz = () => {
    const kendi = tumDesteler().filter(d => !d.hazir);
    const hazir = tumDesteler().filter(d => d.hazir);
    const satir = d => `<li class="deste-satir" data-kod="${kac(d.kod)}"><div class="yayil"><b class="kir">${kac(d.ad)}</b><small class="soluk">${sayi(d.adet)} kelime</small></div>
      <div class="satir deste-araclar"><button type="button" class="dg dg-k dg-ana" data-e="calis" ${d.adet ? '' : 'disabled'} aria-label="${kac(d.ad)} çalış">${ikon('oynat', 'ikon-k')}<span class="dar-gizle">Çalış</span></button>
      <button type="button" class="dg dg-k" data-e="liste" aria-label="${kac(d.ad)} listede göster">${ikon('liste', 'ikon-k')}<span class="dar-gizle">Liste</span></button>
      <button type="button" class="dg dg-k dg-ikon dg-hayalet" data-e="csv" aria-label="${kac(d.ad)} CSV olarak dışa aktar" title="CSV dışa aktar">${ikon('indir')}</button>
      ${d.hazir ? '' : `<button type="button" class="dg dg-k dg-ikon dg-hayalet" data-e="ad" aria-label="${kac(d.ad)} yeniden adlandır" title="Yeniden adlandır">${ikon('kalem')}</button><button type="button" class="dg dg-k dg-ikon dg-hayalet dg-tehlike" data-e="sil" aria-label="${kac(d.ad)} sil" title="Sil">${ikon('sil')}</button>`}</div></li>`;
    main.innerHTML = `<div class="ekran ekran-dar">
      <div class="ekran-bas"><button type="button" class="dg dg-ikon dg-hayalet" id="geri" aria-label="Geri">${ikon('geri')}</button><h1>Desteler<span class="alt">Kendi desteleriniz ve hazır desteler</span></h1><button type="button" class="dg dg-ana" id="yeni">${ikon('arti')}<span class="dar-gizle">Yeni deste</span></button></div>
      <section class="kutu"><div class="kutu-bas"><h2>Kendi destelerim</h2><a class="dg dg-k dg-hayalet" href="#/toplu">${ikon('dosya', 'ikon-k')} Toplu ekle</a></div>
        ${kendi.length ? `<ul class="liste">${kendi.map(satir).join('')}</ul>` : '<p class="soluk">Henüz deste yok. Kelime listesinde "Seç" ile kelime seçip desteye ekleyebilir ya da toplu ekleme yapabilirsiniz.</p>'}</section>
      <section class="kutu"><details><summary><h2 style="display:inline">Hazır desteler (${hazir.length})</h2></summary><ul class="liste" style="margin-top:8px">${hazir.map(satir).join('')}</ul></details></section>
      <p class="kucuk soluk" style="margin-top:12px">Desteyi silmek kartları silmez; yalnız gruplamayı kaldırır.</p></div>`;
  };
  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'geri') { geriGit('#/liste'); return; }
    if (b.id === 'yeni') {
      const ad = await adSor('Yeni deste', '');
      if (ad) { await desteKaydet({ ad, kelimeler: [] }); bildir(`"${ad}" destesi oluşturuldu.`, { tur: 'tamam' }); ciz(); }
      return;
    }
    const li = b.closest('[data-kod]'); if (!li) return;
    const kod = li.dataset.kod;
    const d = tumDesteler().find(x => x.kod === kod);
    if (b.dataset.e === 'calis') return oturumKur({ ...S.ayar.kurulum, kaynak: 'hepsi', sv: [], zor: [], deste: kod });
    if (b.dataset.e === 'liste') { const { listeSuzgec } = await import('./liste.js'); listeSuzgec({ deste: kod }); location.hash = '#/liste'; return; }
    if (b.dataset.e === 'csv') { const r = await dosyaKaydet(dosyaAdi(d.ad) + '.csv', desteCsv(kod), 'text/csv'); if (r === 'indirildi') bildir('CSV indirildi.', { tur: 'tamam' }); return; }
    if (b.dataset.e === 'ad') { const ad = await adSor('Yeniden adlandır', d.ad); if (ad && ad !== d.ad) { await desteKaydet({ ...S.ozelDesteler.get(kod), ad }); ciz(); } return; }
    if (b.dataset.e === 'sil') {
      if (!await onay(`"${d.ad}" destesi silinsin mi? İçindeki ${d.adet} kelime silinmez.`, { baslik: 'Desteyi sil', tamam: 'Sil', tehlike: true })) return;
      const eski = await desteSil(kod); ciz();
      bildir(`"${eski.ad}" silindi.`, { eylem: { ad: 'Geri al', f: async () => { await desteKaydet(eski); ciz(); } } });
    }
  });
  ciz();
}
async function adSor(baslik, deger) {
  const g = document.createElement('div');
  g.innerHTML = `<label class="alan"><span>Deste adı</span><input type="text" id="adGir" maxlength="${SINIR.desteAd}" value="${kac(deger)}"></label><small class="hata-yazi" id="adHata"></small>`;
  enterAnaDugme(g);
  const r = await pencere({ baslik, govde: g, dugmeler: [{ ad: 'Vazgeç', deger: '' }, { ad: 'Kaydet', deger: 'e', sinif: 'dg-ana' }] });
  const ad = sade(g.querySelector('#adGir').value).slice(0, SINIR.desteAd);
  if (r !== 'e' || !ad) return null;
  return ad;
}
