"""Sözlük + anlam baloncuğu uçtan uca testi (Playwright). Sunucu 8790'ı betik açar / kapatır.
Koşum (Makale kökünden): .venv\\Scripts\\python.exe kelime-kartlari\\testler\\e2e_sozluk.py [--hizli]
--hizli: yalnız Chromium 414x896."""
import json, pathlib, subprocess, sys, time
from playwright.sync_api import sync_playwright

KOK = pathlib.Path(__file__).resolve().parents[1]
EKRAN = KOK / 'testler' / 'ekran'; EKRAN.mkdir(exist_ok=True)
URL = 'http://localhost:8790/'
HIZLI = '--hizli' in sys.argv
GORUNUMLER = [('chromium', 414, 896, True), ('chromium', 360, 800, True), ('chromium', 810, 1080, True), ('chromium', 1366, 768, False), ('webkit', 414, 896, True)]
if HIZLI: GORUNUMLER = GORUNUMLER[:1]

sonuc = {'gecti': 0, 'kaldi': [], 'olcum': {}}

def kontrol(ad, kosul, ayrinti=''):
    if kosul: sonuc['gecti'] += 1
    else: sonuc['kaldi'].append(f'{ad} {ayrinti}'); print('  KALDI:', ad, ayrinti)

BALON_HAZIR = "() => { const b = document.querySelector('#balon'); return b && !b.hidden && !b.querySelector('.bl-iskelet'); }"
BALON_TASMA = """() => { const b = document.querySelector('#balon'); if (!b || b.hidden) return null; const r = b.getBoundingClientRect();
  const vv = window.visualViewport || {width: innerWidth, height: innerHeight, offsetLeft: 0, offsetTop: 0};
  return Math.max(0, vv.offsetLeft - r.left, r.right - (vv.offsetLeft + vv.width), vv.offsetTop - r.top, r.bottom - (vv.offsetTop + vv.height)); }"""


def dokun(s, sec, mobil, idx=0):
    el = s.locator(sec).nth(idx)
    el.scroll_into_view_if_needed()
    if mobil: el.tap()
    else: el.click()


