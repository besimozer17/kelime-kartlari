"""Uçtan uca test: Kelime Kartı PWA (site/), port 8791 (sunucuyu kendisi açıp kapatır).
Koşum (Makale kökünden):  .venv\\Scripts\\python.exe kelime-kartlari\\testler\\e2e.py  [cihaz-adı-süzgeci]
Cihazlar: Chromium iPhone 11 / Pixel 7 / küçük Android / iPad 9 / masaüstü; WebKit iPhone 11 / iPad.
Her cihazda: bütün ekranlar açılır, konsol hatası 0, yatay taşma 0, liste arama+süzgeç, kart ekle → listede →
oturumda sorulur → yenilemede kalıcı → sil, toplu ekleme, yedek al → her şeyi sil → geri yükle, koyu tema.
Bir Chromium cihazında: SW kurulumu + çevrimdışı yeniden açılış; manifest + maskable simge."""
import json, pathlib, subprocess, sys, tempfile, time, traceback
from playwright.sync_api import sync_playwright

KOK = pathlib.Path(__file__).resolve().parents[1]
SITE = KOK / 'site'
EKRAN = KOK / 'testler' / 'ekran'; EKRAN.mkdir(exist_ok=True)
PORT = 8791
ADRES = f'http://localhost:{PORT}/'
SUZ = sys.argv[1] if len(sys.argv) > 1 else ''

CIHAZLAR = [
    ('ch-iphone11', 'chromium', dict(viewport={'width': 414, 'height': 896}, device_scale_factor=2, is_mobile=True, has_touch=True)),
    ('ch-pixel7', 'chromium', dict(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True)),
    ('ch-kucuk', 'chromium', dict(viewport={'width': 360, 'height': 800}, device_scale_factor=2, is_mobile=True, has_touch=True)),
    ('ch-ipad9', 'chromium', dict(viewport={'width': 810, 'height': 1080}, device_scale_factor=2, is_mobile=True, has_touch=True)),
    ('ch-masaustu', 'chromium', dict(viewport={'width': 1366, 'height': 768})),
    ('wk-iphone11', 'webkit', 'iPhone 11'),
    ('wk-ipad', 'webkit', 'iPad (gen 7)'),
]
EKRANLAR = ['#/ana', '#/calis', '#/liste', '#/sozluk', '#/istatistik', '#/ayarlar', '#/kart/yeni', '#/toplu', '#/desteler', '#/kelime/although%7Cbaglac']
VERI = "await import('./js/veri.js')"


