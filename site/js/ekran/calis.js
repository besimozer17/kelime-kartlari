// Çalışma kurulumu (#/calis) ve oturum (#/oturum).
import { S, kelime, kayit, suz, tumDesteler, SEVIYELER, TURLER, ayarKaydet, yanitKaydet, kabulEkle, metaYaz, meta, gunlukEkle, xpEkle, durumAl, durumYaz, bugun, trdenEn } from '../veri.js';
import { KIPLER, SIRALAR, kuyrukKur, oturumBaslat, siradaki, bittiMi, yanitla, atla, ozet, sikUret } from '../oturum.js';
import { denetleTr, denetleEn, denetleBosluk, boslukluCumle } from '../denetim.js';
import { kartPuani } from '../puan.js';
import { iskelet, harfSayisi } from '../metin.js';
import { ikon, kac, bildir, sureYaz } from '../ui.js';
import { oku } from '../ses.js';
import { enSar, gizliAc } from '../balon.js';

const svEtiket = k => k.sv ? `<span class="etiket sv sv-${k.sv}${k.svt ? ' tahmin' : ''}" title="${k.svt ? 'Seviye tahmini' : 'Seviye'}">${k.svt ? '≈' : ''}${k.sv}</span>` : '';
const turAd = t => TURLER[t] || t || '';

/* ================================================================== kurulum */
function adaylar(k) {
  const f = { cikarHaric: true, sv: k.sv, zor: k.zor, deste: k.deste };
  if (k.kaynak === 'zor') f.zorlar = true;
  if (k.kaynak === 'vade') f.vade = true;
  if (k.kaynak === 'ozel') f.ozel = true;
  return suz(f);
}

export function kurulumEkrani(main) {
  const k = { ...S.ayar.kurulum };
  const kaynaklar = [['hepsi', 'Hepsi'], ['vade', 'Tekrar zamanı'], ['zor', 'Zorlandıklarım'], ['ozel', 'Kendi kartlarım']];
  const bol = (ad, liste, deger) => `<div class="bolumlu" data-alan="${ad}">${liste.map(([v, a]) => `<button type="button" data-v="${v}" aria-pressed="${String(deger) === String(v)}">${a}</button>`).join('')}</div>`;
  main.innerHTML = `<div class="ekran ekran-dar">
    <div class="ekran-bas"><h1>Çalış<span class="alt">Ne çalışacağınızı seçin; seçim hatırlanır.</span></h1></div>
    <div class="kurulum">
      <section class="kutu"><h2>Kaynak</h2>${bol('kaynak', kaynaklar, k.kaynak)}
        <div class="alan" style="margin-top:12px"><span>Deste</span><select data-alan="deste"><option value="">Bütün desteler</option>${tumDesteler().map(d => `<option value="${kac(d.kod)}" ${d.kod === k.deste ? 'selected' : ''}>${kac(d.ad)} (${d.adet})</option>`).join('')}</select></div>
      </section>
      <section class="kutu"><h2>Seviye ve zorluk</h2>
        <div class="cip-grup" data-coklu="sv">${SEVIYELER.map(s => `<button type="button" class="cip" data-v="${s}" aria-pressed="${k.sv.includes(s)}">${s}</button>`).join('')}</div>
        <div class="cip-grup" data-coklu="zor" style="margin-top:10px">${[['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor']].map(([v, a]) => `<button type="button" class="cip" data-v="${v}" aria-pressed="${k.zor.includes(v)}">${a}</button>`).join('')}</div>
        <p class="kucuk soluk" style="margin-top:8px">Hiçbiri seçili değilse hepsi (seviye tahminleri dahil).</p>
      </section>
      <section class="kutu"><h2>Kip</h2><div class="kip-izgara">${KIPLER.map(x => `<button type="button" class="kip" data-kip="${x.kod}" aria-pressed="${x.kod === k.kip}"><b>${x.ad}</b><small>${x.ac}</small></button>`).join('')}</div></section>
      <section class="kutu"><h2>Sıra ve uzunluk</h2>
        <div class="alan"><span>Sıra</span><select data-alan="sira">${SIRALAR.map(s => `<option value="${s.kod}" ${s.kod === k.sira ? 'selected' : ''}>${s.ad}</option>`).join('')}</select></div>
        <div class="alan" style="margin-top:12px"><span>Kart sayısı</span>${bol('boy', [[10, '10'], [20, '20'], [50, '50'], [0, 'Sınırsız']], k.boy)}</div>
        <div class="alan" style="margin-top:12px"><span>Yeni / tekrar dengesi</span>${bol('oran', [['tekrar', 'Önce tekrar'], ['dengeli', 'Dengeli'], ['yeni', 'Çok yeni']], k.oran)}</div>
      </section>
      <div class="baslat-cubuk"><div class="yayil"><b id="adaySay">…</b><small>kelime bu seçime uyuyor</small></div><button type="button" class="dg dg-ana" id="baslat">${ikon('oynat')} Başlat</button></div>
    </div></div>`;
  const guncelle = () => {
    ayarKaydet({ kurulum: { ...k } });
    const n = adaylar(k).length;
    main.querySelector('#adaySay').textContent = n.toLocaleString('tr-TR');
    main.querySelector('#baslat').disabled = !n;
  };
  main.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const bolum = b.closest('.bolumlu');
    if (bolum) { const a = bolum.dataset.alan; k[a] = a === 'boy' ? Number(b.dataset.v) : b.dataset.v; bolum.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); guncelle(); return; }
    const coklu = b.closest('[data-coklu]');
    if (coklu) { const a = coklu.dataset.coklu, v = b.dataset.v; k[a] = k[a].includes(v) ? k[a].filter(x => x !== v) : [...k[a], v]; b.setAttribute('aria-pressed', k[a].includes(v)); guncelle(); return; }
    if (b.dataset.kip) { k.kip = b.dataset.kip; main.querySelectorAll('.kip').forEach(x => x.setAttribute('aria-pressed', x === b)); guncelle(); return; }
    if (b.id === 'baslat') oturumKur(k);
  });
  main.addEventListener('change', e => { const a = e.target.dataset.alan; if (a) { k[a] = e.target.value; guncelle(); } });
  guncelle();
}