def sozluk_testi(s, ad, mobil, vw):
    s.goto(URL + '#/sozluk'); s.wait_for_selector('#sq')
    # ana iş parçacığı uzun görev gözlemi (Chromium destekler)
    s.evaluate("""() => { window.__uzun = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__uzun = Math.max(window.__uzun, e.duration); }).observe({type: 'longtask', buffered: false}); } catch {} }""")
    t0 = time.time()
    for _ in range(600):
        if s.evaluate("() => import('./js/sozluk.js').then(m => m.durum.cekirdek)") in ('hazir', 'hata'): break
        time.sleep(0.1)
    d = s.evaluate("() => import('./js/sozluk.js').then(async m => ({ ...m.durum, olcum: await m.olcum().catch(() => null) }))")
    sonuc['olcum'][ad] = {'cekirdek_ms': d.get('ms'), 'isci': d.get('isci'), 'motor': d.get('olcum'), 'en_uzun_gorev_ms': round(s.evaluate('window.__uzun || 0')), 'duvar_sn': round(time.time() - t0, 2)}
    kontrol(f'{ad} çekirdek hazır', d['cekirdek'] == 'hazir', str(d))
    kontrol(f'{ad} kayan bölme (taşma)', s.evaluate('document.documentElement.scrollWidth - innerWidth') <= 0)
    # EN arama, yazarken öneri
    s.fill('#sq', 'run'); s.wait_for_selector('#oneri:not([hidden]) [role=option]', timeout=10000)
    kontrol(f'{ad} EN öneri ilk', s.inner_text('#oneri [role=option] .o-k') == 'run', s.inner_text('#oneri [role=option] .o-k'))
    if ad.endswith('414x896') and 'chromium' in ad: s.screenshot(path=str(EKRAN / 'sozluk_oneri_414.png'))
    s.press('#sq', 'ArrowDown'); s.press('#sq', 'Enter'); s.wait_for_selector('.madde h1')
    kontrol(f'{ad} EN madde', s.inner_text('.madde h1') == 'run')
    kontrol(f'{ad} madde TR', 'koşmak' in s.inner_text('.madde-gruplar'))
    kontrol(f'{ad} kayan bölme madde', s.evaluate('document.documentElement.scrollWidth - innerWidth') <= 0)
    # yazım hatası
    s.fill('#sq', 'recieve'); s.wait_for_function("() => document.querySelector('#oneri [role=option] .o-k')?.textContent === 'receive'", timeout=10000)
    kontrol(f'{ad} yazım yakını', True)
    s.press('#sq', 'Escape'); kontrol(f'{ad} Esc öneriyi kapatır', s.is_hidden('#oneri'))
    # TR arama (derin bağlantı)
    s.goto(URL + '#/sozluk?q=kitap'); s.wait_for_selector('.sozluk-sonuc .o-k', timeout=15000)
    kontrol(f'{ad} TR arama', 'book' in s.inner_text('.sozluk-sonuc'))
    # çekimli biçim
    s.goto(URL + '#/sozluk?q=children'); s.wait_for_selector('.madde h1', timeout=15000)
    t = s.inner_text('.madde')
    kontrol(f'{ad} çekimli biçim', 'child' in t, s.inner_text('.madde h1'))
    # öbek
    s.goto(URL + '#/sozluk?q=look%20after'); s.wait_for_selector('.madde h1', timeout=15000)
    kontrol(f'{ad} öbek', s.inner_text('.madde h1') == 'look after')
    # bulunamadı
    s.goto(URL + '#/sozluk?q=qwxzzvq'); s.wait_for_selector('.bos-durum h2', timeout=15000)
    kontrol(f'{ad} bulunamadı', 'bulunamadı' in s.inner_text('.bos-durum h2'))
    # geri tuşu: önceki maddeye döner
    s.go_back(); s.wait_for_selector('.madde h1', timeout=15000)
    kontrol(f'{ad} geri tuşu', s.inner_text('.madde h1') == 'look after')
    # sözlük maddesindeki tanımda baloncuk
    s.goto(URL + '#/sozluk?q=house'); s.wait_for_selector('.madde-tur li .kw', timeout=15000)
    dokun(s, '.madde-tur li .kw', mobil, 1)
    s.wait_for_function(BALON_HAZIR, timeout=15000)
    kontrol(f'{ad} madde baloncuğu taşma', (s.evaluate(BALON_TASMA) or 0) <= 0.5)
    if ad.endswith('810x1080'): s.screenshot(path=str(EKRAN / 'sozluk_madde_balon_810.png'))
    # "Sözlükte aç"
    s.click('#balon .bl-eylem a[href^="#/sozluk"]')
    s.wait_for_function("() => document.querySelector('#balon')?.hidden !== false", timeout=5000)
    kontrol(f'{ad} Sözlükte aç', '#/sozluk?q=' in s.evaluate('location.hash'))


