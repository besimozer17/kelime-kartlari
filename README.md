# Kelime Kartı

İngilizce ↔ Türkçe yazmalı kelime kartları ve çevrimdışı sözlük. Sunucu, hesap, reklam yok; ilerleme yalnız kendi cihazınızda saklanır.

**Aç:** https://besimozer17.github.io/kelime-kartlari/

- 8.281 kelime, A1–C2 seviyeleri, YDS / YÖKDİL / TOEFL desteleri
- İngilizce sorar Türkçesini yazarsınız, Türkçe sorar İngilizcesini yazarsınız; boşluk doldurma, çoktan seçmeli, kart çevirme
- Puan, yanlışların aralıklı tekrarı, örnek cümle ve Türkçe çevirisi
- Cümledeki herhangi bir İngilizce kelimeye dokununca anlamı
- Kendi kartlarınız ve desteleriniz, toplu ekleme, yedek al / geri yükle
- 624 bin maddelik sözlük

## Kurulum
- **iPhone / iPad:** adresi Safari'de açın → Paylaş → **Ana Ekrana Ekle**.
- **Android:** adresi Chrome'da açın → menü (⋮) → **Uygulamayı yükle**.
- **Windows:** [Sürümler](../../releases/latest) sayfasından `KelimeKarti.exe` dosyasını indirip çalıştırın (kurulum gerekmez). İmzasız olduğundan Windows ilk açılışta uyarabilir: "Ek bilgi" → "Yine de çalıştır".

Bir kez açıldıktan sonra internetsiz çalışır. Sözlüğün tamamını çevrimdışı kullanmak için Ayarlar → Sözlüğü indir.

## Geliştirme
`site/` düz HTML / JS'tir (derleme adımı yok): `python -m http.server -d site`. Testler: `node --test "testler/*.test.mjs"`. Masaüstü: `cd masaustu && npm install && npm run exe`.

Veri kaynakları ve lisansları: [KAYNAKLAR.md](KAYNAKLAR.md).
