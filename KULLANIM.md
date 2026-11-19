# EELAB — Kullanım kılavuzu

EELAB iki penceredir: **solda kod** (mikroC uyumlu C ya da MPASM uyumlu assembly, PIC16F628A), **sağda devre** (Proteus 8 "Schematic Capture" görünümünde şema + simülasyon; bu panelin arayüzü Proteus'taki gibi **İngilizce**dir, terimler Proteus'unkilerle aynıdır). Derlenen HEX doğrudan sağdaki devrede çalışır. Kurulum için bkz. `KURULUM.md`.

## 1. Çalışma klasörleri

Her şey `~/Documents/EELAB/` altındadır:

| Klasör | İçerik |
|---|---|
| `Projelerim/` | Varsayılan çalışma klasörü |
| `Ornekler/` | Hazır örnekler (Lab1, Lab2, LCD, tuş takımı, UART, PWM…) ve devreleri. Değiştirebilirsin; güncellemede ezilmez. |
| `Teslim/` | "Teslim paketi" zip'leri |
| `<Lab4>/` … | Kendi açtığın klasörler |

- Kod araç çubuğundaki **📁 klasör** listesinden klasör değiştir; **+ Yeni klasör…** ile oluştur (ad: harf, rakam, `_`, `-`). Son klasör hatırlanır.
- Bir klasör düzdür: `.c`, `.asm`, `.hex` ve devre `.json` dosyaları yan yana. **Klasörü aç** düğmesi Finder'da gösterir.
- **Dosya işlemleri** (kod panelinin **Dosya** menüsü): Yeniden adlandır…, Çoğalt…, Sil…, Finder'da göster. Kod dosyası yeniden adlandırılınca/silinince `.hex`'i de taşınır; Fosc, config bitleri, breakpoint'ler ve devre bağlantısı yeni ada geçer. **Devre** menüsü aynı işlemleri açık devre için yapar (yeniden adlandırınca ona bağlı kod dosyaları güncellenir). **Dosya › Proje Yöneticisi…** klasördeki tüm kod dosyalarını ve devreleri tek listede gösterir (Aç / Yeniden adlandır / Çoğalt / Sil / Finder). Silinenler `~/Documents/EELAB/.Silinenler/` klasörüne taşınır (tarih önekiyle), oradan geri alınabilir. Örnek devreler (uygulamayla gelen) silinemez/yeniden adlandırılamaz; önce **Save Design** ile klasöre kaydet.
- Çalışma klasörü yalnız `EELAB/` altındaki klasörlerden seçilir; diskte rastgele bir klasörü açma ("Klasör seç…") henüz yok.
- **Dosya ↔ devre eşlemesi:** bir dosyayı açınca ona bağlı devre de açılır. Devre açtığında / kaydettiğinde o anki dosyaya bağlanır. Fosc, breakpoint'ler ve izleme listesi de dosya başına saklanır (`.eelab.json`).

## 2. Yeni dosya ve şablonlar

**Yeni** → ad, dil (C / Assembly), **Şablon**, Fosc. Şablon seçilince açıklaması ve devresi görünür; oluşturunca devresi de açılır.

| Şablon | Devre | Ne yapar |
|---|---|---|
| Boş C / Boş ASM | — | İskelet |
| Lab1 LED ve buton | `lab1_led_switch` | A (RA0) basılı: LED'ler kayar; B (RA1): hepsi yanar (8 MHz) |
| Lab2 ASM sayaç | `lab2` | PORTB ikili sayaç → 7448 → 7 segment |
| Lab3 başlangıç | `lab3` | Üç 7448 + 7 segment; birler hanesi 100 ms'de bir sayar |
| Timer0 kesmesi | `lab1_led_switch` | RB0 LED'i ~1 Hz yanıp söner |
| RB0/INT kesmesi | `rb0_int_demo` | INT butonuna (klavye **I**) her basış RA0..RA3 LED'lerinde ikili sayar |
| 7-seg tarama | `mux4_demo` | 4 haneli çoklu tarama, 0000–9999 |
| LCD 4-bit | `lcd_demo` | LM016L'de "EELAB" + sayaç |
| Tuş takımı + LCD | `keypad_demo` | Basılan tuşu LCD'ye yazar |
| UART echo | `uart_demo` | 9600 baud; Virtual Terminal'e yazdığını geri yollar |
| PWM | `lab1_led_switch` | RB3'te 5 kHz PWM, doluluk 500 ms'de bir artar |
| EEPROM | `lab1_led_switch` | EEPROM'a yazar, okuyup LED'lerde gösterir |

