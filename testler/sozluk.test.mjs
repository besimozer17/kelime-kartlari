// Sözlük motoru + enSar birim testleri. Koşum (Makale kökünden): node --test "kelime-kartlari/testler/*.test.mjs"
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ses.js tarayıcıda html.sessiz sınıfı koyar; Node'da küçük bir belge kalıbı yeter
globalThis.document ??= { documentElement: { classList: { add() {}, toggle() {} } } };

const KOK = path.dirname(fileURLToPath(import.meta.url));
const VERI = path.join(KOK, '..', 'site', 'veri', 'sozluk');
const motor = await import('../site/js/sozluk_motor.js');
const { enSar, gizliKume } = await import('../site/js/balon.js');
const { maddeBirlestir } = await import('../site/js/sozluk.js');

let yuklemeMs = 0;
before(async () => {
  motor.getirAyarla(async ad => JSON.parse(await readFile(path.join(VERI, ad), 'utf8')));
  const t = performance.now();
  await motor.istek('cekirdek');
  await motor.istek('tr');
  yuklemeMs = Math.round(performance.now() - t);
  // küçük bir deste (gerçek kelimeler.json'dan seçmek yerine sabit: test bağımsız kalsın)
  motor.kelimelerKur([
    ['house', 'noun', ['ev', 'konut'], 'house|noun', 'A1', 0],
    ['son', 'noun', ['oğul'], 'son|noun', 'A1', 0],
    ['receive', 'verb', ['almak'], 'receive|verb', 'A2', 0],
    ['run', 'verb', ['koşmak'], 'run|verb', 'A1', 0],
    ['take off', 'phrasal', ['havalanmak', 'çıkarmak'], 'take off|phrasal', 'B1', 0],
  ]);
});

test('ölçüm: çekirdek + tr_en yükleme (Node)', () => { assert.ok(yuklemeMs > 0); console.log(`  çekirdek+tr_en okuma+ayrıştırma+dizin: ${yuklemeMs} ms`); });

test('enAnah / parcaAdi / trAnah', () => {
  assert.equal(motor.enAnah('  Café  au  Lait '), 'cafe au lait');
  assert.equal(motor.enAnah('don’t'), "don't");
  assert.equal(motor.parcaAdi('café'), 'ca');
  assert.equal(motor.parcaAdi('a'), 'a_');
  assert.equal(motor.parcaAdi('İstanbul'), 'is');
  assert.equal(motor.parcaAdi("'tis"), '_t');
  assert.equal(motor.parcaAdi('3D'), '3d');
  assert.equal(motor.trAnah('IŞIK'), 'isik');
  assert.equal(motor.trAnah('İstanbul'), 'istanbul');
});

test('kök bulma: biçim haritası + düzensizler + kurallar', () => {
  assert.deepEqual(motor.kokler('running').slice(0, 1), ['run']);
  assert.ok(motor.kokler('children').includes('child'));
  const b = motor.kokler('better');
  assert.ok(b.includes('good') && b.includes('well'), b.join());
  assert.equal(motor.kokler('went')[0], 'go');
  assert.equal(motor.kokler('is')[0], 'be');
  assert.equal(motor.kokler('Was')[0], 'be');
  assert.ok(motor.kokler("teacher's").includes('teacher'));
  assert.ok(motor.kokler('teacher’s').includes('teacher'));
  assert.ok(motor.kokler('stopped').includes('stop'));
  assert.ok(motor.kokler('studies').includes('study'));
  assert.ok(motor.kokler('mice').includes('mouse'));
  assert.ok(motor.kokler('more beautiful').includes('beautiful'));
  assert.deepEqual(motor.kokler('run').filter(x => x === 'run'), []); // kendisi dahil değil
});

test('cekimler / kokAdaylari kuralları', () => {
  const c = motor.cekimler('stop');
  for (const x of ['stops', 'stopped', 'stopping']) assert.ok(c.has(x), x);
  assert.ok(motor.cekimler('study').has('studies'));
  assert.ok(motor.cekimler('make').has('making'));
  assert.ok(motor.cekimler('go').has('went'));
  assert.ok(motor.kokAdaylari('bigger').includes('big'));
  assert.ok(motor.kokAdaylari('happier').includes('happy'));
});

test('EN arama: tam > biçim > önek; aksan / büyük harf duyarsız', () => {
  const r = motor.araEn('run');
  assert.equal(r[0].en, 'run'); assert.equal(r[0].eslesme, 'tam');
  assert.ok(r.slice(1).every(x => x.skor <= r[0].skor));
  assert.ok(r.some(x => x.eslesme === 'onek' && x.en.toLowerCase().startsWith('run')));
  const k = motor.araEn('running');
  assert.ok(k.slice(0, 3).some(x => x.en === 'run' && x.eslesme === 'kok'), JSON.stringify(k.slice(0, 3).map(x => [x.en, x.eslesme])));
  const c = motor.araEn('CAFE');
  assert.ok(['cafe', 'café'].includes(c[0].en) && c[0].eslesme === 'tam', c.slice(0, 3).map(x => x.en).join());
  assert.equal(motor.araEn('café')[0].en, c[0].en);
  assert.equal(motor.araEn('to run')[0].en, 'run');
  assert.ok(motor.araEn('more beautiful').slice(0, 2).some(x => x.en === 'beautiful'));
  assert.equal(motor.araEn('children')[0].eslesme === 'tam' || motor.araEn('children').some(x => x.en === 'child'), true);
});

