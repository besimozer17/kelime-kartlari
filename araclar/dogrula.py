# -*- coding: utf-8 -*-
"""Kelime Kartı veri doğrulaması. Koşma: .venv/Scripts/python.exe -X utf8 kelime-kartlari/araclar/dogrula.py
Çıkış kodu 0 = hepsi geçti."""
import bisect, collections, json, random, re, sqlite3, sys, unicodedata
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
VERI = KOK / "kelime-kartlari" / "site" / "veri"
SOZ = VERI / "sozluk"
DIL_DB = KOK / "veri" / "dil" / "dil.db"
SOZ_DB = KOK / "veri" / "dil" / "sozluk.db"
SEV = ["A1", "A2", "B1", "B2", "C1", "C2"]
TURLER = {"noun", "verb", "adj", "adv", "phrasal", "baglac", "edat", "deyim", "esdizim"}

hatalar, bilgi = [], []


def hata(m):
    hatalar.append(m)


def ro(y):
    return sqlite3.connect(f"file:{y.as_posix()}?mode=ro", uri=True)


def yukle(y):
    with open(y, encoding="utf-8") as f:
        return json.load(f)


def parca_anahtari(kucuk):
    s = "".join(ch for ch in unicodedata.normalize("NFKD", kucuk) if not unicodedata.combining(ch))
    k = lambda ch: ch if ("a" <= ch <= "z" or "0" <= ch <= "9") else "_"
    return (k(s[0]) if s else "_") + (k(s[1]) if len(s) > 1 else "_")


def tr_kucuk(s):
    return s.replace("I", "ı").replace("İ", "i").lower()


# ---------------------------------------------------------------- 1) ayrışma
dosyalar = [VERI / "kelimeler.json", VERI / "kaynaklar.json"] + sorted(SOZ.glob("*.json"))
icerik = {}
for y in dosyalar:
    try:
        icerik[y.name if y.parent == VERI else "sozluk/" + y.name] = yukle(y)
    except Exception as e:
        hata(f"ayrışmadı: {y}: {e}")
bilgi.append(f"ayrışan JSON: {len(icerik)}/{len(dosyalar)}")
for t in VERI.rglob("*.tmp"):
    hata(f"yarım geçici dosya kaldı: {t}")

# ---------------------------------------------------------------- 2) kelimeler.json
K = icerik["kelimeler.json"]
for a in ("surum", "sayim", "desteler", "kelimeler"):
    if a not in K:
        hata(f"kelimeler.json alan yok: {a}")
kel, dst = K["kelimeler"], K["desteler"]
if K["sayim"] != len(kel):
    hata("sayim tutmuyor")
ids = [k["id"] for k in kel]
if len(set(ids)) != len(ids):
    hata(f"id tekil değil: {len(ids) - len(set(ids))}")
say = collections.Counter()
alan = {"id": str, "en": str, "tur": str, "sv": str, "svt": int, "zipf": (int, float), "zor": int, "tr": list,
        "otyz": int, "es": list, "d": list}
