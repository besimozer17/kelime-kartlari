// Aralıklı tekrar — saf, belirlenimci Leitner (6 kutu). Birim testleri: testler/tekrar.test.mjs
// Kayıt: { kutu, vade, son, ilk, dogru, yanlis, neredeyse, seri, sonSonuc, gecmis:[[gun, kod]] }
//   vade/son/ilk: yerel gün numarası (gunNo). Her kelime + yön (et: EN→TR, te: TR→EN) ayrı kayıt.

export const ARALIKLAR = [0, 1, 3, 7, 16, 35];
export const SON_KUTU = ARALIKLAR.length - 1;
const GECMIS_AZAMI = 30;
const KOD = { dogru: 'D', kolay: 'K', neredeyse: 'N', zor: 'Z', yanlis: 'Y' };

/** Yerel takvim günü numarası (saat dilimine göre gece yarısında değişir). */
export function gunNo(t = Date.now()) {
  const d = new Date(t);
  return Math.floor((t - d.getTimezoneOffset() * 60000) / 86400000);
}
/** Gün numarasından "YYYY-AA-GG". */
export function gunTarih(gun) {
  return new Date(gun * 86400000).toISOString().slice(0, 10);
}
/** "YYYY-AA-GG" → gün numarası. */
export function tarihGun(s) {
  return Math.floor(Date.parse(s + 'T00:00:00Z') / 86400000);
}

export function yeniKayit(gun) {
  return { kutu: 0, vade: gun, son: null, ilk: gun, dogru: 0, yanlis: 0, neredeyse: 0, seri: 0, sonSonuc: null, gecmis: [] };
}

/**
 * Yanıttan sonra kaydı güncelle (yeni nesne döner).
 * @param {object|null} kayit
 * @param {'dogru'|'kolay'|'neredeyse'|'zor'|'yanlis'} sonuc
 * @param {number} gun  bugünün gün numarası (saat geri alınmışsa bile çökmez)
 */
export function guncelle(kayit, sonuc, gun) {
  const k = { ...(kayit || yeniKayit(gun)) };
  k.gecmis = [...(k.gecmis || []), [gun, KOD[sonuc] || '?']].slice(-GECMIS_AZAMI);
  let kutu = k.kutu | 0;
  switch (sonuc) {
    case 'kolay': kutu = Math.min(SON_KUTU, kutu + 2); k.dogru++; k.seri++; break;
    case 'dogru': kutu = Math.min(SON_KUTU, kutu + 1); k.dogru++; k.seri++; break;
    case 'neredeyse': case 'zor': k.neredeyse++; break; // aynı kutu
    case 'yanlis': kutu = kutu >= 3 ? 1 : 0; k.yanlis++; k.seri = 0; break;
    default: throw new Error('Bilinmeyen sonuç: ' + sonuc);
  }
  k.kutu = kutu;
  const aralik = sonuc === 'neredeyse' || sonuc === 'zor' ? Math.max(1, ARALIKLAR[kutu]) : ARALIKLAR[kutu];
  k.vade = gun + aralik;
  k.son = gun;
  k.sonSonuc = sonuc;
  return k;
}

/** Aynı oturumda yanlıştan sonra doğru bilindi: kutu değişmez, ertesi güne kalır. */
export function oturumIciDogru(kayit, gun) {
  if (!kayit) return kayit;
  return kayit.vade <= gun ? { ...kayit, vade: gun + 1 } : kayit;
}

/** Tekrar zamanı geldi mi? */
export function vadeli(kayit, gun) {
  return !!kayit && kayit.son != null && kayit.vade <= gun;
}

/** yeni · ogreniliyor · pekisiyor · ogrenildi */
export function durum(kayit) {
  if (!kayit || kayit.son == null) return 'yeni';
  if (kayit.kutu >= 4) return 'ogrenildi';
  if (kayit.kutu >= 2) return 'pekisiyor';
  return 'ogreniliyor';
}
export const DURUM_AD = { yeni: 'Yeni', ogreniliyor: 'Öğreniliyor', pekisiyor: 'Pekişiyor', ogrenildi: 'Öğrenildi' };

/** "Zorlandıklarım": elle işaretli · son yanıt yanlış · çok yanlış yapılmış ve henüz oturmamış. */
export function zorlandi(kayit, elle = false) {
  if (elle) return true;
  if (!kayit) return false;
  if (kayit.sonSonuc === 'yanlis') return true;
  return kayit.yanlis >= 3 && kayit.kutu < 4;
}

/** Tekrar sırası: en çok geciken, sonra düşük kutu önce. */
export function oncelik(kayit, gun) {
  return (gun - kayit.vade) * 10 + (SON_KUTU - kayit.kutu);
}
