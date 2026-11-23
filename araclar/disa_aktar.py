# -*- coding: utf-8 -*-
"""Kelime Kartı PWA veri dışa aktarımı.

Kaynak (SALT OKUNUR): veri/dil/dil.db, veri/dil/sozluk.db
Çıktı: kelime-kartlari/site/veri/{kelimeler.json,kaynaklar.json,sozluk/*.json}

Koşma:  .venv/Scripts/python.exe -X utf8 kelime-kartlari/araclar/disa_aktar.py [--yalniz-kelimeler]
Belirlenimci; internet gerektirmez. Her dosya önce .tmp adına yazılır, sonra os.replace ile yerine konur.

Telif: yalnız kelime + sözlük verisi çıkar. Örnek cümle yalnız açık kaynaklıysa (tatoeba#, wiktionary-en ve
sozluk.db'de gerçekten bulunuyorsa) aktarılır; ÖSYM / OneStopQA metinleriyle 8 sözcüklük ortak dizisi olan
örnek / tanım atılır.
"""
import argparse, collections, gzip, json, os, re, sqlite3, statistics, sys, time, unicodedata
from pathlib import Path

import numpy as np
from wordfreq import zipf_frequency

KOK = Path(__file__).resolve().parents[2]          # .../Makale
DIL_DB = KOK / "veri" / "dil" / "dil.db"
SOZ_DB = KOK / "veri" / "dil" / "sozluk.db"
CIKTI = KOK / "kelime-kartlari" / "site" / "veri"
SOZ_CIKTI = CIKTI / "sozluk"
# Türkçe → İngilizce ters dizin. Brifteki ad "tr.json" idi ama "tr" aynı zamanda "tr…" ile başlayan kelimelerin
# parça anahtarı (tr.json) olduğundan çakışıyordu; 2 karakterden uzun ad seçildi ve dizin.json'a "tr_dizin" alanı eklendi.
TR_DIZIN = "tr_en.json"
OZEL_DOSYALAR = ("dizin.json", "cekirdek.json", TR_DIZIN)
SURUM = "2026-11-23"
SEVIYELER = ["A1", "A2", "B1", "B2", "C1", "C2"]
COK_KELIMELI_TUR = {"phrasal", "deyim", "esdizim", "edat", "baglac"}

# sözlük kırpma sınırları
TANIM_EN_COK = 5
TANIM_KAR = 300
ORNEK_KAR = 200
ES_EN_COK = 8
TR_EN_COK = 8
CEKIRDEK_HEDEF_BAYT = 15 * 1024 * 1024
TOPLAM_HEDEF_BAYT = 150 * 1024 * 1024

DURAK = set("""a an the of to in on at by for with from up down out off over into onto about as and or but
not no be is are was were been being do does did have has had it its one one's oneself someone somebody
something sth sb someone's somebody's your yours you me my his her their them they this that these those
so than then too very""".split())


def ro(yol):
    return sqlite3.connect(f"file:{yol.as_posix()}?mode=ro", uri=True)


def jdump(o):
    return json.dumps(o, ensure_ascii=False, separators=(",", ":"))


def yaz(yol: Path, metin: str) -> int:
    yol.parent.mkdir(parents=True, exist_ok=True)
    gecici = yol.with_name(yol.name + ".tmp")
    veri = metin.encode("utf-8")
    with open(gecici, "wb") as f:
        f.write(veri)
    os.replace(gecici, yol)
    return len(veri)


def tr_kucuk(s: str) -> str:
    return s.replace("I", "ı").replace("İ", "i").lower()


def liste_temizle(xs, n, bas_kelime=None):
    cikti, gorulen = [], set()
    for x in xs or []:
        if not isinstance(x, str):
            continue
        x = re.sub(r"\s+", " ", x).strip()
        if not x or "(bak" in x:
            continue
        a = x.casefold()
        if a in gorulen:
            continue
        gorulen.add(a)
        cikti.append(x)
        if len(cikti) >= n:
            break
    return cikti


def jl(s):
    if not s:
        return []
    try:
        v = json.loads(s)
    except Exception:
        return []
    return v if isinstance(v, list) else []


# ---------------------------------------------------------------- sızıntı süzgeci (ÖSYM / OneStopQA)
SOZCUK_RE = re.compile(r"[a-z0-9]+(?:['’][a-z]+)?")
N_GRAM = 8


ILISKI_RE = re.compile(r"^\s*(?:near-)?(?:synonyms?|antonyms?|holonyms?|meronyms?|hypernyms?|hyponyms?|coordinate terms?|troponyms?|see also|derived terms?|related terms?)\s*:", re.I)


def iliski_satiri(o):
    """Wiktionary'de örnek alanına düşmüş "Near-synonym: …" gibi ilişki satırları örnek değildir."""
    return bool(ILISKI_RE.match(o))


