// Puanlama — saf modül. Birim testleri: testler/puan.test.mjs

export const PUAN = { dogru: 10, neredeyse: 6, secmeli: 5, ipucu: 2, enAz: 2, cevir: { kolay: 6, dogru: 5, neredeyse: 3, zor: 3 } };

/**
 * Tek kartın puanı.
 * @param {{sonuc:string, kip:string, ipucu?:number, seri?:number}} p  seri: bu yanıttan ÖNCEKİ art arda doğru sayısı
 */
export function kartPuani({ sonuc, kip, ipucu = 0, seri = 0 }) {
  if (!['dogru', 'neredeyse', 'kolay', 'zor', 'esanlam'].includes(sonuc)) return 0;
  let taban;
  if (kip === 'cevir') taban = PUAN.cevir[sonuc] ?? 0;
  else if (kip === 'secmeli') taban = sonuc === 'dogru' ? PUAN.secmeli : 0;
  else taban = sonuc === 'neredeyse' ? PUAN.neredeyse : PUAN.dogru;
  if (!taban) return 0;
  taban = Math.max(PUAN.enAz, taban - PUAN.ipucu * ipucu);
  return Math.round(taban * seriCarpani(seri));
}

/** Art arda doğru serisi çarpanı: her doğru +%5, en çok ×1,5. */
export function seriCarpani(seri) {
  return 1 + Math.min(Math.max(seri, 0), 10) * 0.05;
}

/** Seviye L için gereken toplam XP: 50·(L−1)·L → 0, 100, 300, 600, 1000 … */
export function seviyeEsigi(L) { return 50 * (L - 1) * L; }

export function seviyeBilgisi(xp) {
  xp = Math.max(0, xp | 0);
  let L = 1;
  while (seviyeEsigi(L + 1) <= xp) L++;
  const alt = seviyeEsigi(L), ust = seviyeEsigi(L + 1);
  return { seviye: L, xp, alt, ust, oran: (xp - alt) / (ust - alt) };
}

/**
 * Günlük seri (streak): hedefe ulaşılan günler.
 * @param {number[]} gunler  etkinlik olan gün numaraları (sırasız olabilir)
 * @param {number} bugun
 * @returns {{simdi:number, enUzun:number}}  bugün henüz çalışılmadıysa dünkü seri sürer
 */
export function gunSerisi(gunler, bugun) {
  const k = [...new Set(gunler)].sort((a, b) => a - b);
  let enUzun = 0, uzun = 0, onceki = null;
  for (const g of k) {
    uzun = onceki != null && g === onceki + 1 ? uzun + 1 : 1;
    enUzun = Math.max(enUzun, uzun);
    onceki = g;
  }
  const kume = new Set(k);
  let bas = kume.has(bugun) ? bugun : bugun - 1;
  // saat geri alınmışsa (son etkinlik bugünden ileride) seriyi sıfırlama
  const son = k[k.length - 1];
  if (son != null && son > bugun) bas = son;
  let simdi = 0;
  while (kume.has(bas - simdi)) simdi++;
  return { simdi, enUzun };
}