for k in kel:
    for a, t in alan.items():
        if not isinstance(k.get(a), t):
            hata(f"{k.get('id')}: {a} türü yanlış"); break
    for a in ("ipa", "tanim", "oe", "ot", "onem", "ob"):
        if a not in k:
            hata(f"{k['id']}: {a} alanı yok")
    if k["id"] != f'{k["en"]}|{k["tur"]}':
        hata(f"{k['id']}: id biçimi")
    if k["tur"] not in TURLER:
        hata(f"{k['id']}: tur {k['tur']}")
    if k["sv"] not in SEV or k["svt"] not in (0, 1) or not 1 <= k["zor"] <= 5 or k["otyz"] not in (0, 1):
        hata(f"{k['id']}: sv/svt/zor/otyz aralık dışı")
    if not k["tr"] or len(k["tr"]) > 6 or any((not x) or x != x.strip() for x in k["tr"]) or len({x.casefold() for x in k["tr"]}) != len(k["tr"]):
        say["tr_sorunlu"] += 1
    if len(k["es"]) > 6:
        hata(f"{k['id']}: es > 6")
    if k["onem"] is not None and not 0 <= k["onem"] <= 1:
        hata(f"{k['id']}: onem aralık")
    if k["ot"] and not k["oe"]:
        hata(f"{k['id']}: ot var oe yok")
    if k["otyz"] and not k["ot"]:
        hata(f"{k['id']}: otyz=1 ama ot yok")
    for di in k["d"]:
        if not 0 <= di < len(dst):
            hata(f"{k['id']}: geçersiz deste dizini {di}")
    if k["ob"] is not None:
        a, b = k["ob"]
        u = k["oe"].encode("utf-16-le")
        if not (0 <= a < b <= len(u) // 2):
            hata(f"{k['id']}: ob aralık dışı")
        else:
            parca = u[2 * a:2 * b].decode("utf-16-le")
            ilk = re.split(r"[\s\-]+", k["en"].lower())[0][:3]
            if not parca.lower().startswith(ilk[:2]) and not parca[:1].isalpha():
                say["ob_supheli"] += 1
    say["zor_" + str(k["zor"])] += 1
    say["sv_" + k["sv"]] += 1
for z in range(1, 6):
    if not say["zor_" + str(z)]:
        hata(f"zor {z} kademesi boş")
for s in SEV:
    if not say["sv_" + s]:
        hata(f"seviye {s} boş")
adet = collections.Counter(di for k in kel for di in k["d"])
for i, d in enumerate(dst):
    if set(d) != {"kod", "ad", "adet", "grup"} or d["grup"] not in ("sinav", "tur", "seviye", "ozel"):
        hata(f"deste alanları: {d}")
    if adet[i] != d["adet"]:
        hata(f"deste adedi tutmuyor: {d['kod']} {adet[i]} != {d['adet']}")
for s in SEV:
    if not any(d["kod"] == "seviye_" + s.lower() for d in dst):
        hata(f"seviye destesi yok: {s}")
bilgi.append(f"kelimeler: {len(kel)}, deste: {len(dst)}, tr_sorunlu: {say['tr_sorunlu']}, ob_supheli: {say['ob_supheli']}, "
             f"zor: {[say['zor_' + str(z)] for z in range(1, 6)]}")
if say["tr_sorunlu"]:
    hata(f"tr listesi sorunlu kelime: {say['tr_sorunlu']}")

# kaynaklar.json
for r in icerik["kaynaklar.json"]:
    if set(r) != {"ad", "adres", "lisans", "kullanim"}:
        hata(f"kaynaklar.json alanları: {r}")

# ---------------------------------------------------------------- 3) sözlük parçaları
dizin = icerik["sozluk/dizin.json"]
parcalar = {n[len("sozluk/"):-5]: v for n, v in icerik.items()
            if n.startswith("sozluk/") and n not in ("sozluk/dizin.json", "sozluk/cekirdek.json", "sozluk/tr_en.json")}
if set(parcalar) != set(dizin["parcalar"]):
    hata("dizin.json parça listesi dosyalarla tutmuyor")
top = 0
sira_hata = anahtar_hata = satir_hata = 0
for a, p in parcalar.items():
    g = p["g"]
    top += len(g)
    if dizin["parcalar"].get(a, {}).get("adet") != len(g):
        hata(f"dizin adet tutmuyor: {a}")
    if (VERI / "sozluk" / f"{a}.json").stat().st_size != dizin["parcalar"].get(a, {}).get("bayt"):
        hata(f"dizin bayt tutmuyor: {a}")
    onceki = None
    for r in g:
        if not (isinstance(r, list) and len(r) == 6 and isinstance(r[0], str) and isinstance(r[1], str)
                and (r[2] is None or isinstance(r[2], str)) and isinstance(r[3], list) and isinstance(r[4], list)
                and isinstance(r[5], list)) or len(r[4]) > 5 or len(r[3]) > 8 or len(r[5]) > 8 \
                or any(len(t[0]) > 300 or (t[1] is not None and len(t[1]) > 200) for t in r[4]) or (not r[3] and not r[4]):
            satir_hata += 1
        kk = r[0].lower()
        if parca_anahtari(kk) != a:
            anahtar_hata += 1
        if onceki is not None and kk < onceki:
            sira_hata += 1
        onceki = kk
    for b, kok in p["b"].items():
        if parca_anahtari(b) != a:
            anahtar_hata += 1
if top != dizin["toplam"]:
    hata("dizin toplam tutmuyor")
for ad, v in (("satır biçimi", satir_hata), ("parça anahtarı", anahtar_hata), ("sıra", sira_hata)):
    if v:
        hata(f"sözlük {ad} hatası: {v}")
bilgi.append(f"sözlük: {len(parcalar)} parça, {top} madde")


def bul(sozcuk):
    kk = sozcuk.lower()
    p = parcalar.get(parca_anahtari(kk))
    if not p:
        return []
    anahtarlar = [r[0].lower() for r in p["g"]]
    i = bisect.bisect_left(anahtarlar, kk)
    out = []
    while i < len(anahtarlar) and anahtarlar[i] == kk:
        out.append(p["g"][i]); i += 1
    return out


soz = ro(SOZ_DB)
rnd = random.Random(20261123)
n_girdi = soz.execute("select max(id) from girdiler").fetchone()[0]
bulunan = 0
ornek_ids = rnd.sample(range(1, n_girdi + 1), 260)
denenen = 0
for gid in ornek_ids:
    r = soz.execute("select kelime from girdiler where id=?", (gid,)).fetchone()
    if not r:
        continue
    denenen += 1
    if any(x[0] == r[0] for x in bul(r[0])):
        bulunan += 1
    else:
        hata(f"sözlükte bulunamadı: {r[0]}")
    if denenen >= 200:
        break
bilgi.append(f"rastgele sözlük kelimesi ikili aramayla: {bulunan}/{denenen}")

CEKIM = {"went": "go", "gone": "go", "children": "child", "better": "good", "studies": "study", "mice": "mouse",
         "feet": "foot", "teeth": "tooth", "geese": "goose", "women": "woman", "men": "man", "people": "person",
         "ran": "run", "taken": "take", "took": "take", "written": "write", "wrote": "write", "bought": "buy",
         "thought": "think", "brought": "bring", "caught": "catch", "taught": "teach", "seen": "see", "saw": "see",
         "ate": "eat", "eaten": "eat", "drove": "drive", "flew": "fly", "flown": "fly", "began": "begin",
         "begun": "begin", "swam": "swim", "sang": "sing", "worse": "bad", "worst": "bad", "best": "good",
         "analyses": "analysis", "criteria": "criterion", "phenomena": "phenomenon", "hypotheses": "hypothesis",
         "data": "datum", "leaves": "leaf", "knives": "knife", "wives": "wife", "lives": "life",
         "cities": "city", "tried": "try", "making": "make", "stopped": "stop", "bigger": "big", "happier": "happy"}
cekim_ok = 0
for b, kok in CEKIM.items():
    p = parcalar.get(parca_anahtari(b), {})
    v = p.get("b", {}).get(b, "")
    if kok in v.split("|"):
        cekim_ok += 1
    else:
        hata(f"çekim köke gitmiyor: {b} → {v!r} (beklenen {kok})")
bilgi.append(f"çekimli biçim → kök: {cekim_ok}/{len(CEKIM)}")

# çekirdek
C = icerik["sozluk/cekirdek.json"]
cg = C["g"]
if any(cg[i][0].lower() > cg[i + 1][0].lower() for i in range(len(cg) - 1)):
    hata("cekirdek sırasız")
ck = {r[0].lower() for r in cg}
eksik_deste = [k["en"] for k in kel if k["en"].lower() not in ck]
bilgi.append(f"cekirdek: {len(cg)} madde, {len(C['b'])} biçim; çekirdekte olmayan deste kelimesi (sözlükte maddesi yok): {len(eksik_deste)}")
if any(kok_ not in ck for v in C["b"].values() for kok_ in [x.lower() for x in v.split("|")]):
    hata("cekirdek b çekirdekte olmayan köke gidiyor")

# tr.json
if dizin.get("tr_dizin") != "tr_en.json":
    hata("dizin.json tr_dizin alanı")
T = icerik["sozluk/tr_en.json"]
anah = [x[0] for x in T]
if anah != sorted(anah) or len(set(anah)) != len(anah):
    hata("tr_en.json Python sorted sırasında / tekil değil")
if any(len(x[1]) > 12 or not x[1] for x in T):
    hata("tr_en.json liste boyu")
for ara in ("ev", "güzel", "gitmek", "ışık", "İstanbul", "şeker", "öğretmen", "çocuk", "IŞIK", "kitap"):
    a = tr_kucuk(ara)
    i = bisect.bisect_left(anah, a)
    if i < len(anah) and anah[i] == a:
        bilgi.append(f"tr '{ara}' → {T[i][1][:5]}")
    else:
        onek = [anah[j] for j in range(i, min(i + 3, len(anah))) if anah[j].startswith(a)]
        if onek:
            bilgi.append(f"tr '{ara}' tam yok, önekle: {onek}")
        else:
            hata(f"tr_en.json'da sonuç yok: {ara}")

# ---------------------------------------------------------------- 4) ÖSYM / OneStopQA sızıntısı
dil = ro(DIL_DB)
metinler = [r[0] for r in dil.execute("select kok from sorular where kok is not null") if len(r[0]) >= 40]
metinler += [r[0] for r in dil.execute("select metin from parcalar where metin is not null") if len(r[0]) >= 40]
diziler = []
for _ in range(300):
    m = rnd.choice(metinler)
    m = re.sub(r"\s+", " ", m)
    bas = rnd.randrange(0, max(1, len(m) - 45))
    diziler.append(m[bas:bas + 45])
buyuk = []
for y in [VERI / "kelimeler.json"] + sorted(SOZ.glob("*.json")):
    buyuk.append(y.read_text(encoding="utf-8"))
buyuk = "\n".join(buyuk)
eslesen = [d for d in diziler if d in buyuk or json.dumps(d, ensure_ascii=False)[1:-1] in buyuk]
bilgi.append(f"sızıntı denemesi: 300 dizgi (45 karakter), eşleşen {len(eslesen)}")
for d in eslesen:
    hata(f"sınav metni çıktıda: {d!r}")

print("\n".join(bilgi))
if hatalar:
    print(f"\nHATA ({len(hatalar)}):")
    print("\n".join(hatalar[:60]))
    sys.exit(1)
print("\nHEPSİ GEÇTİ")