def kos(p, ad, motor, ayar, sonuc):
    tarayici = getattr(p, motor).launch()
    if isinstance(ayar, str):
        ayar = dict(p.devices.get(ayar) or {'viewport': {'width': 810, 'height': 1080}})
        ayar.pop('default_browser_type', None)
    ctx = tarayici.new_context(**ayar, accept_downloads=True)
    s = ctx.new_page()
    hatalar, adimlar = [], []
    s.on('console', lambda m: m.type == 'error' and hatalar.append(m.text[:200]))
    s.on('pageerror', lambda e: hatalar.append('pageerror: ' + str(e)[:200]))
    gor = ad in ('ch-iphone11', 'ch-kucuk', 'ch-masaustu', 'wk-iphone11', 'ch-ipad9')

    def adim(baslik, f):
        t0 = time.time()
        try:
            f(); adimlar.append((baslik, 'TAMAM', round(time.time() - t0, 1)))
        except Exception as e:
            adimlar.append((baslik, 'HATA: ' + (str(e).splitlines()[0][:220] if str(e) else repr(e)), round(time.time() - t0, 1)))
            try: s.screenshot(path=str(EKRAN / f'HATA_{ad}_{baslik}.png'))
            except Exception: pass

    def git(h, bekle='main .ekran, main .oturum'):
        s.evaluate(f'location.hash = {json.dumps(h)}')
        s.wait_for_selector(bekle, timeout=10000)
        s.wait_for_timeout(120)

    def tasma():
        return s.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')

    def ev(js):
        return s.evaluate('async () => { const V = ' + VERI + '; ' + js + ' }')

    def pencere_dugme(deger):
        s.click(f'dialog.pencere[open] .pencere-alt button[value="{deger}"]')
        s.wait_for_timeout(150)

    def say():
        return int(s.inner_text('#sonucSay').replace('.', ''))

    def acilis():
        s.goto(ADRES); s.wait_for_selector('#devam', timeout=20000)
    adim('acilis', acilis)

    def ekranlar():
        sorun = []
        for h in EKRANLAR:
            git(h)
            t = tasma()
            if t > 0: sorun.append(f'{h} taşma {t}px')
            if s.locator('text=Yakında').count(): sorun.append(f'{h} "Yakında"')
            if gor: s.screenshot(path=str(EKRAN / f'e2e_{ad}_{h.strip("#/").split("/")[0] or "ana"}.png'))
        s.evaluate("location.hash = '#/yok-boyle-yol'"); s.wait_for_timeout(250)
        if s.evaluate('location.hash') != '#/ana': sorun.append('bilinmeyen yol ana ekrana dönmedi')
        if sorun: raise AssertionError('; '.join(sorun))
    adim('ekranlar', ekranlar)

    def liste():
        git('#/liste', '.ksatir')
        n0 = say()
        if n0 < 8000: raise AssertionError(f'liste sayısı {n0}')
        satir = s.locator('.ksatir').count()
        if satir > 80: raise AssertionError(f'sanal değil: {satir} satır DOM\'da')
        s.fill('#ara', 'apple'); s.wait_for_function('document.querySelector("#sonucSay").textContent !== "8.281"', timeout=5000); s.wait_for_timeout(250)
        ilk = s.inner_text('.ksatir .k').lower()
        if not ilk.startswith('apple'): raise AssertionError('arama ilk sonuç: ' + ilk)
        s.fill('#ara', 'ELMA'); s.wait_for_timeout(450)
        if 'apple' not in s.inner_text('#sanal').lower(): raise AssertionError('TR arama "ELMA" apple bulmadı')
        s.fill('#ara', 'kulak'); s.wait_for_timeout(450)
        if say() < 1: raise AssertionError('aksansız TR arama sonuç yok')
        s.click('#araTemizle'); s.wait_for_timeout(350)
        s.click('[data-hsv="A1"]'); s.wait_for_timeout(350)
        a1 = say()
        if not 700 < a1 < 900: raise AssertionError(f'A1 süzgeci {a1}')
        s.click('#suzgecDg'); s.wait_for_selector('dialog.pencere[open]')
        s.click('dialog [data-alan="zor"] [data-v="5"]'); s.wait_for_timeout(150)
        pencere_dugme('tamam'); s.wait_for_timeout(300)
        a1z = say()
        if not a1z < a1: raise AssertionError(f'zorluk süzgeci daraltmadı {a1z}/{a1}')
        s.select_option('#sira', 'seviye'); s.wait_for_timeout(300)
        # geri gelince süzgeç korunur
        git('#/ana'); git('#/liste', '.liste-ekran')
        if say() != a1z: raise AssertionError('süzgeç geri dönünce korunmadı')
        s.click('#hepsiniTemizle'); s.wait_for_timeout(350)
        if say() != n0: raise AssertionError('temizle sonrası sayı')
        s.fill('#ara', 'qqqxxyyzz'); s.wait_for_timeout(450)
        if not s.is_visible('#bos'): raise AssertionError('boş sonuç durumu görünmedi')
        s.fill('#ara', ''); s.wait_for_timeout(350)
        s.evaluate('scrollTo(0, document.body.scrollHeight)'); s.wait_for_timeout(300)
        son = s.locator('.ksatir').last.get_attribute('aria-posinset')
        if int(son) != n0: raise AssertionError(f'en alta kaydırınca son satır {son}/{n0}')
        if tasma() > 0: raise AssertionError('liste taşma')
        s.evaluate('scrollTo(0,0)')
    adim('liste', liste)

    durum = {}
    def kart_ekle():
        git('#/kart/yeni', '#fEn')
        s.click('#kaydet'); s.wait_for_timeout(200)
        if not s.inner_text('#hEn').strip(): raise AssertionError('boş EN doğrulaması yok')
        s.fill('#fEn', '   '); s.click('#kaydet'); s.wait_for_timeout(150)
        if not s.inner_text('#hEn').strip(): raise AssertionError('yalnız boşluk doğrulaması yok')
        s.fill('#fEn', 'apple'); s.wait_for_selector('#oneri .uyari-kutu', timeout=4000)
        s.fill('#fEn', 'zzqtestword')
        s.fill('#fTr input', 'deneme kelimesi'); s.press('#fTr input', 'Enter')
        s.fill('#fTr input', 'sınama'); s.press('#fTr input', 'Enter')
        s.fill('#fOe', 'This zzqtestword is only for testing.')
        s.select_option('#fDeste', '+'); s.fill('#fYeniDeste', 'E2E deste')
        if 'zzqtestword' not in s.inner_text('#onizleme'): raise AssertionError('canlı önizleme yok')
        s.click('#kaydet'); s.wait_for_function("location.hash.startsWith('#/kelime/')", timeout=5000)
        s.wait_for_selector('.madde-bas h1')
        durum['id'] = s.evaluate("decodeURIComponent(location.hash.slice(9))")
        if s.inner_text('.madde-bas h1') != 'zzqtestword': raise AssertionError('ayrıntı başlığı')
        git('#/liste', '.liste-ekran'); s.fill('#ara', 'zzqtest'); s.wait_for_timeout(450)
        if say() != 1 or 'kendi' not in s.inner_text('#sanal'): raise AssertionError('kendi kartı listede yok')
        s.fill('#ara', ''); s.wait_for_timeout(200)
    adim('kart-ekle', kart_ekle)

    def oturum():
        git('#/desteler', '.deste-satir')
        s.locator('.deste-satir', has_text='E2E deste').locator('[data-e="calis"]').click()
        s.wait_for_selector('.oturum .soru-kart:not([hidden])', timeout=6000)
        soru = s.inner_text('.soru-kart')
        if 'zzqtestword' not in soru and 'deneme kelimesi' not in soru: raise AssertionError('kendi kartı sorulmadı: ' + soru[:80])
        if s.is_visible('#yanit'):
            yanit = 'deneme kelimesi' if 'zzqtestword' in s.inner_text('#soru') else 'zzqtestword'
            s.fill('#yanit', yanit); s.press('#yanit', 'Enter')
        else:  # seçmeli / çevir kipi varsayılansa
            s.locator('.sik, #cevir').first.click(); s.wait_for_timeout(200)
            if s.locator('.degerlendir button').count(): s.click('.degerlendir [data-d="dogru"]')
        s.wait_for_selector('.geri-bildirim', timeout=4000)
        s.wait_for_timeout(450); s.click('#ileri'); s.wait_for_selector('.ozet', timeout=4000)
    adim('oturumda-sorulur', oturum)

    def kalicilik():
        s.wait_for_timeout(600)  # IndexedDB yazmaları bitsin (gerçek kullanımda da oturum sonu ekranı okunur)
        s.reload(); s.wait_for_selector('main .ekran, main .oturum', timeout=15000)
        git('#/kelime/' + json.dumps(durum.get('id', ''))[1:-1].replace('|', '%7C'), '.madde-bas')
        if 'Kutu' not in s.inner_text('.yon-ilerleme'): raise AssertionError('yenilemeden sonra ilerleme yok')
        git('#/istatistik', 'main .ekran')
        if not s.locator('.sayi-kutu').count(): raise AssertionError('istatistik veri göstermiyor')
        if gor: s.screenshot(path=str(EKRAN / f'e2e_{ad}_istatistik_dolu.png'), full_page=True)
    adim('yenileme-kalici', kalicilik)

    def toplu():
        git('#/toplu', '#metin')
        s.fill('#metin', 'apple ; elma\nxyzfoo ; foo karşılık, ikinci\n\nbozuk satır\nxyzfoo ; tekrar\nqqbar ; çubuk ; The qqbar is here. ; Çubuk burada.')
        s.wait_for_selector('.onizleme tbody tr', timeout=4000)
        hata, uyari = s.locator('.onizleme tr.hata').count(), s.locator('.onizleme tr.uyari').count()
        if (hata, uyari) != (1, 2): raise AssertionError(f'hatalı/yinelenen işaret {hata}/{uyari}')
        s.click('#aktar'); s.wait_for_selector('#sonuc .bos-durum', timeout=5000)
        if '2 kart eklendi' not in s.inner_text('#sonuc'): raise AssertionError('özet: ' + s.inner_text('#sonuc')[:80])
    adim('toplu-ekle', toplu)

    def sil():
        git('#/kart/' + json.dumps(durum.get('id', ''))[1:-1].replace('|', '%7C'), '#sil')
        s.click('#sil'); s.wait_for_selector('dialog.pencere[open]'); pencere_dugme('e')
        s.wait_for_function("location.hash === '#/liste'", timeout=4000)
        s.wait_for_selector('.bildirim'); s.fill('#ara', 'zzqtest'); s.wait_for_timeout(450)
        if not s.is_visible('#bos'): raise AssertionError('silinen kart listede')
        s.fill('#ara', ''); s.wait_for_timeout(400)
    adim('kart-sil', sil)

    def yedek():
        once = ev('return [V.S.ilerleme.size, V.S.ozel.size, V.S.ozelDesteler.size];')
        y = ev('return await V.yedekAl();')
        yol = pathlib.Path(tempfile.gettempdir()) / f'kk_yedek_{ad}.json'
        yol.write_text(json.dumps(y), encoding='utf-8')
        bozuk = pathlib.Path(tempfile.gettempdir()) / 'kk_bozuk.json'; bozuk.write_text('{"uygulama":"baska"}', encoding='utf-8')
        git('#/ayarlar', '#yedekAl')
        if ad == 'ch-masaustu':
            with s.expect_download() as d: s.click('#yedekAl')
            if not d.value.suggested_filename.startswith('kelime-karti-yedek'): raise AssertionError('indirme adı')
        s.click('#hepsiniSil'); s.wait_for_selector('dialog.pencere[open]'); pencere_dugme('e')
        s.wait_for_selector('dialog.pencere[open]'); pencere_dugme('e'); s.wait_for_timeout(400)
        bos = ev('return [V.S.ilerleme.size, V.S.ozel.size, V.S.ozelDesteler.size];')
        if any(bos): raise AssertionError(f'sıfırlama sonrası {bos}')
        with s.expect_file_chooser() as fc: s.click('#geriYukle')
        fc.value.set_files(str(bozuk)); s.wait_for_selector('.bildirim.hata', timeout=4000)
        with s.expect_file_chooser() as fc: s.click('#geriYukle')
        fc.value.set_files(str(yol)); s.wait_for_selector('dialog.pencere[open]'); pencere_dugme('e'); s.wait_for_timeout(600)
        sonra = ev('return [V.S.ilerleme.size, V.S.ozel.size, V.S.ozelDesteler.size];')
        if sonra != once: raise AssertionError(f'geri yükleme {once} → {sonra}')
        s.reload(); s.wait_for_selector('main .ekran', timeout=15000)
        kal = ev('return [V.S.ilerleme.size, V.S.ozel.size, V.S.ozelDesteler.size];')
        if kal != once: raise AssertionError(f'geri yükleme yenilemede kalmadı {kal}')
    adim('yedek-sifirla-geriyukle', yedek)

    def koyu():
        git('#/ayarlar', '[data-ayar="tema"]')
        s.click('[data-ayar="tema"] [data-v="koyu"]')
        if s.evaluate('document.documentElement.dataset.tema') != 'koyu': raise AssertionError('tema uygulanmadı')
        s.reload(); s.wait_for_selector('main .ekran', timeout=15000)
        arka = s.evaluate('getComputedStyle(document.body).backgroundColor')
        if arka not in ('rgb(11, 19, 34)',): raise AssertionError('koyu arka plan yok: ' + arka)
        for h in ['#/liste', '#/kelime/although%7Cbaglac', '#/ayarlar', '#/kart/yeni']:
            git(h)
            if tasma() > 0: raise AssertionError(h + ' koyu taşma')
            if gor and h in ('#/liste', '#/kelime/although%7Cbaglac'): s.screenshot(path=str(EKRAN / f'e2e_{ad}_koyu_{h.strip("#/").split("/")[0]}.png'))
        git('#/ayarlar', '[data-ayar="tema"]'); s.click('[data-ayar="tema"] [data-v="sistem"]')
    adim('koyu-tema', koyu)

    def kart_param():
        git('#/kart/yeni?en=lookafter&tr=bakmak,%C3%B6zen%20g%C3%B6stermek&tur=phrasal&sv=B1', '#fEn')
        if s.input_value('#fEn') != 'lookafter' or s.locator('#fTr .et').count() != 2 or s.input_value('#fTur') != 'phrasal' or s.input_value('#fSv') != 'B1':
            raise AssertionError('kart formu parametrelerle dolmadı')
    adim('kart-param', kart_param)

    if ad == 'ch-masaustu':
        def sozluk_indir():
            SZ = "await import('./js/sozluk.js')"
            sil0 = s.evaluate('async () => { const Z = ' + SZ + '; await Z.indirileniSil(); return (await Z.indirmeDurumu()).inen; }')
            git('#/ayarlar', '#indirBasla')
            s.click('#indirBasla')
            s.wait_for_function("(document.querySelector('#sozlukBolum small.soluk')||{}).textContent?.match(/^[1-9][0-9.]* [/]/)", timeout=20000)
            s.click('#indirDur'); s.wait_for_selector('#indirBasla, #indirSil', timeout=10000); s.wait_for_timeout(500)
            d = s.evaluate('async () => { const Z = ' + SZ + '; return await Z.indirmeDurumu(); }')
            if not (0 < d['inen'] < d['toplam']): raise AssertionError(f'iptal sonrası durum {d} (önce {sil0})')
            s.click('#indirSil'); s.wait_for_selector('dialog.pencere[open]'); pencere_dugme('e'); s.wait_for_timeout(600)
            d2 = s.evaluate('async () => { const Z = ' + SZ + '; return await Z.indirmeDurumu(); }')
            if d2['inen'] != 0: raise AssertionError(f'sil sonrası {d2}')
        adim('sozluk-indir-iptal-sil', sozluk_indir)

    if ad == 'ch-pixel7':
        def cevrimdisi():
            s.goto(ADRES); s.wait_for_selector('#devam', timeout=20000)
            s.evaluate('navigator.serviceWorker.ready.then(() => true)')
            s.reload(); s.wait_for_selector('#devam', timeout=20000)
            s.wait_for_function('!!navigator.serviceWorker.controller', timeout=15000)
            ctx.set_offline(True)
            s.reload(); s.wait_for_selector('#devam', timeout=20000)
            if not s.is_visible('#agSerit'): raise AssertionError('çevrimdışı şeridi yok')
            git('#/liste', '.ksatir')
            if say() < 8000: raise AssertionError('çevrimdışı kelime verisi yok')
            git('#/ayarlar', '#sozlukBolum')
            ctx.set_offline(False)
        adim('sw-cevrimdisi', cevrimdisi)

        def manifest():
            m = s.evaluate("fetch('./manifest.webmanifest').then(r => r.json())")
            ik = m.get('icons', [])
            if not any(i.get('purpose') == 'maskable' and '512' in i.get('sizes', '') for i in ik): raise AssertionError('maskable simge yok')
            if m.get('display') != 'standalone' or m.get('start_url') != './': raise AssertionError('manifest display/start_url')
            from PIL import Image
            for i in ik:
                w, h = Image.open(SITE / i['src']).size
                if f'{w}x{h}' != i['sizes']: raise AssertionError(f"{i['src']} boyut {w}x{h}")
            im = Image.open(SITE / 'simge' / 'simge-maskable-512.png').convert('RGBA')
            if im.getpixel((10, 10))[3] < 255: raise AssertionError('maskable kenar saydam (tam dolu olmalı)')
        adim('manifest-simge', manifest)

    if hatalar: adimlar.append(('konsol', 'HATA: ' + ' | '.join(dict.fromkeys(hatalar))[:600], 0))
    else: adimlar.append(('konsol', 'TAMAM', 0))
    sonuc[ad] = adimlar
    tarayici.close()


def main():
    sunucu = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', str(SITE)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    sonuc = {}
    try:
        time.sleep(1.2)
        with sync_playwright() as p:
            for ad, motor, ayar in CIHAZLAR:
                if SUZ and not any(x in ad for x in SUZ.split(',')): continue
                t0 = time.time()
                try: kos(p, ad, motor, ayar, sonuc)
                except Exception: sonuc[ad] = [('cokme', 'HATA: ' + traceback.format_exc().splitlines()[-1], 0)]
                print(f'{ad}: {round(time.time() - t0)} sn', flush=True)
    finally:
        sunucu.terminate()
    toplam = gecen = 0
    for ad, adimlar in sonuc.items():
        for b, d, sn in adimlar:
            toplam += 1; gecen += d == 'TAMAM'
            if d != 'TAMAM': print(f'  {ad} / {b}: {d}')
    print(f'SONUÇ: {gecen}/{toplam} adım geçti')
    return 0 if gecen == toplam else 1


if __name__ == '__main__':
    sys.exit(main())
