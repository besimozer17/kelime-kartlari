// node --test kelime-kartlari/testler/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { denetleTr, denetleEn, denetleBosluk, enAnahtar, enKanonik, trKatli, boslukluCumle } from '../site/js/denetim.js';
import { trKucuk, temizle, uzaklik, iskelet, harfSayisi, aksansiz, parcala } from '../site/js/metin.js';

const git = { tr: ['gitmek', 'yola çıkmak'], tur: 'verb' };
const bak = { tr: ['bakmak (bir şeye)', 'ilgilenmek'], tur: 'verb' };
const yardim = { tr: ['yardım etmek'], tur: 'verb' };
const kaymak = { tr: ['kaymak'], tur: 'noun' };
const sorumluluk = { tr: ['sorumluluk'], tur: 'noun' };
const gelistirmek = { tr: ['geliştirmek'], tur: 'verb' };
const sonuc = { tr: ['sonuç'], tur: 'noun' };
const sevinc = { tr: ['ışık'], tur: 'noun' };
const digerTr = new Set(['kaybetmek', 'sonuc', 'kalem', 'kale', 'sorumlu', 'gelistirme'].map(trKatli));

const TR_TABLO = [
  // [açıklama, yanıt, kart, beklenen sonuç, not?, tolerans?]
  ['tam eşleşme', 'gitmek', git, 'dogru', 'tam'],
  ['büyük harf + boşluk', '  GİTMEK  ', git, 'dogru', 'tam'],
  ['Türkçe I → ı', 'IŞIK', sevinc, 'dogru', 'tam'],
  ['ikinci karşılık', 'yola çıkmak', git, 'dogru', 'tam'],
  ['çoklu boşluk + noktalama', 'yola   çıkmak!', git, 'dogru', 'tam'],
  ['-mek eksik', 'git', git, 'dogru', 'mek'],
  ['-mak eksik öbekte', 'yola çık', git, 'dogru', 'mek'],
  ['-mek fazla', 'gitmek', { tr: ['git'], tur: 'verb' }, 'dogru', 'mek'],
  ['isimde -mak atılmaz', 'kay', kaymak, 'yanlis'],
  ['parantez isteğe bağlı (yok)', 'bakmak', bak, 'dogru', 'tam'],
  ['parantez isteğe bağlı (var)', 'bakmak bir şeye', bak, 'dogru', 'tam'],
  ['ASCII yazım ş/ı', 'isik', sevinc, 'dogru', 'ascii'],
  ['ASCII yazım ç', 'yola cikmak', git, 'dogru', 'ascii'],
  ['ASCII + -mek', 'yola cik', git, 'dogru', 'ascii'],
  ['yardımcı fiil farkı', 'yardım yapmak', yardim, 'neredeyse', 'yardimci'],
  ['yardımcı fiil olmak', 'yardım olmak', yardim, 'neredeyse', 'yardimci'],
  ['yazım hatası 1 (uzunluk ≥5)', 'sorumlulk', sorumluluk, 'neredeyse', 'yazim'],
  ['yazım hatası yer değiştirme', 'sorumlulku', sorumluluk, 'neredeyse', 'yazim'],
  ['uzunluk 4 → tolerans yok', 'kalm', { tr: ['kalp'], tur: 'noun' }, 'yanlis'],
  ['uzunluk ≥9 → 2 hata', 'gelistrmk', gelistirmek, 'neredeyse', 'yazim'],
  ['uzunluk ≥9 → 3 hata yanlış', 'glistrmk', gelistirmek, 'yanlis'],
  ['5 harfte 2 hata yanlış', 'sanuk', sonuc, 'yanlis'],
  ['uzaklık 1 ama başka kartın karşılığı', 'kale', { tr: ['kalem'], tur: 'noun' }, 'yanlis', 'baska'],
  ['uzaklık 1 ama başka kelime (sorumlu)', 'sorumlu', { tr: ['sorumluk'], tur: 'noun' }, 'yanlis', 'baska'],
  ['çoklu yanıt virgül', 'koşmak, gitmek', git, 'dogru', 'tam'],
  ['çoklu yanıt noktalı virgül', 'koşmak; yola çıkmak', git, 'dogru', 'tam'],
  ['çoklu yanıt eğik çizgi', 'uçmak / git', git, 'dogru', 'mek'],
  ['çoklu yanıt hiçbiri', 'koşmak, uçmak', git, 'yanlis'],
  ['boş', '', git, 'bos'],
  ['yalnız boşluk', '    ', git, 'bos'],
  ['yalnız noktalama', '...', git, 'bos'],
  ['çok uzun girdi', 'a'.repeat(5000), git, 'yanlis'],
  ['kesme işaretleri', "Türkiye’ye", { tr: ["Türkiye'ye"], tur: 'noun' }, 'dogru', 'tam'],
  ['kullanıcının kabul ettiği', 'seyahat etmek', { ...git, kabulTr: ['seyahat etmek'] }, 'dogru', 'tam'],
  ['sıkı tolerans yazım hatası', 'sorumlulk', sorumluluk, 'yanlis', null, 'siki'],
  ['sıkı tolerans ASCII yine doğru', 'sonuc', sonuc, 'dogru', 'ascii', 'siki'],
  ['hoşgörülü 4 harf 1 hata', 'kalm', { tr: ['kalp'], tur: 'noun' }, 'neredeyse', 'yazim', 'hosgorulu'],
];