Desteklenen mikroC kütüphaneleri: `Delay_ms/us`, `Button`, `Lcd_*`, `Keypad_*`, `UART1_*`, `PWM1_*`, `EEPROM_Read/Write`, `ByteToStr/IntToStr/…`, `sbit … at …`, `PORTB.B0`, `INTCON.GIE` gibi bit erişimleri, `void interrupt()`. Kullanılmayan kütüphane kodu HEX'e girmez.

## 3. Kod editörü

Tuşlar gerçek mikroC PRO for PIC'teki gibidir; eski EELAB kısayolları takma ad olarak çalışmaya devam eder. Ctrl ile ⌘ eşdeğerdir (Ctrl+Y ve Ctrl+R hariç: bunlar yalnız gerçek Ctrl ile çalışır, ⌘R tarayıcıyı yeniler). mikroC tuşları kod paneli odaktayken geçerlidir (koda ya da sol panele bir kez tıkla).

| Tuş | İş | Eski takma ad |
|---|---|---|
| **Ctrl+F9** | Derle → başarılıysa simülasyon başlar | ⌘B |
| Shift+F9 | Tümünü derle | — |
| Ctrl+S | Kaydet | ⌘S |
| Ctrl+F / F3 / Shift+F3 | Bul / sonraki / önceki | ⌘F (⌘G artık *Satıra git*) |
| Ctrl+R | Bul‑değiştir (yalnız gerçek Ctrl) | ⌥⌘F |
| Ctrl+G | Satıra git | — |
| Ctrl+L | Rutin (fonksiyon/etiket) listesi | — |
| Ctrl+D | Bildirime git | — |
| Ctrl+Shift+. / Ctrl+Shift+, | Yorumla / yorumu kaldır | ⌘/ (aç/kapa) |
| Ctrl+Shift+I / Ctrl+Shift+U | Girintile / girintiyi kaldır | Tab / ⇧Tab |
| Ctrl+Y | Satırı sil (yalnız gerçek Ctrl) | — |
| Ctrl+Shift+Z | Yinele | ⇧⌘Z |
| Ctrl+Shift+0..9 / Ctrl+0..9 | Yer imi koy / yer imine git | — |
| Ctrl+J | Kod parçacığı listesi (**Parçacık…**) | — |
| Ctrl+Space / Ctrl+Shift+Space | Kod tamamlama / parametre ipucu | — |
| Ctrl+Shift+E | **Projeyi Düzenle** (saat + config bitleri + mikroC tam zamanlama) | ⇧⌘E |
| **F12** | **Araçlar › Seçenekler** (arayüz dili, saat bağlantısı) | — |

