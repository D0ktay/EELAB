# EELAB — tarayıcı duman testi (elle)

Otomatik kısım: `tests/run_all.sh` (birim + `e2e/cross_test.py` + `e2e/e2e_test.js`). Bu liste yalnız tarayıcıda görülebilenler içindir.
Kullanıcı verisini kirletmemek için geçici kökle başlat; EELAB sekmesini **önde** tut (arka plandaki sekmede tarayıcı simülasyonu kısar).

```bash
T=$(mktemp -d); EELAB_HOME=$T/home EELAB_STATE_DIR=$T/state EELAB_MIGRATE_FROM=$T/yok EELAB_NO_REVEAL=1 \
  python3 server.py --no-open --port 0        # yazdığı adresi aç
```
Paketlenmiş uygulama için aynı listeyi `EELAB.app` ile (gerçek `~/Documents/EELAB`) tekrarla.

Sütunlar: **K** = 2026‑11‑11 WS‑F tarafından gömülü Chromium'da (otomasyonla) denendi ✓ · boş = elle denenmeli.

| # | Adım | Beklenen | K |
|---|---|---|---|
| 1 | İlk açılış | Başlık "EELAB", 📁 Projelerim, Mesajlar'da yardım satırları (şema kaydırma ipucu dahil), konsolda hata yok | ✓ |
| 2 | Yeni → C → şablon "Lab3 başlangıç" | Ad önerisi `Lab3_baslangic`, açıklama + "(Devre: lab3)"; Oluştur → dosya + lab3 devresi açılır | ✓ |
| 3 | ⌘B | ROM/RAM satırı, "Derleme başarılı", simülasyon başlar; birler hanesi 0→9 sayar | ✓ |
| 4 | `birler++` satırında F5 | Kırmızı nokta; simülasyon o satırda durur, satır sarı | ✓ |
| 5 | F6 | Tekrar durur; durum satırında Δ ≈ 100 000 çevrim ≈ 100 ms | ✓ |
| 6 | F8 / F7 / ⇧F8 / F4 | Satır ilerler; dışarı çık; imlece kadar çalışır | F8 ✓ |
| 7 | İzleme sekmesi → `birler` → Ekle | Değer görünür; sayfa yenilenince breakpoint + izleme geri gelir (sunucu `.eelab.json`) | ✓ |
| 8 | Kayıtlar sekmesi, duraklamışken PORTB'ye yaz | Değer değişir, devredeki LED/gösterge güncellenir | |
| 9 | Yeni → ASM → "Lab2 ASM sayaç", derle | `lab2` devresi (7448 + 7 seg) açılır, gösterge 0,1,2… sayar (10–15'te 7448'in özel glifleri) | ✓ |
| 10 | Çalışırken başka dosyaya geç | O dosyanın devresi açılır, simülasyon durur | ✓ |
| 11 | Ornekler › Lab2.asm derle | `lab2` devresinde gösterge **4** | ✓ |
| 12 | Ornekler › Task1.c derle, **S** tuşu | Kronometre sayar; **R** sıfırlar | S ✓ |
| 13 | Yeni → "RB0/INT kesmesi", derle, **I** tuşuna birkaç kez dokun | Her dokunuş RA0..RA3 LED'lerinde +1 (çok kısa dokunuşlar da kaybolmaz) | ✓ |
| 14 | `scope_demo` + PWM şablonu, çalışırken Auto Setup / Hold / Cursors / CSV | Düğmeler çalışırken tıklanır; ~200 µs periyotlu kare dalga; Δt ve 1/Δt; CSV çalışma klasörüne | ✓ |
| 15 | Çalışırken bir tele çift tık | "Probe 1 (RBx) added to the oscilloscope", panel açılır; etikete sağ tık kaldırır | ekle ✓ |
| 16 | Panel çok kanallıyken | `#inst` en fazla %45 yükseklik, kaydırılabilir; şema görünür kalır | |
| 17 | ■ Durdur | Osiloskop paneli gizlenir, düzenleme araçları açılır | ✓ |
| 18 | Boş alanda sürükle / Alt+sürükle / Boşluk+sürükle / orta tuş | Seçim kutusu / kaydırma | kutu, Alt ✓ |
| 19 | ⌘C ⌘V ⌘Z | Yapıştırılanlar yeni benzersiz ad alır; geri al | ✓ |
| 20 | Parça ekle, tel çiz, döndür, sil, çift tıkla ad/değer | Normal editör davranışı; devre başlığında `*` | |
| 21 | Export… › Export Bitmap (PNG 2x) / Export SVG | Çalışma klasörüne `<devre>_sema.png` (2x) ve `.svg`; temiz şema, simülasyon renkleri yok | ✓ |
| 22 | Export… › Print… | Önizlemede yalnız şema, yatay sayfa (otomasyonda yalnız `#printArea` içeriği denetlendi) | kısmen |
| 23 | Teslim paketi (ad/numara Türkçe karakterli) | `Teslim/<ad>.zip`: kaynak, hex, devre json, sema.png, sema.svg, BENIOKU.txt (ad, no, Fosc, config, ROM); Finder'da gösterilir | zip ✓ |
| 24 | File › Import Proteus Project (.pdsprj) › `tests/fixtures/Lab3.pdsprj` | 16 parça, 40 bağlantı tellere çevrilir; Fosc = 8 MHz uygulanır; Mesajlar'da özet | ✓ |
| 25 | LAB2.pdsprj / Led_Switch.pdsprj içe aktar, uygun kodla çalıştır | Gösterge / LED değişir (otomatik: `e2e_test.js`) | |
| 26 | Bozuk dosya içe aktar | Kırmızı hata satırı, uygulama ayakta | |
| 27 | 📁 + Yeni klasör… → "Lab4"; Ornekler'e geç | Liste güncellenir; dosya + devre açılır | ✓ |
| 28 | EELAB ⓘ | Sürüm, klasör, mimari, Python, SDCC/gputils sürümü | ✓ |
| 29 | Kod: ⌘F, ⌥⌘F, ⌃G, ⌘/, Tab/⇧Tab, ⌃J | Bul/değiştir çubuğu, satıra git, yorum, girinti, parçacık | |
| 30 | Derleme hatası (ör. `;` sil) → mesaja tıkla | Satır işaretli, tıklayınca o satır seçilir | |
| 31 | LCD / tuş takımı / UART şablonları | LCD yazısı; tuş LCD'de; terminale yazılan geri gelir | |
| 32 | BUZZER içeren devre | Ses + sessize alma düğmesi | |
| 33 | Hız 0,01x ve 100x | Yavaş/hızlı; "yavaş" uyarısı gerekirse | |
| 34 | Sekmeyi kapat, 15 dk bekle (paket) | Sunucu ve başlatıcı kapanır | |
| 35 | Safari ve Firefox'ta 1–5, 14, 21 | Aynı davranış | |
| 36 | Yeni → C → "Karşılaştırıcı (CMCON/VRCON)", ⌘B | `comparator_demo` açılır; RV1 %30, VM1 `+1.50`, D1 sönük; durum çubuğunda "Logic contention" yok | |
| 37 | RV1 kaydırıcısını sürükle / −, + düğmeleri | Yüzde ve silecek gerilimi değişir, VM1 izler; 2,50 V üstünde D1 yanar, altında söner (`index.html`'de `core.attachRunner(()=>runner)` yoksa da eşik 2,5 V'ta çalışır, VM1 yine doğru) | |
| 38 | Duraklatıp pot çevir, devam et | Duraklamışken VM1 güncellenir, LED devam edince değişir | |
| 39 | `scope_demo` + PWM şablonu (TRISB = 0) | "Logic contention" görünmez (VT1.TXD ↔ RB1 arasında R2 1k); UART şablonunda terminalden yazılan R2 üzerinden PIC'e ulaşır | |