for (const [ad, yanit, kart, beklenen, not, tolerans] of TR_TABLO) {
  test(`EN→TR: ${ad}`, () => {
    const r = denetleTr(yanit, kart, { tolerans: tolerans || 'normal', digerTr });
    assert.equal(r.sonuc, beklenen, JSON.stringify(r));
    if (not) assert.equal(r.not, not, JSON.stringify(r));
  });
}

test('EN→TR: ASCII yanıtta doğru yazım gösterilir', () => {
  const r = denetleTr('isik', sevinc, {});
  assert.equal(r.yazim, 'ışık');
});

const colour = { en: 'colour', tr: ['renk'] };
const lookAfter = { en: 'look after', tr: ['bakmak', 'ilgilenmek'], es: ['take care of'] };
const big = { en: 'big', tr: ['büyük'], es: ['large'] };
const huge = { en: 'enormous', tr: ['kocaman', 'devasa'] };
const enKume = new Set(['color', 'look after', 'big', 'large', 'enormous', 'huge', 'bag', 'beg', 'environment', 'realize', 'center', 'travel', 'accommodate', 'fulfill'].map(w => enAnahtar(w)));
const trdenEn = t => ({ büyük: ['big', 'large', 'great'], kocaman: ['huge', 'enormous'], bakmak: ['look', 'look after', 'watch'] }[t] || []);
const bEn = { tolerans: 'normal', enKume, trdenEn };

const EN_TABLO = [
  ['tam', 'colour', colour, 'dogru'],
  ['Amerikan yazımı -or', 'color', colour, 'dogru'],
  ['büyük harf', 'COLOR', colour, 'dogru'],
  ['-ize / -ise', 'realise', { en: 'realize', tr: ['fark etmek'] }, 'dogru'],
  ['-ise beklenen, -ize yazıldı', 'organize', { en: 'organise', tr: ['düzenlemek'] }, 'dogru'],
  ['-yse / -yze', 'analyze', { en: 'analyse', tr: ['çözümlemek'] }, 'dogru'],
  ['-re / -er', 'center', { en: 'centre', tr: ['merkez'] }, 'dogru'],
  ['theatre / theater', 'theater', { en: 'theatre', tr: ['tiyatro'] }, 'dogru'],
  ['-ll- / -l-', 'traveled', { en: 'travelled', tr: ['seyahat etti'] }, 'dogru'],
  ['fulfil / fulfill', 'fulfill', { en: 'fulfil', tr: ['yerine getirmek'] }, 'dogru'],
  ['favourite / favorite', 'favorite', { en: 'favourite', tr: ['en sevilen'] }, 'dogru'],
  ['jewellery / jewelry', 'jewelry', { en: 'jewellery', tr: ['mücevher'] }, 'dogru'],
  ['four ≠ for', 'for', { en: 'four', tr: ['dört'] }, 'yanlis'],
  ['advise -ize olmaz (ama aynı anahtar)', 'advise', { en: 'advise', tr: ['öğüt vermek'] }, 'dogru'],
  ['acre korunur', 'acer', { en: 'acre', tr: ['dönüm'] }, 'yanlis'],
  ['"to" öneki', 'to look after', lookAfter, 'dogru'],
  ['"a" öneki', 'a big', big, 'dogru'],
  ['"the" öneki', 'the colour', colour, 'dogru'],
  ['öbek tam eşleşme gerekir', 'look', lookAfter, 'esanlam'],
  ['öbekte yer tutucu', 'look after sb', lookAfter, 'dogru'],
  ['eşanlam (es listesi)', 'large', big, 'esanlam'],
  ['eşanlam (aynı TR karşılığı)', 'huge', huge, 'esanlam'],
  ['yazım hatası (≥5)', 'enormus', huge, 'neredeyse'],
  ['yazım hatası (≥9) 2 hata', 'enviroment', { en: 'environment', tr: ['çevre'] }, 'neredeyse'],
  ['3 harfte yazım hatası yok', 'bog', big, 'yanlis'],
  ['uzaklık 1 ama başka kelime', 'beg', { en: 'bag', tr: ['çanta'] }, 'yanlis'],
  ['çoklu yanıt', 'huge, enormous', huge, 'dogru'],
  ['boş', '', big, 'bos'],
  ['yalnız boşluk', '   ', big, 'bos'],
  ['çok uzun', 'x'.repeat(10000), big, 'yanlis'],
  ['kabul edilen', 'massive', { ...huge, kabulEn: ['massive'] }, 'dogru'],
  ['tire = boşluk', 'well-known', { en: 'well known', tr: ['tanınmış'] }, 'dogru'],
];