- **Arayüz dili:** **Araçlar › Seçenekler** (F12) → *Arayüz dili (mikroC paneli)*: **Türkçe** (varsayılan) / **English**. Yalnız sol paneli (menüler, düğmeler, Mesajlar tablosu, hata ayıklayıcı) değiştirir; sağdaki devre paneli her zaman Proteus'taki gibi İngilizcedir. Seçim hatırlanır.
- **Mesajlar** penceresi mikroC'deki gibi tablodur: Satır · Mesaj No. · Mesaj Metni · Birim; Hatalar / Uyarılar / İpuçları süzgeçleri; satıra (çift) tıklamak koda götürür. Başarılı derlemede `.lst`, `.asm` ve `.log` dosyaları kaynağın yanına yazılır.
- Derleme hatası/uyarısı satırda kırmızı/sarı işaretlenir; **Mesajlar**'daki satıra tıklamak o satıra götürür.
- Alt durum çubuğu: satır/sütun, dil, ROM/RAM kullanımı (2048 word sınırı).
- **Kod tamamlama:** 2 harf yazınca ya da bir kayıttan sonra `.` yazınca liste kendiliğinden açılır (⌃Space ile her zaman). İçerik: mikroC kütüphane fonksiyonları (imza + açıklama altta), SFR'ler (`PORTB`, `INTCON`…), bit adları (`INTCON.` → `GIE`, `T0IF`… ve `B0`–`B7`), `RB0_bit` gibi sbit'ler, `_LCD_*` sabitleri, anahtar kelimeler ve dosyadaki kendi değişken/fonksiyon adların; assembly'de komutlar, yönergeler, SFR/bit adları ve etiketler. ↑/↓ seç, **Enter** ya da **Tab** ekle, **Esc** kapat. Fonksiyon eklenince `()` gelir ve parametre ipucu görünür. Yorum ve dizgi içinde açılmaz.
- **Kütüphane** sekmesi (alt panel): desteklenen fonksiyonlar gruplu (Gecikme, LCD, UART, PWM, EEPROM…), ayrıca LCD sabitleri ve SFR'ler. Seçince imza, açıklama ve örnek görünür; **Örneği ekle** / **Adı ekle** imlece yazar (çift tık = örneği ekle). ✓ = bu dosyada kullanılıyor. Liste sunucudaki `/api/libs`'ten gelir (derleyicinin desteklediğiyle aynı).
- **Fosc** (4/8/20 MHz) dosya başınadır. C'de `Delay_ms` ve config word buna göre derlenir — değiştirince yeniden derle. 4 MHz dışında INTOSC uyarısı görünür.
- **mikroC tam zamanlama** (Projeyi Düzenle › *Kütüphane zamanlaması*, yalnız C): açıkken `Delay_ms/Delay_us/Delay_Cyc` ve `Lcd_*` gerçek mikroC çevrim sayılarıyla derlenir (ör. `Delay_ms(100)` @ 4 MHz = tam 100 000 çevrim). **Yeni** ile oluşturulan dosyalarda ve şablonlarda açık, mevcut/örnek dosyalarda (Task1, Task2, Ornekler, eski projeler) kapalıdır — böylece eski HEX'ler bayt bayt aynı kalır (Task1 kronometresi 100 605 çevrim). Değiştirince yeniden derle.
- **Projeyi Düzenle** (Fosc satırındaki **Config bitleri…**, config yazısına tıklama, **Proje** menüsü ya da Ctrl+Shift+E): mikroC'deki *Edit Project* penceresi. Saat frekansı ve config bitleri: Osilatör (INTOSC CLKOUT'suz / CLKOUT'lu, HS, XT, LP, EC, ER G/Ç / CLKOUT), WDT, PWRT, RA5/MCLR, BOR, LVP, CPD, CP. Oluşan config word (`0x3F10` gibi) ve bit dökümü canlı görünür; uyumsuz seçimlerde uyarı verir. **Varsayılan**: C'de Fosc'a göre (4 MHz → INTOSC `0x3F10`, 8/20 MHz → HS `0x3F02`; bunlar önceki sürümlerle aynı HEX'i verir), assembly'de kaynaktaki `__CONFIG`. Ayar dosya başına saklanır (`.eelab.json`) ve **derlemede** uygulanır; assembly'de seçilen değer kaynaktaki `__CONFIG`'in yerine HEX'e yazılır. Değiştirince yeniden derle — derlenene kadar Fosc satırında "⚠ proje ayarı … — derle" görünür. **WDT açıksa** simülatör WDT reset'i uygular: kod `clrwdt` (C'de `asm clrwdt;`) çalıştırmazsa ~18 ms × prescaler'da bir PIC baştan başlar (OPTION_REG reset değerinde prescaler WDT'de, 1:128 → ~2,3 s).
- Kaydedilmemiş değişiklik başlıkta `*` / `•` ile görünür; sayfadan çıkarken uyarılır.
- **Load Program File** (devre araç çubuğundaki HEX simgesi, ya da File/Debug menüsü): başka bir derleyicinin (ör. gerçek mikroC) HEX'ini doğrudan devrede çalıştırır.

