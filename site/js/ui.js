// Arayüz yardımcıları: simgeler, bildirim şeridi, onay penceresi, dosya indirme.
import { kac } from './metin.js';
export { kac };

const YOL = {
  ev: '<path d="M4 11l8-7 8 7v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  calis: '<rect x="3.5" y="6" width="13" height="14" rx="2.2"/><path d="M7.5 3.5h11a2 2 0 0 1 2 2v12"/><path d="M7 11.5l2.2 2.2L13.5 9.5"/>',
  liste: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
  kitap: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/>',
  grafik: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  ayar: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  arti: '<path d="M12 5v14M5 12h14"/>',
  ses: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  ara: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  kapat: '<path d="M6 6l12 12M18 6L6 18"/>',
  geri: '<path d="M15 5l-7 7 7 7"/>',
  ileri: '<path d="M9 5l7 7-7 7"/>',
  alev: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.2 3.5-8.3.4 1.6 1.3 2.6 2.4 3.2C11.6 6.6 13 4.2 15.6 3c-.6 2.8.4 4.6 1.6 6.3 1 1.4 1.8 2.9 1.8 5.3 0 3.7-3 6.4-7 6.4z"/>',
  yildiz: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  dogru: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  yanlis: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  yakin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16v.5"/>',
  ipucu: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
  cevir: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  sil: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  kalem: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  indir: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  yukle: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  bayrak: '<path d="M5 21V4M5 4.5h11l-2 4 2 4H5"/>',
  oynat: '<path d="M7 4.5v15l12-7.5z"/>',
  kup: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  saat: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  deste: '<rect x="4" y="8" width="13" height="12" rx="2"/><path d="M7 5h11a2 2 0 0 1 2 2v10"/>',
  bilgi: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>',
  tema: '<path d="M12 3a9 9 0 1 0 0 18z" fill="currentColor"/><circle cx="12" cy="12" r="9"/>',
  telefon: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  bulut: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.5 3.8 3.8 0 0 1-.4 7.5z"/>',
  daha: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  suzgec: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  sec: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12l3 3 5-6"/>',
  dosya: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  klavye: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8"/>',
};
export function ikon(ad, sinif = '') {
  return `<svg class="ikon ${sinif}" viewBox="0 0 24 24" aria-hidden="true">${YOL[ad] || ''}</svg>`;
}

/* ---------- tema: 'sistem' | 'acik' | 'koyu' */
export function temaUygula(t) {
  if (t === 'acik' || t === 'koyu') document.documentElement.dataset.tema = t;
  else delete document.documentElement.dataset.tema;
}

/** Uygulama içi geri: uygulamada gezinme geçmişi varsa history.back(), yoksa (derin bağlantı) yedek yola. */
export const gezinti = { n: 0 };
/** PWA yükleme istemi (beforeinstallprompt olayı; app.js doldurur). */
export const pwa = { istem: null };
export function geriGit(yedek = '#/ana') {
  if (gezinti.n > 0) { gezinti.n -= 2; history.back(); } else location.hash = yedek;
}

/** Hash yolu için güvenli kimlik (kimliklerde "|" ve boşluk var). */
export const yolKimlik = id => encodeURIComponent(id);

/** Pencere içindeki metin kutusunda Enter: başlıktaki "Kapat" yerine ana düğmeye bassın. */
export function enterAnaDugme(kap) {
  kap.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing || e.target.tagName !== 'INPUT') return;
    e.preventDefault();
    const d = kap.closest('dialog'); const b = d && d.querySelector('.pencere-alt .dg-ana');
    if (b) b.click();
  });
}

