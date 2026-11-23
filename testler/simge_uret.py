"""Kelime Kartı simgeleri (PIL): lacivert zemin, arkada turkuaz kart, önde beyaz kart üzerinde serif "Aa".
Koşum: .venv\\Scripts\\python.exe kelime-kartlari\\testler\\simge_uret.py"""
import pathlib
from PIL import Image, ImageDraw, ImageFont

HEDEF = pathlib.Path(__file__).resolve().parents[1] / 'site' / 'simge'
HEDEF.mkdir(parents=True, exist_ok=True)
FONT = 'C:/Windows/Fonts/georgiab.ttf'
LACI, KOYU, TURKUAZ, MERCAN, KAGIT = (28, 79, 151), (19, 39, 74), (115, 208, 198), (176, 52, 42), (255, 253, 248)


def ciz(boyut, maskable=False, koseli=True):
    S = 4 * boyut  # büyük çiz, küçült (kenar yumuşaması)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # zemin: dikey geçiş
    zemin = Image.new('RGBA', (S, S))
    zd = ImageDraw.Draw(zemin)
    for y in range(S):
        t = y / S
        zd.line([(0, y), (S, y)], fill=tuple(int(LACI[i] * (1 - t) + KOYU[i] * t) for i in range(3)) + (255,))
    maske = Image.new('L', (S, S), 0)
    ImageDraw.Draw(maske).rounded_rectangle([0, 0, S - 1, S - 1], radius=0 if (maskable or not koseli) else int(S * 0.22), fill=255)
    im.paste(zemin, (0, 0), maske)
    olcek = 0.62 if maskable else 0.8  # maskable: güvenli bölge %80 çember
    w, h = S * olcek * 0.62, S * olcek * 0.8
    cx, cy = S / 2, S / 2
    # arka kart (turkuaz, döndürülmüş)
    arka = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(arka).rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=int(w * 0.12), fill=TURKUAZ + (255,))
    arka = arka.rotate(12, center=(cx + w * 0.12, cy), resample=Image.BICUBIC)
    im.alpha_composite(arka)
    # ön kart
    on = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    od = ImageDraw.Draw(on)
    x0, y0 = cx - w / 2 - w * 0.08, cy - h / 2
    od.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=int(w * 0.12), fill=KAGIT + (255,))
    od.rectangle([x0 + w * 0.12, y0 + h * 0.08, x0 + w * 0.88, y0 + h * 0.08 + max(4, h * 0.035)], fill=LACI + (255,))
    f = ImageFont.truetype(FONT, int(h * 0.42))
    od.text((x0 + w / 2, y0 + h * 0.52), 'Aa', font=f, fill=KOYU + (255,), anchor='mm')
    od.rounded_rectangle([x0 + w * 0.3, y0 + h * 0.8, x0 + w * 0.7, y0 + h * 0.8 + max(4, h * 0.045)], radius=int(h * 0.02), fill=MERCAN + (255,))
    on = on.rotate(-4, center=(cx, cy), resample=Image.BICUBIC)
    im.alpha_composite(on)
    im = im.resize((boyut, boyut), Image.LANCZOS)
    return im


ciz(192).save(HEDEF / 'simge-192.png', optimize=True)
ciz(512).save(HEDEF / 'simge-512.png', optimize=True)
ciz(512, maskable=True).save(HEDEF / 'simge-maskable-512.png', optimize=True)
ciz(180, koseli=False).convert('RGB').save(HEDEF / 'apple-touch-icon.png', optimize=True)  # iOS kendisi yuvarlar; saydamlık olmamalı
print('tamam:', sorted(p.name for p in HEDEF.iterdir()))