/** Kurulumdan (ya da hızlı başlatmadan) oturum başlat. */
export function oturumKur(k, hazirAdaylar = null) {
  const liste = hazirAdaylar || adaylar(k);
  const sira = kuyrukKur(liste, k, kayit, bugun());
  if (!sira.length) { bildir('Bu seçimde sorulabilecek kart yok (boşluk kipi örnek cümlesi olan kelimeleri sorar).', { tur: 'hata' }); return; }
  durumYaz('aktifOturum', oturumBaslat(sira, k));
  location.hash = '#/oturum';
}

/* ================================================================== oturum */
export function oturumEkrani(main) {
  let o = durumAl('aktifOturum');
  if (!o || !o.sira) {
    main.innerHTML = `<div class="ekran ekran-dar"><div class="bos-durum">${ikon('calis')}<h2>Süren oturum yok</h2><p>Çalış sekmesinden yeni bir oturum başlatın.</p><div class="satir"><a class="dg dg-ana" href="#/calis">Çalışmaya başla</a></div></div></div>`;
    return () => {};
  }
  document.body.classList.add('odak');
  main.innerHTML = `<div class="oturum">
    <div class="oturum-ust"><button type="button" class="dg dg-ikon dg-hayalet" id="kapat" aria-label="Oturumu kapat">${ikon('kapat')}</button>
      <div class="ilerleme" role="progressbar" aria-label="İlerleme"><i id="cubuk" style="width:0"></i></div>
      <span class="seri-rozet" id="seri" hidden>${ikon('alev')}<b></b></span><span class="oturum-puan">${ikon('yildiz')}<b id="puan">0</b></span></div>
    <div id="alan"></div>
    <div class="soru-kart" id="kart" hidden>
      <div id="soru" style="display:contents"></div>
      <div class="yanit-kutu" id="yk"><input id="yanit" type="text" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="done" aria-label="Yanıtınız"><span class="yanit-ikon" id="yIkon"></span></div>
      <div id="altAlan" style="display:contents"></div>
    </div>
    <div id="gb"></div>
    <p class="kisayol-ipucu">Enter: denetle / sonraki · Alt+İ: ipucu · Alt+B: bilmiyorum · 1–4: şık</p>
  </div>`;
  const $ = s => main.querySelector(s);
  const inp = $('#yanit');
  let durum = 'soru', son = null, ipucu = 0, esanlamHak = true, cevapZamani = 0, basla = Date.now(), sikler = null;

  const kaydet = () => durumYaz('aktifOturum', o);
  const ustGuncelle = () => {
    $('#cubuk').style.width = Math.round((o.i / Math.max(1, o.sira.length)) * 100) + '%';
    $('#puan').textContent = o.puan;
    $('#seri').hidden = o.seri < 2; $('#seri b').textContent = o.seri;
  };

  function goster() {
    ustGuncelle();
    $('#gb').innerHTML = '';
    if (bittiMi(o)) return bitir();
    const og = siradaki(o); const k = kelime(og.id);
    if (!k) { o = atla(o); return goster(); }
    durum = 'soru'; son = null; ipucu = 0; esanlamHak = true; basla = Date.now(); sikler = null;
    const yk = $('#yk'); yk.className = 'yanit-kutu'; $('#yIkon').innerHTML = '';
    inp.value = ''; inp.readOnly = false;
    $('#kart').hidden = false;
    const tekrar = og.t ? '<span class="etiket kirmizi">yeniden</span>' : '';
    const ust = `<div class="soru-ust"><span class="soru-yon">${og.kip === 'bosluk' ? 'Boşluğu doldurun' : og.yon === 'et' ? 'İngilizce → Türkçe' : 'Türkçe → İngilizce'}</span>${svEtiket(k)}<span class="etiket">${kac(turAd(k.tur))}</span>${tekrar}</div>`;
    let soru = '';
    if (og.kip === 'bosluk') {
      const c = boslukluCumle(k.oe, k.ob, '\u0000');
      soru = `${ust}<p class="cumle" lang="en">${enSar(c, { gizle: [k.en, k.oe.slice(k.ob[0], k.ob[1])] }).replace('\u0000', '<span class="bosluk">&nbsp;</span>')}</p>${k.ot ? `<p class="cumle-tr">${kac(k.ot)}${k.otyz ? '<span class="yz">YZ</span>' : ''}</p>` : ''}<p class="soru-ipucu">${harfSayisi(k.oe.slice(k.ob[0], k.ob[1]))} harf</p>`;
    } else if (og.yon === 'et') {
      soru = `${ust}<div class="bas-kelime${k.en.length > 16 ? ' uzun' : ''}">${kac(k.en)}</div>${k.ipa ? `<div class="ipa">${kac(k.ipa)}</div>` : ''}<button type="button" class="dg dg-k dg-hayalet ses-dg" data-oku="${kac(k.en)}">${ikon('ses')} Dinle</button>`;
    } else {
      const birden = trdenEn(k.tr[0]).length > 1;
      soru = `${ust}<div class="bas-tr">${kac(k.tr.slice(0, 3).join(', '))}</div><p class="soru-ipucu">${harfSayisi(k.en)} harf${birden && k.tanim ? ` · <span lang="en">${enSar(maskele(k.tanim, k.en), { gizle: [k.en] })}</span>` : ''}</p>`;
    }
    $('#soru').innerHTML = soru + '<p class="soru-ipucu" id="ipucuAlan"></p>';
    const yaz = og.kip === 'yaz' || og.kip === 'bosluk';
    yk.hidden = !yaz;
    if (og.kip === 'secmeli') {
      sikler = sikUret(k, S.tumu, Math.random);
      const gos = x => (og.yon === 'et' ? x.tr.slice(0, 2).join(', ') : x.en);
      $('#altAlan').innerHTML = `<div class="sik-liste">${sikler.map((x, i) => `<button type="button" class="sik" data-sik="${i}"><span class="no">${i + 1}</span><span class="m">${kac(gos(x))}</span></button>`).join('')}</div>`;
      if (og.yon === 'te') $('#soru .bas-tr').textContent = k.tr.slice(0, 3).join(', ');
    } else if (og.kip === 'cevir') {
      $('#altAlan').innerHTML = `<button type="button" class="dg dg-ana dg-buyuk dg-tam" id="cevir" style="margin-top:10px">${ikon('cevir')} Kartı çevir</button>`;
    } else {
      $('#altAlan').innerHTML = `<div class="ipucu-dugmeler"><button type="button" class="dg dg-hayalet" data-ipucu="harf">${ikon('ipucu')} İlk harf <span class="eksi">−2</span></button><button type="button" class="dg dg-hayalet" data-ipucu="iskelet">İskelet <span class="eksi">−2</span></button>${k.oe && og.kip !== 'bosluk' ? '<button type="button" class="dg dg-hayalet" data-ipucu="ornek">Örnek <span class="eksi">−2</span></button>' : ''}${k.tanim ? '<button type="button" class="dg dg-hayalet" data-ipucu="tanim">Tanım <span class="eksi">−2</span></button>' : ''}</div>
        <div class="yanit-dugmeler"><button type="button" class="dg" id="bilmiyorum">Bilmiyorum</button><button type="button" class="dg dg-ana" id="denetle">Denetle</button></div>`;
      if (document.activeElement !== inp) inp.focus({ preventScroll: true });
    }
    if (S.ayar.otoOku && og.yon === 'et' && og.kip !== 'bosluk') oku(k.en);
  }

  function maskele(metin, en) {
    const re = new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'gi');
    return metin.replace(re, '___');
  }

  function ipucuVer(tur) {
    const og = siradaki(o); const k = kelime(og.id);
    const hedef = og.kip === 'bosluk' ? k.oe.slice(k.ob[0], k.ob[1]) : og.yon === 'et' ? k.tr[0] : k.en;
    ipucu++;
    const alan = $('#ipucuAlan');
    const ek = { harf: `İlk harf: <b>${kac([...hedef][0])}</b>`, iskelet: `<b>${kac(iskelet(hedef, 1))}</b>`, ornek: k.oe ? `<i lang="en">${enSar(og.yon === 'te' ? (boslukluCumle(k.oe, k.ob) || k.oe) : k.oe, { gizle: [k.en, k.ob ? k.oe.slice(k.ob[0], k.ob[1]) : ''] })}</i>` : '', tanim: `<span lang="en">${enSar(maskele(k.tanim || '', k.en), { gizle: [k.en] })}</span>` }[tur];
    alan.innerHTML += (alan.innerHTML ? '<br>' : '') + ek;
    main.querySelector(`[data-ipucu="${tur}"]`)?.setAttribute('disabled', '');
    inp.focus({ preventScroll: true });
  }

  function denetle(bilmiyorum = false) {
    if (durum !== 'soru') return;
    const og = siradaki(o); const k = kelime(og.id); const m = meta(k.id);
    const deger = inp.value;
    let r;
    if (bilmiyorum) r = { sonuc: 'yanlis', eslesen: og.yon === 'et' ? k.tr[0] : k.en, not: 'bilmiyorum' };
    else {
      if (!deger.trim()) { inp.focus(); return; }
      const b = { tolerans: S.ayar.tolerans, digerTr: S.trKume, enKume: S.enKume, trdenEn };
      if (og.kip === 'bosluk') r = denetleBosluk(deger, k, b);
      else if (og.yon === 'et') r = denetleTr(deger, { ...k, kabulTr: m.kabulTr }, b);
      else r = denetleEn(deger, { ...k, kabulEn: m.kabulEn }, b);
      if (r.sonuc === 'bos') return;
      if (r.sonuc === 'esanlam' && esanlamHak) {
        esanlamHak = false;
        $('#yk').className = 'yanit-kutu esanlam';
        $('#ipucuAlan').innerHTML = `Bu da doğru (<b>${kac(deger.trim())}</b>), ama beklenen başka bir kelime. Bir kez daha deneyin.`;
        inp.select(); return;
      }
      if (r.sonuc === 'esanlam') r = { ...r, sonuc: 'neredeyse', not: 'esanlam' };
    }
    sonucGoster(r, deger);
  }

  function sonucGoster(r, deger) {
    const og = siradaki(o); const k = kelime(og.id);
    durum = 'cevap'; son = { r, deger }; cevapZamani = Date.now();
    $('#yk').className = 'yanit-kutu ' + r.sonuc;
    $('#yIkon').innerHTML = ikon(r.sonuc === 'dogru' ? 'dogru' : r.sonuc === 'yanlis' ? 'yanlis' : 'yakin', 'yanit-ikon');
    const puan = kartPuani({ sonuc: r.sonuc, kip: og.kip === 'bosluk' ? 'yaz' : og.kip, ipucu, seri: o.seri });
    son.puan = puan;
    const baslik = { dogru: 'Doğru', neredeyse: 'Neredeyse doğru', yanlis: 'Yanlış', kolay: 'Kolay', zor: 'Zor' }[r.sonuc] || 'Doğru';
    let ac = '';
    if (r.not === 'ascii' || r.not === 'yazim' || r.not === 'yardimci' || r.not === 'kok') ac = `Doğru yazım: <strong>${kac(r.yazim || r.eslesen)}</strong>`;
    if (r.not === 'esanlam') ac = `Eşanlamlı yazdınız; beklenen: <strong>${kac(k.en)}</strong>`;
    if (r.sonuc === 'yanlis' && deger && r.not !== 'bilmiyorum') ac = `Yanıtınız: <s>${kac(deger.trim())}</s>`;
    const tutan = r.sonuc === 'yanlis' ? '\u0000' : (r.eslesen || '').toLocaleLowerCase('tr');
    const anlam = k.tr.map(t => `<span class="${t.toLocaleLowerCase('tr') === tutan ? 'tutan' : ''}">${kac(t)}</span>`).join(', ');
    const ornek = k.oe ? `<div class="ornek" lang="en">${enSar(k.oe, { vurgu: k.ob })}${k.ot ? `<span class="tr">${kac(k.ot)}${k.otyz ? '<span class="yz" title="Yapay zekâ çevirisi">YZ çevirisi</span>' : ''}</span>` : ''}</div>` : '';
    const zor = meta(k.id).zor;
    const yazKip = og.kip === 'yaz' || og.kip === 'bosluk';
    $('#gb').innerHTML = `<div class="geri-bildirim gb-${r.sonuc === 'esanlam' ? 'neredeyse' : r.sonuc}">
      <div class="gb-bas">${ikon(r.sonuc === 'dogru' || r.sonuc === 'kolay' ? 'dogru' : r.sonuc === 'yanlis' ? 'yanlis' : 'yakin')}<span>${baslik}</span><span class="puan-art">${puan ? '+' + puan : ''}</span></div>
      <div class="gb-govde">
        ${ac ? `<p class="gb-ac">${ac}</p>` : ''}
        <div class="gb-kelime"><span class="k">${kac(k.en)}</span>${k.ipa ? `<span class="ipa">${kac(k.ipa)}</span>` : ''}${svEtiket(k)}<button type="button" class="dg dg-k dg-ikon dg-hayalet ses-dg" data-oku="${kac(k.en)}" aria-label="Sesli oku">${ikon('ses')}</button></div>
        <div class="anlamlar">${anlam}</div>
        ${ornek}
        ${k.tanim ? `<p class="tanim" lang="en">${enSar(k.tanim)}</p>` : ''}
        ${k.es && k.es.length ? `<div class="esanlamlar"><span class="soluk">Eşanlamlar:</span><span lang="en">${k.es.slice(0, 8).map(x => enSar(x)).join(', ')}</span></div>` : ''}
        ${og.kip === 'secmeli' && og.yon === 'te' && sikler ? `<p class="siklar-ac">Şıklar: <span lang="en">${sikler.map(x => enSar(x.en)).join(' · ')}</span></p>` : ''}
        <div class="gb-araclar">
          ${yazKip && r.sonuc !== 'dogru' && deger && deger.trim() ? '<button type="button" class="dg dg-k" id="dogruSay">Bunu doğru say</button>' : ''}
          ${r.sonuc === 'dogru' ? '<button type="button" class="dg dg-k dg-hayalet" id="bilmiyordum">Aslında bilmiyordum</button>' : ''}
          <button type="button" class="dg dg-k dg-hayalet" id="zorIsaret" aria-pressed="${!!zor}">${ikon('bayrak')} ${zor ? 'Zor işaretli' : 'Zor olarak işaretle'}</button>
          <a class="dg dg-k dg-hayalet" href="#/sozluk?q=${encodeURIComponent(k.en)}">${ikon('kitap')} Sözlükte aç</a>
          <button type="button" class="dg dg-k dg-hayalet" id="cikar">${ikon('sil')} Bu kartı çıkar</button>
        </div>
      </div></div>
      <button type="button" class="dg dg-ana dg-buyuk dg-tam gb-ileri" id="ileri">Sonraki ${ikon('ileri')}</button>`;
    $('#altAlan').querySelectorAll('button').forEach(b => { if (!b.closest('.sik-liste')) b.disabled = true; });
    gizliAc(main); // yanıt verildi: yanıtı ele veren kelimeler artık tıklanabilir
    if (S.ayar.otoOku) oku(k.en);
    if (yazKip) inp.focus({ preventScroll: true }); else $('#ileri').focus({ preventScroll: true });
    requestAnimationFrame(() => $('#gb').scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  function sonraki() {
    if (durum !== 'cevap' || Date.now() - cevapZamani < 400) return;
    const og = siradaki(o);
    const { r } = son;
    let sonuc = r.sonuc;
    const puan = sonuc === 'yanlis' ? 0 : son.puan;
    yanitKaydet(og.id, og.yon, sonuc, { tekrarMi: og.t > 0 });
    o = yanitla(o, sonuc, puan, { ipucu, ms: Date.now() - basla });
    if (puan) xpEkle(puan);
    gunlukEkle({ kart: 1, dogru: sonuc === 'dogru' || sonuc === 'kolay' ? 1 : 0, neredeyse: sonuc === 'neredeyse' || sonuc === 'zor' ? 1 : 0, yanlis: sonuc === 'yanlis' ? 1 : 0, puan, sure: Math.round((Date.now() - basla) / 1000), yeni: og.t === 0 && !kayitOnce(og) ? 1 : 0 });
    kaydet();
    goster();
  }
  const kayitOnce = og => { const x = kayit(og.id, og.yon); return x && x.gecmis && x.gecmis.length > 1; };

  function bitir() {
    document.body.classList.remove('odak');
    const z = ozet(o);
    const enIyi = durumAl('enIyi', 0) || 0;
    const rekor = z.puan > enIyi;
    if (rekor) durumYaz('enIyi', z.puan);
    durumYaz('aktifOturum', null);
    $('#kart').hidden = true;
    $('#gb').innerHTML = '';
    $('#alan').innerHTML = `<div class="kutu ozet"><div class="buyuk-ikon">${ikon('yildiz')}</div><h2>Oturum bitti</h2>
      ${rekor ? `<span class="rekor">${ikon('yildiz', 'ikon-k')} Yeni en iyi skor</span>` : ''}
      <div class="ozet-sayilar"><div><strong>${z.puan}</strong><span>puan</span></div><div><strong>%${z.oran}</strong><span>doğruluk</span></div><div><strong>${sureYaz(z.sure)}</strong><span>süre</span></div><div><strong>${z.enUzunSeri}</strong><span>en uzun seri</span></div></div>
      ${z.yanlislar.length ? `<h3 style="text-align:left;margin-bottom:6px">Yanlışlar (${z.yanlislar.length})</h3><ul class="liste" style="text-align:left">${z.yanlislar.map(y => { const k = kelime(y.id); return k ? `<li class="liste-ogesi"><span class="k" lang="en">${enSar(k.en)}</span><span class="a kesik">${kac(k.tr.join(', '))}</span></li>` : ''; }).join('')}</ul>` : '<p class="soluk">Hiç yanlış yok.</p>'}
      <div class="satir" style="justify-content:center;margin-top:16px">${z.yanlislar.length ? '<button type="button" class="dg dg-ana" id="yanlisCalis">Yanlışları şimdi tekrar çalış</button>' : ''}<a class="dg" href="#/calis">Yeni oturum</a><a class="dg dg-hayalet" href="#/ana">Ana ekran</a></div></div>`;
    $('#ust') ;
    main.querySelector('.oturum-ust').hidden = true;
    main.querySelector('.kisayol-ipucu').hidden = true;
    const yb = main.querySelector('#yanlisCalis');
    if (yb) yb.onclick = () => {
      const sira = z.yanlislar.map(y => ({ id: y.id, yon: y.yon, kip: 'yaz', t: 0 }));
      durumYaz('aktifOturum', oturumBaslat(sira, { ...o.ayar, kip: 'karisik' }));
      oturumEkrani(main);
    };
  }

  // olaylar
  inp.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.repeat || e.isComposing) return;
    e.preventDefault();
    if (durum === 'soru') denetle(); else sonraki();
  });
  main.onclick = e => {
    const b = e.target.closest('button, a'); if (!b) return;
    const og = siradaki(o); const k = og && kelime(og.id);
    if (b.dataset.oku) return void oku(b.dataset.oku);
    if (b.id === 'kapat') { kaydet(); document.body.classList.remove('odak'); location.hash = '#/ana'; return; }
    if (b.id === 'denetle') return denetle();
    if (b.id === 'bilmiyorum') return denetle(true);
    if (b.dataset.ipucu) return ipucuVer(b.dataset.ipucu);
    if (b.id === 'ileri') { cevapZamani = 0; return sonraki(); }
    if (b.dataset.sik != null && durum === 'soru') {
      const i = Number(b.dataset.sik); const dogru = sikler[i].id === k.id;
      main.querySelectorAll('.sik').forEach((x, j) => { x.disabled = true; if (sikler[j].id === k.id) x.classList.add('dogru'); else if (j === i) x.classList.add('yanlis'); });
      return sonucGoster({ sonuc: dogru ? 'dogru' : 'yanlis', eslesen: og.yon === 'et' ? sikler[i].tr[0] : sikler[i].en, not: 'secmeli' }, '');
    }
    if (b.id === 'cevir') {
      b.remove();
      const arka = document.createElement('div'); arka.className = 'cevir-arka';
      arka.innerHTML = `<div class="${og.yon === 'et' ? 'anlamlar' : 'bas-kelime'}">${kac(og.yon === 'et' ? k.tr.join(', ') : k.en)}</div>
        <div class="degerlendir">${[['yanlis', 'Bilemedim', '1'], ['zor', 'Zor', '2'], ['dogru', 'İyi', '3'], ['kolay', 'Kolay', '4']].map(([d, a, n]) => `<button type="button" data-d="${d}">${a}<small>${n}</small></button>`).join('')}</div>`;
      $('#altAlan').append(arka);
      return;
    }
    if (b.dataset.d && durum === 'soru') return sonucGoster({ sonuc: b.dataset.d, eslesen: k.tr[0], not: 'cevir' }, '');
    if (b.id === 'dogruSay') {
      kabulEkle(k.id, og.yon === 'et' && og.kip !== 'bosluk' ? 'kabulTr' : 'kabulEn', son.deger.trim());
      son.r = { ...son.r, sonuc: 'dogru', not: 'kabul' };
      son.puan = kartPuani({ sonuc: 'dogru', kip: 'yaz', ipucu, seri: o.seri });
      bildir('Kabul edildi: bu yanıt artık bu kartta doğru sayılır.', { tur: 'tamam' });
      cevapZamani = 0; return sonraki();
    }
    if (b.id === 'bilmiyordum') { son.r = { ...son.r, sonuc: 'yanlis' }; son.puan = 0; cevapZamani = 0; return sonraki(); }
    if (b.id === 'zorIsaret') { const z = !meta(k.id).zor; metaYaz(k.id, { zor: z }); b.setAttribute('aria-pressed', z); b.lastChild.textContent = z ? ' Zor işaretli' : ' Zor olarak işaretle'; return; }
    if (b.id === 'cikar') {
      metaYaz(k.id, { cikar: true });
      bildir(`"${k.en}" çalışmadan çıkarıldı.`, { eylem: { ad: 'Geri al', f: () => metaYaz(k.id, { cikar: false }) } });
      o = atla(o); kaydet(); return goster();
    }
  };
  const tus = e => {
    if (e.altKey && /^(i|ı|İ)$/i.test(e.key)) { e.preventDefault(); const b = main.querySelector('[data-ipucu]:not([disabled])'); if (b && durum === 'soru') ipucuVer(b.dataset.ipucu); return; }
    if (e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); return denetle(true); }
    if (document.activeElement === inp && !$('#yk').hidden) return;
    if (/^[1-4]$/.test(e.key)) { const b = main.querySelector(`.sik[data-sik="${Number(e.key) - 1}"], .degerlendir button:nth-child(${e.key})`); if (b && !b.disabled) b.click(); }
    if (e.key === ' ' && main.querySelector('#cevir')) { e.preventDefault(); main.querySelector('#cevir').click(); }
    if (e.key === 'Enter' && durum === 'cevap') { e.preventDefault(); sonraki(); }
  };
  document.addEventListener('keydown', tus);
  goster();
  return () => { document.removeEventListener('keydown', tus); document.body.classList.remove('odak'); };
}