/* ---------- bildirim şeridi (geri al düğmeli) */
export function bildir(mesaj, { tur = '', eylem = null, sure = 3800 } = {}) {
  const kap = document.getElementById('bildirimler');
  if (!kap) return;
  const el = document.createElement('div');
  el.className = 'bildirim ' + tur;
  el.innerHTML = `<span>${kac(mesaj)}</span>`;
  if (eylem) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'dg dg-k dg-bildirim'; b.textContent = eylem.ad;
    b.onclick = () => { eylem.f(); el.remove(); };
    el.append(b);
  }
  kap.append(el);
  setTimeout(() => { el.classList.add('cikis'); setTimeout(() => el.remove(), 260); }, eylem ? Math.max(sure, 6000) : sure);
}

/* ---------- pencere (dialog) */
export function pencere({ baslik, govde, dugmeler = [], genis = false }) {
  return new Promise(ok => {
    const d = document.createElement('dialog');
    d.className = 'pencere' + (genis ? ' genis' : '');
    d.innerHTML = `<form method="dialog" class="pencere-ic">
      <header class="pencere-bas"><h2>${kac(baslik)}</h2><button class="dg dg-ikon dg-hayalet" value="" aria-label="Kapat">${ikon('kapat')}</button></header>
      <div class="pencere-govde"></div>
      <footer class="pencere-alt">${dugmeler.map(b => `<button class="dg ${b.sinif || ''}" value="${kac(b.deger)}">${kac(b.ad)}</button>`).join('')}</footer>
    </form>`;
    const g = d.querySelector('.pencere-govde');
    if (typeof govde === 'string') g.innerHTML = govde; else if (govde) g.append(govde);
    document.body.append(d);
    d.addEventListener('close', () => { ok(d.returnValue); d.remove(); });
    d.addEventListener('click', e => { if (e.target === d) d.close(''); });
    d.showModal();
    const ilk = d.querySelector('.pencere-alt .dg-ana') || d.querySelector('.pencere-alt .dg');
    if (ilk && !g.querySelector('input,textarea,select')) ilk.focus();
  });
}
export async function onay(mesaj, { baslik = 'Emin misiniz?', tamam = 'Tamam', tehlike = false } = {}) {
  const r = await pencere({ baslik, govde: `<p>${kac(mesaj)}</p>`, dugmeler: [{ ad: 'Vazgeç', deger: 'h' }, { ad: tamam, deger: 'e', sinif: tehlike ? 'dg-tehlike-dolu' : 'dg-ana' }] });
  return r === 'e';
}

/* ---------- dosya */
export async function dosyaKaydet(ad, metin, tip = 'application/json') {
  const blob = new Blob([metin], { type: tip });
  // telefonda paylaşım sayfası (Dosyalar'a kaydet / AirDrop / Drive) daha kullanışlı
  try {
    const dosya = new File([blob], ad, { type: tip });
    if (navigator.canShare && navigator.canShare({ files: [dosya] }) && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ files: [dosya], title: ad });
      return 'paylasildi';
    }
  } catch (e) { if (e && e.name === 'AbortError') return 'iptal'; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = ad;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'indirildi';
}
export function dosyaSec(kabul = '.json,application/json') {
  return new Promise(ok => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = kabul;
    i.onchange = () => ok(i.files[0] || null);
    i.click();
  });
}

/* ---------- biçim */
export const sayi = n => Number(n || 0).toLocaleString('tr-TR');
export function sureYaz(sn) {
  sn = Math.round(sn);
  if (sn < 60) return sn + ' sn';
  const d = Math.floor(sn / 60), s = sn % 60;
  if (d < 60) return d + ' dk' + (s ? ' ' + s + ' sn' : '');
  return Math.floor(d / 60) + ' sa ' + (d % 60) + ' dk';
}
export function boyutYaz(b) {
  if (b == null) return '?';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace('.', ',') + ' MB';
}

/** Gecikmeli çağrı. */
export function geciktir(f, ms) {
  let t; const g = (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); };
  g.iptal = () => clearTimeout(t);
  return g;
}

/** Yazı alanı mı (kısayolları engellemek için)? */
export const yaziAlani = el => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
