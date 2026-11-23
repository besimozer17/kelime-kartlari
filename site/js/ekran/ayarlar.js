// Ayarlar (#/ayarlar): görünüm, çalışma, ses, sözlük indirme, yedek / geri yükle / sıfırla, depolama, kurulum, sürüm, kaynaklar.
import { S, ayarKaydet, yedekAl, yedekDogrula, geriYukle, sifirla, jsonGetir, UYGULAMA_SURUM } from '../veri.js';
import { bilgi as depoBilgi } from '../depo.js';
import { KIPLER } from '../oturum.js';
import { oku, aksanlar } from '../ses.js';
import { indirmeDurumu, tumunuIndir, indirileniSil } from '../sozluk.js';
import { ikon, kac, bildir, pencere, onay, dosyaKaydet, dosyaSec, boyutYaz, sayi, temaUygula, pwa } from '../ui.js';

const bolumlu = (ad, liste, deger) => `<div class="bolumlu" data-ayar="${ad}" role="radiogroup">${liste.map(([v, a]) => `<button type="button" role="radio" data-v="${v}" aria-pressed="${String(deger) === String(v)}" aria-checked="${String(deger) === String(v)}">${a}</button>`).join('')}</div>`;
export const kuruluMu = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const iosMu = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const webMi = () => /^https?:$/.test(location.protocol);

