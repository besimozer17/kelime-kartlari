// Açılış, yönlendirici (#/…), tema, kabuk.
import { S, yukle, vadeliSayisi, bugunku, xp, durumAl, hataDinle } from './veri.js';
import { bilgi as depoBilgi } from './depo.js';
import { seviyeBilgisi, gunSerisi } from './puan.js';
import { tarihGun, gunNo } from './tekrar.js';
import { kurulumEkrani, oturumEkrani, oturumKur } from './ekran/calis.js';
import { listeEkrani } from './ekran/liste.js';
import { kelimeEkrani } from './ekran/kelime.js';
import { kartEkrani, topluEkrani, destelerEkrani } from './ekran/kart.js';
import { istatistikEkrani } from './ekran/istatistik.js';
import { ayarlarEkrani } from './ekran/ayarlar.js';
import { sozlukEkrani } from './ekran/sozluk.js';
import { balonKur } from './balon.js';
import { ikon, kac, bildir, temaUygula as temaKoy, gezinti, pwa } from './ui.js';

// Yükleme istemi erkenden yakalanır (Android Chrome / masaüstü); Ayarlar'daki "Yükle" düğmesi kullanır.
addEventListener('beforeinstallprompt', e => { e.preventDefault(); pwa.istem = e; dispatchEvent(new Event('kk-yukle')); });
addEventListener('appinstalled', () => { pwa.istem = null; dispatchEvent(new Event('kk-yukle')); bildir('Uygulama yüklendi.', { tur: 'tamam' }); });

const main = document.getElementById('ana');
let temizlik = null;

/* ---------- tema */
export function temaUygula(t = S.ayar.tema) { temaKoy(t); }

/* ---------- ekranlar */

function anaEkran(m) {
  const seri = gunSerisi([...S.gunluk.values()].filter(x => x.kart > 0).map(x => tarihGun(x.gun)), gunNo()).simdi;
  const g = bugunku(), hedef = S.ayar.hedef || 20, vade = vadeliSayisi();
  const oran = Math.min(1, (g.kart || 0) / hedef), C = 2 * Math.PI * 44;
  const sv = seviyeBilgisi(xp());
  const aktif = durumAl('aktifOturum');
  const veriUyari = S.veriDurum === 'tamam' ? '' : `<div class="uyari-kutu" style="margin-bottom:14px">${ikon('bilgi')}<div>${S.veriDurum === 'yok' ? 'Kelime verisi bulunamadı (veri/kelimeler.json).' : 'Kelime verisi okunamadı: ' + kac(S.veriHata || '')} Kendi kartlarınızla çalışabilirsiniz.</div></div>`;
  m.innerHTML = `<div class="ekran">
    <div class="ekran-bas"><h1>Bugün<span class="alt">${S.tumu.length.toLocaleString('tr-TR')} kelime · seviye ${sv.seviye}</span></h1><a class="dg dg-ikon dg-hayalet" href="#/ayarlar" aria-label="Ayarlar">${ikon('ayar')}</a></div>
    ${veriUyari}
    <section class="kutu bugun">
      <div class="bugun-ust">
        <div class="halka"><svg viewBox="0 0 104 104"><circle class="arka" cx="52" cy="52" r="44"/><circle class="on" cx="52" cy="52" r="44" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - oran)}"/></svg><div class="halka-yazi"><strong>${g.kart || 0}</strong><span>/ ${hedef} kart</span></div></div>
        <div class="bugun-bilgi"><h2>${oran >= 1 ? 'Günlük hedef tamam' : 'Günlük hedef'}</h2>
          <div class="bugun-sayilar"><span>${ikon('saat')} ${vade} tekrar zamanı</span><span>${ikon('yildiz')} ${g.puan || 0} puan</span>${seri ? `<span>${ikon('alev', 'alev')} ${seri} gün seri</span>` : ''}</div></div>
      </div>
      <button type="button" class="dg dg-devam" id="devam">${aktif && aktif.sira ? 'Oturuma devam et' : vade ? 'Tekrarları çalış' : 'Devam et'} <small>${aktif && aktif.sira ? `${aktif.i}/${aktif.sira.length}` : ''}</small></button>
    </section>
    <h2 class="bolum-bas">Hızlı başlat</h2>
    <div class="hizli">
      <button type="button" class="hizli-kutu" data-hizli="yeni">${ikon('oynat')}<b>Yeni kelimeler</b><small>20 kart, EN → TR</small></button>
      <button type="button" class="hizli-kutu mercan" data-hizli="zor">${ikon('bayrak')}<b>Zorlandıklarım</b><small>yanlış yaptıklarınız</small></button>
      <button type="button" class="hizli-kutu yesil" data-hizli="te">${ikon('cevir')}<b>TR → EN</b><small>İngilizcesini yaz</small></button>
      <a class="hizli-kutu mor" href="#/calis">${ikon('ayar')}<b>Özel oturum</b><small>seviye, deste, kip seç</small></a>
    </div>
    <div class="hizli hizli-2" style="margin-top:10px">
      <a class="hizli-kutu" href="#/kart/yeni">${ikon('arti')}<b>Kart ekle</b><small>kendi kelimeniz</small></a>
      <a class="hizli-kutu yesil" href="#/liste">${ikon('liste')}<b>Kelimeler</b><small>A1 … C2, ara, süz</small></a>
    </div>
    <div class="kutu" style="margin-top:14px"><div class="seviye-cubuk"><b>Seviye ${sv.seviye}</b><div class="ilerleme"><i style="width:${Math.round(sv.oran * 100)}%"></i></div><span class="soluk">${sv.xp} / ${sv.ust} XP</span></div></div>
  </div>`;
  m.querySelector('#devam').onclick = () => {
    if (aktif && aktif.sira) { location.hash = '#/oturum'; return; }
    oturumKur(vade ? { ...S.ayar.kurulum, kaynak: 'vade' } : S.ayar.kurulum);
  };
  m.querySelectorAll('[data-hizli]').forEach(b => b.onclick = () => {
    const h = b.dataset.hizli, k = S.ayar.kurulum;
    if (h === 'yeni') oturumKur({ ...k, kaynak: 'hepsi', kip: 'et', boy: 20, oran: 'yeni', sv: [], zor: [], deste: '' });
    if (h === 'zor') oturumKur({ ...k, kaynak: 'zor', kip: 'karisik', boy: 20, sv: [], zor: [], deste: '' });
    if (h === 'te') oturumKur({ ...k, kaynak: 'hepsi', kip: 'te', boy: 20, sv: [], zor: [], deste: '' });
  });
}

