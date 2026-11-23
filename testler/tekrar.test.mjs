import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guncelle, oturumIciDogru, vadeli, durum, zorlandi, ARALIKLAR, gunTarih, tarihGun, gunNo } from '../site/js/tekrar.js';
import { kartPuani, seviyeBilgisi, gunSerisi, seriCarpani } from '../site/js/puan.js';

const G = 20000;

test('aralıklar 0/1/3/7/16/35', () => assert.deepEqual(ARALIKLAR, [0, 1, 3, 7, 16, 35]));

test('doğru dizisi kutuları ilerletir', () => {
  let k = null; const vadeler = [];
  for (let i = 0; i < 7; i++) { k = guncelle(k, 'dogru', G); vadeler.push(k.vade - G); }
  assert.deepEqual(vadeler, [1, 3, 7, 16, 35, 35, 35]);
  assert.equal(k.kutu, 5); assert.equal(k.dogru, 7); assert.equal(k.seri, 7);
});

const TABLO = [
  // [başlangıç kutusu, sonuç, beklenen kutu, beklenen aralık]
  [0, 'yanlis', 0, 0], [2, 'yanlis', 0, 0], [3, 'yanlis', 1, 1], [5, 'yanlis', 1, 1],
  [0, 'neredeyse', 0, 1], [3, 'neredeyse', 3, 7], [2, 'zor', 2, 3],
  [1, 'dogru', 2, 3], [4, 'kolay', 5, 35], [0, 'kolay', 2, 3],
];
for (const [kutu, sonuc, bk, ba] of TABLO) {
  test(`kutu ${kutu} + ${sonuc} → kutu ${bk}, +${ba} gün`, () => {
    const k = guncelle({ kutu, vade: G, son: G - 5, ilk: G - 30, dogru: 3, yanlis: 1, neredeyse: 0, seri: 2, gecmis: [] }, sonuc, G);
    assert.equal(k.kutu, bk); assert.equal(k.vade - G, ba);
  });
}

test('yanlış seriyi sıfırlar, sayaç artar, geçmiş tutulur', () => {
  const k = guncelle(guncelle(null, 'dogru', G), 'yanlis', G + 1);
  assert.equal(k.seri, 0); assert.equal(k.yanlis, 1); assert.deepEqual(k.gecmis, [[G, 'D'], [G + 1, 'Y']]);
});
test('geçmiş en çok 30', () => {
  let k = null; for (let i = 0; i < 40; i++) k = guncelle(k, 'dogru', G + i);
  assert.equal(k.gecmis.length, 30);
});
test('girdi değiştirilmez (saf)', () => {
  const k0 = guncelle(null, 'dogru', G); const kopya = JSON.stringify(k0);
  guncelle(k0, 'yanlis', G); assert.equal(JSON.stringify(k0), kopya);
});
test('saat geri alınması çökmez', () => {
  const k = guncelle(guncelle(null, 'dogru', G + 10), 'dogru', G);
  assert.equal(k.son, G); assert.ok(Number.isFinite(k.vade));
});
test('bilinmeyen sonuç hata verir', () => assert.throws(() => guncelle(null, 'harika', G)));
test('oturum içi doğru: vade yarına', () => {
  const k = guncelle(null, 'yanlis', G);
  assert.equal(oturumIciDogru(k, G).vade, G + 1); assert.equal(oturumIciDogru(k, G).kutu, 0);
});
test('vadeli', () => {
  assert.equal(vadeli(null, G), false);
  assert.equal(vadeli(guncelle(null, 'yanlis', G), G), true);
  assert.equal(vadeli(guncelle(null, 'dogru', G), G), false);
  assert.equal(vadeli(guncelle(null, 'dogru', G), G + 1), true);
});
test('durumlar', () => {
  assert.equal(durum(null), 'yeni');
  assert.equal(durum({ kutu: 0, son: G }), 'ogreniliyor');
  assert.equal(durum({ kutu: 1, son: G }), 'ogreniliyor');
  assert.equal(durum({ kutu: 3, son: G }), 'pekisiyor');
  assert.equal(durum({ kutu: 4, son: G }), 'ogrenildi');
});
test('zorlandıklarım', () => {
  assert.equal(zorlandi(null), false); assert.equal(zorlandi(null, true), true);
  assert.equal(zorlandi({ sonSonuc: 'yanlis', yanlis: 1, kutu: 0 }), true);
  assert.equal(zorlandi({ sonSonuc: 'dogru', yanlis: 3, kutu: 2 }), true);
  assert.equal(zorlandi({ sonSonuc: 'dogru', yanlis: 3, kutu: 4 }), false);
  assert.equal(zorlandi({ sonSonuc: 'dogru', yanlis: 1, kutu: 1 }), false);
});
test('gün ↔ tarih', () => {
  assert.equal(gunTarih(tarihGun('2026-11-23')), '2026-11-23');
  assert.ok(Math.abs(gunNo() - tarihGun(new Date().toISOString().slice(0, 10))) <= 1);
});

// ---- puan
const PUAN_TABLO = [
  [{ sonuc: 'dogru', kip: 'yaz' }, 10], [{ sonuc: 'neredeyse', kip: 'yaz' }, 6],
  [{ sonuc: 'yanlis', kip: 'yaz' }, 0], [{ sonuc: 'bos', kip: 'yaz' }, 0],
  [{ sonuc: 'dogru', kip: 'yaz', ipucu: 2 }, 6], [{ sonuc: 'dogru', kip: 'yaz', ipucu: 9 }, 2],
  [{ sonuc: 'neredeyse', kip: 'yaz', ipucu: 3 }, 2], [{ sonuc: 'dogru', kip: 'secmeli' }, 5],
  [{ sonuc: 'yanlis', kip: 'secmeli' }, 0], [{ sonuc: 'kolay', kip: 'cevir' }, 6],
  [{ sonuc: 'zor', kip: 'cevir' }, 3], [{ sonuc: 'dogru', kip: 'yaz', seri: 4 }, 12],
  [{ sonuc: 'dogru', kip: 'yaz', seri: 50 }, 15], [{ sonuc: 'esanlam', kip: 'yaz' }, 10],
];
for (const [g, b] of PUAN_TABLO) test(`puan ${JSON.stringify(g)} = ${b}`, () => assert.equal(kartPuani(g), b));
test('seri çarpanı sınırları', () => { assert.equal(seriCarpani(-3), 1); assert.equal(seriCarpani(10), 1.5); });
test('seviye', () => {
  assert.equal(seviyeBilgisi(0).seviye, 1); assert.equal(seviyeBilgisi(99).seviye, 1);
  assert.equal(seviyeBilgisi(100).seviye, 2); assert.equal(seviyeBilgisi(300).seviye, 3);
  assert.equal(seviyeBilgisi(200).oran, 0.5);
});
test('günlük seri', () => {
  assert.deepEqual(gunSerisi([], G), { simdi: 0, enUzun: 0 });
  assert.deepEqual(gunSerisi([G - 2, G - 1, G], G), { simdi: 3, enUzun: 3 });
  assert.deepEqual(gunSerisi([G - 2, G - 1], G), { simdi: 2, enUzun: 2 }); // bugün henüz çalışılmadı
  assert.deepEqual(gunSerisi([G - 5, G - 4, G - 3, G - 1], G), { simdi: 1, enUzun: 3 });
  assert.deepEqual(gunSerisi([G - 3], G), { simdi: 0, enUzun: 1 });
  assert.equal(gunSerisi([G, G + 1, G + 2], G).simdi, 3); // saat geri alındı
});
