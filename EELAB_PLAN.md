# EELAB — Faz 3 planı (yeniden adlandırma + olgunlaştırma + dağıtım)

Tarih: 2026-11-11 · Kaynak ağaç: `EE321_Lab3_Studio/` · Önceki sözleşmeler: `SPEC.md` §1–9 (geçerli kalır).
Bu belge YALNIZCA plan içerir. Uygulayıcı ajanlar §3'teki dosya sahipliğine ve §3.2'deki sözleşmelere uyar.

## 0. Temel kararlar ve doğrulanmış durum

| Konu | Karar |
|---|---|
| Ürün adı / sürüm | **EELAB** 1.0.0 (`VERSION` dosyası). Bundle id `app.eelab.EELAB`. Port 8321 kalır (doluysa 8322–8399). |
| Sunucu | Python **kalır**, yeniden yazılmaz. Pakete taşınabilir CPython gömülür (python-build-standalone). |
| Başlatıcı | AppleScript applet atılır → küçük evrensel **Objective‑C/Cocoa** başlatıcı (mutlak yol yok), varsayılan tarayıcıyı açar. |
| Toolchain | sdcc/cpp/cc1/gpasm/gplink **evrensel (x86_64+arm64)**, `minos 11.0`, nötr prefix ile yeniden derlenir. PIC kütüphaneleri/başlıklar bayt bayt aynı kalır. |
| Kullanıcı verisi | `~/Documents/EELAB/` (paket dışı). Paket salt‑okunur kabul edilir. |
| Windows/Linux | Bu fazda **yok** (hedef kitle zaten Windows'ta gerçek Proteus/mikroC çalıştırabiliyor). Kod OS'tan bağımsız tutulur; "Later L1". |
| REA | Bu planlama oturumunda REA aracı erişilebilir değildi; `.pdsprj` ön çözümlemesi elle yapıldı (Ek A). WS‑C, REA'sı varsa onu doğrulama için kullanır. |

Bugün ölçülen gerçekler (plan bunlara dayanır):
- Tüm testler yeşil: `library_test.js`, `sim_test.js` (34), `core_test.js` (24), `build_test.py` (11 dosya), `pdsprj_test.py`.
- `toolchain/bin/*`, `toolchain/cpp/*`: yalnız x86_64, yalnız sistem kütüphaneleri (`libSystem`, `libc++`, `libiconv`, `libz`), ama **`minos 15.5`** (macOS 14 ve altında açılmaz) ve içlerinde **derleme makinesinin `/Users/<ad>/…` yolları gömülü**. İkisi de yeniden derlemeyle düzelir.
- Kaynaklar duruyor: `<scratch>/tools/src/{sdcc-src.tar.bz2, gputils.tar.bz2, boost.tar.bz2}` + açılmış ağaçlar; SDCC `configure` satırı `tools/src/sdcc-4.5.0/config.log` içinde.
- Bu Mac'te CLT clang 17 ile `-arch arm64 -arch x86_64 -mmacosx-version-min=11.0` (Cocoa dahil) derleniyor; `lipo`, `codesign`, `hdiutil`, `iconutil`, `sips`, `swiftc` mevcut. **arm64 dilimi bu Intel Mac'te çalıştırılamaz** (bkz. Risk R1).
- **HEX tabanı iki ayrı şeydir** (Ek B): (a) depodaki `projeler/Task1.hex`/`Task2.hex` dondurulmuş dosyalardır ve `core_test.js` bunlara bağlıdır; (b) bugünkü derleme hattı aynı `Task1.c`'den farklı bir HEX üretir (sayım periyodu 100 605 çevrim; dondurulmuş dosyada 100 165 çevrim, fark %0,44). İkisi de korunur, hiçbiri "düzeltilmez".
- `tests/pdsprj_test.py` `~/Downloads/...` mutlak yollarını kullanıyor → fixture'lar depoya alınmalı.
- `.pdsprj` içindeki `ROOT.DSN` sıkıştırılmamış; teller ve pin→tel bağlantıları okunabiliyor (Ek A). Üç ders dosyası da aynı sürüm (RELEASE 806 / FILEVER 814).

Adım 0 (paralel işten önce, kullanıcı onayıyla): proje klasöründe `git init` + temel commit. Ajanlar aynı ağaçta, yalnız kendi dosyalarını commit eder.

## Durum — 2026-11-11 (WS‑F entegrasyon)

B, C, D, E bitti ve commit'lendi; A (paketleme) sürüyor. `tests/run_all.sh`: 11 paket yeşil (core 24, debug 14, ide 8, library, scope 13, sim 49, build 11+13 şablon, pdsprj, server 131, cross 292, e2e 24). Uygulanan sözleşme ayrıntıları: `SPEC.md` "Faz 3 — uygulanan sözleşmeler".

| # | Durum | Kanıt / kalan |
|---|---|---|
| M1 | ✓ (bir kalem açık) | `cross_test`: arayüzde eski ad/ürün kimliği yok; `ee321.*` → `eelab.*` göçü var. Kök dizindeki eski `EE321 Lab Studio.app` kullanıcı onayı bekliyor (silinmedi). |
| M2 | A'da | `package_test.sh` A bitince `tests/run_all.sh --package` ile; Apple Silicon: **denenmedi**. |
| M3 | ✓ | `server_test` (göç, ikinci açılış), tarayıcı: klasör oluştur/geç, dosya↔devre. |
| M4 | ✓ | `debug_test` (Task1 kronometre 100 605), `e2e_test` (lab3 şablonu breakpoint, Δ ≈ 100 ms), tarayıcı: F5/F6/F8, izleme kalıcılığı. Elle: F4/⇧F8, SFR yazma. |
| M5 | ✓ | `scope_test` (PWM/UART ±1 çevrim), `e2e_test` (PWM şablonu 200 çevrim periyot), tarayıcı: çalışırken düğmeler, imleçler, CSV, prob. |
| M6 | ✓ | `pdsprj_test` (Lab3 ağ eşitliği), `e2e_test` (3 dosya içe aktar → yönlendir → simüle et; bozuk girdi `{error}`), tarayıcı: Lab3 içe aktarma + CLOCK=8 MHz. |
| M7 | ✓ (elle kalan) | `ide_test` (2 000 satır < 16 ms). Elle: ⌘F/⌃G/⌘/ ve hata satırına tıklama tarayıcıda. |
| M8 | ✓ (yazdırma elle) | `e2e_test` + tarayıcı: teslim zip'i içeriği, PNG 2x/SVG temiz şema. Yazdırma önizlemesi elle. |
| M9 | ✓ | `e2e_test`: 13 şablonun her biri derlenip eşlendiği devrede beklenen çıktıyı veriyor. `rb0_int` için `circuits/rb0_int_demo.json`, `lab2` için `circuits/lab2.json` (LAB2.pdsprj'den) eklendi. |

---

## 1. Özellik listesi (öncelik + kabul ölçütü)

### MUST — EELAB 1.0

| # | Özellik | Kabul ölçütü |
|---|---|---|
| M1 | **Ad/marka → EELAB**: pencere başlıkları, sayfa başlığı, uygulama, ikon, `ee321.*` localStorage anahtarları → `eelab.*` (eski anahtar bir kez okunur). Başlıklardaki "mikroC PRO for PIC (Mac)", "Proteus 8 (Mac)", "MPLAB IDE v8.92" ürün kimliği olarak kaldırılır ("EELAB Kod — mikroC uyumlu", "EELAB Devre"). | Arayüzde ve pakette "EE321 Lab Studio" geçmez; eski tarayıcı durumundaki son dosya/devre açılışta hatırlanır. |
| M2 | **Kendi kendine yeten paket** (§2): Xcode CLT, Python, Homebrew olmadan Intel ve Apple Silicon Mac'te (macOS 11+) çalışır. | `tests/package_test.sh` yeşil; paket boşluklu/Türkçe karakterli bir yola kopyalanıp `env -i` ile çalıştırıldığında Build → HEX, Ek B ile aynı; paket içine hiçbir dosya yazılmaz. |
| M3 | **Çalışma klasörleri + veri göçü** (§2.7): veriler `~/Documents/EELAB/<Klasör>/`; klasör seç/oluştur; dosya↔devre eşlemesi (dosya açılınca devresi de açılır). | İlk açılışta `Ornekler/` ve `Projelerim/` oluşur; eski `projeler/` içindeki kullanıcı dosyaları kopyalanır, eski klasör değişmez; ikinci açılışta tekrar kopyalanmaz. |
| M4 | **Hata ayıklayıcı**: kaynak satırına ve adrese breakpoint, Duraklat/Devam, Adım (komut), Step Over, Step Out, imlece kadar çalıştır; W/STATUS/PC/SFR tablosu (değişen kırmızı), RAM ızgarası, Watch (C global değişkenleri ve asm etiketleri; dec/hex/bin, 8/16 bit), yığın, EEPROM, listing/disassembly görünümü, **kronometre** (iki durma arası çevrim ve süre), duraklamışken SFR/RAM yazma; hız 0,01x–100x. | `Task1.c`'de `ones++` satırına breakpoint → orada durur, satır işaretlenir, `ones` izlenir; iki duruş arası kronometre 100 605 çevrim = 100,605 ms (4 MHz). `Lab2.asm`'de etiket breakpoint'i ve tek adım çalışır. Breakpoint yokken çekirdek hızı gerilemesi ≤ %5. |
| M5 | **Osiloskop + lojik analizör**: şemaya konan `OSCILLOSCOPE` (A–D) ve `LOGIC-ANALYSER` (A0–A7) parçaları; çevrim çözünürlüklü kayıt; zaman/böl, çalış/tut, iki imleç (Δt, 1/Δt), kanal başına otomatik frekans/periyot/doluluk; CSV dışa aktarma. | `Pwm_Demo`: RB3'te ölçülen periyot ve doluluk PR2/CCPR1L'den hesaplananla ±1 çevrim. `Uart_Demo`: bit süresi 104 çevrim (9600 baud, 4 MHz). Alet yokken simülasyon hızı değişmez. |
| M6 | **Gerçek `.pdsprj` içe aktarma**: parçalar (ref, değer, konum, dönüş) + ağlar `ROOT.DSN`/`ROOT.CDB`'den; Lab3 şablon kısayolu kaldırılır; `CLOCK=` özelliği proje Fosc'una uygulanır; desteklenmeyen parçalar listelenir. | `Lab3.pdsprj` ağları `circuits/lab3.json` ağlarıyla kanonik olarak aynı; `LAB2.pdsprj` ve `Led_Switch.pdsprj` tel çekmeden simüle edilir (Lab2.asm / Lab1_LedSwitch.c ile gösterge değişir); bozuk dosya `{error}` döndürür, istisna sızmaz. |
| M7 | **Kod editörü temel**: C ve PIC asm sözdizimi renklendirme, satır numarası + breakpoint oluğu, bul/değiştir (⌘F), satıra git, otomatik girinti, yorum aç/kapa (⌘/), **hata satırına tıklayınca o satıra gitme**, kaydedilmemiş değişiklik uyarısı. | 2 000 satırlık dosyada yazma gecikmesi hissedilmez (tuş başına < 16 ms); derleme hatasına tıklamak doğru satırı seçer; mevcut ⌘S/⌘B/Tab davranışı aynı. |
| M8 | **Teslim paketi + şema çıktısı**: "Teslim paketi oluştur" → zip (`.c/.asm`, `.hex`, devre JSON, `sema.png`, `sema.svg`, `BENIOKU.txt`: ad, numara, tarih, Fosc, config word, ROM kullanımı); şemayı PNG/SVG kaydet ve yazdır. | Zip `~/Documents/EELAB/Teslim/` altında oluşur ve Finder'da gösterilir; PNG en az 2x çözünürlükte, simülasyon durumundan bağımsız temiz şema; yazdırma önizlemesinde yalnız şema görünür. |
| M9 | **Şablonlar + örnek galerisi**: "Yeni" penceresinde şablon seçimi (Boş C, Boş ASM, Lab1 LED/buton, Lab2 ASM sayaç, Lab3 başlangıç, Timer0 kesmesi, RB0/INT kesmesi, 7‑seg tarama, LCD 4‑bit, tuş takımı+LCD, UART echo, PWM, EEPROM); her şablon ilgili örnek devreyle eşlenir. | Her şablon değiştirilmeden derlenir (2K word sınırı içinde) ve eşlendiği devrede beklenen çıktıyı verir (test: `build_test.py` şablonları da derler). |

### SHOULD — 1.1

| # | Özellik | Kabul ölçütü |
|---|---|---|
| S1 | Editör: ağ etiketi/terminal (`TERMINAL`, aynı `value` = aynı ağ), kutu ile çoklu seçim, kopyala/yapıştır, serbest metin notu, çalışırken tele tıklayıp osiloskopa "proba" ekleme. | Etiketle bağlanan iki pin `SIM.pinNets`'te aynı ağda; kopyalanan blok yeni benzersiz id'ler alır. |
| S2 | Config bit penceresi (osilatör, WDT, MCLR, PWRT, BOR, LVP). Varsayılan değerler bugünküyle aynı HEX'i verir. | Ayar değişmeden Ek B md5'leri korunur; WDT açılınca çekirdek WDT reset'i gösterir. |
| S3 | Listing/istatistik sekmesi: ROM/RAM kullanımı, fonksiyon başına word, `.lst` görünümü. | Değerler `.map` ile tutarlı. |
| S4 | Yeni parçalar: `74HC595`, `LM044L` (20×4), `7SEG-MPX2-CC/CA`, `TRAFFIC-LIGHTS`, `L293D`, `RELAY`. | Her parça için `library_test`/`sim_test` durumu + bir örnek devre. |
| S5 | Otomatik tamamlama (SFR adları, mikroC kütüphane fonksiyonları) + "Kütüphane" başvuru paneli (desteklenen fonksiyonlar, imza, örnek). | Liste `server.LIBS` ile aynı kaynaktan üretilir (`/api/libs`). |
| S6 | Herhangi bir klasörü çalışma klasörü yapma (yerel klasör seçici), dosya sil/yeniden adlandır/çoğalt. | Seçilen klasör yeniden açılışta hatırlanır. |
| S7 | Karşılaştırıcı (CMCON/VRCON) + `POT-HG`. | Föydeki karşılaştırıcı örneği çalışır. |
| S8 | CI: GitHub Actions (macos‑13 x86_64 + macos‑14 arm64) doğal derleme/test/DMG. | arm64 çalıştırıcıda tüm testler yeşil (R1'in kalıcı çözümü). |

### LATER
L1 Windows/Linux taşınabilir mod (sistem Python + resmî SDCC 4.5.0 ikilileri, bizim `lib/`+`include/` ile) · L2 Developer ID + notarization (Gatekeeper uyarısı tamamen kalkar; `build_app.sh` kimlik verilirse kullanır) · L3 Yerel pencere (WKWebView) + `.pdsprj/.hex` çift tık ilişkilendirme · L4 PIC16F877A/16F84A · L5 ADC/analog, I2C/SPI parçaları · L6 İngilizce arayüz · L7 Çekirdeği Web Worker'a taşıma. **Yapılmayacak:** `.pdsprj` dışa aktarma (kapalı format; yanlış dosya üretme riski).

---

## 2. Dağıtım tasarımı

### 2.1 Python için seçenekler

| Seçenek | Artı | Eksi | Sonuç |
|---|---|---|---|
| Sistem `python3` (bugünkü) | 0 MB | Temiz Mac'te yok (CLT kurulum istemi), sürüm belirsiz | Yalnız geliştirici modu |
| **Gömülü CPython (python-build-standalone, mimari başına ağaç)** | `server.py`/testler aynen çalışır; arm64 ikilisi upstream'de test edilmiş | +50–60 MB (budanmış), çok sayıda Mach‑O imzalanır | **Seçildi** |
| Sunucuyu Swift/Go/C ile yeniden yazmak | Küçük tek ikili | `convert()` regex'lerinin yeniden yazımı HEX'i riske atar; arm64 dilimi burada test edilemez; `build_test.py` boşa çıkar | Reddedildi |
| Sunucusuz (SDCC+gputils → WASM) | Kurulum yok | Haftalarca port işi, doğrulanamaz | Reddedildi |
| PyInstaller/py2app | Tek paket | Harici bağımlılık, çapraz mimari yok | Reddedildi |

CPython: python-build-standalone `install_only_stripped`, 3.12.x ya da 3.13.x; `aarch64-apple-darwin` ve `x86_64-apple-darwin` varlıkları `packaging/versions.json` içinde **etiket + sha256** ile sabitlenir, `~/Library/Caches/EELAB-build/` altına indirilir (yalnız derleme anında ağ; çalışma anında ağ yok). Kod Python 3.9 ile de çalışır kalır (geliştirici modu ve mevcut testler).
Budama: `test/ idlelib/ tkinter/ turtledemo/ ensurepip/ lib2to3/ pydoc_data/ venv/ site-packages/*`, `lib/tcl* lib/tk*`, `include/ share/`, `bin/{pip*,idle*,pydoc*,2to3*,*-config}`, `lib-dynload/{_tkinter*,_test*,xx*}`. Hedef ≤ 30 MB/mimari.

### 2.2 Paket yerleşimi (tamamı göreli)

```
EELAB.app/Contents/
  Info.plist            CFBundleName=EELAB, CFBundleIdentifier=app.eelab.EELAB, CFBundleExecutable=EELAB,
                        CFBundleIconFile=EELAB, LSMinimumSystemVersion=11.0, NSHighResolutionCapable,
                        CFBundleDevelopmentRegion=tr, LSApplicationCategoryType=public.app-category.education
  MacOS/EELAB           evrensel Cocoa başlatıcı
  Resources/
    EELAB.icns
    app/                kaynak ağacın kopyası: server.py pdsprj.py eelab_paths.py index.html js/ css/ shim/
                        circuits/ projeler/ (örnekler) templates/ VERSION
    toolchain/          bin/{sdcc,sdcpp,gpasm,gplink} cpp/{cpp,cc1} include/ nonfree/ lib/ lkr/ gpheader/ VERSION.json
    python/arm64/       budanmış CPython      python/x86_64/   budanmış CPython
    selftest/golden.json   Ek B md5 listesi
    LICENSES/           SDCC (GPL), gputils (GPL), CPython (PSF), kaynak adresleri
```
Pakete GİRMEZ: `tests/`, `packaging/`, `SPEC.md`, `EELAB_PLAN.md`, `*.hex` çıktıları, `.ayarlar.json`, ders föyleri/`.pdsprj` dosyaları ve **varsayılan olarak `Task1.*`, `Task2.*`** (kullanıcının lab çözümleri; `--include-solutions` ile açıkça istenirse eklenir).

### 2.3 Başlatıcı (`packaging/launcher/main.m`)
- `NSBundle.mainBundle.resourcePath` üzerinden her yolu türetir; derleme: `clang -arch x86_64 -arch arm64 -mmacosx-version-min=11.0 -framework Cocoa`.
- Çalışan dilime göre `python/arm64` ya da `python/x86_64` seçer; `python3 -I -B app/server.py --launcher` çalıştırır. Ortam: `EELAB_APP`, `EELAB_TOOLCHAIN`, `PATH=/usr/bin:/bin`, `LANG=en_US.UTF-8`. Çıktı `~/Library/Logs/EELAB/server.log` (1 MB'ta döndürülür).
- Zaten çalışan örnek varsa (`server.json` + `/api/ping` → `app:"EELAB"`) yalnız tarayıcıyı açıp çıkar.
- Menü: Tarayıcıda Aç (⌘O) · Çalışma Klasörünü Göster · Tanılama · Günlüğü Göster · Çıkış (⌘Q). Dock simgesine tıklama = Tarayıcıda Aç.
- Çıkış → sunucuya SIGTERM; sunucu kendi kapanırsa (15 dk boşta) başlatıcı da çıkar. Sunucu ilk 3 sn içinde hata koduyla çıkarsa günlüğün son 20 satırıyla uyarı penceresi.
- Geliştirici modu aynen kalır: kaynak ağaçta `python3 server.py`.

### 2.4 Evrensel toolchain (`packaging/build_toolchain.sh`)
1. Kaynakları önbelleğe al: `~/Library/Caches/EELAB-build/src/` (scratch'teki tarball'lar varsa oradan kopyala, yoksa sha256 sabitli indir). **İlk iş budur; scratch klasörü kalıcı değildir.**
2. x86_64: yerel derleme, `MACOSX_DEPLOYMENT_TARGET=11.0`, `--prefix=/opt/eelab-toolchain` (var olmayan nötr yol), mevcut `configure` bayraklarıyla (yalnız pic14, `--disable-ucsim --disable-sdcdb --enable-non-free`).
3. arm64: `CC="clang -arch arm64" CXX="clang++ -arch arm64" ./configure --build=x86_64-apple-darwin --host=aarch64-apple-darwin --disable-device-lib …` (yalnız ana makine ikilileri; PIC kütüphaneleri mimariden bağımsızdır ve yeniden üretilmez). gputils için aynı `--host`.
4. `lipo -create` → `sdcc`, `cpp`, `cc1`, `gpasm`, `gplink`. `sdcpp` kabuk sarmalayıcısı aynı kalır.
5. `toolchain/{lib,include,nonfree,lkr,gpheader}` **dokunulmaz**; sha256 manifesti `toolchain/VERSION.json` içine yazılır ve testte doğrulanır.
6. Yedek yollar (sırayla): (a) tek geçişte `CC="clang -arch x86_64 -arch arm64"`, `CPP="clang -E"`, bağımlılık izleme kapalı; (b) toolchain yalnız x86_64 kalır, Apple Silicon'da Rosetta 2 ile çalışır (sunucu algılar, başlatıcı `softwareupdate --install-rosetta --agree-to-license` komutunu gösterir).
Kabul: x86_64 dilimi Ek B'deki 11 md5'i birebir üretir; `lipo -archs` her ikilide `x86_64 arm64`; `otool -L` yalnız `/usr/lib/*`; `minos` ≤ 11.0; `strings … | grep /Users/` boş.

### 2.5 İmzalama ve Gatekeeper
- İçten dışa ad‑hoc: paketteki her Mach‑O (`.so`, `.dylib`, çalıştırılabilir) `codesign --force --timestamp=none -s -`, sonra paket; doğrulama `codesign --verify --deep --strict`. `lipo` sonrası yeniden imza zorunlu (arm64 imzasız kod çalıştırmaz).
- Paket salt‑okunur varsayılır (App Translocation + imza mührü): Python `-B` ile `.pyc` yazmaz; sunucu paket içine hiçbir şey yazmaz.
- Notarize edilmediği için başka Mac'te ilk açılış engellenir. Belgelenen üç yol (`OKU-BENI.txt`, Türkçe):
  1. **Önerilen:** Terminal'e `bash /Volumes/EELAB/kur.sh` (script karantinayı kaldırır; `bash dosya` Gatekeeper'a takılmaz).
  2. macOS 15 ve sonrası: Sistem Ayarları → Gizlilik ve Güvenlik → "EELAB engellendi" → **Yine de Aç**. macOS 11–14: Control‑tık → Aç.
  3. Elle: `xattr -dr com.apple.quarantine /Applications/EELAB.app`.
- `EELAB_SIGN_ID` ve notarytool kimliği verilirse `build_app.sh` Developer ID ile imzalar/notarize eder (L2).

### 2.6 Paketleme ve kurulum
- `packaging/build_app.sh [--arch universal|arm64|x86_64] [--include-solutions]` → `dist/EELAB.app`; `packaging/make_dmg.sh` → `dist/EELAB-1.0.0.dmg` (`hdiutil … -format UDZO`; içinde `EELAB.app`, `Applications` bağlantısı, `kur.sh`, `Kur.command`, `kaldir.sh`, `OKU-BENI.txt`) ve `dist/EELAB-1.0.0.zip` (`ditto -c -k --keepParent`). Tahmini boyut: uygulama 75–90 MB, DMG 30–40 MB.
- `kur.sh`: kaynağı kendi konumundan bulur → çalışan EELAB sunucusunu durdurur → hedef `/Applications` (yazılamıyorsa `~/Applications`) → `ditto` → `xattr -dr com.apple.quarantine` → `codesign --verify` (bozuksa ad‑hoc yeniden imza) → `open`. Kullanıcı verisine dokunmaz. `kaldir.sh` yalnız uygulamayı ve `~/Library/{Application Support,Logs,Caches}/EELAB`'ı siler; `~/Documents/EELAB` kalır.
- Tanılama (menü ya da `server.py --selftest`): örnekleri derler, md5'leri `selftest/golden.json` ile karşılaştırır, mimari/araç zinciri kipini raporlar. Apple Silicon doğrulaması bu raporla yapılır.

### 2.7 Kullanıcı verisi ve ilk açılış göçü
```
~/Documents/EELAB/            kök (EELAB_HOME ya da state.json "home" ile değişir)
  Projelerim/                 varsayılan çalışma klasörü
  Ornekler/                   paketteki örnek kod + devrelerin kopyası
  Teslim/                     teslim zip'leri
  <Lab3>/ …                   kullanıcının açtığı klasörler (ad: [A-Za-z0-9_-]{1,40})
~/Library/Application Support/EELAB/state.json   {schema, home, current, examplesVersion, migrated[]}
~/Library/Application Support/EELAB/server.json  {pid, port, url, version}
~/Library/Logs/EELAB/server.log
```
- Klasör başına ayar dosyası `.eelab.json`: `{version:1, files:{"Task1.c":{fosc, circuit, config, watches, breakpoints}}}`. Eski `.ayarlar.json` biçimi okunur.
- Bir çalışma klasörü düzdür (`*.c`, `*.asm`, `*.hex`, `*.json` devreler) — ders klasörü düzeniyle aynı; "proje = klasör".
- İlk açılış: kökü oluştur; `Ornekler/` kopyala; sürüm yükselince yalnız eksik dosyalar eklenir, kullanıcı dosyası asla ezilmez.
- Eski kurulum göçü — adaylar: `$EELAB_MIGRATE_FROM`, `~/Downloads/EE321_Lab3_Studio/projeler`, `EELAB.app`'in yanındaki `projeler/`. Örneklerle sha256'sı aynı olanlar atlanır; kalanlar (`Task1.c`, `Task2.c`, kullanıcı devreleri, `.hex`) `Projelerim/` altına **kopyalanır** (çakışmada `_eski` eki). Eski klasör değiştirilmez/silinmez; işlem `state.json.migrated`'a yazılır.
- `~/Documents` erişimi reddedilirse (TCC, `PermissionError`): kök `~/EELAB` olur ve Messages'ta bildirilir.

### 2.8 İkon ve marka
- `packaging/make_icon.swift` (CoreGraphics, harici varlık yok) 1024 px PNG çizer → `sips` ile iconset → `iconutil -c icns`. Motif: koyu lacivert yuvarlatılmış kare, krem (`#c9c7a4`) DIP entegre + bordo (`#7a1414`) kenar, üstünde kırmızı 7‑segment "EE", altta yeşil (`#1c5a1c`) iz. Aynı motifin SVG'si favicon olarak `index.html`'e gömülür.
- Metin: "EELAB — EE321 Mikroişlemciler için kod + devre laboratuvarı". Üçüncü taraf adları yalnız uyumluluk ifadesinde ("mikroC uyumlu sözdizimi", "Proteus .pdsprj içe aktarır").

---

## 3. İş akışları (5 paralel + 1 bitiş)

### 3.1 Dosya sahipliği (başkasının dosyasına DOKUNMA)

| WS | Sahip önerisi | Sahip olunan dosyalar |
|---|---|---|
| **A — Paketleme/Platform** | Codex | `packaging/**`, `toolchain/**` (yalnız `bin/`, `cpp/`, `VERSION.json` değişir), `VERSION`, `dist/**`, `tests/package_test.sh` |
| **B — Sunucu/Derleyici/Veri** | Codex | `server.py`, `eelab_paths.py` (yeni), `shim/**`, `projeler/**`, `templates/**` (yeni), `tests/build_test.py`, `tests/server_test.py` (yeni) |
| **C — Proteus içe aktarıcı** | Opus (+REA) | `pdsprj.py`, `tests/pdsprj_test.py`, `tests/fixtures/**` (yeni), `docs/pdsprj-format.md` (yeni) |
| **D — IDE + Hata ayıklayıcı** | Opus | `index.html`, `css/**` (yeni), `js/pic.js`, `js/ide.js` (yeni), `js/debug.js` (yeni), `tests/core_test.js`, `tests/debug_test.js` (yeni), `tests/ide_test.js` (yeni) |
| **E — Devre editörü + Aletler** | Codex | `js/library.js`, `js/sim.js`, `js/editor.js`, `js/scope.js` (yeni), `circuits/**`, `tests/library_test.js`, `tests/sim_test.js`, `tests/scope_test.js` (yeni) |
| **F — Entegrasyon/QA (sonda)** | Opus | `SPEC.md`, `EELAB_PLAN.md`, `KURULUM.md`, `KULLANIM.md`, `tests/run_all.sh`, `tests/e2e/**`; yalnız entegrasyon düzeltmesi için diğer dosyalara küçük yama; eski `EE321 Lab Studio.app`'in kaldırılması |

Kural: bir modül yüklenmemişse ilgili özellik gizlenir, hata verilmez (`window.SCOPE`, `window.DEBUG`, `window.IDE`, `r.debug` yoksa eski davranış). Böylece akışlar birbirini beklemeden test edebilir.

### 3.2 Arayüz sözleşmeleri

**K1 — Süreç ve yollar (A↔B).** Sunucu: `APP = dirname(server.py)`; `TC = $EELAB_TOOLCHAIN` → yoksa `APP/toolchain` → yoksa `APP/../toolchain`. Bayraklar: `--launcher` (tarayıcıyı açar, `server.json` yazar), `--no-open`, `--port N`, `--selftest` (çıkış kodu 0/1, stdout'a JSON). Ortam: `EELAB_HOME`, `EELAB_MIGRATE_FROM`. Sunucu paket içine yazmaz; geçici dosya öneki `eelab_`. `server.json` yalnız sunucu tarafından yazılır, başlatıcı okur. `VERSION` tek satırdır (A yazar, B okur; yoksa `"dev"`).

**K2 — Toolchain yerleşimi (A↔B).** Göreli düzen bugünküyle aynı. B tüm araç çağrılarını tek `tool_cmd(name)` üzerinden yapar; açılışta `gpasm -v` denemesi başarısızsa ve makine arm64 ise `/usr/bin/arch -x86_64` öneki kullanılır; kip `/api/info`'da görünür.

**K3 — HTTP API (B↔D/E).** Mevcut uçlar ve alanları aynen kalır. Eklenenler:

| Uç | Gövde → Yanıt |
|---|---|
| `GET /api/ping` | `{ok, app:"EELAB", version}` |
| `GET /api/info` | `{version, home, workspace, arch, python, toolchain:{sdcc, gputils, mode:"native"\|"rosetta"\|"missing"}}` |
| `GET /api/workspace` · `POST /api/workspace` `{action:"open"\|"create", name}` | `{root, current, folders:[ad…]}` |
| `POST /api/settings` | `{name, fosc?, circuit?, config?, watches?, breakpoints?}` → `{ok, settings}` (`.eelab.json`) |
| `GET /api/file` | mevcut + `settings` nesnesi |
| `GET /api/templates` · `POST /api/new` `{name, fosc, template?}` | `[{id, title, lang, fosc, desc, circuit?}]` |
| `POST /api/build` | mevcut `{ok, messages, hex, hexPath, fosc}` + `diag:[{line, sev:"error"\|"warning", text}]` + `debug` (aşağıda) |
| `POST /api/export` | `{name, files:[ad…], student:{ad,no}?, svg?, pngBase64?}` → `{ok, path}`; zip `Teslim/` altına, Finder'da gösterilir |
| `POST /api/export-file` | `{name, ext:"svg"\|"png"\|"csv"\|"txt", text?\|base64?}` → `{ok, path}` (çalışma klasörüne) |
| `POST /api/circuit-delete`, `/api/delete`, `/api/rename` (S6) | `{name[, to]}` → `{ok}` |
| Statik | `/js/*.js`, `/css/*.css`, `/circuits/*.json`, `/img/*.{png,svg}` |

`debug` nesnesi (derleme zaten `.lst`/`.map` üretir; **derleyici bayrakları değişmez**, yalnız geçici klasördeki dosyalar okunur):
```
debug: { lang:"c"|"asm", file:"Task1.c",
         lines:   [[addr, line], …],            // addr artan; her kaynak satırının ilk program adresi; line 1 tabanlı, kullanıcının dosyası
         symbols: [{name:"ones", raw:"_ones", addr:0x20, size:2, kind:"var"|"label"|"func"}],
         lst: "<listing metni>", rom: <word>, ram: <bayt> }
```
`server.py` içindeki şu adlar ve imzalar korunur (testler kullanıyor): `PROJ`, `SETTINGS`, `FILE_RE`, `build(name, code, fosc=None)`, `convert`, `lib_uses`, `fname`.

**K4 — İçe aktarma sonucu (C↔B/D/E).** `parse_pdsprj(bytes) -> dict`, SPEC §1 şeması + ek alanlar:
```
{ version:1, parts:[{id,type,x,y,rot,value}], nets:[["U1.17","U2.7"],…], wires:[],
  meta:{clock:8000000|null, program:"test.hex"|null, cfgword:int|null, release:"806", filever:"814"},
  unsupported:[{ref, device, reason}], warnings:[…] }
```
- `type` yalnız `LIB.order`'daki adlardan; pin adresleri SPEC §2/§7 `num` değerleriyle. Aygıt adı → tip tablosu `pdsprj.DEVICE_MAP`'tedir (F, tablodaki her tipin `LIB.types`'ta olduğunu test eder).
- Konum: Proteus 100 th → 10 SVG birimi (10 nm birimde `x/25400`), y ekseni çevrilir, tümü pozitife ötelenip 10'a oturtulur. Teller `nets` olarak verilir; yönlendirmeyi mevcut `SIM.route` yapar (semboller Proteus'unkinden farklı olduğu için tel geometrisi taşınmaz).
- `id`: Proteus ref'i `[A-Za-z0-9_]`'ye uyuyorsa aynen; değilse önek+numara, özgün ad `value`'ya (BUTTON için klavye kısayolu `value`'nun ilk harfidir: "START/STOP" → S).
- POWER/GROUND terminalleri parça olur; aynı etiketli terminaller/tel etiketleri ağ birleştirir (parça üretmez).
- D, `meta.clock` geçerliyse (4/8/20 MHz) Fosc seçicisini ayarlar ve Messages'a yazar.

**K5 — Çekirdek hata ayıklama API'si (D içinde; testler ve F kullanır).** `PIC.create()` dönüşüne eklenir; mevcut `run(end, budgetMs) -> boolean`, `step`, `peek`, `drive` imzaları değişmez:
```
core.bp      = { set(addr), clear(addr), clearAll(), has(addr), list() }
core.runDbg(end, budgetMs) -> { done, stop: null|"bp"|"budget", pc }      // bp sayısı 0 iken run() ile aynı hız yolu
core.stepOver() / core.stepOut(maxCyc) -> { stop, pc }
core.mem     = { read(addr9), write(addr9, v) }        // banka çözümlü; PORT yazımı latch'e gider
core.stack() -> [adres…]      core.ee -> Uint8Array(128)
PIC.disasm(op, addr) -> "movlw 0x07"
```
`DEBUG.create({mount, core, getDebug:()=>r.debug, onChange})` → `{refresh(), setVisible(b)}`; `IDE.create({textarea, gutter, …})` → `{getValue, setValue, setLang, gotoLine, setMarkers, setBreakpoints, onBreakpointToggle, setExecLine}`.

**K6 — Aletler ve dışa aktarma (E↔D).**
- Yeni parça tipleri: `OSCILLOSCOPE` (pin `A,B,C,D`), `LOGIC-ANALYSER` (pin `A0..A7`); "Sanal Aletler" kategorisi.
- `runner.rec = { channels:[{id:"OSC1:A", part, pin, net, label}], read(i, t0, t1) -> {t:Float64Array, v:Uint8Array}, clear() }` — geçişler (çevrim, seviye 0/1/2), `t0` anındaki ilk seviye dahil; kanal başına 65 536 geçişlik halka tampon; alet yoksa kayıt yapılmaz.
- `SCOPE.create({mount, getRunner, getCyc, getFosc, save:(name, ext, text)=>…})` → `{frame(), reset()}`. D, `index.html`'de `<div id="inst">` yuvasını sağlar, `render()` içinde `frame()`, durdurmada `reset()` çağırır; `channels` boşsa panel gizlidir.
- `ED.exportSVG({bg:true}) -> string` (stilleri gömülü, bağımsız SVG; çalışma durumu renkleri olmadan), `ED.exportPNG({scale:2}) -> Promise<dataURL>`.
- SPEC §8 etkileşim sözleşmesi (`Runner.port/press/uartTx/uartRx/termKey/setClock/state`) değişmez.

**K7 — Marka (hepsi).** Görünen ad her yerde "EELAB". localStorage `eelab.file`, `eelab.circuit` (eski `ee321.*` bir kez okunur). Arayüz metinleri Türkçe.

### 3.3 Akış ayrıntıları

**WS‑A — Paketleme/Platform (Codex)**
- İşler: kaynak önbelleği; `build_toolchain.sh` (§2.4); `fetch_python.sh` + budama; başlatıcı (§2.3); `Info.plist`; ikon (§2.8); `build_app.sh`, `make_dmg.sh`, `kur.sh`, `Kur.command`, `kaldir.sh`, `OKU-BENI.txt`; `LICENSES/`; `selftest/golden.json` (Ek B'den).
- Testler: `tests/package_test.sh` — (1) her Mach‑O'da beklenen dilimler, (2) `otool -L` yalnız sistem yolları, (3) `minos` ≤ 11.0, (4) pakette `/Users/` dizgesi yok, (5) `codesign --verify --deep --strict`, (6) paket `"/tmp/…/EE Lab Öğrenci/"` altına kopyalanıp `env -i HOME=<tmp> PATH=/usr/bin:/bin` ile başlatılır → `/api/ping`, `/api/build` (örnek) → md5 Ek B, (7) çalıştırma sonrası paket içinde değişen dosya yok, (8) `/api/info.python` paket içini gösterir, (9) karantina özniteliği eklenip `kur.sh` geçici hedefe kurar → öznitelik kalkmış.
- Bitti sayılır: `dist/EELAB-1.0.0.dmg` üretildi; test yeşil; x86_64 dilimi Ek B md5'lerini veriyor; arm64 için statik denetimler geçti ve tanılama raporu hazır.

**WS‑B — Sunucu/Derleyici/Veri (Codex)**
- İşler: `eelab_paths.py` (kök/çalışma klasörü/durum/göç, §2.7); K1–K3 uçları; `.eelab.json`; `debug` + `diag` çıkarımı (`.lst`, `.map`, gpasm `.lst`); `templates/` + `index.json` (M9); teslim zip'i (`zipfile`, sabit sıra); `/api/reveal` ve benzerlerinde platform ayrımı; `--selftest`; EELAB adlandırması. S2 (config), S5 (`/api/libs`).
- Testler: `build_test.py` yeşil kalır ve çıktılar Ek B md5'leriyle karşılaştırılır (yeni doğrulama); şablonların derlenmesi; `server_test.py` — geçici `EELAB_HOME` ile gerçek HTTP: çalışma klasörü oluştur/aç, kaydet/aç, ayarlar, build `debug.lines` boş değil ve `Task1.c`'de `ones++` satırı eşleniyor, export zip içeriği, yol kaçışı (`../`) reddi, göç (sahte eski klasör: kopyalandı, ezmedi, ikinci kez kopyalamadı), `Host` denetimi.
- Bitti sayılır: testler yeşil; kaynak ağaçtan `python3 server.py` ve 3.9/3.12 ikisiyle de çalışıyor; uygulama klasörüne yazma yok.

**WS‑C — Proteus içe aktarıcı (Opus, REA varsa onunla)**
- İşler: Ek A bulgularını doğrula ve tamamla (kayıt başlıkları, bileşen konum/dönüş/ayna alanları, pin sırası, terminal ve etiket kayıtları, tel kavşakları); `ROOT.CDB`'den ref/pin/özellik okuma; ağ çıkarımı (pin→tel işaretçileri + çakışan tel uçları + `WIRE DOT` + etiket birleştirme, union‑find); `DEVICE_MAP` (31 tip + E'nin yeni tipleri); K4 çıktısı; biçim belgesi `docs/pdsprj-format.md`. Fixture'lar `tests/fixtures/` altına (Lab3, LAB2, Led_Switch) ve `lab3_nets.json` altın dosyası (`SIM.pinNets(circuits/lab3.json)` çıktısı).
- Testler: `pdsprj_test.py` mutlak yol içermez; Lab3 ağ eşitliği; üç dosyada `unsupported` boş ya da açıkça beklenen; her pin adresi geçerli; kesilmiş/bozuk girdi `ValueError` → sunucuda `{error}`; farklı `FILEVER` → uyarı + yalnız parça listesi (çökme yok).
- Bitti sayılır: M6 kabul ölçütleri; şablon kısayolu yok.

**WS‑D — IDE + Hata ayıklayıcı (Opus)**
- İşler: M1 arayüz adlandırması; `css/eelab.css`'e taşıma (isteğe bağlı); `js/ide.js` (M7); `js/pic.js` K5; `js/debug.js` panelleri (M4); çalışma klasörü ve şablon arayüzü (M3, M9); teslim/PNG/SVG/yazdır düğmeleri (M8, K3+K6 ile); `#inst` yuvası; hız seçenekleri; `meta.clock` uygulaması; `/api/info` ile "Hakkında/Tanılama".
- Testler: `core_test.js` aynen yeşil (dondurulmuş `Task1/Task2.hex` karşılaştırmaları dahil); `debug_test.js` — breakpoint'te durma, stepOver/stepOut (iç içe çağrı ve kesme sırasında), kronometre 100 605 çevrim, `mem.write` PORTB → `onPort`, breakpoint'siz hız gerilemesi ≤ %5; `ide_test.js` — renklendirici belirteçleri (C/asm), satır↔adres eşleme yardımcıları (DOM'suz).
- Bitti sayılır: M4/M7 senaryoları tarayıcıda elle doğrulandı; eski kısayollar ve Build→çalıştır akışı aynı.

**WS‑E — Devre editörü + Aletler (Codex)**
- İşler: `OSCILLOSCOPE`, `LOGIC-ANALYSER`, kayıt (K6), `js/scope.js` (M5); `ED.exportSVG/PNG` (M8); S1 (TERMINAL, çoklu seçim, kopyala/yapıştır, proba); S4 parçaları + örnek devreler.
- Testler: mevcut `library_test.js`/`sim_test.js` yeşil; `scope_test.js` — PWM ve UART ölçümleri (M5 ölçütleri), halka tampon taşması, alet yokken `Runner.port` çağrı maliyeti değişmiyor; `exportSVG` çıktısı geçerli XML ve tüm parçaları içeriyor.
- Bitti sayılır: M5 ve M8'in şema kısmı; yeni tipler `LIB.categories`'te.

**WS‑F — Entegrasyon/QA (Opus, en sonda)**
- İşler: `tests/run_all.sh` (hepsini çalıştırır); çapraz denetimler (`DEVICE_MAP` ⊆ `LIB.types`; şablon↔devre eşlemeleri var; `golden.json` = Ek B); uçtan uca senaryolar (`tests/e2e/`: üç `.pdsprj` içe aktar → derle → Node'da simüle et → gösterge değişimi); tarayıcıda duman testi listesi (her örnek devre, debugger, osiloskop, teslim zip'i, yazdır); paketlenmiş uygulamayla aynı liste; `KURULUM.md`, `KULLANIM.md`; `SPEC.md` güncellemesi; eski applet'in kaldırılması (kullanıcı onayıyla); ikinci Mac için tanılama adımları.
- Bitti sayılır: `run_all.sh` + `package_test.sh` yeşil; DMG temiz bir kullanıcı hesabında `kur.sh` ile kurulup Lab3 çalıştırıldı; Apple Silicon tanılama raporu alındı ya da "doğrulanmadı" olarak açıkça işaretlendi.

Sıra: A–E aynı anda başlar. Tek bağımlılık: A'nın paket testi (6) B'nin `--no-open/--port` bayraklarını ister — B bunları ilk iş olarak ekler. F, A–E "bitti" dedikten sonra çalışır.

---

## 4. Riskler ve YAPILMAYACAKLAR

| # | Risk | Önlem |
|---|---|---|
| R1 | arm64 dilimleri bu Intel Mac'te çalıştırılamaz; doğrulanmamış kod dağıtılır. | Statik denetimler; açılışta araç zinciri öz‑denetimi + Rosetta yedeği (K2); tanılama raporu; kalıcı çözüm S8 (arm64 CI). Apple Silicon'da test edilene kadar sürüm notunda "Apple Silicon: denenmedi" yazar. |
| R2 | HEX değişimi (araç zinciri yeniden derlemesi, sunucu düzenlemesi). | Ek B md5'leri `build_test.py` ve `package_test.sh` içinde zorunlu; `toolchain/lib` vb. manifestle kilitli; `shim/` içinde gecikme/kod üretimini etkileyen değişiklik F onayı ister. arm64 sdcc'nin ürettiği HEX farklı çıkarsa: tanılama bunu ayrı raporlar, sürüm durdurulur. |
| R3 | Dondurulmuş `projeler/Task1.hex`/`Task2.hex`'in üzerine yazılması `core_test.js`'i bozar. | `projeler/` artık salt‑okunur örnek kaynağıdır; sunucu oraya yazmaz. Bu iki dosya değiştirilmez. |
| R4 | Gatekeeper (macOS 15+ sağ tık→Aç yok), karantina, App Translocation. | §2.5 üç yol + `kur.sh`; paket salt‑okunur tasarım. |
| R5 | `~/Documents` TCC izni reddi; ad‑hoc imzada her sürümde yeniden sorulur. | `~/EELAB` yedeği; hata mesajı açık. |
| R6 | SDCC çapraz derlemesi (sdcpp/gcc tabanlı kısım) takılabilir. | §2.4 yedek (a) ve (b). |
| R7 | `index.html` tek merkez; birden çok akış dokunursa çakışma. | Tek sahip D; diğerleri kendi `js/*.js` modülünü K5/K6 yuvalarına bağlar. |
| R8 | Kayıt/breakpoint denetimi simülasyonu yavaşlatır. | Sıfır alet/sıfır breakpoint yolunda ek iş yok; hız testleri. |
| R9 | `.pdsprj` biçim farkları (başka Proteus sürümleri). | `FILEVER` denetimi; anlaşılmayan yapıda parça listesine düş + uyarı; asla istisna sızdırma. |
| R10 | Lisans/marka: SDCC ve gputils GPL; ders föyleri ve kullanıcının lab çözümleri. | `LICENSES/` + kaynak adresleri; föyler/`.pdsprj` fixture'ları ve `Task1/Task2` pakete girmez; üçüncü taraf ürün adları kimlik olarak kullanılmaz. |
| R11 | python-build-standalone varlığı değişir/indirilemez. | Sürüm+sha256 sabit, yerel önbellek; `EELAB_PYTHON` ile sistem Python'una düşme. |
| R12 | Port 8321 başka süreçte. | `/api/ping` kimlik denetimi, 8322–8399 yedeği, `server.json`. |

YAPILMAYACAKLAR:
- Mevcut testleri kırmak/silmek/gevşetmek; `core_test.js`'teki referans sayıları değiştirmek.
- Derleyici bayraklarını, `shim/` gecikme döngülerini, `toolchain/lib|include|nonfree|lkr|gpheader` içeriğini değiştirmek (Ek B md5'leri bozulur). 100 165 ↔ 100 605 çevrim farkını bu fazda "düzeltmek".
- npm, CDN, harici JS/CSS/font, çalışma anında ağ erişimi; pip paketi; Electron/Tauri.
- Pakete mutlak yol, kullanıcı adı, e‑posta gömmek; paket içine yazmak; kullanıcı verisini silmek/taşımak (yalnız kopyalanır).
- İngilizce arayüz metni (arayüz Türkçe kalır); gereksiz kod yorumu.
- Başka akışın dosyasını düzenlemek; SPEC §1–9 sözleşmelerini tek taraflı değiştirmek.
- `.pdsprj` yazmak; Lab3 şablon kısayolunu "çözümleme" diye bırakmak.
- Kullanıcı onayı olmadan eski `EE321 Lab Studio.app`'i ya da eski `projeler/` içeriğini silmek.

---

## Ek A — `.pdsprj` ön bulguları (elle hexdump; WS‑C doğrulayacak)
- Arşiv: `PROJECT.XML` (`RELEASE`, `FILEVER`), `ROOT.CDB`, `ROOT.DSN`, `SCRIPTS/PWRRAILS.DAT`.
- `ROOT.CDB`: uzunluk önekli (1 bayt) dizgiler. Bileşen başına: ref (`U1`, `START/STOP`), pin listesi (ad, numara: `RA7/OSC1/CLKIN`→`16`, `RB0/INT`→`6` …), sonra ref, değer, aygıt adı (`PIC16F628A`, `7448`, `RES`, `BUTTON`), paket ve `{ANAHTAR=DEĞER}` özellikleri (`{CLOCK=8MHz}`, `{PROGRAM=test\test.hex}`, `{CFGWORD=0x3F6B}`).
- `ROOT.DSN`: sıkıştırılmamış. Başta `ISIS SCHEMATIC FILE`, stil tabloları, `*PINOUT` metinleri; nesneler `ISIS CIRCUIT FILE` / `OBJECT DATA` bölümünden sonra.
- Tel kaydı: `7F "WIRE" 00 00 00`, ardından `uint16` nokta sayısı, ardından sayı × (`int32 x`, `int32 y`) little‑endian. Birim 10 nm (100 th = 254 000). Üç dosyadaki 48 + 19 + 8 telin tamamı bu düzenle çözüldü; hepsi dik açılı ve 50 th ızgarasında.
- Bileşen kaydında pin sayısı kadar `uint32` var; sıfır olmayan değer o pine bağlı tel kaydının dosya ofseti (ör. Lab3'te U1 tablosundaki `0x1376E, 0x137DA, 0x13846, 0x138B2` değerleri U2'nin A, B, C, D giriş pinlerinde de var; `0x1376E`, ilk `WIRE` etiketinden 0x18 bayt önceki kayıt başıdır). Bu, geometriye gerek kalmadan ağ çıkarmaya yeter.
- Görülen kayıt etiketleri: `COMPONENT`, `TERMINAL` (`$TERPOWER`, `$TERGROUND`), `TERMINAL LABEL`, `WIRE LABEL`, `WIRE DOT`, `MKRPINNAME`, `MKRPINNUM`, `MKRORIGIN`, `MKRNODE`.
- Henüz çözülmedi: bileşen konum/dönüş/ayna alanları, DSN'deki pin sırası ile CDB pin sırası arasındaki eşleme, terminal→tel bağlantısı, kavşak kayıtları.

## Ek B — HEX tabanı (2026-11-11, mevcut x86_64 toolchain)
Dondurulmuş dosyalar (değiştirilmez): `projeler/Task1.hex` md5 `c87140f8824b23ebf3ccf28a610e86f5`, `projeler/Task2.hex` md5 `6418f6256b7116b45d7758d365f35725`.

`tests/build_test.py --out` çıktıları (derleme hattının üretmesi gereken):

| Dosya | md5 |
|---|---|
| Eeprom_Demo.hex | `7a87477588daee23ac1e07dac97afd1d` |
| Keypad_Demo.hex | `5cc234d24771ebf1b17ecbb556da62db` |
| Lab1_LedSwitch.hex | `bfa6e92635deb9ccf23605db12bc7be7` |
| Lab2.hex | `98b06a9c4e2d555b0e2bf45864266638` |
| Lcd_Demo.hex | `aef7dc2e42981944829c3b4e291359f9` |
| Mux4_Demo.hex | `72abfc23b02cc3f5567130db03a83b64` |
| Pwm_Demo.hex | `26dfdf732c56fa7bdcaae05ed77d2d60` |
| Task1.hex | `99437e695fd25fb340041117b14fee2c` |
| Task2.hex | `ad023cded4811665dcc6fc2e1fe2f03d` |
| Timer0_Interrupt.hex | `5ed819ec9016927d3b20dba4c52046c8` |
| Uart_Demo.hex | `1123e193112c79127408e2336d5011c5` |

Zamanlama (çekirdekte ölçüldü, 4 MHz): Task1 sayım periyodu — dondurulmuş HEX 100 165 çevrim, güncel derleme 100 605 çevrim; Task2 tarama adımı — 10 125 ve 10 129 çevrim.