const EKRANLAR = {
  ana: anaEkran,
  calis: kurulumEkrani,
  oturum: oturumEkrani,
  liste: listeEkrani,
  kelime: kelimeEkrani,
  kart: kartEkrani,
  toplu: topluEkrani,
  desteler: destelerEkrani,
  sozluk: sozlukEkrani,
  istatistik: istatistikEkrani,
  ayarlar: ayarlarEkrani,
};
const SEKME = { oturum: 'calis', kelime: 'liste', kart: 'liste', toplu: 'liste', desteler: 'liste' };
const BASLIK = { ana: 'Bugün', calis: 'Çalış', oturum: 'Çalışma', liste: 'Kelimeler', kelime: 'Kelime', kart: 'Kart', toplu: 'Toplu ekle', desteler: 'Desteler', sozluk: 'Sözlük', istatistik: 'İlerleme', ayarlar: 'Ayarlar' };

let ilkYol = true;
function yonlendir() {
  const ham = location.hash.replace(/^#\/?/, '') || 'ana';
  const [yol, sorgu = ''] = ham.split('?');
  const parca = yol.split('/');
  let ad = parca[0];
  if (!EKRANLAR[ad]) { // bilinmeyen yol → ana (geçmişe yeni kayıt eklemeden)
    ad = 'ana'; parca.splice(0, parca.length, 'ana');
    if (location.hash && location.hash !== '#/ana') history.replaceState(null, '', '#/ana');
  }
  if (!ilkYol) gezinti.n++;
  ilkYol = false;
  const ekran = EKRANLAR[ad];
  if (typeof temizlik === 'function') { try { temizlik(); } catch (e) { console.warn(e); } }
  temizlik = null;
  document.body.classList.remove('odak');
  document.querySelectorAll('dialog.pencere[open]').forEach(d => d.close(''));
  const eski = document.getElementById('ana');
  const yeni = eski.cloneNode(false); // eski dinleyicileri bırak
  eski.replaceWith(yeni);
  if (ad !== 'oturum') window.scrollTo(0, 0);
  try { temizlik = ekran(yeni, parca, new URLSearchParams(sorgu)) || null; }
  catch (e) {
    console.error(e);
    yeni.innerHTML = `<div class="ekran ekran-dar"><div class="kutu bos-durum">${ikon('bilgi')}<h2>Bu ekran açılamadı</h2><p>${kac(e && e.message || e)}</p><div class="satir"><a class="dg dg-ana" href="#/ana">Ana ekran</a></div></div></div>`;
  }
  const sekme = SEKME[ad] || ad;
  document.querySelectorAll('.ray a[data-sekme]').forEach(a => { if (a.dataset.sekme === sekme) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.title = (ad === 'ana' ? '' : (BASLIK[ad] || '') + ' · ') + 'Kelime Kartı';
  const vr = document.getElementById('vadeRozet'); const n = vadeliSayisi();
  vr.hidden = !n; vr.textContent = n > 99 ? '99+' : n;
  vr.setAttribute('aria-label', `${n} tekrar zamanı`);
  // klavye / ekran okuyucu: içerik değişti → odak ana alana (oturum kendi odağını yönetir)
  if (ad !== 'oturum' && document.activeElement && document.activeElement !== document.body && !yeni.contains(document.activeElement)) yeni.focus({ preventScroll: true });
}

/* ---------- çevrimdışı şeridi */
function agSeridi() {
  let s = document.getElementById('agSerit');
  if (navigator.onLine) { if (s) s.remove(); return; }
  if (s) return;
  s = document.createElement('div'); s.className = 'serit uyari'; s.id = 'agSerit'; s.setAttribute('role', 'status');
  s.innerHTML = `${ikon('bulut')}<span class="yayil">Çevrimdışısınız. Kartlar ve indirilen sözlük çalışır.</span>`;
  document.getElementById('seritler').append(s);
}

/* ---------- açılış */
async function basla() {
  temaUygula();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => temaUygula());
  hataDinle(() => bildir('Veri kaydedilemedi (depolama dolu ya da kapalı olabilir).', { tur: 'hata' }));
  await yukle();
  if (depoBilgi.bellekte) {
    const s = document.createElement('div'); s.className = 'serit uyari';
    s.innerHTML = `<span class="yayil">Bu tarayıcı veriyi kalıcı saklamıyor (özel sekme olabilir). İlerleme sekme kapanınca kaybolur.</span>`;
    document.getElementById('seritler').append(s);
  }
  addEventListener('hashchange', yonlendir);
  addEventListener('online', agSeridi); addEventListener('offline', agSeridi); agSeridi();
  try { balonKur(); } catch (e) { console.warn('Baloncuk kurulamadı', e); }
  // sanal klavye açıkken alt çubuğu gizle
  if (window.visualViewport) {
    const vv = window.visualViewport;
    vv.addEventListener('resize', () => document.body.classList.toggle('klavye-acik', window.innerHeight - vv.height > 150));
  }
  yonlendir();
  swKaydet();
}

/* ---------- service worker (yalnız http/https; Electron app:// ve file://'de yok) */
function swKaydet() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const seritGoster = kayit => {
    if (document.getElementById('surumSerit')) return;
    const s = document.createElement('div'); s.className = 'serit'; s.id = 'surumSerit';
    s.innerHTML = '<span class="yayil">Yeni sürüm hazır.</span><button type="button" class="dg dg-k dg-ana">Yenile</button>';
    s.querySelector('button').onclick = () => kayit.waiting && kayit.waiting.postMessage({ tip: 'atla' });
    document.getElementById('seritler').append(s);
  };
  // İlk kurulumda clients.claim() da controllerchange doğurur; o zaman yenilemeye gerek yok.
  const oncedenDenetleyici = !!navigator.serviceWorker.controller;
  let yenilendi = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (oncedenDenetleyici && !yenilendi) { yenilendi = true; location.reload(); } });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(kayit => {
    if (kayit.waiting && navigator.serviceWorker.controller) seritGoster(kayit);
    kayit.addEventListener('updatefound', () => {
      const y = kayit.installing;
      y && y.addEventListener('statechange', () => { if (y.state === 'installed' && navigator.serviceWorker.controller) seritGoster(kayit); });
    });
  }).catch(e => console.warn('SW kaydı olmadı', e));
}
basla().catch(e => {
  console.error(e);
  document.getElementById('ana').innerHTML = `<div class="ekran"><div class="kutu bos-durum"><h2>Açılamadı</h2><p>${kac(e && e.message || e)}</p></div></div>`;
});
