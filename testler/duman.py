"""Hızlı duman testi: site/ 8790'da, Chromium; açılış + bir EN→TR kartı + konsol hataları.
Koşum: .venv\\Scripts\\python.exe kelime-kartlari\\testler\\duman.py"""
import subprocess, sys, time, pathlib
from playwright.sync_api import sync_playwright

KOK = pathlib.Path(__file__).resolve().parents[1]
EKRAN = KOK / 'testler' / 'ekran'; EKRAN.mkdir(exist_ok=True)
sunucu = subprocess.Popen([sys.executable, '-m', 'http.server', '8790', '-d', str(KOK / 'site')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
hatalar = []
try:
    time.sleep(1.2)
    with sync_playwright() as p:
        b = p.chromium.launch()
        s = b.new_page(viewport={'width': 414, 'height': 896})
        s.on('console', lambda m: m.type == 'error' and hatalar.append(m.text))
        s.on('pageerror', lambda e: hatalar.append(str(e)))
        t0 = time.time(); s.goto('http://localhost:8790/'); s.wait_for_selector('#devam', timeout=20000)
        print('açılış sn', round(time.time() - t0, 2))
        s.screenshot(path=str(EKRAN / 'duman_ana.png'))
        s.click('[data-hizli="yeni"]'); s.wait_for_selector('#yanit')
        print('soru:', s.inner_text('.bas-kelime'))
        s.fill('#yanit', 'xyz'); s.press('#yanit', 'Enter'); s.wait_for_selector('.geri-bildirim')
        print('geri bildirim:', s.inner_text('.gb-bas'))
        s.screenshot(path=str(EKRAN / 'duman_oturum.png'), full_page=True)
        time.sleep(0.5); s.press('#yanit', 'Enter'); time.sleep(0.3)
        print('sonraki soru:', s.inner_text('.soru-ust'))
        print('yatay taşma:', s.evaluate('document.documentElement.scrollWidth - innerWidth'))
        b.close()
finally:
    sunucu.terminate()
print('konsol hataları:', hatalar or 'yok')
