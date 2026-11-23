// Sözlük ekranı (#/sozluk?q=…): yazarken öneri, yön, son aramalar, madde görünümü, bulunamadı → yakın öneriler.
import { ara, madde, kokBul, hazirla, durumDinle, turAd, sonAramalar, sonAramaEkle, sonAramaTemizle, indirmeDurumu, enAnah } from '../sozluk.js';
import { enSar } from '../balon.js';
import { ikon, kac, boyutYaz } from '../ui.js';
import { oku } from '../ses.js';

const YONLER = [['oto', 'Otomatik'], ['en', 'EN → TR'], ['tr', 'TR → EN']];
let sonYon = 'oto'; // oturum boyunca hatırlanır

function hashParam() {
  const h = location.hash.split('?')[1] || '';
  const p = new URLSearchParams(h);
  return { q: (p.get('q') || '').trim(), yon: p.get('yon') || '' };
}
const git = (q, yon = sonYon) => { location.hash = '#/sozluk?q=' + encodeURIComponent(q) + (yon !== 'oto' ? '&yon=' + yon : ''); };

const svEtiket = m => (m.sv ? `<span class="etiket sv sv-${kac(m.sv)}${m.svt ? ' tahmin' : ''}" title="${m.svt ? 'Seviye tahmini' : 'Seviye'}">${m.svt ? '≈' : ''}${kac(m.sv)}</span>` : '');
const ESLESME = { tam: '', kok: 'biçim', onek: '', obek: 'öbek', yakin: 'yakın' };