def sozcukler(metin):
    return SOZCUK_RE.findall(metin.lower().replace("’", "'"))


def sinav_ngramlari():
    c = ro(DIL_DB)
    metinler = [r[0] for r in c.execute("select metin from parcalar") if r[0]]
    for kok, sec in c.execute("select kok, secenekler_json from sorular"):
        if kok:
            metinler.append(kok)
        if sec:
            try:
                metinler.extend(str(v) for v in json.loads(sec).values())
            except Exception:
                pass
    kume = set()
    for m in metinler:
        w = sozcukler(m)
        for i in range(len(w) - N_GRAM + 1):
            kume.add(" ".join(w[i:i + N_GRAM]))
    return kume


def sizinti_var(metin, kume):
    w = sozcukler(metin)
    for i in range(len(w) - N_GRAM + 1):
        if " ".join(w[i:i + N_GRAM]) in kume:
            return True
    return False


# ---------------------------------------------------------------- seviye tahmini
def esik_uydur(xs, ys):
    """xs: puan (yüksek = kolay), ys: 0..5. 5 eşik; seviye = puanı eşikten küçük olan eşik sayısı."""
    xs = np.asarray(xs, float); ys = np.asarray(ys, int)
    med = [float(np.median(xs[ys == k])) for k in range(6)]
    cuts = np.array([(med[k] + med[k + 1]) / 2 for k in range(5)])

    def isabet(cs):
        return int(((xs[:, None] < cs[None, :]).sum(1) == ys).sum())

    en_iyi = isabet(cuts)
    for _ in range(3):
        for k in range(5):
            ust = cuts[k - 1] if k > 0 else 8.0
            alt = cuts[k + 1] if k < 4 else 0.0
            for aday in np.linspace(alt, ust, 162)[1:-1]:
                cs = cuts.copy(); cs[k] = aday
                a = isabet(cs)
                if a > en_iyi:
                    en_iyi, cuts = a, cs
    return cuts, med


def ortanca_esik(xs, ys):
    xs = np.asarray(xs, float); ys = np.asarray(ys, int)
    med = [float(np.median(xs[ys == k])) for k in range(6)]
    return np.array([(med[k] + med[k + 1]) / 2 for k in range(5)]), med


def esikle(cuts, x):
    return int((x < cuts).sum())


def seviye_modeli(tum_kelimeler):
    """tum_kelimeler: [(lemma, tur, seviye|None, zipf)] (dil.db'nin tamamı). Döner: tahmin fonksiyonu + rapor."""
    etiketli = [(l, t, SEVIYELER.index(s), z) for l, t, s, z in tum_kelimeler
                if s in SEVIYELER and z is not None and " " not in l]
    lemma_sv = collections.defaultdict(dict)
    for l, t, s, z in tum_kelimeler:
        if s in SEVIYELER:
            lemma_sv[l.lower()][t] = SEVIYELER.index(s)

    def puan(l, z, a):
        return z - a * len(l)

    # 5 kat çapraz doğrulama (belirlenimci katlar: sıra numarası mod 5)
    adaylar = []
    for ad, fn in (("ortanca", ortanca_esik), ("esik", esik_uydur)):
        for a in (0.0, 0.03, 0.06):
            tam = pm1 = n = 0
            for f in range(5):
                eg = [r for i, r in enumerate(etiketli) if i % 5 != f]
                te = [r for i, r in enumerate(etiketli) if i % 5 == f]
                cuts, _ = fn([puan(r[0], r[3], a) for r in eg], [r[2] for r in eg])
                for r in te:
                    p = esikle(cuts, puan(r[0], r[3], a)); n += 1
                    tam += p == r[2]; pm1 += abs(p - r[2]) <= 1
            adaylar.append({"yontem": ad, "uzunluk_katsayi": a, "tam": round(tam / n, 4), "pm1": round(pm1 / n, 4), "n": n})
    secilen = max(adaylar, key=lambda d: (d["pm1"] + d["tam"], d["tam"], -d["uzunluk_katsayi"]))
    a = secilen["uzunluk_katsayi"]
    fn = ortanca_esik if secilen["yontem"] == "ortanca" else esik_uydur
    cuts, med = fn([puan(r[0], r[3], a) for r in etiketli], [r[2] for r in etiketli])

    # aynı lemma başka türde seviyeli → o seviye: ölç
    tot = ayni = yakin = 0
    for l, ts in lemma_sv.items():
        v = list(ts.values())
        for i in range(len(v)):
            for j in range(len(v)):
                if i != j:
                    tot += 1; ayni += v[i] == v[j]; yakin += abs(v[i] - v[j]) <= 1

    def tek(sozcuk, z=None):
        s = lemma_sv.get(sozcuk.lower())
        if s:
            return min(s.values())
        if z is None:
            z = zipf_frequency(sozcuk, "en")
        return esikle(cuts, puan(sozcuk, z, a))

    def tahmin(lemma, tur, zipf):
        """Döner: (seviye dizini, kural)"""
        lk = lemma.lower()
        cok = (" " in lk) or tur in ("phrasal", "deyim", "esdizim")
        if not cok:
            if lk in lemma_sv:
                return min(lemma_sv[lk].values()), "baska_tur"
            return esikle(cuts, puan(lemma, zipf, a)), "zipf"
        icerik = [w for w in re.split(r"[\s\-]+", lk) if w and w not in DURAK and not w.endswith("'s")]
        if icerik:
            taban = max(tek(w) for w in icerik)
        else:
            taban = esikle(cuts, puan(lemma, zipf, a))
        return min(5, taban + 1), "obek+1"

    rapor = {"adaylar": adaylar, "secilen": secilen, "esikler": [round(float(x), 3) for x in cuts],
             "seviye_ortanca_zipf": {SEVIYELER[i]: round(m, 2) for i, m in enumerate(med)},
             "baska_tur_olcum": {"cift": tot, "ayni": round(ayni / tot, 4) if tot else None,
                                 "pm1": round(yakin / tot, 4) if tot else None},
             "etiketli_tek_kelime": len(etiketli)}
    return tahmin, rapor


