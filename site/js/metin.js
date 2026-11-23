// Metin yardımcıları — saf, DOM'suz (Node birim testleriyle de çalışır).

const AZAMI = 300; // çok uzun girdiyi kırp (düzenleme uzaklığı O(n·m))

/** Türkçe yerel küçük harf: I→ı, İ→i. */
export function trKucuk(s) {
  return String(s ?? '').replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
}

/** İngilizce küçük harf (I→i). 'İ' gelirse i'ye indir. */
export function enKucuk(s) {
  return String(s ?? '').replace(/İ/g, 'i').toLowerCase();
}

const ASCII = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u', é: 'e', è: 'e', ê: 'e', á: 'a', à: 'a', ï: 'i', ë: 'e', ô: 'o' };
/** Türkçe harfleri ASCII karşılığına indir (ş→s, ı→i …). Girdi küçük harf olmalı. */
export function asciiKatla(s) {
  return String(s).replace(/[çğıöşüâîûéèêáàïëô]/g, c => ASCII[c]);
}

/** Arama için: küçük harf + aksansız (EN ve TR ortak; "Işık" = "isik" = "ışık"). */
export function aksansiz(s) {
  return trKucuk(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
}

const KESME = /['’‘‚‛ʼʻ`´′]/g;
const NOKTALAMA = /[.,!?;:"“”„«»‹›…·•*_~+=<>|\\/()[\]{}¿¡#%^&@$€₺\-–—―]/g;

/** Karşılaştırma için temizle: küçük harf, kesme at, noktalama → boşluk, boşlukları sadeleştir. */
export function temizle(s, dil = 'tr') {
  let t = String(s ?? '').slice(0, AZAMI).normalize('NFC');
  t = dil === 'tr' ? trKucuk(t) : enKucuk(t);
  t = t.normalize('NFKC').replace(/̇/g, ''); // "i̇" birleşik noktası
  t = t.replace(KESME, '').replace(NOKTALAMA, ' ').replace(/\s+/g, ' ').trim();
  return t;
}

/** Parantez / köşeli parantez içini at ("bakmak (bir şeye)" → "bakmak"). */
export function parantezsiz(s) {
  return String(s ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}
/** Parantez işaretlerini at, içini bırak ("bakmak (bir şeye)" → "bakmak bir şeye"). */
export function parantezli(s) {
  return String(s ?? '').replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Kullanıcı yanıtını birden çok karşılığa böl ("git, yürü; ilerle / devam et"). */
export function parcala(s) {
  return String(s ?? '').slice(0, AZAMI).split(/[,;/|\n]+/).map(x => x.trim()).filter(Boolean);
}

/**
 * Damerau–Levenshtein (bitişik yer değiştirme dahil, OSA) — `sinir` aşılınca sinir+1 döner.
 */
export function uzaklik(a, b, sinir = Infinity) {
  a = String(a); b = String(b);
  if (a === b) return 0;
  const n = a.length, m = b.length;
  if (Math.abs(n - m) > sinir) return sinir + 1;
  if (!n) return m; if (!m) return n;
  let onceki2 = null, onceki = new Array(m + 1), simdi = new Array(m + 1);
  for (let j = 0; j <= m; j++) onceki[j] = j;
  for (let i = 1; i <= n; i++) {
    simdi[0] = i;
    let satirEnAz = simdi[0];
    for (let j = 1; j <= m; j++) {
      const bedel = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(onceki[j] + 1, simdi[j - 1] + 1, onceki[j - 1] + bedel);
      if (onceki2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, onceki2[j - 2] + 1);
      simdi[j] = v;
      if (v < satirEnAz) satirEnAz = v;
    }
    if (satirEnAz > sinir) return sinir + 1;
    onceki2 = onceki.slice(); [onceki, simdi] = [simdi, onceki];
  }
  return onceki[m];
}

/** Kod noktası sırasıyla karşılaştırma (sözlük dosyalarının sıralaması). */
export function kodSira(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

/** Sıralı dizide alt sınır (ilk >= x). `al` ögeden anahtarı çıkarır. */
export function altSinir(dizi, x, al = v => v) {
  let lo = 0, hi = dizi.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (al(dizi[mid]) < x) lo = mid + 1; else hi = mid; }
  return lo;
}

/** HTML kaçışı. */
export function kac(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Kelimenin iskeleti: "c _ _ _ _" (boşluk ve tire korunur, ilk `acik` harf açık). */
export function iskelet(kelime, acik = 1) {
  let say = 0;
  return [...String(kelime)].map(c => {
    if (/[\s'-]/.test(c)) return c === ' ' ? '  ' : c;
    say++;
    return say <= acik ? c : '_';
  }).join(' ').replace(/ {3,}/g, '   ');
}

/** Harf sayısı (boşluk / tire hariç); öbekte "4 + 5" biçimi. */
export function harfSayisi(kelime) {
  const p = String(kelime).trim().split(/\s+/).map(w => [...w.replace(/[^\p{L}\p{N}]/gu, '')].length).filter(Boolean);
  return p.length > 1 ? p.join(' + ') : String(p[0] || 0);
}