## Faz 4 (birebir uyum) — 2026-11-12, WS-5

**K** = WS-5 tarafından T3 önizleme sekmesinde (JS + gerçek tuş olayları) ve başsız Chrome'da (CDP, ekran görüntüleri) denendi ✓ · boş = elle denenmeli. Plan referansları `FIDELITY_PLAN.md` §1 (P = Proteus, M = mikroC, C = simülasyon).

| # | Adım | Beklenen | K |
|---|---|---|---|
| 40 | Ornekler › Task1.c (lab3), kod paneline tıkla, **Ctrl+F9** (M1) | Derlenir, simülasyon başlar; Mesajlar tablosu Satır · Mesaj No. · Mesaj Metni · Birim (1139, 122, 123, 127, 1144 ×2, 125…), Hatalar/Uyarılar/İpuçları süzgeçleri (M3) | ✓ |
| 41 | START/STOP butonu (ya da **S**) iki kez | Sayar, sonra durur (gösterge sabit) | ✓ |
| 42 | Task1, `ones++` satırına (36) breakpoint, START | Ardışık duruşlar arası **100 605** çevrim (eelab modu, D2) | ✓ |
| 43 | **F9** (kod paneli odakta) | Gerekirse derler, ilk kaynak satırında (Task1: satır 8) durur; **F8** → satır 9; **Ctrl+F2** → durur, hata ayıklama durum satırı temizlenir | ✓ |
| 44 | F7 / Ctrl+F8 / F4 / F2 / Shift+F4 / Ctrl+Shift+F5 / Alt+D | İçine adım, dışarı çık, imlece kadar, kesmeye atla, BP listesi, BP temizle, Ayrıştırma sekmesi | |
| 45 | macOS'ta "Klavye gezinmesi" açıkken ^F2 / ^F8 | Sistem yakalarsa **⌘.** / **⇧F8** takma adları çalışır (KULLANIM §5 notu) | |
| 46 | Araçlar › Seçenekler (**F12**) › English → Tamam | mikroC paneli (menü File·Edit·View·Project·Run·Tools·Help, düğmeler, hata ayıklama çubuğu, Mesajlar tablosu: "Compiled Successfully", "Used ROM (program words)…") İngilizce; devre paneli değişmez; geri Türkçe | ✓ |
| 47 | Yeni → C (Projelerim) → Projeyi Düzenle (Ctrl+Shift+E) | "mikroC tam zamanlama" **işaretli**; Ornekler › Task1.c'de **işaretsiz** (D2) | ✓ |
| 48 | Devre: U1'e çift tık / Ctrl+E (P-Edit Component) | Program File, Program Configuration Word (yer tutucu HEX'teki 0x3F10), Processor Clock Frequency = proje saati `4MHz` (D4), Advanced Properties: WDT 18m, EEPROM Write Delay 10m, .BIN, Randomize/Start-up "No" (kapalı) | ✓ |
| 49 | Processor Clock Frequency = `1MHz`, EEPROM Write Delay = `4m` → OK | Sarı şerit "Uyarı: Proteus saat frekansı (1 MHz) ≠ mikroC proje saati (4 MHz)"; simülasyon 1 MHz'te; çekirdek `eeWriteDelay` = 0,004 (ED.onEditPart → core.setProps) | ✓ |
| 50 | Debug menüsü (devre paneli): Pause Animation, Step Over, Step Into, PIC CPU Registers / Data Memory / Program Memory / EPROM Memory / Source Code, Watch Window, Reset Persistent Model Data, Start VSM Debugging, Stop VSM Debugging | Her öğe etkin ve çalışır; açılır pencereler duraklamışken dolar (Registers üst satırı = PC'deki komut) | ✓ |
| 51 | System › Set Animation Options… | Frames per Second 20, Timestep per Frame 50ms, Single Step Time 50ms, Show Logic State of Pins Yes, Wire Voltage No | ✓ |
| 52 | Devre paneline tıkla, **F6 / F7 / F8 / F5** (P1) | Yakınlaştır ×1,25 / uzaklaştır / tüm sayfa / imlece ortala; kod paneli odaktayken aynı tuşlar mikroC anlamında | F6 ✓ |
| 53 | Shift+sürükle, orta tık (izleyerek kaydır), tel çizerken sağ tık / Ctrl, Num +/− (P2–P9) | Kutu zoom, track-pan, son köşeyi geri al / düz segment, döndür | |
| 54 | Uart_Demo.c (uart_demo), derle; terminale `A` yaz (P16) | "EE321 UART", ardından yankı `A` (TX çerçevesi + `uartRx(cfg)` yolu) | ✓ |
| 55 | Durdur, VT1 Edit Component: Baud Rate 19200 → çalıştır | Liste 110…57600; Data Bits/Parity/Stop Bits/XON-XOFF/polarite; 9600'lük PIC ile uyuşmazlıkta **bozuk karakterler** (C12) | ✓ |
| 56 | Terminal ekranında sağ tık | Clear Screen, Pause, Copy, Paste, Hex Display Mode, Echo Typed Characters | |
| 57 | Eeprom_Demo iki kez çalıştır (arada ■) | EEPROM içeriği korunur (EPROM Memory penceresi); Debug › Reset Persistent Model Data → FF (D3) | |
| 58 | LCD şablonu, LCD meşgulken komut (C18) | Mesaj sayacında `[LM016L] Controller received command whilst busy. [<LCD ref>]`; demo yine çalışır | |
| 59 | Derleme sonrası çalışma klasörü | `<ad>.lst` (`;Address Opcode ASM`, `GOTO       nnn`), `.asm`, `.log` dosyaları kaynağın yanında | |
| 60 | Dosya › .mcppi dışa / içe aktar | Zip içinde `X.mcppi` (`[DEVICE] Name=P16F628A Clock=…`); içe aktarınca Fosc uygulanır | |