export function ayarlarEkrani(main) {
  let indirIptal = null;
  const ciz = () => {
    const a = S.ayar, k = a.kurulum;
    const ak = aksanlar();
    main.innerHTML = `<div class="ekran ekran-dar ayarlar">
    <div class="ekran-bas"><h1>Ayarlar</h1></div>
    <h2 class="bolum-bas">Görünüm</h2>
    <section class="kutu"><div class="ayar-satir sar"><div class="yayil"><b>Tema</b><small>Sistem: telefonun açık / koyu ayarını izler</small></div>${bolumlu('tema', [['sistem', 'Sistem'], ['acik', 'Açık'], ['koyu', 'Koyu']], a.tema)}</div></section>
    <h2 class="bolum-bas">Çalışma</h2>
    <section class="kutu">
      <div class="ayar-satir sar"><div class="yayil"><b>Günlük hedef</b><small>Ana ekrandaki halka (kart)</small></div>${bolumlu('hedef', [[10, '10'], [20, '20'], [30, '30'], [50, '50'], [100, '100']], a.hedef)}</div>
      <div class="ayar-satir sar"><div class="yayil"><b>Yazım toleransı</b><small>Küçük yazım hatalarında "neredeyse doğru" sayma payı</small></div>${bolumlu('tolerans', [['siki', 'Sıkı'], ['normal', 'Normal'], ['hosgorulu', 'Hoşgörülü']], a.tolerans)}</div>
      <div class="ayar-satir sar"><div class="yayil"><b>Oturum uzunluğu</b><small>Varsayılan kart sayısı</small></div>${bolumlu('boy', [[10, '10'], [20, '20'], [50, '50'], [0, 'Sınırsız']], k.boy)}</div>
      <div class="ayar-satir sar"><div class="yayil"><b>Varsayılan kip</b></div><select data-ayar-sec="kip" aria-label="Varsayılan kip">${KIPLER.map(x => `<option value="${x.kod}" ${x.kod === k.kip ? 'selected' : ''}>${x.ad}</option>`).join('')}</select></div>
    </section>
    <div class="ses-dg"><h2 class="bolum-bas">Ses</h2>
    <section class="kutu">
      <div class="ayar-satir"><div class="yayil"><b>Otomatik seslendirme</b><small>İngilizce kelime sorulunca ve yanıttan sonra okunur</small></div><label class="anahtar"><input type="checkbox" data-ayar-anahtar="otoOku" ${a.otoOku ? 'checked' : ''} aria-label="Otomatik seslendirme"><i></i></label></div>
      <div class="ayar-satir sar"><div class="yayil"><b>Konuşma hızı</b><small id="hizYaz">${String(a.hiz).replace('.', ',')}×</small></div><input type="range" min="0.6" max="1.4" step="0.1" value="${a.hiz}" data-ayar-aralik="hiz" aria-label="Konuşma hızı" style="max-width:220px"></div>
      ${ak.us || ak.gb ? `<div class="ayar-satir sar"><div class="yayil"><b>Aksan</b>${!(ak.us && ak.gb) ? '<small>Bu cihazda yalnız bir aksan var</small>' : ''}</div>${bolumlu('aksan', [['en-US', 'ABD'], ['en-GB', 'İngiliz']], a.aksan)}</div>` : ''}
      <div class="ayar-satir"><div class="yayil"><b>Dene</b></div><button type="button" class="dg dg-k" id="sesDene">${ikon('ses', 'ikon-k')} "Pronunciation"</button></div>
    </section></div>
    <h2 class="bolum-bas">Sözlük</h2>
    <section class="kutu indirme" id="sozlukBolum"><p class="soluk">Durum okunuyor…</p></section>
    <h2 class="bolum-bas">Veri</h2>
    <section class="kutu">
      <div class="ayar-satir"><div class="yayil"><b>Yedek al</b><small>İlerleme, kendi kartları, desteler, notlar ve ayarlar (JSON)</small></div><button type="button" class="dg dg-k" id="yedekAl">${ikon('indir', 'ikon-k')} Yedek al</button></div>
      <div class="ayar-satir"><div class="yayil"><b>Geri yükle</b><small>Yedek dosyasından birleştir ya da üstüne yaz</small></div><button type="button" class="dg dg-k" id="geriYukle">${ikon('yukle', 'ikon-k')} Geri yükle</button></div>
      <div class="ayar-satir"><div class="yayil"><b>İlerlemeyi sıfırla</b><small>Kendi kartları, desteler ve notlar kalır</small></div><button type="button" class="dg dg-k dg-tehlike" id="sifirla">Sıfırla</button></div>
      <div class="ayar-satir"><div class="yayil"><b>Her şeyi sil</b><small>Kendi kartları ve desteler dahil bütün kullanıcı verisi</small></div><button type="button" class="dg dg-k dg-tehlike" id="hepsiniSil">${ikon('sil', 'ikon-k')} Sil</button></div>
      <div class="ayar-satir"><div class="yayil"><b>Depolama</b><small id="depolama">hesaplanıyor…</small></div></div>
    </section>
    <div id="yukleBolum"></div>
    <h2 class="bolum-bas">Hakkında</h2>
    <section class="kutu">
      <div class="ayar-satir"><div class="yayil"><b>Sürüm</b><small id="surum">Uygulama ${UYGULAMA_SURUM} · kelime verisi ${kac(S.surum || '—')}</small></div></div>
      <details id="kaynaklar"><summary class="ayar-satir" style="cursor:pointer"><span class="yayil"><b>Kaynaklar ve lisanslar</b><small>Sözlük, örnek cümle ve seviye verisinin kaynakları</small></span></summary><div class="kaynak-liste" id="kaynakListe"><p class="soluk">Yükleniyor…</p></div></details>
    </section></div>`;
    sozlukCiz(); depolamaYaz(); yukleCiz();
  };

  /* ---------- sözlük indirme */
  async function sozlukCiz(ilerleme = null) {
    const kap = main.querySelector('#sozlukBolum'); if (!kap) return;
    let d = { inen: 0, toplam: 0, bayt: 0 };
    try { d = (await indirmeDurumu()) || d; } catch { /* taslak */ }
    if (ilerleme) d = { ...d, ...ilerleme };
    const tamam = d.yerel || (d.toplam && d.inen >= d.toplam);
    const boyut = d.toplamBayt ? boyutYaz(d.toplamBayt) : '~107 MB';
    const oran = d.toplam ? Math.round((d.inen / d.toplam) * 100) : 0;
    kap.innerHTML = `<div class="ayar-satir" style="border:0;padding:0"><div class="yayil"><b>Sözlüğün tamamını çevrimdışı indir</b><small>${d.yerel ? 'Sözlük uygulamanın içinde; indirme gerekmez.' : tamam ? 'Bütün sözlük bu cihazda; internet olmadan da çalışır.' : d.hata ? 'Sözlük dizini okunamadı (bağlantı gerekli olabilir).' : `Temel sözlük kullandıkça iner. Tamamı ${boyut}; Wi-Fi önerilir.`}</small></div></div>
      ${d.toplam ? `<div class="ilerleme" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${oran}" aria-label="Sözlük indirme"><i style="width:${oran}%"></i></div><small class="soluk">${sayi(d.inen)} / ${sayi(d.toplam)} parça${d.bayt ? ' · ' + boyutYaz(d.bayt) : ''}</small>` : ''}
      <div class="satir">${indirIptal ? `<button type="button" class="dg dg-k" id="indirDur">${ikon('kapat', 'ikon-k')} İptal</button>` : tamam ? '' : `<button type="button" class="dg dg-k dg-ana" id="indirBasla" ${navigator.onLine ? '' : 'disabled'}>${ikon('indir', 'ikon-k')} ${d.inen ? 'İndirmeyi sürdür' : 'Tamamını indir'}</button>`}
        ${d.inen && !indirIptal && !d.yerel ? `<button type="button" class="dg dg-k dg-tehlike" id="indirSil">${ikon('sil', 'ikon-k')} İndirileni sil</button>` : ''}${!navigator.onLine && !tamam ? '<small class="soluk">İndirmek için bağlantı gerekli.</small>' : ''}</div>`;
  }
  async function indir() {
    const ac = new AbortController(); indirIptal = ac;
    sozlukCiz();
    try {
      await tumunuIndir((a, b, c) => {
        const x = typeof a === 'object' && a ? a : { inen: a, toplam: b, bayt: c };
        if (main.isConnected) sozlukCiz(x);
      }, { iptal: ac.signal });
      if (!ac.signal.aborted) bildir('Sözlük indirildi.', { tur: 'tamam' });
    } catch (e) {
      if (!ac.signal.aborted && e?.name !== 'AbortError') {
        const ileti = e?.kota ? 'Depolama alanı yetmiyor: cihazda yer açın ya da indirileni silin. İnen parçalar korunur.'
          : e?.ag ? 'Bağlantı koptu; indirme durdu. Bağlanınca "İndirmeyi sürdür" ile kaldığı yerden devam eder.'
          : 'İndirme yarıda kaldı: ' + (e?.message || e);
        bildir(ileti, { tur: 'hata', sure: 7000 });
      } else if (ac.signal.aborted) bildir('İndirme durduruldu; inen parçalar korunur.');
    } finally { indirIptal = null; if (main.isConnected) sozlukCiz(); }
  }

  /* ---------- depolama */
  async function depolamaYaz() {
    const el = main.querySelector('#depolama'); if (!el) return;
    let s = '';
    try { if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); s = `${boyutYaz(e.usage)} kullanılıyor${e.quota ? ' · ' + boyutYaz(e.quota) + ' sınır' : ''}`; } } catch { /* */ }
    s += depoBilgi.bellekte ? (s ? ' · ' : '') + 'Kalıcı depo yok: veriler sekme kapanınca silinir' : depoBilgi.persist ? (s ? ' · ' : '') + 'kalıcı (tarayıcı silmez)' : '';
    el.textContent = s || 'bilinmiyor';
  }

  /* ---------- uygulamayı yükle */
  function yukleCiz() {
    const kap = main.querySelector('#yukleBolum'); if (!kap) return;
    if (!webMi() || kuruluMu()) { kap.innerHTML = ''; return; }
    const ios = iosMu();
    kap.innerHTML = `<h2 class="bolum-bas">Uygulamayı yükle</h2><section class="kutu" style="display:grid;gap:10px">
      <div class="satir">${ikon('telefon')}<div class="yayil"><b>Ana ekrana ekleyin</b><div class="kucuk soluk">Uygulama gibi tam ekran açılır, internetsiz çalışır.</div></div>
      ${pwa.istem ? `<button type="button" class="dg dg-ana" id="yukle">${ikon('indir', 'ikon-k')} Yükle</button>` : ''}</div>
      ${ios ? `<ol class="adimlar"><li>Safari'de alttaki <b>Paylaş</b> düğmesine dokunun (kare ve yukarı ok).</li><li><b>Ana Ekrana Ekle</b>'yi seçin.</li><li>Sağ üstte <b>Ekle</b>'ye dokunun.</li></ol>`
        : !pwa.istem ? `<ol class="adimlar"><li>Android Chrome: sağ üstteki <b>⋮</b> menüsünden <b>Uygulamayı yükle</b> ya da <b>Ana ekrana ekle</b>.</li><li>Bilgisayarda Chrome / Edge / Brave: adres çubuğundaki <b>yükle</b> simgesi.</li></ol>` : ''}</section>`;
  }

  /* ---------- olaylar */
  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const bol = b.closest('[data-ayar]');
    if (bol) {
      const ad = bol.dataset.ayar; let v = b.dataset.v;
      if (ad === 'hedef' || ad === 'boy') v = Number(v);
      bol.querySelectorAll('button').forEach(x => { x.setAttribute('aria-pressed', x === b); x.setAttribute('aria-checked', x === b); });
      if (ad === 'boy') ayarKaydet({ boy: v, kurulum: { ...S.ayar.kurulum, boy: v } });
      else ayarKaydet({ [ad]: v });
      if (ad === 'tema') temaUygula(v);
      return;
    }
    if (b.id === 'sesDene') return void oku('Pronunciation');
    if (b.id === 'indirBasla') return indir();
    if (b.id === 'indirDur') { indirIptal?.abort(); return; }
    if (b.id === 'indirSil') {
      if (!await onay('İndirilen sözlük parçaları bu cihazdan silinsin mi? Gerekince yeniden iner.', { tamam: 'Sil', tehlike: true })) return;
      try { await indirileniSil(); bildir('İndirilen sözlük silindi.'); } catch (x) { bildir('Silinemedi: ' + (x?.message || x), { tur: 'hata' }); }
      return sozlukCiz();
    }
    if (b.id === 'yukle' && pwa.istem) {
      const ist = pwa.istem; pwa.istem = null;
      try { await ist.prompt(); const r = await ist.userChoice; if (r?.outcome === 'accepted') bildir('Uygulama yükleniyor.', { tur: 'tamam' }); } catch { /* */ }
      return yukleCiz();
    }
    if (b.id === 'yedekAl') {
      try {
        const y = await yedekAl();
        const ad = `kelime-karti-yedek-${new Date().toISOString().slice(0, 10)}.json`;
        const r = await dosyaKaydet(ad, JSON.stringify(y), 'application/json');
        if (r !== 'iptal') bildir(`Yedek ${r === 'paylasildi' ? 'paylaşıldı' : 'indirildi'}: ${sayi(y.ilerleme.length)} ilerleme kaydı, ${sayi(y.ozel.length)} kendi kartı.`, { tur: 'tamam' });
      } catch (x) { bildir('Yedek alınamadı: ' + (x?.message || x), { tur: 'hata' }); }
      return;
    }
    if (b.id === 'geriYukle') return geriYukleAkis();
    if (b.id === 'sifirla' || b.id === 'hepsiniSil') {
      const hepsi = b.id === 'hepsiniSil';
      const m1 = hepsi ? 'Bütün ilerleme, kendi kartlarınız, desteleriniz, notlarınız silinecek. Önce yedek almanızı öneririz.' : 'Bütün ilerleme, günlük kayıtlar, puan ve XP silinecek. Kendi kartlarınız, desteleriniz ve notlarınız kalır.';
      if (!await onay(m1, { baslik: hepsi ? 'Her şeyi sil' : 'İlerlemeyi sıfırla', tamam: 'Devam', tehlike: true })) return;
      if (!await onay('Bu işlem geri alınamaz. Emin misiniz?', { baslik: 'Son onay', tamam: hepsi ? 'Evet, her şeyi sil' : 'Evet, sıfırla', tehlike: true })) return;
      await sifirla(hepsi);
      bildir(hepsi ? 'Bütün veriler silindi.' : 'İlerleme sıfırlandı.', { tur: 'tamam' });
      return ciz();
    }
  });
  main.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.ayarSec === 'kip') ayarKaydet({ kurulum: { ...S.ayar.kurulum, kip: t.value } });
    if (t.dataset.ayarAnahtar) ayarKaydet({ [t.dataset.ayarAnahtar]: t.checked });
    if (t.dataset.ayarAralik) ayarKaydet({ [t.dataset.ayarAralik]: Number(t.value) });
  });
  main.addEventListener('input', e => { if (e.target.dataset.ayarAralik === 'hiz') main.querySelector('#hizYaz').textContent = String(e.target.value).replace('.', ',') + '×'; });
  main.addEventListener('toggle', async e => {
    if (e.target.id !== 'kaynaklar' || !e.target.open || e.target.dataset.yuklendi) return;
    e.target.dataset.yuklendi = '1';
    const kap = main.querySelector('#kaynakListe');
    try {
      const l = await jsonGetir('./veri/kaynaklar.json');
      kap.innerHTML = (Array.isArray(l) ? l : []).map(x => `<div><b>${kac(x.ad)}</b>${x.lisans ? `<span class="soluk">Lisans: ${kac(x.lisans)}</span><br>` : ''}${x.kullanim ? `<span>${kac(x.kullanim)}</span><br>` : ''}${x.adres ? `<a href="${kac(x.adres)}" target="_blank" rel="noopener noreferrer">${kac(x.adres)}</a>` : ''}</div>`).join('') || '<p class="soluk">Kaynak listesi boş.</p>';
    } catch { kap.innerHTML = '<p class="soluk">Kaynak listesi okunamadı (çevrimdışı olabilir).</p>'; }
  }, true);

  async function geriYukleAkis() {
    const f = await dosyaSec('.json,application/json');
    if (!f) return;
    let o, oz;
    try {
      if (f.size > 50 * 1048576) throw new Error('Dosya çok büyük; bir yedek dosyası olmayabilir.');
      try { o = JSON.parse(await f.text()); } catch { throw new Error('Dosya okunamadı: geçerli bir JSON değil (bozuk olabilir).'); }
      oz = yedekDogrula(o);
    } catch (x) { bildir(x.message || String(x), { tur: 'hata', sure: 6000 }); return; }
    const g = document.createElement('div');
    g.innerHTML = `<p>${oz.tarih ? `<b>${new Date(oz.tarih).toLocaleString('tr-TR')}</b> tarihli yedek: ` : ''}${sayi(oz.ilerleme)} ilerleme kaydı, ${sayi(oz.ozel)} kendi kartı, ${sayi(oz.desteler)} deste, ${sayi(oz.gunluk)} günlük kayıt.</p>
      <div class="secim-liste"><label><input type="radio" name="kip" value="birlestir" checked><span><b>Birleştir</b><br><small class="soluk">Bu cihazdaki veri kalır; her kelimede daha yeni olan kazanır.</small></span></label>
      <label><input type="radio" name="kip" value="ustune"><span><b>Üstüne yaz</b><br><small class="soluk">Bu cihazdaki bütün veri silinir, yerine yedek konur.</small></span></label></div>`;
    const r = await pencere({ baslik: 'Yedeği geri yükle', govde: g, dugmeler: [{ ad: 'Vazgeç', deger: '' }, { ad: 'Geri yükle', deger: 'e', sinif: 'dg-ana' }] });
    if (r !== 'e') return;
    const kip = g.querySelector('input[name=kip]:checked').value;
    if (kip === 'ustune' && !await onay('Bu cihazdaki bütün veri silinip yedekle değiştirilecek.', { tamam: 'Üstüne yaz', tehlike: true })) return;
    try {
      const s = await geriYukle(o, kip);
      temaUygula(S.ayar.tema);
      bildir(`Geri yüklendi: ${sayi(s.ilerleme)} ilerleme, ${sayi(s.ozel)} kart, ${sayi(s.desteler)} deste.`, { tur: 'tamam' });
    } catch (x) { bildir('Geri yüklenemedi: ' + (x?.message || x), { tur: 'hata' }); }
    ciz();
  }

  const yukleDegisti = () => main.isConnected && yukleCiz();
  const agDegisti = () => main.isConnected && !indirIptal && sozlukCiz();
  addEventListener('kk-yukle', yukleDegisti);
  addEventListener('online', agDegisti); addEventListener('offline', agDegisti);
  ciz();
  return () => { removeEventListener('kk-yukle', yukleDegisti); removeEventListener('online', agDegisti); removeEventListener('offline', agDegisti); };
}