# ---------------------------------------------------------------- örnekte kelimeyi bulma (ob)
def tahmini_cekimler(w):
    f = {w, w + "s", w + "es", w + "ed", w + "d", w + "ing", w + "er", w + "est", w + "'s"}
    if w.endswith("y") and len(w) > 2:
        f |= {w[:-1] + "ies", w[:-1] + "ied", w[:-1] + "ier", w[:-1] + "iest"}
    if w.endswith("e"):
        f |= {w[:-1] + "ing"}
    if len(w) >= 3 and w[-1] not in "aeiouwxy" and w[-2] in "aeiou" and w[-3] not in "aeiou":
        f |= {w + w[-1] + "ed", w + w[-1] + "ing", w + w[-1] + "er", w + w[-1] + "est"}
    if w.endswith("f"):
        f |= {w[:-1] + "ves"}
    if w.endswith("fe"):
        f |= {w[:-2] + "ves"}
    return f


def utf16(s, i):
    return len(s[:i].encode("utf-16-le")) // 2


def kelime_araligi(oe, lemma, tur, bicim_fn):
    lk = lemma.lower()
    parca = [p for p in re.split(r"[\s]+", lk) if p]
    if not parca:
        return None

    def kalip(tok, ilk):
        if tok in ("one's", "someone's", "somebody's", "his/her"):
            return r"\S+"
        if tok in ("someone", "somebody", "something", "sth", "sb", "oneself", "one"):
            return r"\S+(?:\s+\S+)?"
        bic = tahmini_cekimler(tok)
        if ilk or len(parca) == 1:
            bic |= set(bicim_fn(tok))
        bic = sorted(bic, key=lambda x: (-len(x), x))
        return "(?:" + "|".join(re.escape(b).replace("'", "['’]").replace(r"\-", r"[\-\s]?") for b in bic) + ")"

    ara = r"\s+(?:\S+\s+){0,3}?" if tur in ("phrasal", "deyim") and len(parca) > 1 else r"[\s\-]+"
    desen = ara.join(kalip(t, i == 0) for i, t in enumerate(parca))
    m = re.search(r"(?<![A-Za-z])" + desen + r"(?![A-Za-z])", oe, re.IGNORECASE)
    if not m and len(parca) > 1 and tur not in ("phrasal", "deyim"):
        # birleşik yazım (ör. "health care" → "healthcare")
        m = re.search(r"(?<![A-Za-z])" + re.escape("".join(parca)) + r"\w*", oe, re.IGNORECASE)
    if not m:
        return None
    return [utf16(oe, m.start()), utf16(oe, m.end())]


# ---------------------------------------------------------------- kelimeler.json
def deste_grubu(kod):
    if kod.startswith(("yds_", "yokdil_", "toefl_")):
        return "sinav"
    if kod.startswith("tur_"):
        return "tur"
    if kod.startswith("seviye_"):
        return "seviye"
    return "ozel"