test('EN arama: yazım hatası, öbek, kelime başı', () => {
  const y = motor.araEn('recieve');
  assert.ok(y.length && y[0].en === 'receive', y.slice(0, 3).map(x => x.en).join());
  const y3 = motor.araEn('hapiness');
  assert.ok(y3.slice(0, 3).some(x => x.en === 'happiness'), y3.slice(0, 3).map(x => x.en + ':' + x.eslesme).join());
  const y2 = motor.araEn('beautifull');
  assert.ok(y2.slice(0, 3).some(x => x.en === 'beautiful'));
  const o = motor.araEn('look after');
  assert.equal(o[0].en, 'look after'); assert.equal(o[0].eslesme, 'tam');
  assert.ok(motor.araEn('spite').some(x => x.en === 'in spite of'));
  assert.deepEqual(motor.araEn(''), []);
  assert.ok(Array.isArray(motor.araEn('zzqqxx')));
});

test('TR arama: tam, aksansız, sıra', () => {
  assert.equal(motor.araTr('kitap')[0].en, 'book');
  assert.equal(motor.araTr('ev')[0].en, 'house');
  assert.ok(motor.araTr('isik').slice(0, 5).some(x => x.en === 'light'));
  assert.ok(motor.araTr('IŞIK').slice(0, 5).some(x => x.en === 'light'));
  assert.ok(motor.araTr('havalanmak').some(x => x.en === 'take off'));
});

test('otomatik yön', async () => {
  assert.equal((await motor.ara({ q: 'ışık' })).yon, 'tr');
  assert.equal((await motor.ara({ q: 'book', parca: false })).yon, 'en');
  assert.equal((await motor.ara({ q: 'kitap', parca: false })).yon, 'tr');
  const ev = await motor.ara({ q: 'ev', parca: false });
  assert.equal(ev.yon, 'tr'); assert.equal(ev.sonuc[0].en, 'house');
  const son = await motor.ara({ q: 'son', parca: false });
  assert.equal(son.yon, 'en'); assert.equal(son.sonuc[0].en, 'son');
  assert.equal((await motor.ara({ q: 'kitap', yon: 'en', parca: false })).yon, 'en');
});

test('öbek yakalama (çekimli ilk kelime dahil)', async () => {
  assert.equal((await motor.obek({ adaylar: [['looked', 'after']] }))?.en, 'look after');
  assert.equal((await motor.obek({ adaylar: [['in', 'spite', 'of']] }))?.en, 'in spite of');
  assert.equal(await motor.obek({ adaylar: [['of', 'the']] }), null);
});

test('enSar: belirteçleme, kaçış, kesme, tire, sayı', () => {
  const h = enSar("Don't touch the well-known <b>teacher's</b> 3 apples, O'Brien!");
  const ks = [...h.matchAll(/class="kw" data-k="([^"]*)"/g)].map(m => m[1]);
  assert.deepEqual(ks, ['Don&#39;t', 'touch', 'the', 'well-known', 'b', 'teacher&#39;s', 'b', 'apples', 'O&#39;Brien']);
  assert.ok(!h.includes('<b>')); assert.ok(h.includes('&lt;'));
  assert.ok(!h.includes('data-k="3"') && h.includes(' 3 '));
  assert.equal((h.match(/tabindex="0"/g) || []).length, 1);
  assert.equal(enSar(''), ''); assert.equal(enSar(null), '');
  // bitişiklik: boşlukla ayrılanlarda data-s; noktalamada yok
  const b = enSar('look after, it');
  assert.match(b, /data-k="look" data-i="0" tabindex="0" data-s=""/);
  assert.doesNotMatch(b, /data-k="after"[^>]*data-s/);
});

test('enSar: vurgu aralığı (UTF-16) ve gizle', () => {
  const s = 'He ran — quickly — to the café.';
  const i = s.indexOf('ran');
  const h = enSar(s, { vurgu: [i, i + 3] });
  assert.match(h, /<mark><span class="kw" data-k="ran"[^>]*>ran<\/span><\/mark>/);
  const e = '😀 He runs';
  const j = e.indexOf('runs');
  assert.match(enSar(e, { vurgu: [j, j + 4] }), /<mark><span class="kw" data-k="runs"/);
  const g = enSar('She ran and runs; running is fun. Run!', { gizle: ['run'] });
  assert.equal((g.match(/kw-gizli/g) || []).length, 4);
  assert.match(g, /class="kw" data-k="She"/);
  const g2 = enSar('He looked after his sister.', { gizle: ['look after'] });
  assert.match(g2, /kw-gizli" data-k="looked"/);
  assert.match(g2, /class="kw" data-k="his"/);
  assert.ok(gizliKume(['go']).has('went'));
});

test('maddeBirlestir: deste + çekirdek + parça', () => {
  const deste = [{ id: 'run|verb', en: 'run', tur: 'verb', tr: ['koşmak'], es: ['sprint'], tanim: 'move fast', ipa: '/rʌn/', sv: 'A1', oe: 'I run.', ob: [2, 5] }];
  const cek = [['run', 'verb', '/ɹʌn/', ['koşmak', 'akmak'], [['To move quickly.', 'Run!']], ['gallop']], ['run', 'noun', null, ['koşu'], [], []]];
  const m = maddeBirlestir('run', deste, cek, null, { parcaDurum: 'ag', cekirdek: true });
  assert.equal(m.en, 'run'); assert.equal(m.id, 'run|verb'); assert.equal(m.ipa, '/rʌn/');
  assert.deepEqual(m.turler, ['verb', 'noun']);
  assert.deepEqual(m.gruplar[0].tr, ['koşmak', 'akmak']);
  assert.deepEqual(m.ornek.ob, [2, 5]);
  assert.equal(m.baglantiGerekli, true); assert.equal(m.tam, false);
  const p = maddeBirlestir('run', [], cek, cek, { parcaDurum: 'tamam' });
  assert.equal(p.tam, true); assert.deepEqual(p.kaynak, ['parca']);
  assert.equal(maddeBirlestir('yok', [], [], null), null);
});
