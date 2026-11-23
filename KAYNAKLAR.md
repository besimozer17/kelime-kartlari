# Kelime Kartı – veri kaynakları ve lisanslar

Uygulamadaki kelime ve sözlük verisi aşağıdaki açık kaynaklardan derlendi (`araclar/disa_aktar.py`, 2026-11-23). Makine okunur listesi: `site/veri/kaynaklar.json` (uygulamanın "Hakkında" bölümü).

| Kaynak | Adres | Lisans | Nerede kullanıldı |
|---|---|---|---|
| Wiktionary İngilizce dökümü (kaikki.org / wiktextract, 2026-10-30) | https://kaikki.org/dictionary/English/ | CC BY-SA 4.0 ve GFDL | Sözlük tanımları, örnekler, IPA, eş anlamlılar, çekimli biçimler, bir kısım Türkçe karşılık; kart tanımları ve 321 kart örneği |
| Türkçe Vikisözlük dökümü (kaikki.org, 2026-11-03) | https://kaikki.org/trwiktionary/ | CC BY-SA 4.0 ve GFDL | İngilizce maddelerin Türkçe karşılıkları |
| FreeDict eng-tur 0.3 | https://freedict.org/ | GPL-2.0 veya sonrası | Vikisözlük'te karşılığı olmayan kelimelerde Türkçe karşılık yedeği |
| Tatoeba | https://tatoeba.org/ | CC BY 2.0 FR (Tatoeba katkıcıları) | Kartlardaki örnek cümleler ve insan çevirisi Türkçeleri (6.918) |
| CEFR-J Vocabulary Profile 1.5 (Yukio Tono, TUFS) | https://github.com/openlanguageprofiles/olp-en-cefrj | Ücretsiz, atıf koşuluyla: "The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies." | Seviye A1–B2 |
| Octanove Vocabulary Profile C1/C2 1.0 | https://github.com/openlanguageprofiles/olp-en-cefrj | CC BY-SA 4.0 | Seviye C1–C2 |
| NGSL / NAWL 1.2 (Browne, Culligan, Phillips) | https://www.newgeneralservicelist.com/new-academic-word-list | CC BY-SA 4.0 | TOEFL akademik destesi, birkaç tanım |
| wordfreq (Robyn Speer ve ark.) | https://github.com/rspeer/wordfreq | Kod MIT, veri CC BY-SA 4.0 | Zipf sıklığı; seviyesi olmayan kelimelerde seviye tahmini (`svt=1`), zorluk (`zor`) |
| WordNet 3.0 (Princeton University) | https://wordnet.princeton.edu/ | WordNet 3.0 lisansı (serbest, telif bildirimiyle) | Kök bulma yedeği |
| NLTK averaged perceptron tagger | https://www.nltk.org/ | Apache 2.0 | Kelime türü etiketleme |
| Claude (Anthropic) – yapay zekâ çevirisi | https://www.anthropic.com/ | Bu uygulama için üretildi | Açık sözlükte karşılığı olmayan kelimelerin Türkçe önerileri; 22 örnek çevirisi (`otyz=1`, "YZ" işaretli) |
| ÖSYM YDS / YÖKDİL kitapçıklarındaki kelime sayımı | https://www.osym.gov.tr/ | Yalnız kelime listesi ve sayım (olgusal veri) | Deste üyeliği ve önem puanı. **Soru, okuma parçası ve şık metni bu uygulamada YOKTUR.** |

## Telif önlemleri
- Kart örnek cümlesi yalnız `tatoeba#<id>` ya da sözlükte bulunan Wiktionary örneğiyse aktarılır. Wiktionary'den örnek alanına düşmüş "Near-synonym: …" türü ilişki satırları (30) atıldı.
- ÖSYM soru kökü / şık / parça metinleri ve OneStopQA metinleriyle 8 sözcüklük ortak dizisi olan her örnek ve tanım atılır (kartlarda 1 örnek atıldı; sözlük sayımı `araclar/son_rapor.json`).
- `araclar/dogrula.py` her koşuda sınav metinlerinden 300 rastgele 45 karakterlik dizgiyi çıktılarda arar (beklenen: 0).

## Atıf
Wiktionary ve Vikisözlük içeriği CC BY-SA 4.0 ile, Tatoeba cümleleri CC BY 2.0 FR ile yeniden dağıtılır; türetilmiş veri dosyaları (`site/veri/**`) aynı koşullarla (CC BY-SA 4.0) paylaşılır.
