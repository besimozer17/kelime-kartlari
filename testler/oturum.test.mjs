import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kuyrukKur, oturumBaslat, yanitla, atla, bittiMi, ozet, sikUret, tohumlu } from '../site/js/oturum.js';

const K = Array.from({ length: 30 }, (_, i) => ({ id: 'w' + i + '|noun', en: 'w' + i, tr: ['t' + i], tur: 'noun', sv: 'B1', zor: (i % 5) + 1, zipf: 3, oe: i % 2 ? `I saw w${i} today.` : null, ob: i % 2 ? [6, 6 + String('w' + i).length] : null }));
const bos = () => null;

test('kuyruk boyu ve kip', () => {
  const q = kuyrukKur(K, { kip: 'et', sira: 'karisik', boy: 10, oran: 'dengeli' }, bos, 100, tohumlu(7));
  assert.equal(q.length, 10); assert.ok(q.every(x => x.yon === 'et' && x.kip === 'yaz'));
});
test('sınırsız = hepsi', () => assert.equal(kuyrukKur(K, { kip: 'te', boy: 0 }, bos, 100, tohumlu(1)).length, 30));
test('boşluk kipinde ob olmayan sorulmaz', () => {
  const q = kuyrukKur(K, { kip: 'bosluk', boy: 0 }, bos, 100, tohumlu(1));
  assert.equal(q.length, 15); assert.ok(q.every(x => x.kip === 'bosluk' && x.yon === 'te'));
});
test('kolaydan zora sıralı', () => {
  const q = kuyrukKur(K, { kip: 'et', sira: 'kolay', boy: 0 }, bos, 100);
  const z = q.map(x => K.find(k => k.id === x.id).zor);
  assert.deepEqual(z, [...z].sort((a, b) => a - b));
});
test('yanlış 3 kart sonra yeniden sorulur, doğru bilinene dek biter değil', () => {
  let o = oturumBaslat([{ id: 'a', yon: 'et', kip: 'yaz', t: 0 }, { id: 'b', yon: 'et', kip: 'yaz', t: 0 }], {});
  o = yanitla(o, 'yanlis');
  assert.deepEqual(o.sira.map(x => x.id), ['a', 'b', 'a']);
  o = yanitla(o, 'dogru'); assert.equal(bittiMi(o), false);
  o = yanitla(o, 'yanlis'); assert.equal(o.sira.length, 4);
  o = yanitla(o, 'dogru'); assert.equal(bittiMi(o), true);
  const s = ozet(o); assert.equal(s.toplam, 2); assert.equal(s.yanlis, 1); assert.equal(s.dogru, 1);
});
test('atla yeniden sorulmaları kaldırır', () => {
  let o = oturumBaslat([{ id: 'a', yon: 'et', kip: 'yaz', t: 0 }], {});
  o = yanitla(o, 'yanlis'); o = atla(o); assert.equal(bittiMi(o), true);
});
test('seçmeli: 4 şık, doğru dahil, tekrarsız', () => {
  const s = sikUret(K[0], K, tohumlu(3));
  assert.equal(s.length, 4); assert.ok(s.includes(K[0])); assert.equal(new Set(s.map(x => x.en)).size, 4);
});