for (const [ad, yanit, kart, beklenen] of EN_TABLO) {
  test(`TR→EN: ${ad}`, () => {
    const r = denetleEn(yanit, kart, bEn);
    assert.equal(r.sonuc, beklenen, JSON.stringify(r));
  });
}

test('TR→EN: eşanlamda beklenen kelime döner', () => {
  const r = denetleEn('large', big, bEn);
  assert.equal(r.eslesen, 'big');
});

const bosluk = { en: 'go', oe: 'She went to school early.', ob: [4, 8] };
test('boşluk: çekimli biçim doğru', () => assert.equal(denetleBosluk('went', bosluk).sonuc, 'dogru'));
test('boşluk: kök biçim de doğru (not: kok)', () => {
  const r = denetleBosluk('go', bosluk);
  assert.equal(r.sonuc, 'dogru'); assert.equal(r.not, 'kok'); assert.equal(r.yazim, 'went');
});
test('boşluk: yanlış', () => assert.equal(denetleBosluk('come', bosluk).sonuc, 'yanlis'));
test('boşluk: boş', () => assert.equal(denetleBosluk(' ', bosluk).sonuc, 'bos'));
test('boşluk: cümle', () => assert.equal(boslukluCumle(bosluk.oe, bosluk.ob), 'She _____ to school early.'));
test('boşluk: yazım hatası', () => assert.equal(denetleBosluk('accomodated', { en: 'accommodate', oe: 'They accommodated us.', ob: [5, 17] }).sonuc, 'neredeyse'));

test('metin: trKucuk', () => { assert.equal(trKucuk('IĞDIR İLİ'), 'ığdır ili'); });
test('metin: temizle', () => { assert.equal(temizle('  “Merhaba,”   DÜNYA! '), 'merhaba dünya'); });
test('metin: aksansız arama', () => { assert.equal(aksansiz('Işık Çiçek'), aksansiz('isik cicek')); });
test('metin: uzaklık', () => {
  assert.equal(uzaklik('kitap', 'kitap'), 0); assert.equal(uzaklik('kitap', 'ktiap'), 1);
  assert.equal(uzaklik('kitap', 'kitaplar'), 3); assert.equal(uzaklik('abc', 'xyz', 1), 2);
});
test('metin: iskelet', () => { assert.equal(iskelet('cat'), 'c _ _'); assert.equal(iskelet('look after'), 'l _ _ _   _ _ _ _ _'); });
test('metin: harf sayısı', () => { assert.equal(harfSayisi('look after'), '4 + 5'); assert.equal(harfSayisi('colour'), '6'); });
test('metin: parcala', () => { assert.deepEqual(parcala('a, b; c / d'), ['a', 'b', 'c', 'd']); });
test('enKanonik örnekleri', () => {
  assert.equal(enKanonik('behaviour'), 'behavior');
  assert.equal(enKanonik('hour'), 'hour');
  assert.equal(enKanonik('organisation'), 'organization');
  assert.equal(enKanonik('exercise'), 'exercise');
  assert.equal(enKanonik('metre'), 'meter');
  assert.equal(enKanonik('genre'), 'genre');
});
