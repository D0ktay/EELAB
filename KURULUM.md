# EELAB — Kurulum (başka bir Mac'e)

EELAB, EE321 Mikroişlemciler için kod + devre laboratuvarıdır: mikroC uyumlu C ve MPASM uyumlu assembly derler, PIC16F628A'yı Proteus benzeri bir şemada simüle eder.

**Gereksinim:** macOS 11 (Big Sur) veya sonrası, Intel ya da Apple Silicon. Xcode, Python, Homebrew **gerekmez** (hepsi uygulamanın içinde). Çalışırken internet gerekmez. Tarayıcı: Safari, Chrome ya da Firefox.

## 1. Dosyayı al

Paketi üreten makinede: `packaging/make_dmg.sh` → `dist/EELAB-1.0.0.dmg` ve `dist/EELAB-1.0.0.zip`.
İkisinden birini USB bellek, AirDrop ya da bulut ile diğer Mac'e kopyala. İçerik aynıdır:
`EELAB.app`, `kur.sh`, `Kur.command`, `kaldir.sh`, `OKU-BENI.txt`.

## 2. Kur

EELAB notarize edilmemiştir (Apple Developer ID ile imzalı değildir). macOS ilk açılışta "açılamıyor / geliştirici doğrulanamadı" der. Aşağıdakilerden **birini** kullan.

### A) Önerilen: kurulum betiği

1. DMG'ye çift tıkla (ya da zip'i çift tıklayıp aç).
2. Terminal'i aç (Uygulamalar › İzlenceler › Terminal) ve yaz:

   ```bash
   bash /Volumes/EELAB/kur.sh
   ```

   Zip kullandıysan: `bash ` yaz, açılan klasördeki `kur.sh` dosyasını Terminal penceresine sürükle, Enter.

Betik: çalışan eski EELAB'ı durdurur → `/Applications`'a kopyalar (yazılamıyorsa `~/Applications`) → karantina işaretini kaldırır → imzayı doğrular (bozuksa yerel imzalar) → uygulamayı açar. `~/Documents/EELAB` içindeki projelere dokunmaz.

`Kur.command`'a çift tıklamak da aynı işi yapar, ama macOS onu da engelleyebilir; o zaman yukarıdaki Terminal satırını kullan.

### B) Elle sürükle + macOS'tan izin

1. `EELAB.app`'i Uygulamalar klasörüne sürükle, çift tıkla, uyarıyı kapat.
2. **macOS 15 (Sequoia) ve sonrası:** Sistem Ayarları › Gizlilik ve Güvenlik › aşağıda "EELAB engellendi" › **Yine de Aç** › parola.
   **macOS 11–14:** EELAB'a **Control‑tık (sağ tık) › Aç › Aç**.

### C) Terminal ile karantinayı kaldır

```bash
xattr -dr com.apple.quarantine /Applications/EELAB.app
open /Applications/EELAB.app
```

## 3. İlk açılış

- EELAB varsayılan tarayıcıda `http://127.0.0.1:8321/` adresini açar (port doluysa 8322–8399). Dock simgesine tıklamak sekmeyi yeniden açar.
- macOS **Belgeler klasörüne erişim** izni sorarsa **İzin Ver** de. Reddedilirse veriler `~/EELAB` altına yazılır.
- Oluşan klasörler: `~/Documents/EELAB/{Projelerim, Ornekler, Teslim}`.
- Eski "EE321 Lab Studio" kurulumu varsa (`~/Downloads/EE321_Lab3_Studio/projeler` ya da uygulamanın yanındaki `projeler/`), içindeki kullanıcı dosyaları **bir kez kopyalanır** (`Projelerim/`); eski klasör değişmez.
- Menü: Tarayıcıda Aç (⌘O) · Çalışma Klasörünü Göster · Tanılama · Günlüğü Göster · Çık (⌘Q). Tarayıcı sekmesi kapandıktan 15 dk sonra EELAB kendiliğinden kapanır.

## 4. Doğrulama / Tanılama

- EELAB menüsü › **Tanılama**: sürüm, işlemci mimarisi, derleyici kipi (`yerel` / `Rosetta 2` / `BULUNAMADI`) ve örnek derlemelerin md5 denetimi. "Panoya Kopyala" ile kopyalayıp yardım isterken gönder.
- Uygulama içinde sol üstteki **EELAB ⓘ** düğmesi aynı bilgilerin özetini gösterir.
- Terminal'den: `/Applications/EELAB.app/Contents/MacOS/EELAB --print-config`
- Günlük: `~/Library/Logs/EELAB/server.log`

### Apple Silicon (M1/M2/M3/M4) notu

Bu sürüm bir **Intel** Mac'te üretildi ve test edildi. Uygulama ve derleyiciler evrenseldir (x86_64 + arm64), ama arm64 dilimleri yalnızca statik olarak denetlendi — **Apple Silicon'da denenmedi**. İlk kurulumda lütfen:

1. EELAB › Tanılama'yı aç: derleyici kipi "yerel" (ya da "Rosetta 2") olmalı ve örnek derlemelerin md5 denetimi başarılı olmalı. Raporu kopyala/gönder.
2. Derleyici çalışmazsa EELAB Rosetta 2'ye düşer ve kurulmasını önerebilir:

   ```bash
   softwareupdate --install-rosetta --agree-to-license
   ```

## 5. Güncelleme

Yeni DMG ile aynı kurulum adımını tekrarla (`bash /Volumes/EELAB/kur.sh`). Projelerin (`~/Documents/EELAB`) korunur; `Ornekler/` klasörüne yalnızca eksik yeni örnekler eklenir, var olan dosyaların ezilmez.

## 6. Kaldırma

```bash
bash /Volumes/EELAB/kaldir.sh        # onay sorar;  -y ile sormaz
```

Silinenler: `EELAB.app` (`/Applications` ya da `~/Applications`), `~/Library/Application Support/EELAB`, `~/Library/Logs/EELAB`, `~/Library/Caches/EELAB`.
**`~/Documents/EELAB` (projelerin) silinmez**; istemiyorsan elle sil.

## 7. Sorun giderme

| Belirti | Çözüm |
|---|---|
| "EELAB hasarlı, Çöp Sepeti'ne taşıyın" | Karantina: Yol A ya da C. |
| Tarayıcı açılmıyor | Dock'taki EELAB'a tıkla ya da menü › Tarayıcıda Aç; adres günlükte yazar. |
| "Sunucuya ulaşılamadı" | EELAB kapanmış (15 dk boşta). Uygulamayı yeniden aç, sayfayı yenile. |
| Derle → "derleyici bulunamadı" | Tanılama raporunu gönder; Apple Silicon'da Rosetta komutunu dene. |
| Simülasyon yavaş / duruyor | Sekme arka plandayken tarayıcı simülasyonu yavaşlatır; EELAB sekmesini önde tut. |
| Belgeler klasörü izni reddedildi | Sistem Ayarları › Gizlilik ve Güvenlik › Dosyalar ve Klasörler › EELAB › Belgeler'i aç; ya da `~/EELAB` kullanılır. |

## Geliştirici modu (kaynak ağaçtan)

Python 3.9+ ve paket içindeki `toolchain/` ile:

```bash
python3 server.py                          # tarayıcıyı açar, port 8321
python3 server.py --no-open --port 0       # boş bir port, tarayıcı açmaz
EELAB_HOME=/tmp/eelab EELAB_STATE_DIR=/tmp/eelab-state python3 server.py   # kullanıcı verisinden ayrı deneme
tests/run_all.sh                           # tüm testler (--package: paket testi de)
```