export function sozlukEkrani(m) {
  const { q: q0, yon: y0 } = hashParam();
  const gorYon = YONLER.some(y => y[0] === y0) ? y0 : null; // adresteki yön yalnız bu görünüm için
  m.innerHTML = `<div class="ekran ekran-dar sozluk-ekran">
    <div class="ekran-bas"><h1>Sözlük<span class="alt">İngilizce ↔ Türkçe · çevrimdışı çalışır</span></h1></div>
    <div class="sozluk-ust">
      <div class="sozluk-ara" role="search">
        ${ikon('ara')}
        <input type="search" id="sq" value="${kac(q0)}" placeholder="İngilizce ya da Türkçe kelime" aria-label="Sözlükte ara"
          role="combobox" aria-expanded="false" aria-controls="oneri" aria-autocomplete="list"
          autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="search" maxlength="80">
        <button type="button" class="dg dg-ikon dg-hayalet sozluk-temizle" id="sqTemizle" aria-label="Temizle"${q0 ? '' : ' hidden'}>${ikon('kapat')}</button>
      </div>
      <div class="bolumlu sozluk-yon" role="group" aria-label="Arama yönü">${YONLER.map(([v, a]) => `<button type="button" data-yon="${v}" aria-pressed="${v === sonYon}">${a}</button>`).join('')}</div>
      <ul class="oneri-liste" id="oneri" role="listbox" aria-label="Öneriler" hidden></ul>
    </div>
    <div class="sozluk-durum" id="sDurum" aria-live="polite"></div>
    <div id="sGovde"></div>
  </div>`;
  const $ = s => m.querySelector(s);
  const inp = $('#sq'), liste = $('#oneri'), govde = $('#sGovde');
  let sorguNo = 0, oneriler = [], secili = -1, kapali = false;

  /* ---------- yükleme göstergesi */
  const durumKapat = durumDinle(d => {
    const el = $('#sDurum'); if (!el) return;
    if (d.cekirdek === 'yukleniyor') el.innerHTML = `<div class="sozluk-yukleniyor"><span class="donen" aria-hidden="true"></span>Sözlük hazırlanıyor… (ilk açılışta bir kez)</div>`;
    else if (d.cekirdek === 'hata') el.innerHTML = `<div class="uyari-kutu">${ikon('bilgi')}<div>${d.ag ? 'Çevrimdışısınız ve sözlük bu cihaza henüz inmedi. Bağlanınca kendiliğinden yüklenir; o zamana dek yalnız kelime destesindeki kelimeler aranır.' : 'Sözlük yüklenemedi: ' + kac(d.hata || '')}</div></div>`;
    else el.innerHTML = '';
  });
  hazirla().catch(() => {});

  /* ---------- öneriler */
  const oneriKapat = () => { liste.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); secili = -1; };
  function oneriGoster(r) {
    oneriler = r; secili = -1;
    if (!r.length || kapali) { oneriKapat(); return; }
    liste.innerHTML = r.slice(0, 12).map((x, i) => {
      const a = x.yon === 'tr' && x.trEslesen ? `${kac(x.trEslesen)} → ${kac(x.tr.slice(0, 2).join(', '))}` : kac(x.tr.slice(0, 3).join(', ') || x.tanim || '');
      const d = x.eslesme === 'kok' ? `${kac(x.bicim || '')} → biçim` : ESLESME[x.eslesme] || '';
      return `<li role="presentation"><button type="button" role="option" id="on${i}" data-i="${i}" aria-selected="false" tabindex="-1"><span class="o-k" lang="en">${kac(x.en)}</span><span class="o-a">${a}</span><span class="o-d">${kac(d || (x.kaynak === 'deste' ? 'deste' : x.kaynak === 'ozel' ? 'kendi' : turAd(x.tur)))}</span></button></li>`;
    }).join('');
    liste.hidden = false; inp.setAttribute('aria-expanded', 'true');
    alanAyarla();
  }
  function seciliYap(i) {
    const bs = liste.querySelectorAll('[role=option]');
    if (!bs.length) return;
    secili = (i + bs.length) % bs.length;
    bs.forEach((b, j) => b.setAttribute('aria-selected', String(j === secili)));
    inp.setAttribute('aria-activedescendant', 'on' + secili);
    bs[secili].scrollIntoView({ block: 'nearest' });
  }
  async function sorgula(q) {
    const no = ++sorguNo;
    if (!q.trim()) { oneriKapat(); return null; }
    let r;
    try { r = await ara(q, { yon: sonYon, sinir: 20 }); } catch (e) { console.warn(e); r = []; }
    if (no !== sorguNo) return null; // eski yanıt yenisini ezmesin
    return r;
  }
  let zaman = 0;
  inp.addEventListener('input', () => {
    $('#sqTemizle').hidden = !inp.value;
    kapali = false;
    clearTimeout(zaman);
    const q = inp.value;
    if (!q.trim()) { sorguNo++; oneriKapat(); bosDurum(); return; }
    zaman = setTimeout(async () => { const r = await sorgula(q); if (r) oneriGoster(r); }, 150);
  });
  inp.addEventListener('keydown', async e => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (liste.hidden && oneriler.length) oneriGoster(oneriler); seciliYap(secili + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); seciliYap(secili - 1); }
    else if (e.key === 'Escape') {
      if (!liste.hidden) { e.preventDefault(); kapali = true; oneriKapat(); }
      else if (inp.value) { e.preventDefault(); inp.value = ''; $('#sqTemizle').hidden = true; bosDurum(); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(zaman);
      if (secili >= 0 && oneriler[secili]) { sec(oneriler[secili]); return; }
      const q = inp.value.trim(); if (!q) return;
      git(q);
      if (hashParam().q === q) goruntule(q); // aynı adres: hashchange olmaz
    }
  });
  liste.addEventListener('mousedown', e => e.preventDefault()); // input odağı kalsın
  liste.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) sec(oneriler[Number(b.dataset.i)]); });
  function sec(x) {
    oneriKapat();
    const q = x.eslesme === 'kok' && x.bicim ? x.bicim : x.en;
    inp.blur();
    const yon = x.yon === 'tr' ? 'en' : sonYon;
    git(q, yon);
    if (hashParam().q === q) goruntule(q, yon);
  }
  $('#sqTemizle').onclick = () => { inp.value = ''; $('#sqTemizle').hidden = true; oneriKapat(); bosDurum(); inp.focus(); };
  m.querySelector('.sozluk-yon').addEventListener('click', e => {
    const b = e.target.closest('[data-yon]'); if (!b) return;
    sonYon = b.dataset.yon;
    m.querySelectorAll('[data-yon]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (inp.value.trim()) { kapali = false; sorgula(inp.value).then(r => r && oneriGoster(r)); }
  });
  const disari = e => { if (!e.target.closest('.sozluk-ust')) oneriKapat(); };
  document.addEventListener('pointerdown', disari);

  /* ---------- sanal klavye: öneri listesi görünür alana sığsın */
  function alanAyarla() {
    if (liste.hidden) return;
    const vv = window.visualViewport;
    const alt = vv ? vv.offsetTop + vv.height : innerHeight;
    const ust = liste.getBoundingClientRect().top;
    liste.style.maxHeight = Math.max(160, Math.floor(alt - ust - 12)) + 'px';
  }
  const vv = window.visualViewport;
  if (vv) vv.addEventListener('resize', alanAyarla);

  /* ---------- görünümler */
  function bosDurum() {
    const son = sonAramalar();
    govde.innerHTML = `${son.length ? `<section class="kutu sozluk-son"><div class="kutu-bas"><h2>Son aramalar</h2><button type="button" class="dg dg-k dg-hayalet" id="sonTemizle">Temizle</button></div>
      <div class="cip-grup">${son.map(s => `<a class="cip" href="#/sozluk?q=${encodeURIComponent(s)}" lang="en">${kac(s)}</a>`).join('')}</div></section>` : ''}
      <div class="kutu bos-durum">${ikon('kitap')}<h2>Bir kelime arayın</h2><p>İngilizce yazarsanız Türkçesini, Türkçe yazarsanız İngilizcesini bulur. Çekimli biçimler (<i>running</i>, <i>children</i>), yazım hataları ve öbekler (<i>look after</i>) de olur.</p><p class="kucuk soluk" id="indirmeNot" style="margin-top:10px"></p></div>`;
    const t = govde.querySelector('#sonTemizle');
    if (t) t.onclick = () => { sonAramaTemizle(); bosDurum(); };
    indirmeDurumu().then(d => {
      const el = govde.querySelector('#indirmeNot'); if (!el || !d.toplam) return;
      el.textContent = d.yerel ? 'Tam sözlük bu cihazda.' : d.inen >= d.toplam ? 'Tam sözlük indirildi; her şey çevrimdışı çalışır.'
        : `Temel sözlük çevrimdışı çalışır. Tam sözlük (${boyutYaz(d.toplamBayt)}) ${d.inen ? `${d.inen}/${d.toplam} parça indirildi; ` : ''}Ayarlar'dan indirilebilir.`;
    }).catch(() => {});
  }

  async function goruntule(q, yon = gorYon || sonYon) {
    const no = ++sorguNo;
    oneriKapat();
    govde.innerHTML = `<div class="kutu madde-yukleniyor" aria-busy="true"><div class="bl-iskelet"><i style="width:45%;height:28px"></i><i></i><i></i><i style="width:70%"></i></div></div>`;
    let r = [];
    try { r = await ara(q, { yon, sinir: 12 }); } catch (e) { console.warn(e); }
    if (no !== sorguNo) return;
    const ilk = r[0];
    if (r.yon === 'tr') {
      if (!r.length) return bulunamadi(q, r);
      const tam = r.filter(x => x.eslesme === 'tam');
      sonAramaEkle(q);
      govde.innerHTML = `<section class="kutu"><div class="madde-bas"><h1 class="tr-bas">${kac(q)}</h1></div><p class="soluk" style="margin-top:6px">${tam.length ? 'İngilizce karşılıkları' : 'Yakın sonuçlar'}</p>
        <ul class="oneri-liste sozluk-sonuc">${(tam.length ? tam : r).map(x => `<li><a href="#/sozluk?q=${encodeURIComponent(x.en)}&yon=en" class="o-sat"><span class="o-k" lang="en">${kac(x.en)}</span><span class="o-a">${kac(x.tr.slice(0, 3).join(', ') || x.trEslesen || '')}</span><span class="o-d">${kac(turAd(x.tur))}</span></a></li>`).join('')}</ul>
        ${r.digerTam ? `<p class="kucuk" style="margin-top:10px"><a href="#/sozluk?q=${encodeURIComponent(q)}&yon=en">İngilizce kelime olarak ara: ${kac(q)}</a></p>` : ''}</section>`;
      return;
    }
    if (!ilk || !(ilk.eslesme === 'tam' || ilk.eslesme === 'kok')) return bulunamadi(q, r);
    const hedef = ilk.en;
    const [mm, kokler] = await Promise.all([madde(hedef), ilk.eslesme === 'tam' && !/\s/.test(q.trim()) ? kokBul(q) : Promise.resolve([])]);
    if (no !== sorguNo) return;
    if (!mm) return bulunamadi(q, r);
    sonAramaEkle(mm.en);
    if (document.activeElement !== inp) inp.value = q;
    maddeCiz(mm, { bicim: ilk.eslesme === 'kok' ? q : null, kokler: kokler.filter(k => enAnah(k) !== enAnah(mm.en)), digerTam: r.digerTam, q });
  }

  function bulunamadi(q, r) {
    const yakin = (r || []).slice(0, 10);
    govde.innerHTML = `<div class="kutu bos-durum">${ikon('ara')}<h2>“${kac(q)}” bulunamadı</h2>
      ${yakin.length ? `<p>Bunlardan biri mi?</p><div class="cip-grup sozluk-yakin">${yakin.map(x => `<a class="cip" href="#/sozluk?q=${encodeURIComponent(x.en)}" lang="en">${kac(x.en)}</a>`).join('')}</div>` : '<p>Yazımı denetleyin ya da arama yönünü değiştirin.</p>'}
      <div class="satir"><a class="dg" href="#/kart/yeni?en=${encodeURIComponent(q)}">${ikon('arti')} Kendi kartı olarak ekle</a></div></div>`;
  }

  function maddeCiz(mm, { bicim, kokler, digerTam, q }) {
    const karta = mm.id
      ? `<a class="dg dg-ana" href="#/kelime/${encodeURIComponent(mm.id)}">${ikon('kitap')} Kelimeyi aç</a>`
      : `<a class="dg dg-ana" href="#/kart/yeni?en=${encodeURIComponent(mm.en)}${mm.tr.length ? '&tr=' + encodeURIComponent(mm.tr.slice(0, 3).join(', ')) : ''}${mm.turler[0] ? '&tur=' + encodeURIComponent(mm.turler[0]) : ''}">${ikon('arti')} Karta ekle</a>`;
    const notlar = [];
    if (bicim) notlar.push(`<b lang="en">${kac(bicim)}</b>, <b lang="en">${kac(mm.en)}</b> kelimesinin biçimi.`);
    if (kokler && kokler.length) notlar.push(`<b lang="en">${kac(mm.en)}</b> ayrıca ${kokler.slice(0, 3).map(k => `<a href="#/sozluk?q=${encodeURIComponent(k)}" lang="en">${kac(k)}</a>`).join(', ')} kelimesinin biçimi olabilir.`);
    if (digerTam) notlar.push(`<a href="#/sozluk?q=${encodeURIComponent(q)}&yon=tr">Türkçe kelime olarak ara: ${kac(q)}</a>`);
    const ornek = mm.ornek ? `<div class="ornek" lang="en">${enSar(mm.ornek.oe, { vurgu: mm.ornek.ob })}${mm.ornek.ot ? `<span class="tr" lang="tr">${kac(mm.ornek.ot)}${mm.ornek.otyz ? '<span class="yz" title="Yapay zekâ çevirisi">YZ çevirisi</span>' : ''}</span>` : ''}</div>` : '';
    const gruplar = mm.gruplar.map(g => `<section class="madde-tur">
        <h3><span>${kac(turAd(g.tur))}</span>${enAnah(g.kelime) === enAnah(mm.en) && g.kelime !== mm.en ? `<span class="etiket" lang="en">${kac(g.kelime)}</span>` : ''}</h3>
        ${g.tr.length ? `<p class="madde-tr">${kac(g.tr.join(', '))}</p>` : ''}
        ${g.tanimlar.length ? `<ol lang="en">${g.tanimlar.map(([t, o]) => `<li>${enSar(t)}${o ? `<em>${enSar(o)}</em>` : ''}</li>`).join('')}</ol>` : ''}
        ${g.es.length ? `<div class="esanlamlar"><span class="soluk">Eşanlamlar:</span>${g.es.slice(0, 10).map(x => `<a href="#/sozluk?q=${encodeURIComponent(x)}" lang="en">${kac(x)}</a>`).join('')}</div>` : ''}
      </section>`).join('');
    const kaynak = { deste: 'kelime destesi', ozel: 'kendi kartınız', cekirdek: 'temel sözlük', parca: 'tam sözlük' };
    govde.innerHTML = `<article class="kutu madde">
      <div class="madde-bas"><h1 lang="en">${kac(mm.en)}</h1><button type="button" class="dg dg-ikon dg-hayalet ses-dg" data-oku="${kac(mm.en)}" aria-label="Sesli oku">${ikon('ses')}</button></div>
      <div class="madde-alt">${mm.ipa ? `<span class="ipa">${kac(mm.ipa)}</span>` : ''}${svEtiket(mm)}${mm.id ? `<span class="etiket ${mm.ozel ? 'mor' : 'yesil'}">${mm.ozel ? 'kendi kartınız' : 'destede'}</span>` : ''}</div>
      ${notlar.length ? `<div class="madde-not">${notlar.map(n => `<p>${n}</p>`).join('')}</div>` : ''}
      <div class="satir madde-eylem">${karta}</div>
      ${ornek}
      <div class="madde-gruplar">${gruplar}</div>
      ${mm.baglantiGerekli ? `<div class="uyari-kutu bilgi" style="margin-top:14px">${ikon('bulut')}<div>Tam madde (daha çok tanım ve örnek) için bağlantı gerekli. Çevrimdışı kullanım için tam sözlüğü Ayarlar'dan indirebilirsiniz.</div></div>` : ''}
      <p class="kucuk soluk madde-kaynak">Kaynak: ${mm.kaynak.map(k => kaynak[k] || k).join(', ')} (Wiktionary, Vikisözlük, FreeDict; CC BY-SA)</p>
    </article>`;
  }

  govde.addEventListener('click', e => {
    const b = e.target.closest('[data-oku]');
    if (b) oku(b.dataset.oku);
  });

  if (q0) goruntule(q0); else { bosDurum(); if (matchMedia('(pointer: fine)').matches) inp.focus(); }

  return () => {
    sorguNo++; clearTimeout(zaman);
    durumKapat();
    document.removeEventListener('pointerdown', disari);
    if (vv) vv.removeEventListener('resize', alanAyarla);
  };
}