def kelimeler_uret(soz, ngram, bicim_index):
    c = ro(DIL_DB)
    tum = c.execute("select lemma, tur, seviye, genel_siklik from kelimeler").fetchall()
    tahmin, sv_rapor = seviye_modeli(tum)

    destedeki = {r[0] for r in c.execute("select distinct kelime_id from deste_kelime")}
    onem = {k: o for k, o in c.execute("select kelime_id, onem from kelime_ozet where sinav_kodu='HEPSI'")}
    satirlar = c.execute("""select id, lemma, tur, ipa, seviye, genel_siklik, tr_json, tanim_en, ornek_en, ornek_tr,
                            esanlam_json, kaynak_json from kelimeler order by id""").fetchall()
    sayac = collections.Counter()
    kel = []
    for (kid, lemma, tur, ipa, seviye, z, trj, tanim, oe, ot, esj, kj) in satirlar:
        if kid not in destedeki:
            continue
        k = json.loads(kj) if kj else {}
        z = float(z) if z is not None else zipf_frequency(lemma, "en")
        if seviye in SEVIYELER:
            sv, svt = SEVIYELER.index(seviye), 0
        else:
            sv, kural = tahmin(lemma, tur, z); svt = 1
            sayac["sv_tahmin_" + kural] += 1
        # örnek: yalnız açık kaynak
        okaynak = k.get("ornek")
        if oe:
            acik = False
            if isinstance(okaynak, str) and okaynak.startswith("tatoeba#"):
                acik = True; sayac["ornek_tatoeba"] += 1
            elif okaynak == "wiktionary-en":
                if soz.ornek_sozlukte_var(k.get("sozluk_girdi_id"), lemma, oe):
                    acik = True; sayac["ornek_wiktionary"] += 1
                else:
                    sayac["ornek_atlandi_wiktionary_dogrulanamadi"] += 1
            else:
                sayac["ornek_atlandi_kaynak_belirsiz:" + str(okaynak)] += 1
            if acik and iliski_satiri(oe):
                acik = False; sayac["ornek_atlandi_iliski_satiri"] += 1
            if acik and sizinti_var(oe, ngram):
                acik = False; sayac["ornek_atlandi_sinav_metni"] += 1
            if not acik:
                oe = ot = None
        if not oe:
            ot = None
        otyz = 1 if (ot and k.get("ornek_tr_kaynak") == "yz") else 0
        ob = None
        if oe:
            ob = kelime_araligi(oe, lemma, tur, bicim_index)
            sayac["ob_bulundu" if ob else "ob_bulunamadi"] += 1
        if tanim and sizinti_var(tanim, ngram):
            tanim = None; sayac["tanim_atlandi_sinav_metni"] += 1
        tr = liste_temizle(jl(trj), 6)
        kel.append({"id": f"{lemma}|{tur}", "en": lemma, "tur": tur, "ipa": ipa or None,
                    "sv": SEVIYELER[sv], "svt": svt, "zipf": round(z, 2), "zor": 0,
                    "tr": tr, "tanim": tanim or None, "oe": oe or None, "ot": ot or None, "otyz": otyz, "ob": ob,
                    "es": liste_temizle(jl(esj), 6), "d": [],
                    "onem": round(onem[kid] / 100, 3) if kid in onem and onem[kid] is not None else None,
                    "_kid": kid, "_svi": sv})

    # zor: seviye (0..5) + ters Zipf birleşik puanı, beşte birlik dilimler
    def zpuan(r):
        return 0.6 * r["_svi"] / 5 + 0.4 * min(1.0, max(0.0, (6.5 - r["zipf"]) / 4.5))
    sirali = sorted(kel, key=lambda r: (zpuan(r), r["id"]))
    n = len(sirali)
    for i, r in enumerate(sirali):
        r["zor"] = min(5, 1 + (i * 5) // n)

    # sıra: önem azalan, Zipf azalan, id
    kel.sort(key=lambda r: (-(r["onem"] if r["onem"] is not None else -1), -r["zipf"], r["id"]))

    # desteler (seviye desteleri sv'den yeniden)
    kid2i = {r["_kid"]: i for i, r in enumerate(kel)}
    desteler, uyeler = [], []
    seviye_eklendi = False
    for did, kod, ad in c.execute("select id, kod, ad from desteler order by id"):
        if kod.startswith("seviye_"):
            if seviye_eklendi:
                continue
            seviye_eklendi = True
            for s in SEVIYELER:
                desteler.append({"kod": "seviye_" + s.lower(), "ad": f"{s} seviyesi", "adet": 0, "grup": "seviye"})
                uyeler.append([i for i, r in enumerate(kel) if r["sv"] == s])
            continue
        ids = [kid2i[k] for (k,) in c.execute("select kelime_id from deste_kelime where deste_id=? order by sira, kelime_id", (did,)) if k in kid2i]
        desteler.append({"kod": kod, "ad": ad, "adet": 0, "grup": deste_grubu(kod)})
        uyeler.append(ids)
    for di, ids in enumerate(uyeler):
        desteler[di]["adet"] = len(ids)
        for i in ids:
            kel[i]["d"].append(di)
    for r in kel:
        r["d"].sort()
        r.pop("_kid"); r.pop("_svi")

    cikti = {"surum": SURUM, "sayim": len(kel), "desteler": desteler, "kelimeler": kel}
    bayt = yaz(CIKTI / "kelimeler.json", jdump(cikti))

    # rapor
    tahminler = collections.Counter(r["sv"] for r in kel if r["svt"])
    rapor = {"kelime": len(kel), "bayt": bayt, "gzip": len(gzip.compress(jdump(cikti).encode("utf-8"), 9)),
             "seviye": dict(collections.Counter(r["sv"] for r in kel)), "seviye_tahmin": dict(tahminler),
             "zor": dict(sorted(collections.Counter(r["zor"] for r in kel).items())),
             "oe": sum(1 for r in kel if r["oe"]), "ot": sum(1 for r in kel if r["ot"]),
             "otyz": sum(r["otyz"] for r in kel), "ipa": sum(1 for r in kel if r["ipa"]),
             "tanim": sum(1 for r in kel if r["tanim"]), "onem_null": sum(1 for r in kel if r["onem"] is None),
             "sayac": dict(sayac), "seviye_modeli": sv_rapor,
             "desteler": {d["kod"]: d["adet"] for d in desteler}}
    return kel, rapor


# ---------------------------------------------------------------- sözlük erişimi
class Sozluk:
    def __init__(self):
        self.c = ro(SOZ_DB)
        self._ornek_onbellek = {}

    def ornekler(self, gid):
        r = self.c.execute("select tanimlar_json from girdiler where id=?", (gid,)).fetchone()
        out = []
        if r and r[0]:
            for t in json.loads(r[0]):
                out.extend(t.get("ornekler") or [])
        return out

    def ornek_sozlukte_var(self, gid, lemma, oe):
        adaylar = []
        if gid:
            adaylar.append(gid)
        adaylar += [r[0] for r in self.c.execute("select id from girdiler where kelime_kucuk=?", (lemma.lower(),))]
        hedef = oe.strip()
        for g in adaylar:
            for o in self.ornekler(g):
                if hedef in o:
                    return True
        return False


def bicim_index_kur(soz):
    """kök (küçük) → çekimli biçimler kümesi (cekimler_json + bicimler)."""
    idx = collections.defaultdict(set)
    gid2k = {}
    for gid, kk, cek in soz.c.execute("select id, kelime_kucuk, cekimler_json from girdiler"):
        gid2k[gid] = kk
        if cek:
            try:
                for d in json.loads(cek):
                    b = (d.get("bicim") or "").lower().strip()
                    if b and " " not in b and len(b) < 40:
                        idx[kk].add(b)
            except Exception:
                pass
    for b, gid in soz.c.execute("select bicim_kucuk, girdi_id from bicimler"):
        kk = gid2k.get(gid)
        if kk and b:
            idx[kk].add(b)
    return lambda w: idx.get(w.lower(), ())


# ---------------------------------------------------------------- sözlük parçaları
def k1(ch):
    return ch if ("a" <= ch <= "z" or "0" <= ch <= "9") else "_"


def parca_anahtari(kucuk):
    s = "".join(ch for ch in unicodedata.normalize("NFKD", kucuk) if not unicodedata.combining(ch))
    a = k1(s[0]) if len(s) > 0 else "_"
    b = k1(s[1]) if len(s) > 1 else "_"
    return a + b


def ornek_sec(ornekler, ngram, sayac):
    for o in ornekler or []:
        if not isinstance(o, str):
            continue
        o = o.strip()
        if "\n" in o:          # Wiktionary alıntısı: "1839, Yazar, Eser,\n“metin”" → yalnız alıntı metni
            o = o.split("\n")[-1].strip()
        o = o.strip()
        if not o or len(o) > ORNEK_KAR or iliski_satiri(o):
            continue
        if sizinti_var(o, ngram):
            sayac["soz_ornek_atlandi_sinav_metni"] += 1
            continue
        return o
    return None


def kisalt(s, n):
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def sozluk_uret(soz, ngram, kel, tanim_sinir=TANIM_EN_COK, ornek_kuyruk=True):
    sayac = collections.Counter()
    satirlar = {}       # gid → (kucuk, satir)
    gorulen = set()
    for gid, kelime, kk, tur, ipa, tj, esj, trj in soz.c.execute(
            "select id, kelime, kelime_kucuk, tur, ipa, tanimlar_json, esanlam_json, tr_json from girdiler order by id"):
        anahtar = (kelime, tur)
        if anahtar in gorulen:
            sayac["yinelenen_atlandi"] += 1
            continue
        tanimlar = []
        for t in jl(tj)[: tanim_sinir * 3]:
            if not isinstance(t, dict):
                continue
            metin = (t.get("tanim") or "").strip()
            if not metin:
                continue
            if sizinti_var(metin, ngram):
                sayac["soz_tanim_atlandi_sinav_metni"] += 1
                continue
            ornek = ornek_sec(t.get("ornekler"), ngram, sayac) if ornek_kuyruk else None
            tanimlar.append([kisalt(metin, TANIM_KAR), ornek])
            if len(tanimlar) >= tanim_sinir:
                break
        tr = liste_temizle(jl(trj), TR_EN_COK)
        if not tanimlar and not tr:
            sayac["bos_atlandi"] += 1
            continue
        gorulen.add(anahtar)
        es = liste_temizle(jl(esj), ES_EN_COK)
        satirlar[gid] = (kk, [kelime, tur, ipa or None, tr, tanimlar, es])
    sayac["madde"] = len(satirlar)

    # çekimli biçimler → kökler
    kok_ad = {gid: s[1][0] for gid, s in satirlar.items()}
    bicim_kok = collections.defaultdict(set)
    for b, gid in soz.c.execute("select bicim_kucuk, girdi_id from bicimler"):
        if b and b.startswith(("more ", "most ")):
            sayac["bicim_atlandi_more_most"] += 1      # "more abandoned" → uygulama "more/most " önekini kendisi atabilir
            continue
        if gid in kok_ad and b:
            ad = kok_ad[gid]
            if ad.lower() != b:
                bicim_kok[b].add(ad)
    zcache = {}

    def zf(w):
        if w not in zcache:
            zcache[w] = zipf_frequency(w, "en")
        return zcache[w]

    def kok_birlestir(adlar):
        if len(adlar) == 1:
            return next(iter(adlar))
        return "|".join(sorted(adlar, key=lambda w: (-zf(w), w.lower(), w)))

    return satirlar, bicim_kok, kok_birlestir, sayac


def parcalari_yaz(satirlar, bicim_kok, kok_birlestir):
    parcalar = collections.defaultdict(list)
    for gid, (kk, satir) in satirlar.items():
        parcalar[parca_anahtari(kk)].append((kk, satir[0], satir[1], gid, satir))
    bpar = collections.defaultdict(dict)
    for b in sorted(bicim_kok):
        bpar[parca_anahtari(b)][b] = kok_birlestir(bicim_kok[b])
    SOZ_CIKTI.mkdir(parents=True, exist_ok=True)
    # eski parçaları temizle (yeniden koşmada artık kalmasın)
    anahtarlar = sorted(set(parcalar) | set(bpar))
    for eski in SOZ_CIKTI.glob("*.json"):
        if eski.stem not in anahtarlar and eski.name not in OZEL_DOSYALAR:
            eski.unlink()
    dizin, olcum = {}, []
    toplam_ham = toplam_gz = 0
    for a in anahtarlar:
        g = [x[4] for x in sorted(parcalar.get(a, []), key=lambda x: (x[0], x[1], x[2], x[3]))]
        metin = jdump({"g": g, "b": bpar.get(a, {})})
        bayt = yaz(SOZ_CIKTI / f"{a}.json", metin)
        gz = len(gzip.compress(metin.encode("utf-8"), 6))
        dizin[a] = {"adet": len(g), "bayt": bayt}
        olcum.append((a, len(g), bayt, gz))
        toplam_ham += bayt; toplam_gz += gz
    return dizin, olcum, toplam_ham, toplam_gz


def cekirdek_yaz(satirlar, bicim_kok, kok_birlestir, kel, tanim_sinir, ornek_yalniz_deste=False):
    deste_k = {r["en"].lower() for r in kel}
    secilen = {gid: s for gid, s in satirlar.items() if s[1][3] or s[0] in deste_k}

    def kirp(kk, satir):
        tan = satir[4][:tanim_sinir]
        if ornek_yalniz_deste and kk not in deste_k:
            tan = [[t, None] for t, _ in tan]
        return satir[:4] + [tan] + satir[5:]
    g = [kirp(s[0], s[1]) for gid, s in sorted(secilen.items(), key=lambda x: (x[1][0], x[1][1][0], x[1][1][1], x[0]))]
    adlar = {s[1][0] for s in secilen.values()}
    b = {}
    for bic in sorted(bicim_kok):
        kk = bicim_kok[bic] & adlar
        if kk:
            b[bic] = kok_birlestir(kk)
    metin = jdump({"g": g, "b": b})
    return metin, len(g), len(b)


def tr_dizin_yaz(satirlar, kel):
    tr2en = collections.defaultdict(dict)   # anahtar → {en: öncelik}
    zc = {}

    def zf(w):
        if w not in zc:
            zc[w] = zipf_frequency(w, "en")
        return zc[w]

    def anahtarlar(x):
        x = re.sub(r"\([^)]*\)", " ", x)
        for p in re.split(r"[:;,/]", x):
            p = re.sub(r"\s+", " ", p).strip(" .!?\"'-–")
            if 2 <= len(p) <= 40:
                yield tr_kucuk(p)

    for i, r in enumerate(kel):
        for pos, t in enumerate(r["tr"]):
            for a in anahtarlar(t):
                onc = (0, min(pos, 3), -r["zipf"], r["en"].lower(), r["en"])
                if r["en"] not in tr2en[a] or tr2en[a][r["en"]] > onc:
                    tr2en[a][r["en"]] = onc
    for gid, (kk, satir) in satirlar.items():
        en = satir[0]
        for pos, t in enumerate(satir[3]):
            for a in anahtarlar(t):
                onc = (1, min(pos, 3), -zf(en), en.lower(), en)
                if en not in tr2en[a] or tr2en[a][en] > onc:
                    tr2en[a][en] = onc
    liste = []
    for a in sorted(tr2en):
        ens = sorted(tr2en[a].items(), key=lambda kv: (kv[1], kv[0]))
        liste.append([a, [e for e, _ in ens[:12]]])
    return jdump(liste), len(liste)


KAYNAKLAR = [
    {"ad": "Wiktionary İngilizce dökümü (kaikki.org / wiktextract, 2026-10-30)", "adres": "https://kaikki.org/dictionary/English/",
     "lisans": "CC BY-SA 4.0 ve GFDL", "kullanim": "Sözlük tanımları, örnekler, okunuş (IPA), eş anlamlılar, çekimli biçimler, bir kısım Türkçe karşılık; kart tanımları ve 351 örnek cümle"},
    {"ad": "Türkçe Vikisözlük dökümü (kaikki.org, 2026-11-03)", "adres": "https://kaikki.org/trwiktionary/",
     "lisans": "CC BY-SA 4.0 ve GFDL", "kullanim": "İngilizce maddelerin Türkçe karşılıkları"},
    {"ad": "FreeDict eng-tur 0.3", "adres": "https://freedict.org/", "lisans": "GPL-2.0 veya sonrası",
     "kullanim": "Vikisözlük'te karşılığı olmayan kelimeler için Türkçe karşılık yedeği"},
    {"ad": "Tatoeba", "adres": "https://tatoeba.org/", "lisans": "CC BY 2.0 FR (Tatoeba katkıcıları)",
     "kullanim": "Kartlardaki İngilizce örnek cümleler ve insan çevirisi Türkçeleri"},
    {"ad": "CEFR-J Vocabulary Profile 1.5 (Yukio Tono, Tokyo University of Foreign Studies)", "adres": "https://github.com/openlanguageprofiles/olp-en-cefrj",
     "lisans": "Araştırma ve ticari kullanım ücretsiz, atıf koşuluyla", "kullanim": "Kelime seviyeleri A1–B2"},
    {"ad": "Octanove Vocabulary Profile C1/C2 1.0", "adres": "https://github.com/openlanguageprofiles/olp-en-cefrj",
     "lisans": "CC BY-SA 4.0", "kullanim": "Kelime seviyeleri C1–C2"},
    {"ad": "NGSL / NAWL 1.2 (Browne, Culligan, Phillips)", "adres": "https://www.newgeneralservicelist.com/new-academic-word-list",
     "lisans": "CC BY-SA 4.0", "kullanim": "Akademik kelime destesi (TOEFL akademik), birkaç tanım"},
    {"ad": "wordfreq 3.x (Robyn Speer ve ark.)", "adres": "https://github.com/rspeer/wordfreq",
     "lisans": "Kod MIT, veri CC BY-SA 4.0", "kullanim": "Kelime sıklığı (Zipf), seviyesi olmayan kelimelerde seviye tahmini, zorluk"},
    {"ad": "WordNet 3.0 (Princeton University)", "adres": "https://wordnet.princeton.edu/",
     "lisans": "WordNet 3.0 lisansı (serbest kullanım, telif bildirimiyle)", "kullanim": "Kök bulma (lemma) yedeği"},
    {"ad": "NLTK averaged perceptron tagger", "adres": "https://www.nltk.org/", "lisans": "Apache 2.0",
     "kullanim": "Kelime türü etiketleme"},
    {"ad": "Claude (Anthropic) yapay zekâ çevirisi", "adres": "https://www.anthropic.com/",
     "lisans": "Uygulama için üretilmiş içerik", "kullanim": "Açık sözlüklerde karşılığı olmayan kelimelerin Türkçe önerileri ve 22 örnek çevirisi (\"YZ\" işaretli)"},
    {"ad": "Deste seçimi: ÖSYM YDS / YÖKDİL kitapçıklarında geçen kelimelerin sayımı", "adres": "https://www.osym.gov.tr/",
     "lisans": "Yalnız kelime listesi ve sayım (olgusal veri); soru, parça ve şık metni uygulamada YOKTUR",
     "kullanim": "Hangi kelimenin hangi sınav destesinde olduğu ve önem puanı"},
]


def kaynaklar_yaz():
    yaz(CIKTI / "kaynaklar.json", jdump(KAYNAKLAR))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--yalniz-kelimeler", action="store_true")
    arg = ap.parse_args()
    t0 = time.time()
    print("sınav metni 8-gram kümesi…", flush=True)
    ngram = sinav_ngramlari()
    soz = Sozluk()
    print("biçim dizini…", flush=True)
    bicim_index = bicim_index_kur(soz)
    print("kelimeler.json…", flush=True)
    kel, krap = kelimeler_uret(soz, ngram, bicim_index)
    kaynaklar_yaz()
    rapor = {"kelimeler": krap}
    print(json.dumps(krap, ensure_ascii=False, indent=1), flush=True)
    print(f"kelimeler.json bitti ({time.time() - t0:.0f} sn)", flush=True)
    if arg.yalniz_kelimeler:
        return

    print("sözlük…", flush=True)
    satirlar, bicim_kok, kok_birlestir, ssay = sozluk_uret(soz, ngram, kel)
    dizin, olcum, ham, gz = parcalari_yaz(satirlar, bicim_kok, kok_birlestir)
    kirpma = {"tanim": TANIM_EN_COK, "tanim_kar": TANIM_KAR, "ornek_kar": ORNEK_KAR, "es": ES_EN_COK, "tr": TR_EN_COK}
    if ham > TOPLAM_HEDEF_BAYT:
        print(f"toplam {ham/1e6:.1f} MB > 150 MB: sıkılaştırılıyor (tanım 3, örnek yalnız deste/TR'li maddelerde)", flush=True)
        satirlar, bicim_kok, kok_birlestir, ssay = sozluk_uret(soz, ngram, kel, tanim_sinir=3)
        deste_k = {r["en"].lower() for r in kel}
        for gid, (kk, s) in satirlar.items():
            if not s[3] and kk not in deste_k:
                s[4] = [[t, None] for t, _ in s[4]]
        dizin, olcum, ham, gz = parcalari_yaz(satirlar, bicim_kok, kok_birlestir)
        kirpma.update({"tanim": 3, "ornek": "yalnız Türkçe karşılıklı / deste maddelerinde"})
    yaz(SOZ_CIKTI / "dizin.json", jdump({"surum": SURUM, "toplam": sum(d["adet"] for d in dizin.values()),
                                          "tr_dizin": TR_DIZIN, "cekirdek": "cekirdek.json", "parcalar": dizin}))
    ct = TANIM_EN_COK
    metin, cadet, cb = cekirdek_yaz(satirlar, bicim_kok, kok_birlestir, kel, ct)
    if len(metin.encode("utf-8")) > CEKIRDEK_HEDEF_BAYT:
        ct = 2
        metin, cadet, cb = cekirdek_yaz(satirlar, bicim_kok, kok_birlestir, kel, ct)
    cornek = "hepsi"
    if len(metin.encode("utf-8")) > CEKIRDEK_HEDEF_BAYT:
        cornek = "yalniz_deste"
        metin, cadet, cb = cekirdek_yaz(satirlar, bicim_kok, kok_birlestir, kel, ct, ornek_yalniz_deste=True)
    cbayt = yaz(SOZ_CIKTI / "cekirdek.json", metin)
    cgz = len(gzip.compress(metin.encode("utf-8"), 6))
    trm, tradet = tr_dizin_yaz(satirlar, kel)
    trbayt = yaz(SOZ_CIKTI / TR_DIZIN, trm)
    trgz = len(gzip.compress(trm.encode("utf-8"), 6))
    olcum.sort(key=lambda x: -x[2])
    srap = {"madde": sum(d["adet"] for d in dizin.values()), "parca": len(dizin), "ham_MB": round(ham / 1e6, 2),
            "gzip_MB": round(gz / 1e6, 2), "kirpma": kirpma, "sayac": dict(ssay),
            "en_buyuk_10": [{"parca": a, "adet": n, "ham_KB": round(b / 1024), "gzip_KB": round(g / 1024)} for a, n, b, g in olcum[:10]],
            "gzip_1_5MB_asan": [a for a, n, b, g in olcum if g > 1.5 * 1024 * 1024],
            "ham_8MB_asan": [a for a, n, b, g in olcum if b > 8 * 1024 * 1024],
            "cekirdek": {"madde": cadet, "bicim": cb, "tanim_sinir": ct, "ornek": cornek, "ham_MB": round(cbayt / 1e6, 2), "gzip_MB": round(cgz / 1e6, 2)},
            "tr": {"anahtar": tradet, "ham_MB": round(trbayt / 1e6, 2), "gzip_MB": round(trgz / 1e6, 2)},
            "bicim_toplam": len(bicim_kok)}
    rapor["sozluk"] = srap
    print(json.dumps(srap, ensure_ascii=False, indent=1))
    yaz(KOK / "kelime-kartlari" / "araclar" / "son_rapor.json", json.dumps(rapor, ensure_ascii=False, indent=1))
    print(f"bitti ({time.time() - t0:.0f} sn)")


if __name__ == "__main__":
    main()
