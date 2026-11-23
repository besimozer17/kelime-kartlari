// İlerleme / istatistik (#/istatistik).
import { S, kelime, kelimeDurum, zorMu, yanlisSayisi, bugun, xp, durumAl, SEVIYELER } from '../veri.js';
import { gunTarih, tarihGun, DURUM_AD } from '../tekrar.js';
import { seviyeBilgisi, gunSerisi } from '../puan.js';
import { oturumKur } from './calis.js';
import { ikon, kac, sayi, sureYaz, yolKimlik } from '../ui.js';

const yuzde = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function istatistikEkrani(main) {
  const g = bugun();
  const gunluk = new Map([...S.gunluk.values()].map(x => [tarihGun(x.gun), x]));
  const topla = n => { const t = { kart: 0, dogru: 0, neredeyse: 0, sure: 0, puan: 0 }; for (let i = 0; i < n; i++) { const x = gunluk.get(g - i); if (x) for (const a in t) t[a] += x[a] || 0; } return t; };
  const bu = topla(1), h7 = topla(7), h30 = topla(30);
  const seri = gunSerisi([...gunluk].filter(([, x]) => x.kart > 0).map(([n]) => n), g);
  const sv = seviyeBilgisi(xp());
  const gorulen = [...S.ilerleme.values()].some(x => x.son != null);

  if (!gorulen && !S.gunluk.size) {
    main.innerHTML = `<div class="ekran ekran-dar"><div class="ekran-bas"><h1>İlerleme</h1></div>
      <div class="kutu bos-durum">${ikon('grafik')}<h2>Henüz veri yok</h2><p>İlk çalışma oturumunuzdan sonra günlük etkinlik, doğruluk, seri ve seviye başına öğrendikleriniz burada görünür.</p><div class="satir"><a class="dg dg-ana" href="#/calis">Çalışmaya başla</a></div></div></div>`;
    return;
  }
  // durum sayımı (tek geçiş)
  const durumSay = { yeni: 0, ogreniliyor: 0, pekisiyor: 0, ogrenildi: 0 };
  const svSay = Object.fromEntries(SEVIYELER.map(s => [s, { toplam: 0, ogreniliyor: 0, pekisiyor: 0, ogrenildi: 0 }]));
  for (const k of S.tumu) {
    const d = kelimeDurum(k.id); durumSay[d]++;
    if (svSay[k.sv]) { svSay[k.sv].toplam++; if (d !== 'yeni') svSay[k.sv][d]++; }
  }
  const yon = { et: { d: 0, n: 0, y: 0 }, te: { d: 0, n: 0, y: 0 } };
  for (const x of S.ilerleme.values()) if (yon[x.yon]) { yon[x.yon].d += x.dogru || 0; yon[x.yon].n += x.neredeyse || 0; yon[x.yon].y += x.yanlis || 0; }
  const yonSatir = (y, ad) => { const t = yon[y]; const top = t.d + t.n + t.y; return `<div class="sv-cubuk yon"><b>${ad}</b><div class="ilerleme"><i class="i-ogrenildi" style="width:${yuzde(t.d, top)}%"></i><i class="i-ogreniliyor" style="width:${yuzde(t.n, top)}%"></i></div><span>%${yuzde(t.d + t.n, top)} <small class="soluk">(${sayi(top)})</small></span></div>`; };
  const zorlar = S.tumu.filter(k => yanlisSayisi(k.id) > 0 || S.meta.get(k.id)?.zor)
    .sort((a, b) => (yanlisSayisi(b.id) - yanlisSayisi(a.id)) || (zorMu(b.id) - zorMu(a.id))).slice(0, 20);
  // son 30 gün çubukları
  const g30 = Array.from({ length: 30 }, (_, i) => g - 29 + i);
  const enCok = Math.max(1, ...g30.map(n => gunluk.get(n)?.kart || 0));
  // ısı haritası: son 12 hafta, pazartesiden başlar
  const gunHafta = n => (new Date(n * 864e5).getUTCDay() + 6) % 7;
  const bas = g - gunHafta(g) - 7 * 11;
  const hedef = S.ayar.hedef || 20;
  const isi = Array.from({ length: 84 }, (_, i) => {
    const n = bas + i; const x = gunluk.get(n); const kart = x?.kart || 0;
    const s = !kart ? 0 : kart < hedef / 2 ? 1 : kart < hedef ? 2 : kart < hedef * 2 ? 3 : 4;
    return `<i ${n > g ? 'class="gelecek"' : `data-s="${s}"`} title="${new Date(n * 864e5).toLocaleDateString('tr-TR')}: ${kart} kart"></i>`;
  }).join('');
  const toplamPuan = [...S.gunluk.values()].reduce((a, x) => a + (x.puan || 0), 0);

  main.innerHTML = `<div class="ekran">
    <div class="ekran-bas"><h1>İlerleme<span class="alt">Seviye ${sv.seviye} · ${sayi(sv.xp)} XP</span></h1></div>
    <div class="sayi-izgara">
      <div class="sayi-kutu"><strong>${sayi(bu.kart)}</strong><span>bugün kart · %${yuzde(bu.dogru + bu.neredeyse, bu.kart)} doğru</span></div>
      <div class="sayi-kutu"><strong>${sayi(h7.kart)}</strong><span>7 gün · %${yuzde(h7.dogru + h7.neredeyse, h7.kart)} doğru</span></div>
      <div class="sayi-kutu"><strong>${sayi(h30.kart)}</strong><span>30 gün · %${yuzde(h30.dogru + h30.neredeyse, h30.kart)} doğru</span></div>
      <div class="sayi-kutu"><strong>${ikon('alev', 'ikon-k alev')} ${seri.simdi}</strong><span>gün seri · en uzun ${seri.enUzun}</span></div>
    </div>
    <div class="izgara izgara-2" style="margin-top:14px">
      <section class="kutu"><div class="kutu-bas"><h2>Son 30 gün</h2><span class="soluk kucuk">${sureYaz(h30.sure)} çalışma</span></div>
        <div class="cubuk-grafik" role="img" aria-label="Son 30 günün kart sayıları">${g30.map(n => { const v = gunluk.get(n)?.kart || 0; return `<div title="${gunTarih(n)}: ${v} kart"><i class="${!v ? 'bos' : n === g ? 'bugun' : ''}" style="height:${v ? Math.max(4, (v / enCok) * 100) : 2}%"></i></div>`; }).join('')}</div>
        <div class="eksen"><span>${new Date(g30[0] * 864e5).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span><span>bugün</span></div></section>
      <section class="kutu"><div class="kutu-bas"><h2>Son 12 hafta</h2><span class="soluk kucuk">hedef ${hedef} kart</span></div>
        <div class="isi" role="img" aria-label="Son 12 haftanın etkinlik ısı haritası">${isi}</div>
        <div class="lejant"><span>az</span><span class="isi-lejant"><i data-s="1"></i><i data-s="2"></i><i data-s="3"></i><i data-s="4"></i></span><span>çok</span></div></section>
      <section class="kutu"><h2 class="kucuk-bas">Seviyeye göre</h2><div class="sv-cubuklar">${SEVIYELER.map(s => { const x = svSay[s]; return `<div class="sv-cubuk"><span class="etiket sv sv-${s}">${s}</span><div class="ilerleme" title="${x.ogrenildi} öğrenildi, ${x.pekisiyor} pekişiyor, ${x.ogreniliyor} öğreniliyor / ${x.toplam}"><i class="i-ogrenildi" style="width:${yuzde(x.ogrenildi, x.toplam)}%"></i><i class="i-pekisiyor" style="width:${yuzde(x.pekisiyor, x.toplam)}%"></i><i class="i-ogreniliyor" style="width:${yuzde(x.ogreniliyor, x.toplam)}%"></i></div><span class="kucuk">${sayi(x.ogrenildi)} / ${sayi(x.toplam)}</span></div>`; }).join('')}</div>
        <div class="lejant"><span><i class="nokta d-ogrenildi"></i> öğrenildi</span><span><i class="nokta d-pekisiyor"></i> pekişiyor</span><span><i class="nokta d-ogreniliyor"></i> öğreniliyor</span></div></section>
      <section class="kutu"><h2 class="kucuk-bas">Durum</h2><div class="durum-liste">${Object.entries(durumSay).map(([d, n]) => `<div><i class="nokta d-${d}"></i><span class="yayil">${DURUM_AD[d]}</span><b>${sayi(n)}</b></div>`).join('')}</div>
        <h2 class="kucuk-bas" style="margin-top:16px">Yöne göre doğruluk</h2><div class="sv-cubuklar">${yonSatir('et', 'EN→TR')}${yonSatir('te', 'TR→EN')}</div></section>
    </div>
    <section class="kutu" style="margin-top:14px"><div class="kutu-bas"><h2>En çok zorlandıklarım</h2>${zorlar.length ? `<button type="button" class="dg dg-k dg-ana" id="zorCalis">${ikon('oynat', 'ikon-k')} Bunları çalış</button>` : ''}</div>
      ${zorlar.length ? `<ol class="liste zor-liste">${zorlar.map(k => `<li><a class="liste-ogesi" href="#/kelime/${yolKimlik(k.id)}"><span class="k">${kac(k.en)}</span><span class="a kesik yayil">${kac((k.tr || []).join(', '))}</span><span class="etiket kirmizi">${yanlisSayisi(k.id)} yanlış</span></a></li>`).join('')}</ol>` : '<p class="soluk">Henüz zorlandığınız kelime yok.</p>'}</section>
    <div class="sayi-izgara" style="margin-top:14px">
      <div class="sayi-kutu"><strong>${sayi(toplamPuan)}</strong><span>toplam puan</span></div>
      <div class="sayi-kutu"><strong>${sayi(xp())}</strong><span>XP</span></div>
      <div class="sayi-kutu"><strong>${sv.seviye}</strong><span>seviye · sonraki ${sayi(sv.ust)} XP</span></div>
      <div class="sayi-kutu"><strong>${sayi(durumAl('enIyi', 0) || 0)}</strong><span>en iyi oturum puanı</span></div>
    </div></div>`;
  const zb = main.querySelector('#zorCalis');
  if (zb) zb.onclick = () => oturumKur({ ...S.ayar.kurulum, kaynak: 'hepsi', kip: 'karisik', boy: 0, sira: 'karisik' }, zorlar.map(k => kelime(k.id)));
}
