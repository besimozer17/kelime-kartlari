// Kelime ayrıntısı (#/kelime/<id>): anlamlar, örnek, tanım, ilerleme, not, kabul edilen yanıtlar, deste, düzeltme.
import { S, kelime, kayit, meta, metaYaz, kabulEkle, duzeltKaydet, ozguneDon, kelimeDurum, zorMu, bugun, TURLER, bulAralik } from '../veri.js';
import { DURUM_AD, SON_KUTU } from '../tekrar.js';
import { enSar } from '../balon.js';
import { oku } from '../ses.js';
import { oturumKur, } from './calis.js';
import { sonSira } from './liste.js';
import { desteSec, SINIR } from './kart.js';
import { ikon, kac, bildir, pencere, geciktir, sayi, yolKimlik, enterAnaDugme, geriGit } from '../ui.js';

const sonrakiYaz = (vade, g) => { const f = vade - g; return f <= 0 ? 'bugün' : f === 1 ? 'yarın' : `${f} gün sonra`; };

export function kelimeEkrani(main, parca = []) {
  const id = decodeURIComponent(parca.slice(1).join('/') || '');
  const k = kelime(id);
  if (!k) {
    main.innerHTML = `<div class="ekran ekran-dar"><div class="kutu bos-durum">${ikon('ara')}<h2>Kelime bulunamadı</h2><p>Silinmiş ya da bağlantı hatalı olabilir.</p><div class="satir"><a class="dg dg-ana" href="#/liste">Kelime listesi</a></div></div></div>`;
    return;
  }
  const sira = sonSira.length && sonSira.includes(id) ? sonSira : S.tumu.map(x => x.id);
  const yer = sira.indexOf(id);
  const onceki = yer > 0 ? sira[yer - 1] : null, sonraki = yer >= 0 && yer < sira.length - 1 ? sira[yer + 1] : null;

  const ciz = () => {
    const k = kelime(id); const m = meta(id); const g = bugun();
    const durum = kelimeDurum(id);
    const desteAd = (k.d || []).map(i => S.desteler[i]).filter(Boolean);
    const kendiD = [...S.ozelDesteler.values()].filter(d => d.kelimeler.includes(id));
    const yon = (y, ad) => {
      const r = kayit(id, y);
      if (!r || r.son == null) return `<div><b>${ad}</b><span class="soluk kucuk">Henüz sorulmadı</span></div>`;
      return `<div><div class="satir"><b class="yayil">${ad}</b><span class="kucuk soluk">Kutu ${r.kutu}/${SON_KUTU} · sonraki: ${sonrakiYaz(r.vade, g)}</span></div>
        <div class="kutucuklar" aria-label="Kutu ${r.kutu} / ${SON_KUTU}">${Array.from({ length: SON_KUTU }, (_, i) => `<i class="${i < r.kutu ? 'dolu' : ''}"></i>`).join('')}</div>
        <div class="satir kucuk"><span class="etiket yesil">${r.dogru} doğru</span>${r.neredeyse ? `<span class="etiket sari">${r.neredeyse} yakın</span>` : ''}<span class="etiket kirmizi">${r.yanlis} yanlış</span></div>
        ${r.gecmis && r.gecmis.length ? `<div class="gecmis" aria-label="Son yanıtlar">${r.gecmis.slice(-20).map(([gn, kod]) => `<i class="g-${kod}" title="${new Date(gn * 864e5).toLocaleDateString('tr-TR')}"></i>`).join('')}</div>` : ''}</div>`;
    };
    const ob = k.ob && k.oe ? k.ob : null;
    const kabul = (alan, ad, ph) => `<div class="alan"><span>${ad}</span><div class="cip-grup kabul" data-alan="${alan}">${(m[alan] || []).map((x, i) => `<span class="etiket mavi">${kac(x)}<button type="button" class="et-sil" data-kabul-sil="${alan}" data-i="${i}" aria-label="${kac(x)} kaldır">${ikon('kapat', 'ikon-k')}</button></span>`).join('') || '<span class="soluk kucuk">Yok</span>'}</div>
      <div class="satir"><input type="text" data-kabul-gir="${alan}" placeholder="${ph}" aria-label="${ad} ekle" maxlength="${SINIR.tr}" autocapitalize="off" spellcheck="false" style="flex:1;width:auto"><button type="button" class="dg dg-k" data-kabul-ekle="${alan}">Ekle</button></div></div>`;
    main.innerHTML = `<div class="ekran kelime-ekran">
      <div class="ekran-bas"><button type="button" class="dg dg-ikon dg-hayalet" id="geri" aria-label="Geri">${ikon('geri')}</button><span class="yayil soluk kucuk">${yer >= 0 ? `${sayi(yer + 1)} / ${sayi(sira.length)}` : ''}</span>
        <a class="dg dg-ikon dg-hayalet" ${onceki ? `href="#/kelime/${yolKimlik(onceki)}"` : 'aria-disabled="true" tabindex="-1"'} aria-label="Önceki kelime" id="onceki">${ikon('geri')}</a>
        <a class="dg dg-ikon dg-hayalet" ${sonraki ? `href="#/kelime/${yolKimlik(sonraki)}"` : 'aria-disabled="true" tabindex="-1"'} aria-label="Sonraki kelime" id="sonraki">${ikon('ileri')}</a></div>
      <div class="madde-bas"><h1 lang="en">${kac(k.en)}</h1><button type="button" class="dg dg-ikon ses-dg" data-oku="${kac(k.en)}" aria-label="Sesli oku">${ikon('ses')}</button></div>
      <div class="madde-alt">${k.tur ? `<span class="etiket">${kac(TURLER[k.tur] || k.tur)}</span>` : ''}${k.sv ? `<span class="etiket sv sv-${k.sv}${k.svt ? ' tahmin' : ''}" title="${k.svt ? 'Tahmini seviye' : 'Seviye'}">${k.svt ? '≈' : ''}${k.sv}</span>` : ''}${k.ipa ? `<span class="ipa">${kac(k.ipa)}</span>` : ''}
        <span class="etiket"><i class="nokta d-${durum}"></i> ${DURUM_AD[durum]}</span>${k.ozel ? '<span class="etiket mor">kendi kartım</span>' : ''}${zorMu(id) ? `<span class="etiket kirmizi">${ikon('bayrak', 'ikon-k')} zorlandıklarım</span>` : ''}${m.cikar ? '<span class="etiket">çalışmadan çıkarıldı</span>' : ''}${k._orj ? '<span class="etiket sari">düzeltildi</span>' : ''}</div>
      <div class="ayrinti-izgara">
        <div class="izgara">
          <section class="kutu"><div class="kutu-bas"><h2>Türkçe karşılıklar</h2>${k.ozel ? `<a class="dg dg-k" href="#/kart/${yolKimlik(id)}">${ikon('kalem', 'ikon-k')} Düzenle</a>` : `<span class="satir">${k._orj ? '<button type="button" class="dg dg-k dg-hayalet" id="ozgun">Özgüne dön</button>' : ''}<button type="button" class="dg dg-k" id="duzelt">${ikon('kalem', 'ikon-k')} Düzelt</button></span>`}</div>
            <div class="anlamlar">${kac((k.tr || []).join(', ')) || '<span class="soluk">—</span>'}</div>
            ${k._orj ? `<p class="kucuk soluk" style="margin-top:6px">Özgün: ${kac((k._orj.tr || []).join(', '))}</p>` : ''}</section>
          ${k.oe || k.tanim || (k.es && k.es.length) ? `<section class="kutu" style="display:grid;gap:12px">
            ${k.oe ? `<div><h2 class="kucuk-bas">Örnek cümle</h2><div class="ornek" lang="en">${enSar(k.oe, { vurgu: ob, gizle: [] })}${k.ot ? `<span class="tr" lang="tr">${kac(k.ot)}${k.otyz ? '<span class="yz" title="Yapay zekâ çevirisi">YZ çevirisi</span>' : ''}</span>` : ''}</div></div>` : ''}
            ${k.tanim ? `<div><h2 class="kucuk-bas">İngilizce tanım</h2><p class="tanim" lang="en">${enSar(k.tanim)}</p></div>` : ''}
            ${k.es && k.es.length ? `<div><h2 class="kucuk-bas">Eşanlamlar</h2><div class="esanlamlar" lang="en">${k.es.map(x => `<span class="es">${enSar(x)}</span>`).join('')}</div></div>` : ''}
          </section>` : ''}
          <section class="kutu"><label class="alan"><span>Kişisel not</span><textarea id="not" rows="3" maxlength="${SINIR.not}" placeholder="Kendinize hatırlatıcı…">${kac(m.not || '')}</textarea><small class="soluk" id="notDurum" aria-live="polite"></small></label></section>
        </div>
        <div class="izgara">
          <section class="kutu"><h2 class="kucuk-bas">İlerlemem</h2><div class="yon-ilerleme">${yon('et', 'EN → TR')}${yon('te', 'TR → EN')}</div></section>
          <section class="kutu"><div class="kutu-bas"><h2>Desteler</h2><button type="button" class="dg dg-k" id="deste">${ikon('deste', 'ikon-k')} Desteye ekle / çıkar</button></div>
            <div class="cip-grup">${desteAd.map(d => `<span class="etiket">${kac(d.ad)}</span>`).join('')}${kendiD.map(d => `<span class="etiket mor">${kac(d.ad)}</span>`).join('')}${!desteAd.length && !kendiD.length ? '<span class="soluk kucuk">Hiçbir destede değil</span>' : ''}</div></section>
          <section class="kutu" style="display:grid;gap:12px"><h2 class="kucuk-bas">Doğru sayılan ek yanıtlar</h2>
            ${kabul('kabulTr', 'Türkçe (EN → TR)', 'ör. bir başka karşılık')}${kabul('kabulEn', 'İngilizce (TR → EN)', 'ör. a synonym')}</section>
          <section class="kutu eylemler">
            <button type="button" class="dg dg-ana" id="calis">${ikon('oynat')} Bunu çalış</button>
            <button type="button" class="dg" id="zor" aria-pressed="${!!m.zor}">${ikon('bayrak')} ${m.zor ? 'Zor işaretli' : 'Zor olarak işaretle'}</button>
            <button type="button" class="dg" id="cikar">${m.cikar ? `${ikon('cevir')} Çalışmaya geri al` : `${ikon('sil')} Çalışmadan çıkar`}</button>
            <a class="dg" href="#/sozluk?q=${encodeURIComponent(k.en)}">${ikon('kitap')} Sözlükte aç</a>
          </section>
        </div>
      </div></div>`;
  };
  ciz();
  const notYaz = geciktir(v => { metaYaz(id, { not: v }); const d = main.querySelector('#notDurum'); if (d) d.textContent = 'Kaydedildi'; }, 500);
  main.addEventListener('input', e => { if (e.target.id === 'not') { notYaz(e.target.value); main.querySelector('#notDurum').textContent = ''; } });
  main.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.dataset.kabulGir) { e.preventDefault(); main.querySelector(`[data-kabul-ekle="${e.target.dataset.kabulGir}"]`).click(); }
  });
  main.addEventListener('click', async e => {
    const b = e.target.closest('button, a[aria-disabled]'); if (!b) return;
    if (b.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
    if (b.dataset.oku) return void oku(b.dataset.oku);
    if (b.id === 'geri') return geriGit('#/liste');
    if (b.id === 'zor') { metaYaz(id, { zor: !meta(id).zor }); return ciz(); }
    if (b.id === 'cikar') {
      const c = !meta(id).cikar; metaYaz(id, { cikar: c });
      bildir(c ? `"${k.en}" çalışmadan çıkarıldı.` : `"${k.en}" çalışmaya geri alındı.`, { eylem: { ad: 'Geri al', f: () => { metaYaz(id, { cikar: !c }); ciz(); } } });
      return ciz();
    }
    if (b.id === 'calis') return oturumKur({ ...S.ayar.kurulum, kaynak: 'hepsi', kip: S.ayar.kurulum.kip === 'bosluk' && !k.ob ? 'karisik' : S.ayar.kurulum.kip, boy: 0 }, [kelime(id)]);
    if (b.id === 'deste') { const r = await desteSec([id]); if (r) bildir(r, { tur: 'tamam' }); return ciz(); }
    if (b.dataset.kabulEkle) {
      const a = b.dataset.kabulEkle; const inp = main.querySelector(`[data-kabul-gir="${a}"]`);
      const v = inp.value.replace(/\s+/g, ' ').trim();
      if (!v) { inp.focus(); return; }
      kabulEkle(id, a, v.slice(0, SINIR.tr)); bildir('Eklendi: artık doğru sayılır.', { tur: 'tamam' }); ciz();
      main.querySelector(`[data-kabul-gir="${a}"]`).focus(); return;
    }
    if (b.dataset.kabulSil) {
      const a = b.dataset.kabulSil; const liste = [...(meta(id)[a] || [])]; const [x] = liste.splice(Number(b.dataset.i), 1);
      metaYaz(id, { [a]: liste });
      bildir(`"${x}" kaldırıldı.`, { eylem: { ad: 'Geri al', f: () => { kabulEkle(id, a, x); ciz(); } } });
      return ciz();
    }
    if (b.id === 'ozgun') { ozguneDon(id); bildir('Özgün karşılıklara dönüldü.', { tur: 'tamam' }); return ciz(); }
    if (b.id === 'duzelt') return duzeltPenceresi();
  });

  async function duzeltPenceresi() {
    const k = kelime(id);
    const g = document.createElement('div');
    g.innerHTML = `<label class="alan"><span>Türkçe karşılıklar (virgülle ayırın)</span><textarea id="dTr" rows="3" maxlength="600">${kac((k.tr || []).join(', '))}</textarea></label>
      ${k.oe ? `<label class="alan"><span>Örneğin Türkçesi</span><textarea id="dOt" rows="2" maxlength="${SINIR.ot}">${kac(k.ot || '')}</textarea></label>` : ''}
      <small class="hata-yazi" id="dHata" aria-live="polite"></small><p class="kucuk soluk">Düzeltme yalnız sizde geçerlidir; "Özgüne dön" ile geri alınır.</p>`;
    enterAnaDugme(g);
    const r = await pencere({ baslik: 'Karşılığı düzelt', govde: g, dugmeler: [{ ad: 'Vazgeç', deger: '' }, { ad: 'Kaydet', deger: 'e', sinif: 'dg-ana' }] });
    if (r !== 'e') return;
    const tr = [...new Set(g.querySelector('#dTr').value.split(/[,;\n]/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, SINIR.trAdet).map(x => x.slice(0, SINIR.tr));
    if (!tr.length) { bildir('En az bir karşılık gerekli; değişiklik kaydedilmedi.', { tur: 'hata' }); return; }
    const orj = k._orj || k;
    const d = { ...(meta(id).duzelt || {}) };
    if (tr.join('|') !== (orj.tr || []).join('|')) d.tr = tr; else delete d.tr;
    const ot = g.querySelector('#dOt');
    if (ot) { const v = ot.value.trim(); if (v !== (orj.ot || '')) { d.ot = v; d.otyz = 0; } else { delete d.ot; delete d.otyz; } }
    duzeltKaydet(id, d);
    bildir('Düzeltme kaydedildi.', { tur: 'tamam' });
    ciz();
  }
  return () => { notYaz.iptal(); const t = main.querySelector('#not'); if (t && t.value !== (meta(id).not || '')) metaYaz(id, { not: t.value }); };
}