## 4. Simülasyon

- Sol alttaki simülasyon düğmeleri: ▶ **Run** · ▶| **Step** (50 ms ilerlet) · ⏸ **Pause** · ■ **Stop**; yanında hız (0.01x–100x). Durum çubuğu Proteus'taki gibi: `ANIMATING: 00:00:01.250000 (CPU load 12%)`, gösterge değerleri, `Logic contention(s) detected on net RB1` uyarısı (çakışan ağların adlarıyla); solunda mesaj sayacı (**No Messages** / **N Messages** — tıklayınca Mesajlar sekmesi), sağında imleç koordinatı (thou, `th`).
- **Butonlar:** fareyle basılı tut, ya da klavyeden butonun değerinin ilk harfi (Lab3: **S** = START/STOP, **R** = RESET). Önce kod kutusunun dışına tıkla.
- **Anahtar / LOGICSTATE / DIP anahtar:** tıklayınca değişir. **Tuş takımı:** tuşa bas.
- **Virtual Terminal:** üzerine tıkla, yaz (Esc ile çık); bu sırada S/R kısayolları kapalıdır.
- Çalışırken durum çubuğunun üstündeki **PIC CPU Registers** satırında PORTA/PORTB/TRIS/W/PC/INTCON canlı görünür. Pin uçlarındaki kareler Proteus'taki gibi: kırmızı = 1, mavi = 0, gri = boşta.
- **İki saat (Proteus'taki gibi):** mikroC proje saati (Fosc) yalnız derleyiciyi, PIC parçasının **Processor Clock Frequency** özelliği (Edit Component) simülasyonu yönetir. Parçada değer yoksa (yeni parçalar ve eski devreler) proje saati kullanılır. İkisi farklıysa kod panelinin üstünde sarı uyarı çıkar: "Uyarı: Proteus saat frekansı (1 MHz) ≠ mikroC proje saati (4 MHz)". Eski "tek saat" davranışı için **Araçlar › Seçenekler** › *Proteus saatini mikroC proje saatine bağla*.
- **EEPROM** Proteus modelindeki gibidir: bir bayt yazma 10 ms sürer (PIC'in *Data EEPROM Write Delay* özelliği) ve içerik simülasyonlar arasında korunur; silmek için devre panelinde **Debug › Reset Persistent Model Data**.
- Simülasyon uyarıları (yığın taşması, geçersiz komut, WDT reset'i, LCD meşgulken komut…) Proteus biçiminde (`[PIC16] PC=0x0354. … [U1]`) durum çubuğundaki mesaj sayacında listelenir.
- EELAB sekmesini önde tut: tarayıcı arka plandaki sekmeyi yavaşlatır.

## 5. Hata ayıklayıcı

Breakpoint için satır numarasının soluna (oluğa) tıkla ya da **F5**. Derleme gerekli (satır↔adres eşlemesi için); kod değişince "yeniden derle" uyarısı çıkar.

| Tuş | İş | Eski takma ad |
|---|---|---|
| **F9** | Hata ayıklayıcıyı başlat: gerekirse derler, HEX'i yükler, reset eder ve ilk kaynak satırında durur | — |
| **Ctrl+F2** | Hata ayıklayıcıyı / simülasyonu durdur | ⌘. |
| F6 | Çalıştır / devam · çalışırken duraklat | — |
| F7 | Adım (fonksiyonun içine gir) | — |
| F8 | Üzerinden atla (çağrıyı tek adımda geç) | — |
| **Ctrl+F8** | Dışarı çık (fonksiyondan dön) | ⇧F8 |
| F4 | İmlecin olduğu satıra kadar çalıştır | — |
| F5 | İmlecin satırında breakpoint aç/kapa | — |
| F2 | Kesmeye atla (PC = 0x0004 olana kadar çalıştır) | — |
| Shift+F4 / Ctrl+Shift+F5 | Breakpoint listesi / tümünü temizle | — |
| Shift+F5 / Ctrl+F5 | İzleme penceresi / imleçteki adı izlemeye ekle | — |
| Alt+D | Ayrıştırma (disassembly) sekmesi | — |
| **Komut** düğmesi | Tek makine komutu | — |

> **macOS notu:** Sistem Ayarları › Klavye › Klavye kısayolları'nda "Klavye gezinmesi" açıksa macOS **^F2** (menü çubuğuna odak) ve **^F8** (durum menüleri) tuşlarını kendisi yakalar; EELAB'a ulaşmazlar. O zaman eski takma adları kullan: durdurmak için **⌘.**, dışarı çıkmak için **⇧F8**. F-tuşları parlaklık/ses yapıyorsa **fn** ile bas ya da "F1, F2 vb. tuşları standart işlev tuşları olarak kullan" seçeneğini aç.

Alt panel sekmeleri: **Kayıtlar** (W, PC, STATUS bayrakları, tüm SFR'ler; değişen kırmızı; duraklamışken değere tıklayıp yaz, bite tıklayıp çevir) · **RAM** ızgarası · **İzleme** (C global değişkenleri, asm etiketleri, SFR ya da `0x20` gibi adres; ondalık/hex/ikili/karakter/işaretli, 1–2 bayt) · **Yığın · EEPROM** · **Ayrıştırma** (disassembly + listing; adrese breakpoint) · **İstatistik** (ROM ve RAM kullanım çubukları; fonksiyon/bölüm başına word sayısı ve yüzdesi — Kullanıcı / Kütüphane / Sistem (SDCC başlangıç ve çalışma zamanı) / Veri; değişkenlerin RAM adresleri ve boyutları. C'de değerler bağlayıcının `.map` dosyasından gelir ve toplamı ROM'a eşittir; assembly'de etiketten etikete sayılır. Fonksiyon adına tıklamak koda götürür).
**İzleme** sekmesi mikroC'deki *Watch Values* gibidir: İsim · Değer · Adres; listeden değişken seç + Ekle, Kaldır / Tümünü Ekle / Tümünü Kaldır; değişen değer kırmızı; çift tık = Değer Düzenle (Dec/Hex/Bin/Char/Float, işaretli).
**Kronometre:** üst satırda toplam çevrim ve son iki duruş arası süre (ör. Lab3'te iki `birler++` duruşu arası ≈ 100 000 çevrim = 100 ms @ 4 MHz); "Sıfırla" ile sıfırla. Breakpoint'ler ve izleme listesi dosyayla birlikte saklanır.

## 6. Devre editörü

Düzenlemek için simülasyonu **durdur (■)**. Tuşlar odağa göre ayrılır: devre paneline tıkladıktan sonra F5–F8, F10/F11 ve Ctrl+F12 Proteus'taki anlamındadır; kod paneline tıklayınca mikroC tuşları geçerli olur (F5 breakpoint, F8 üzerinden atla…).

| İşlem | Nasıl |
|---|---|
| Parça yerleştir | **Object Selector** (**DEVICES** listesi) içinden seç — üstteki kutuya İngilizce ya da Türkçe yaz (ör. `resistor` / `direnç`) — ya da **P** düğmesi / **P** tuşu ile **Pick Devices** penceresini aç (Keywords, Category, Results, önizleme); şemaya tıkla; R ile döndür |
| Kip araç çubuğu | En soldaki dikey çubuk: **Selection**, **Component** (DEVICES), **Wire Label** (ağ etiketi = TERMINAL), **Terminals** (DEFAULT/POWER/GROUND), **Probe**, **Virtual Instruments** (OSCILLOSCOPE, LOGIC-ANALYSER, VIRTUAL-TERMINAL). Gri olanlar EELAB'da yok. Üstünde **Overview** (küçük harita: tıkla/sürükle = kaydır) |
| Tel çiz | Bir pinden başla, tıklayarak köşe koy, pinde/telde bitir; **W** tel aracı; Esc iptal |
| Seç / taşı | Tıkla-sürükle; boş alanda sürükle = **seçim kutusu**; ⇧/⌘‑tık = seçime ekle; ok tuşları (⇧ ile 50) |
| Kaydır | **Alt + sürükle**, **Boşluk + sürükle** ya da orta tuş; iki parmakla kaydır |
| Yakınlaştır | Fare tekerleği, ⌘ + iki parmak, F6/F7/F8, araç çubuğunda **Zoom In / Zoom Out / Zoom To View Entire Sheet**; **G** ızgarayı aç/kapa |
| Kopyala / kes / yapıştır / çoğalt / tümü | ⌘C / ⌘X / ⌘V / ⌘D / ⌘A (yapıştırılanlar yeni benzersiz ad alır) |
| Döndür / sil | R / Delete; sol alttaki **Rotate Clockwise / Anti-Clockwise** düğmeleri; **sağ tık** = bağlam menüsü (Edit Properties, Delete Object, Rotate…, Cut/Copy/Paste) |
| Geri al / yinele | ⌘Z / ⇧⌘Z |
| Ad / değer düzenle | Parçaya çift tıkla, **Ctrl+E** (imlecin altındaki parça) ya da **E** (referansla bul: `U1`) → **Edit Component**. PIC: Program File, Program Configuration Word, Processor Clock Frequency (`4MHz`, `32.768kHz`…), *Advanced Properties*: Watchdog Timer Period (`18m`), Data EEPROM Write Delay (`10m`), Initial contents of EEPROM (.BIN). VIRTUAL TERMINAL: Baud Rate, Data Bits, Parity, Stop Bits, XON/XOFF, polarite — PIC'in baud hızıyla uyuşmazsa ekranda Proteus'taki gibi bozuk karakterler görünür |
| Görünüm tuşları (devre paneli odaktayken) | **F6** yakınlaştır · **F7** uzaklaştır · **F8** tüm sayfa · **F5** imlece ortala (Proteus). **Shift + sürükle** = kutu çizerek yakınlaştır; orta tuşa tıkla = imleci izleyerek kaydır; tel çizerken sağ tık son köşeyi geri alır, Ctrl basılıyken düz/çapraz segment; Num **+ / −** = döndür |
| Hata ayıklama (devre paneli) | **Debug** menüsü: Start VSM Debugging (Ctrl+F12), Pause Animation (Pause), Stop VSM Debugging (Shift+Break / Shift+Esc), Step Over (F10), Step Into (F11), Step Out (Ctrl+F11); duraklamışken PIC CPU Registers / Data Memory / Program Memory / EPROM Memory / Source Code ve Watch Window pencereleri; Reset Persistent Model Data. **System › Set Animation Options…**: kare hızı, adım süresi, pin lojik durumları |
| Ağ etiketi | **TERMINAL** parçası (Terminals kipinde **DEFAULT**): aynı ada sahip terminaller aynı ağdır (uzun tel çekmeden bağlar) |

**Save Design** çalışma klasörüne `.json` yazar; **Open Design…** klasördeki ve örnek devreleri listeler; **Reload Default Design** Lab3 şemasını yükler. Aynı komutlar **File** menüsünde de var.

### Parça listesi (Pick Devices kategorileri)

| Category | Parçalar |
|---|---|
| Microprocessor ICs | PIC16F628A (VDD/VSS hep beslenir) |
| Optoelectronics | LED (RED/GREEN/YELLOW/BLUE), LED-BARGRAPH-RED, 7SEG-MPX1-CC/CA, 7SEG-MPX2-CC/CA, 7SEG-MPX4-CC/CA, 7SEG-BCD, LM016L (2×16 LCD), LM044L (4×20 LCD), TRAFFIC-LIGHTS |
| TTL 74 Series / 74HC Series | 7448, 7447 / 74HC595 |
| Switches & Relays | BUTTON, SWITCH, DIPSW_8, KEYPAD-PHONETYPE (4×3), KEYPAD-SMALLCALC (4×4), RELAY |
| Debugging Tools | LOGICSTATE, LOGICPROBE |
| Resistors · Capacitors · Miscellaneous | RES · CAP, CAP-ELEC · CRYSTAL (dekoratif) |
| Speakers & Sounders · Electromechanical · Transistors · Analog ICs | BUZZER (sesi kapatılabilir) · MOTOR · NPN · L293D |
| Terminals (Terminals kipi) | DEFAULT (= TERMINAL, ağ etiketi), POWER, GROUND |
| Virtual Instruments (Instruments kipi) | OSCILLOSCOPE (A–D), LOGIC-ANALYSER (A0–A7), VIRTUAL-TERMINAL |

Simülasyon lojik düzeydedir (0/1/boşta); analog davranış (ADC, gerilim, akım) yoktur.

## 7. Osiloskop ve lojik analizör

Şemaya **OSCILLOSCOPE** ya da **LOGIC-ANALYSER** koy ve kanallarını sinyallere bağla (örnek: `scope_demo` devresi). Ya da **çalışırken bir tele/pine çift tıkla** → "Probe" kanalı eklenir (etikete sağ tık ile kaldır). Panel şemanın altında açılır.

- **Horizontal**: zaman/böl (`/div`) listesi ya da fare tekerleği; **Auto Setup** sinyale göre ayarlar; **⏸ Hold / ▶ Run** ekranı dondurur.
- **Trigger**: kanal, kenar (Rising/Falling/Both), kip (Auto / Normal / One-Shot).
- **Measure › Cursors**: iki tıkla A ve B'yi koy (sürükleyerek taşı, sağ tık siler) → Δt, 1/Δt.
- Kanal başına frekans, periyot ve doluluk otomatik ölçülür. Kanal etiketine tıklamak kanalı gizler/gösterir.
- **CSV**: görünen aralık çalışma klasörüne kaydedilir (`time_s,cycle,…`). **Clear** kaydı siler. Kanal renkleri Proteus osiloskobundaki gibi: A sarı, B mavi, C kırmızı, D yeşil.

## 8. Proteus `.pdsprj` içe aktarma

Araç çubuğundaki ilk düğme ya da **File › Import Proteus Project (.pdsprj)…** → dosyayı seç. Parçalar (ad, değer, konum, dönüş) ve bağlantılar okunur, teller otomatik çizilir; projedeki `CLOCK` (ör. 8 MHz) Fosc'a uygulanır. Desteklenmeyen parçalar Mesajlar'da listelenir. Kalıcı olması için **Save Design**. Ders dosyaları (Lab3, LAB2, Led_Switch) test edilmiştir. Proteus'taki programı değil, EELAB'ın derlediği HEX'i çalıştırır. `.pdsprj` yazma (dışa aktarma) yoktur.

## 9. Dışa aktarma ve teslim

- Devre araç çubuğu › **Export…** (ya da **File** menüsü): **Export Bitmap (PNG 2x)**, **Export SVG** (çalışma klasörüne `<devre>_sema.png/.svg`; simülasyon renkleri olmadan temiz şema) ya da **Print…** (yalnız şema, yatay sayfa).
- **Teslim paketi** (kod araç çubuğu): ad‑soyad ve numara gir → `~/Documents/EELAB/Teslim/<dosya>.zip` oluşur ve Finder'da gösterilir. İçerik: kaynak (`.c`/`.asm`), `.hex`, devre `.json`, `sema.png`, `sema.svg`, `BENIOKU.txt` (ad, numara, tarih, Fosc, config word, ROM kullanımı). Önce derle ki HEX güncel olsun.

## 10. Hakkında / Tanılama

Sol üstteki **EELAB ⓘ**: sürüm, çalışma klasörü, işlemci mimarisi, Python ve derleyici durumu. Sorun bildirirken bunu ve uygulama menüsündeki **Tanılama** raporunu gönder.