def oturum_testi(s, ad, mobil, vw, vh):
    s.goto(URL + '#/ana'); s.wait_for_selector('main#ana .ekran', timeout=20000)
    s.evaluate("""async () => { const c = await import('./js/ekran/calis.js'); const v = await import('./js/veri.js');
      c.oturumKur({ ...v.S.ayar.kurulum, kaynak: 'hepsi', kip: 'et', boy: 20, oran: 'yeni', sv: [], zor: [], deste: '', sira: 'karisik' }); }""")
    s.wait_for_selector('#yanit', timeout=10000)
    gizli_sinandi = False
    for _ in range(12):
        # soru sırasında: örnek ipucu → yanıt kelimesi tıklanamaz
        if not gizli_sinandi and s.locator('[data-ipucu="ornek"]').count():
            s.click('[data-ipucu="ornek"]')
            n = s.locator('#ipucuAlan .kw-gizli').count()
            kontrol(f'{ad} soru sırasında gizli kelime', n >= 1, str(n))
            if n:
                s.locator('#ipucuAlan .kw-gizli').first.click(force=True); time.sleep(0.3)
                kontrol(f'{ad} gizli kelime baloncuk açmaz', s.evaluate("() => !document.querySelector('#balon') || document.querySelector('#balon').hidden"))
            gizli_sinandi = True
        s.fill('#yanit', 'xyz'); s.press('#yanit', 'Enter'); s.wait_for_selector('.geri-bildirim')
        if s.locator('.geri-bildirim .ornek .kw').count() >= 3:
            break
        time.sleep(0.45); s.press('#yanit', 'Enter'); s.wait_for_selector('.geri-bildirim', state='detached')
    kontrol(f'{ad} yanıttan sonra gizli açıldı', s.locator('.kw-gizli').count() == 0)
    kelimeler = s.locator('.geri-bildirim .ornek .kw')
    n = kelimeler.count()
    kontrol(f'{ad} örnek cümle sarıldı', n >= 3, str(n))
    if not n: return
    s.locator('#yanit').focus()
    # vurgulu (hedef) kelime → anlamı kartın anlamıyla örtüşmeli
    hedef = s.locator('.geri-bildirim .ornek mark .kw')
    sec = '.geri-bildirim .ornek mark .kw' if hedef.count() else '.geri-bildirim .ornek .kw'
    dokun(s, sec, mobil)
    s.wait_for_function(BALON_HAZIR, timeout=20000)
    anlam = s.inner_text('.anlamlar').split(',')[0].strip()
    bt = s.inner_text('#balon')
    kontrol(f'{ad} baloncuk doğru anlam', anlam.lower() in bt.lower(), f'beklenen "{anlam}" / balon: {bt[:120]!r}')
    if mobil: kontrol(f'{ad} input odağı korunur', s.evaluate("document.activeElement && document.activeElement.id") == 'yanit')
    kontrol(f'{ad} baloncuk taşma', (s.evaluate(BALON_TASMA) or 0) <= 0.5, str(s.evaluate(BALON_TASMA)))
    if ad in ('chromium 414x896', 'chromium 360x800', 'webkit 414x896'): s.screenshot(path=str(EKRAN / f"balon_oturum_{ad.replace(' ', '_')}.png"))
    # kenar kelimeler: ilk ve son
    for idx in (0, n - 1):
        s.mouse.click(2, 2) if not mobil else None
        dokun(s, '.geri-bildirim .ornek .kw', mobil, idx)
        s.wait_for_function(BALON_HAZIR, timeout=20000)
        kontrol(f'{ad} kenar kelime {idx} taşma', (s.evaluate(BALON_TASMA) or 0) <= 0.5, str(s.evaluate(BALON_TASMA)))
    # dışına dokununca kapanır
    if mobil: s.touchscreen.tap(vw // 2, 60)
    else: s.mouse.click(vw // 2, 60)
    time.sleep(0.2)
    kontrol(f'{ad} dışarı dokunma kapatır', s.evaluate("() => document.querySelector('#balon').hidden"))
    # Enter akışı bozulmadı: Enter → sonraki soru
    if mobil:
        s.locator('#yanit').focus(); time.sleep(0.45); s.press('#yanit', 'Enter')
        s.wait_for_selector('.geri-bildirim', state='detached', timeout=5000)
        kontrol(f'{ad} Enter akışı', s.locator('#yanit').input_value() == '')
    else:
        # klavye: Tab ile kelimeye, Enter açar, Esc kapatır ve odağı geri verir
        s.locator('.geri-bildirim .ornek .kw').first.focus()
        s.keyboard.press('Enter'); s.wait_for_function(BALON_HAZIR, timeout=20000)
        kontrol(f'{ad} klavye Enter açar (oturum ilerlemez)', s.locator('.geri-bildirim').count() == 1)
        s.keyboard.press('Escape')
        kontrol(f'{ad} Esc kapatır + odak geri', s.evaluate("() => document.querySelector('#balon').hidden && document.activeElement.classList.contains('kw')"))
        # baloncuktan Karta ekle bağlantısı
        dokun(s, '.geri-bildirim .ornek .kw', mobil, 0); s.wait_for_function(BALON_HAZIR, timeout=20000)
        href = s.get_attribute('#balon .bl-eylem a:first-child', 'href') or ''
        kontrol(f'{ad} Karta ekle bağlantısı', href.startswith('#/kart/yeni?en=') or href.startswith('#/kelime/'), href)
        s.click('#balon .bl-eylem a:first-child'); time.sleep(0.3)
        kontrol(f'{ad} Karta ekle yolu', s.evaluate('location.hash').startswith(('#/kart/yeni', '#/kelime/')))


def cevrimdisi_testi(b):
    c = b.new_context(viewport={'width': 414, 'height': 896}, has_touch=True, service_workers='block')
    s = c.new_page()
    s.goto(URL); s.wait_for_selector('main#ana .ekran', timeout=20000)
    c.set_offline(True)
    s.evaluate("location.hash = '#/sozluk?q=house'"); s.wait_for_selector('.madde h1', timeout=20000)
    kontrol('çevrimdışı deste kelimesi', s.inner_text('.madde h1') == 'house')
    kontrol('çevrimdışı uyarı', 'bağlantı' in s.inner_text('main').lower())
    w = s.locator('.madde .ornek .kw')
    if w.count():
        # deste dışı bir kelime (ör. 'the' yerine son kelime)
        w.nth(w.count() - 1).tap(); s.wait_for_function(BALON_HAZIR, timeout=20000)
        kontrol('çevrimdışı baloncuk', 'bağlantı' in s.inner_text('#balon').lower() or s.locator('#balon .bl-tr').count() > 0, s.inner_text('#balon')[:100])
    s.screenshot(path=str(EKRAN / 'sozluk_cevrimdisi_414.png'))
    c.close()


sunucu = subprocess.Popen([sys.executable, '-m', 'http.server', '8790', '-d', str(KOK / 'site')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
hatalar = []
try:
    time.sleep(1.2)
    with sync_playwright() as p:
        tarayicilar = {}
        for tad, vw, vh, mobil in GORUNUMLER:
            ad = f'{tad} {vw}x{vh}'
            print('==', ad)
            b = tarayicilar.get(tad) or getattr(p, tad).launch()
            tarayicilar[tad] = b
            koyu = vw == 1366
            c = b.new_context(viewport={'width': vw, 'height': vh}, has_touch=mobil, service_workers='block', color_scheme='dark' if koyu else 'light')
            s = c.new_page()
            s.on('console', lambda m, ad=ad: m.type == 'error' and hatalar.append(f'{ad}: {m.text}'))
            s.on('pageerror', lambda e, ad=ad: hatalar.append(f'{ad}: {e}'))
            try:
                sozluk_testi(s, ad, mobil, vw)
                oturum_testi(s, ad, mobil, vw, vh)
                if koyu:
                    s.goto(URL + '#/sozluk?q=take%20off'); s.wait_for_selector('.madde h1', timeout=15000)
                    dokun(s, '.madde-tur li .kw', False, 0); s.wait_for_function(BALON_HAZIR, timeout=15000)
                    kontrol(f'{ad} koyu tema baloncuk zemini', s.evaluate("getComputedStyle(document.querySelector('#balon')).backgroundColor") != 'rgb(255, 255, 255)')
                    s.screenshot(path=str(EKRAN / 'sozluk_koyu_1366.png'))
            except Exception as e:
                kontrol(f'{ad} istisna', False, repr(e)[:300])
                try: s.screenshot(path=str(EKRAN / f"hata_{ad.replace(' ', '_')}.png"))
                except Exception: pass
            c.close()
        cevrimdisi_testi(tarayicilar['chromium'])
        for b in tarayicilar.values(): b.close()
finally:
    sunucu.terminate()
kontrol('konsol hatası 0', not hatalar, json.dumps(hatalar[:8], ensure_ascii=False))
print(json.dumps(sonuc['olcum'], ensure_ascii=False, indent=1))
print(f"GEÇTİ {sonuc['gecti']} · KALDI {len(sonuc['kaldi'])}")
for k in sonuc['kaldi']: print(' -', k)
