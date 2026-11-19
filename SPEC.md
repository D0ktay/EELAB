# EE321 Lab Studio — devre editörü + .pdsprj içe aktarma: ortak sözleşme

Uygulama: `EE321_Lab3_Studio/` — yerel Python sunucusu (`server.py`, port 8321) + tek sayfa arayüz (`index.html`).
Sol panel mikroC benzeri editör (C → gerçek HEX, SDCC ile), sağ panel Proteus benzeri devre; HEX, `index.html` içindeki PIC16F628A çekirdeğinde (`P`, `step()`) çalışır.
Bugün sağdaki devre `index.html` içinde elle çizilmiş SABİT bir şemadır. Hedef: devre **veri** olsun, kullanıcı düzenleyebilsin ve bir Proteus `.pdsprj` dosyasından yüklenebilsin.
Arayüz dili Türkçe. Harici kütüphane/CDN/npm YOK (saf JS, Python 3.9 stdlib). Kod dosyalarında gereksiz yorum yazma.

## Dosya sahipliği (başkasının dosyasına DOKUNMA)
| Dosya | Sahip |
|---|---|
| `js/library.js`, `circuits/lab3.json`, `tests/library_test.js` | Ajan A (kütüphane) |
| `index.html`, `js/sim.js`, `js/editor.js`, `tests/sim_test.js` | Ajan B (editör + simülasyon) |
| `pdsprj.py`, `tests/pdsprj_test.py` | Ajan C (içe aktarıcı) |
| `server.py`, `SPEC.md`, `shim/`, `toolchain/`, `projeler/` | planlayıcı — değiştirme |

## 1. Devre JSON şeması (herkes buna uyar)
```json
{ "version": 1,
  "parts": [ { "id": "U1", "type": "PIC16F628A", "x": 250, "y": 240, "rot": 0, "value": "" } ],
  "wires": [ { "id": "w1", "points": [[410,260],[520,260]] } ],
  "nets":  [ ["U1.17", "U2.7"] ] }
```
- Birim: SVG kullanıcı birimi. Izgara 10. Parça orijinleri, pin uçları ve tel noktaları 10'un katıdır. Varsayılan görünüm `viewBox="0 0 1080 670"`.
- `id` benzersizdir ve referans adıdır (U1, R10, SW1...). `rot` ∈ {0,90,180,270}. `value` serbest metin (ör. `10k`, `220`).
- `wires`: dik açılı (Manhattan) çoklu çizgiler.
- `nets` İSTEĞE BAĞLIDIR ve yalnızca içe aktarmada kullanılır: her eleman birbirine bağlı pinlerin listesi, pin adresi `"PARÇAID.pinNum"`. Editör `nets` görürse bunları otomatik yönlendirip `wires`'a çevirir ve `nets`'i siler.
- Bağlantı kuralı: bir tel ucu/köşesi bir pin ucuyla ya da başka bir telin ucu/köşesiyle aynı noktadaysa bağlıdır; bir tel UCU başka bir telin parçası üzerine denk geliyorsa da bağlıdır (T bağlantı). Sadece kesişen teller bağlı DEĞİLDİR.

## 2. Parça tipleri ve pin numaraları (`num` her zaman string)
| type | pinler (num = ad) |
|---|---|
| `PIC16F628A` | 17=RA0, 18=RA1, 1=RA2, 2=RA3, 3=RA4, 4=RA5/MCLR, 15=RA6, 16=RA7, 6..13=RB0..RB7 (VSS=5, VDD=14 çizilmez, hep beslenir) |
| `7448` | 7=A, 1=B, 2=C, 6=D, 3=LT, 4=BI/RBO, 5=RBI, 13=QA, 12=QB, 11=QC, 10=QD, 9=QE, 15=QF, 14=QG (VCC/GND çizilmez) |
| `7SEG-MPX1-CC` | A, B, C, D, E, F, G, DP (anotlar), K (ortak katot) |
| `BUTTON` | 1, 2 |
| `RES` | 1, 2 (varsayılan value `10k`) |
| `POWER` | 1 (lojik 1 kaynağı, +5V) |
| `GROUND` | 1 (lojik 0) |

## 3. `js/library.js` API'si (Ajan A yazar, Ajan B kullanır)
Tarayıcıda `window.LIB`, Node'da `module.exports` (DOM gerektiren fonksiyonlar hariç Node'da çalışmalı).
```js
LIB.types[type] = { type, prefix, label, w, h, defaultValue, pins: [{ num, name, x, y }] }
// w,h: gövde sınır kutusu (rot 0, orijin sol-üst). pin x,y: tel bağlama noktası, orijine göre, rot 0.
LIB.order            // ["PIC16F628A","7448","7SEG-MPX1-CC","BUTTON","RES","POWER","GROUND"]
LIB.pinPos(part, num) -> [x, y]      // döndürme uygulanmış mutlak koordinat (10'un katı)
LIB.bbox(part) -> { x, y, w, h }     // döndürme uygulanmış mutlak sınır kutusu
LIB.render(part, parentSvg) -> g     // <g class="part" data-id=...>: sembol, pin çizgileri, pin kareleri, ref ve value yazısı; transform'u kendisi ayarlar
LIB.update(g, part, state)           // dinamik görünümü günceller
```
- Döndürme: gövde merkezi etrafında saat yönünde; sonuç ızgaraya (10) oturmalı.
- `state = { on: bool, pins: { num: 0|1|2 }, lit: { A:bool,...,DP:bool }, pressed: bool }`. `on=false` (simülasyon durmuş): pin kareleri gri, segmentler sönük.
- Pin karesi renkleri: 0 → `#1d3fd8`, 1 → `#e11313`, 2 (boşta/bilinmiyor) → `#9a9a9a`. Segment yanık `#ff2a1a`, sönük `#521010`.
- `BUTTON` sembolünde tıklanabilir alan `class="btn-hit"` olan saydam bir `rect` olmalı (editör çalışma modunda buna basma olayı bağlar); `pressed` iken kontak çubuğu aşağı iner.
- Görünüm Proteus'a benzesin: gövde dolgusu `#c9c7a4`, kenar `#7a1414`, tel rengi `#1c5a1c`, yazı Arial 7–10 px. Mevcut `index.html` içindeki çizim kodu referans alınabilir.

## 4. Simülasyon (Ajan B)
- Devreden netlist çıkar (kural §1), her karede lojik seviyeleri çöz: güçlü sürücüler = POWER(1), GROUND(0), PIC çıkış pinleri, 7448 çıkışları. Basılı BUTTON iki ucunu kısa devre eder. RES zayıf bağlantıdır (pull-up/pull-down ve seri direnç). Sürülmeyen net = 2 (boşta).
- PIC girişi: bağlı netin seviyesi (boşta → 0). Hem A hem B portu giriş olabilmeli (`P` çekirdeğinde bugün yalnızca `P.ext` ile A portu var; genişlet).
- 7448: gerçek doğruluk tablosu; bağlı olmayan LT/BI/RBI = 1.
- 7SEG-MPX1-CC: bir segment, anot neti 1 (doğrudan ya da dirençle) VE K neti 0'a bağlıysa yanar.
- Birden çok PIC desteklenmez; devrede PIC yoksa simülasyon yine çalışır (sadece lojik).

## 5. Sunucu uçları (hazır, `server.py`)
- `GET /js/<dosya>`, `GET /circuits/<dosya>` — statik dosyalar.
- `GET /api/circuits` → `{files:[ad,...]}` (`projeler/*.json`), `GET /api/circuit?name=AD` → devre JSON, `POST /api/circuit-save` `{name, circuit}`.
- `POST /api/import-pdsprj` — gövde: `.pdsprj` dosyasının ham baytları → `pdsprj.parse_pdsprj(bytes)` sonucunu JSON döndürür: `{parts, wires?, nets?, warnings:[...]}` ya da `{error}`.

## 6. `pdsprj.py` (Ajan C)
`parse_pdsprj(data: bytes) -> dict` — §1 şemasında `parts` + (`nets` ya da `wires`) + `warnings` döndürür. `.pdsprj` bir zip'tir (`ROOT.DSN`, `ROOT.CDB`, `PROJECT.XML`). Parça tipleri §2'deki adlara, pinler §2'deki `num`'lara çevrilir; tanınmayan parçalar `warnings`'e yazılır ve atlanır.

---
# Faz 2 — EE321 kütüphanesi genişletme + derleyici/çekirdek geliştirme (2026-11-11)

Kurs içeriği (yerel föyler): Lab1 LED + buton/anahtar (mikroC, P16F628A, **8 MHz**), Lab2 PIC Assembly (MPLAB/MPASM, `lab2assignment.asm`, 7448 + 7seg), Lab3 kronometre (7448, 7SEG-MPX1-CC, BUTTON, RES). Sonraki lablarda beklenenler: Timer0/kesme, çoklu 7seg tarama, LCD (LM016L), tuş takımı, UART + Virtual Terminal, PWM (CCP1/RB3), EEPROM, buzzer, motor.

## Dosya sahipliği (Faz 2)
| Dosya | Sahip |
|---|---|
| `js/library.js`, `js/sim.js`, `js/editor.js`, `circuits/*.json`, `tests/library_test.js`, `tests/sim_test.js` | Ajan P (parçalar + devre çözücü) |
| `index.html`, `js/pic.js` (YENİ: çekirdek index.html'den buraya taşınır), `shim/*`, `server.py`, `projeler/*`, `tests/core_test.js`, `tests/build_test.py` | Ajan K (çekirdek + derleyici) |
| `SPEC.md`, `pdsprj.py` | planlayıcı |

## 7. Yeni parça tipleri (Ajan P) — `num` string
| type | pinler | davranış |
|---|---|---|
| `LED-RED`, `LED-GREEN`, `LED-YELLOW`, `LED-BLUE` | `A`, `K` | A=1 ve K=0 (doğrudan ya da RES üzerinden) → yanar. `state.lit.ON` |
| `SWITCH` | `1`, `2` | SPST anahtar; tıklayınca açık/kapalı değişir (kalıcı) |
| `DIPSW_8` | `1..8` (sol), `9..16` (sağ; i ↔ 17-i değil, i ↔ i+8) | 8 bağımsız anahtar, her biri tıklanınca değişir |
| `LOGICSTATE` | `1` | güçlü sürücü 0/1, tıklayınca değişir (Proteus LOGICSTATE) |
| `LOGICPROBE` | `1` | netin değerini 0/1/? olarak gösterir |
| `7SEG-MPX1-CA` | `A..G`, `DP`, `COM` | ortak anot: COM=1 ve segment pini 0 → yanar |
| `7447` | 7448 ile aynı pinler | çıkışlar aktif-düşük (CA ekran için) |
| `7SEG-BCD` | `1`,`2`,`4`,`8` | 4 bit BCD girişi doğrudan rakam gösterir (Proteus 7SEG-BCD) |
| `7SEG-MPX4-CC`, `7SEG-MPX4-CA` | `A..G`, `DP`, `1..4` (hane ortak uçları) | çoklu hane tarama; kalıcılık penceresi (WIN) ile titreşimsiz görünür |
| `LED-BARGRAPH-RED` | `A1..A10`, `K1..K10` | 10 ayrı LED |
| `LM016L` | `1`=VSS,`2`=VDD,`3`=VEE (çizilir ama elektriksiz), `4`=RS,`5`=RW,`6`=E,`7..14`=D0..D7 | HD44780 durum makinesi: E düşen kenarında RS/D okunur; 8-bit ve 4-bit mod, clear/home/entry/display/cursor/function set/DDRAM adres; 2×16 karakter gösterir. `state.lcd = {lines:[s0,s1], cursor}` |
| `KEYPAD-PHONETYPE` | satır `A,B,C,D`, sütun `1,2,3` | 4×3 (1 2 3 / 4 5 6 / 7 8 9 / * 0 #); tuşa basılı iken satır netiyle sütun netini kısa devre eder |
| `KEYPAD-SMALLCALC` | satır `A,B,C,D`, sütun `1,2,3,4` | 4×4 (7 8 9 / / 4 5 6 x / 1 2 3 - / C 0 = +) |
| `BUZZER` | `1`, `2` | iki ucu arasında 1/0 farkı varsa ya da son pencerede değişiyorsa "çalıyor" (görsel dalga + Web Audio bip, sessize alınabilir) |
| `MOTOR` | `1`, `2` | 1→2 yönünde dönüş animasyonu, ters yön ters döner |
| `CRYSTAL`, `CAP`, `CAP-ELEC` | `1`,`2` | dekoratif (elektriksel etkisi yok) |
| `NPN` | `B`,`C`,`E` | B=1 ve E=0 ise C'yi zayıf 0'a çeker (anahtar modeli) |
| `VIRTUAL-TERMINAL` | `RXD`, `TXD`, `RTS`, `CTS` | PIC UART'ına bağlanır: RXD'si PIC RB2(TX) netindeyse PIC'in gönderdiği baytları gösterir; TXD'si RB1(RX) netindeyse kullanıcı klavyeyle yazdığı baytları PIC'e yollar. `state.text` |
`LIB.order` yeni tipleri kategorilere göre içerir; `LIB.categories = [{name:'Mikrodenetleyici', types:[...]}, {name:'Göstergeler',...}, {name:'Giriş',...}, {name:'Pasif',...}, {name:'Çıkış/Aktüatör',...}, {name:'Sanal Aletler',...}]` — editör paleti kategorili ve aranabilir olur.

## 8. Etkileşim sözleşmesi (P ↔ K)
- Editör tıklanabilir alanlar: `class="btn-hit"`, isteğe bağlı `data-key="5"`. Editör `onPress(id, v)` çağırır; `data-key` varsa id = `"KP1:5"` olur. BUTTON/keypad: basılı tut; SWITCH/LOGICSTATE/DIPSW (`data-key` = anahtar no): `v=true` geldiğinde durum değişir, `v=false` yok sayılır. Bunların hepsi `Runner.press(id, v, cyc)` içinde çözülür. `index.html` mevcut `pressBtn` akışını değiştirmez.
- `Runner.port(trisA, latA, trisB, latB, cyc)` — her port/TRIS değişiminde çağrılır (önbellekli olsa bile). Ajan P, LCD kenar algılamasını burada (önbellekten bağımsız, her çağrıda) yapar.
- UART: çekirdek, TXREG'e yazılan baytı gönderim süresi bitince `runner.uartTx(byte, cyc)` ile verir (Runner, RB2 netine bağlı VIRTUAL-TERMINAL RXD'sine ekler). Çekirdek her karede `runner.uartRx()` çağırır → bekleyen bir bayt (number) ya da `null` (terminal TXD'si RB1 netindeyse kullanıcının yazdıkları). Terminal klavye girişi: editör, terminal seçiliyken/üzerine tıklanmışken yazılan tuşları `runner.termKey(id, char)` ile verir (Ajan P; index.html'deki global klavye kısayollarıyla çakışmasın diye terminal odaktayken S/R kısayolları devre dışı — Ajan K `window.TERM_FOCUS` bayrağına bakar).
- Saat: `Runner` zamanı komut çevrimi (`cyc`) cinsinden alır; `runner.setClock(fosc)` ile Fosc (Hz) bildirilir (WIN ve buzzer frekansı buna göre). Ajan K çekirdekte Fosc seçiciyi (4/8/20 MHz, varsayılan 4 MHz, mikroC projesindeki gibi) ve gerçek-zaman hesaplarını buna göre yapar.
- `runner.state(part, r)` dönen nesneye yeni alanlar: `lcd`, `text`, `on` (switch durumu), `level` (LOGICPROBE), `spin` (motor), `sound` (buzzer).

## 9. Çekirdek ve derleyici (Ajan K)
- `js/pic.js`: PIC16F628A çekirdeği tek dosyada, Node'da da test edilebilir (`module.exports`). Eksikler: DC bayrağı, RETFIE + kesmeler (GIE/PEIE, T0IF, INTF (RB0, INTEDG), RBIF (RB4..7 değişimi), TMR1IF, TMR2IF, CCP1IF, RCIF/TXIF, EEIF), 0x0004 vektörü; TMR0 (OPTION_REG prescaler/T0CS/PSA), TMR1, TMR2 + PR2, CCP1 (capture/compare/PWM, RB3 çıkışı), USART (asenkron, BRGH, SPBRG; TXREG/RCREG/TXSTA/RCSTA), EEPROM (EECON1/EECON2/EEADR/EEDATA, 128 bayt), CMCON (karşılaştırıcılar kapalı varsayılır), WDT/SLEEP (SLEEP: kesmeye kadar bekler), OPTION_REG RBPU (PORTB zayıf pull-up'ları: TRIS=1 ve boşta → 1). Config word'deki osilatör/MCLR bilgisi gösterilir.
- `server.py`: `/api/build` dosya uzantısına göre: `.c` → SDCC (mevcut), `.asm` → `gpasm` (MPASM uyumlu; `p16F628A.inc` bulunmalı, `__CONFIG` dahil). Dosya listesinde `.asm` dosyaları da görünür; yeni dosya oluştururken dil seçilebilir.
- `shim/mikroc.h` + `convert()`: mikroC PRO kütüphaneleri: `sbit X at Y;` / `sbit X at Y_bit;`, `char keypadPort at PORTB;`, `void interrupt()` → SDCC kesme fonksiyonu, `Delay_us`, `Delay_ms` (Fosc'a göre doğru), `Vdelay_ms`, `Button(&PORTx, pin, time, active)`, `Lcd_Init/Lcd_Out/Lcd_Out_Cp/Lcd_Chr/Lcd_Chr_Cp/Lcd_Cmd` + `_LCD_CLEAR` vb. sabitler (4-bit, mikroC pin ataması `sbit LCD_RS at ...` ile), `Keypad_Init/Keypad_Key_Press/Keypad_Key_Click` (mikroC 4×4 kodlaması 1..16), `UART1_Init(baud)/UART1_Write/UART1_Read/UART1_Data_Ready/UART1_Tx_Idle/UART1_Write_Text/UART1_Read_Text`, `PWM1_Init(freq)/PWM1_Set_Duty/PWM1_Start/PWM1_Stop`, `EEPROM_Read/EEPROM_Write`, `ByteToStr/ShortToStr/IntToStr/WordToStr`, `Bcd2Dec/Dec2Bcd`, `Lo/Hi`, `.B0..B7`, `.F0..F7` erişimleri her SFR için, `TMR0`, `INTCON.T0IF`, `OPTION_REG` vb. bit erişimleri (`INTCON.GIE = 1;` → doğru bite). Kullanılmayan kütüphane kodu HEX'e girmemeli (16F628A 2K word).
- Proje ayarı: Fosc (4/8/20 MHz) proje başına; delay sabitleri buna göre; HEX config word'ü INTOSC/HS'e göre.

---
# Faz 3 — EELAB: yeniden adlandırma, olgunlaştırma, dağıtım (2026-11-11)

Ürün adı **EELAB** olur. Ayrıntılı plan, öncelikli özellik listesi, dağıtım tasarımı, arayüz sözleşmeleri (K1–K7) ve riskler: **`EELAB_PLAN.md`**. Bu belgedeki §1–9 geçerli kalır; çelişki olursa §1–9 sözleşmeleri korunur ve değişiklik WS‑F üzerinden yapılır.

## Dosya sahipliği (Faz 3) — başkasının dosyasına DOKUNMA
| WS | Sahip önerisi | Dosyalar |
|---|---|---|
| A — Paketleme/Platform | Codex | `packaging/**`, `toolchain/**` (yalnız `bin/`, `cpp/`, `VERSION.json`), `VERSION`, `dist/**`, `tests/package_test.sh` |
| B — Sunucu/Derleyici/Veri | Codex | `server.py`, `eelab_paths.py`, `shim/**`, `projeler/**`, `templates/**`, `tests/build_test.py`, `tests/server_test.py` |
| C — Proteus içe aktarıcı | Opus (+REA) | `pdsprj.py`, `tests/pdsprj_test.py`, `tests/fixtures/**`, `docs/pdsprj-format.md` |
| D — IDE + Hata ayıklayıcı | Opus | `index.html`, `css/**`, `js/pic.js`, `js/ide.js`, `js/debug.js`, `tests/core_test.js`, `tests/debug_test.js`, `tests/ide_test.js` |
| E — Devre editörü + Aletler | Codex | `js/library.js`, `js/sim.js`, `js/editor.js`, `js/scope.js`, `circuits/**`, `tests/library_test.js`, `tests/sim_test.js`, `tests/scope_test.js` |
| F — Entegrasyon/QA (sonda) | Opus | `SPEC.md`, `EELAB_PLAN.md`, `KURULUM.md`, `KULLANIM.md`, `tests/run_all.sh`, `tests/e2e/**` |

## Değişmez kurallar (Faz 3)
- Mevcut beş test yeşil kalır; `projeler/Task1.hex` ve `projeler/Task2.hex` dondurulmuştur (değiştirilmez), derleme hattı çıktıları `EELAB_PLAN.md` Ek B md5'leriyle aynı kalır.
- Kullanıcı verisi `~/Documents/EELAB/` altındadır; uygulama klasörüne/paketine yazılmaz; `projeler/` salt‑okunur örnek kaynağıdır.
- Harici kütüphane/CDN/npm yok; çalışma anında ağ yok; arayüz Türkçe; mutlak yol yok.
- Eksik modül = özellik gizli (`window.SCOPE`, `window.DEBUG`, `window.IDE`, `build.debug` yoksa eski davranış).

## Faz 3 — uygulanan sözleşmeler (WS‑F entegrasyon notları, 2026-11-11)
`EELAB_PLAN.md` K1–K7'nin gerçekleşen hâli; plandan farklı olan yerler burada bağlayıcıdır.
- **Ayarlar (K3):** `POST /api/settings {name, fosc?, circuit?, config?, watches?, breakpoints?}` mevcut ayarlarla **birleştirir** (tam yazmaz) ve `{ok, settings}` döndürür. `GET /api/file` → `{name, code, lang, fosc, settings, hasHex}`. `index.html` breakpoint/izleme listesini hem `.eelab.json`'a hem `localStorage eelab.dbg.<dosya>`'ya yazar; açılışta sunucu değeri önceliklidir. Dosya açılınca `settings.circuit` devresi açılır (devrede kaydedilmemiş değişiklik yoksa; simülasyon çalışıyorsa durdurulur).
- **Şablonlar (M9):** `templates/index.json` → `{id, title, lang, fosc, desc, circuit?}`; `circuit` `circuits/<ad>.json` yoksa sunucu alanı düşürür. `POST /api/new {name, template}` dosyanın `settings.circuit`'ini şablonunkine ayarlar. Eşleme: lab1/timer0/pwm/eeprom → `lab1_led_switch`, lab2 → `lab2` (LAB2.pdsprj'den içe aktarıldı), lab3 → `lab3`, rb0_int → `rb0_int_demo`, seven_seg → `mux4_demo`, lcd → `lcd_demo`, keypad_lcd → `keypad_demo`, uart → `uart_demo`. Örnek eşlemesi `eelab_paths.EXAMPLE_CIRCUITS` (Lab2.asm → `lab2`).
- **Aletler (K6):** `SCOPE.create({mount, getRunner, getCyc, getFosc, save})` → `{frame(), reset(), destroy(), autoset(), state()}`. `frame()` paneli kanal yoksa kendisi gizler; `index.html` `render()` içinde (çalışırken ve duraklamışken) çağırır, `setMode('stop')` → `reset()`. `#inst` en fazla %45 yükseklik, kaydırılabilir. Prob: çalışırken tele/pine çift tık → `runner.probe({wire}|{pin})`, kaldırma `runner.unprobe(id)`.
- **Şema dışa aktarma (K6/M8):** `ED.exportSVG(opts) -> string`, `ED.exportPNG({scale, title?}) -> Promise<dataURL>` (içerik sınırına kırpılmış, 2x), `ED.print()`; `index.html` yazdırmada kendi `#printArea` + `@media print` yolunu kullanır.
- **Devre editörü etkileşimi:** boş alanda sürükleme = seçim kutusu; kaydırma = Alt/Boşluk + sürükle ya da orta tuş (çalışırken boş alanda sürükleme de kaydırır); ⌘C/X/V/D/A, ok tuşları, R, W, Delete, ⌘Z/⇧⌘Z.
- **Basma olayları:** `pressBtn(id, v)` aynı parçaya aynı komut çevriminde gelen ikinci olayı bir sonraki simülasyon karesine erteler (çekirdek her kenarı en az bir kez görür; kare hızı düşükken kısa dokunuşlar kaybolmaz).
- **Gösterge kalıcılığı:** `Runner.frame()` LED/segmentleri 20 ms'lik pencerede (`runner.win = Fosc/4·0,02`) birleştirir; geçiş anında bir kare iki durumun birleşimi görünebilir (çoklu tarama için kasıtlı). Testler kararlı değeri pencereden uzun süre aynı kalan örnekle okur (`tests/e2e/e2e_test.js`).
- **Testler:** `tests/run_all.sh [--package] [--no-e2e]` tüm paketleri çalıştırır. `tests/e2e/cross_test.py` (DEVICE_MAP ⊆ LIB.types, kategoriler, şablon/örnek ↔ devre, `server.GOLDEN` = `golden.json` = Ek B, dondurulmuş HEX md5, harici URL/mutlak yol yok), `tests/e2e/e2e_test.js` (geçici `EELAB_HOME` ile gerçek sunucu: 13 şablon derle + eşlendiği devrede çıktı doğrula, ayar kalıcılığı, breakpoint/kronometre, üç `.pdsprj` içe aktar → simüle et, teslim zip'i, dışa aktarma). Elle liste: `tests/e2e/TARAYICI_KONTROL.md`. Sunucu ortamı: `EELAB_HOME`, `EELAB_STATE_DIR`, `EELAB_MIGRATE_FROM`, `EELAB_NO_REVEAL=1` (Finder açmaz).

---
# Faz 4 — Birebir uyum (mikroC PRO for PIC + Proteus 8) (2026-11-12)

Ayrıntılı boşluk denetimi (kaynaklı), altın değerler (§2), arayüz sözleşmeleri K-F1…K-F5 (§3), iş akışı görev tanımları (§4) ve kullanıcı kararları D1–D5 (§5): **`FIDELITY_PLAN.md`**. Bu belgedeki §1–9 ve Faz 2/3 sözleşmeleri geçerli kalır; Faz 4 işi için çelişkide `FIDELITY_PLAN.md` bağlayıcıdır.

## Dosya sahipliği (Faz 4) — başkasının dosyasına DOKUNMA
| WS | Sahip | Dosyalar |
|---|---|---|
| 1 — Çekirdek | Codex | `js/pic.js`, `js/uart.js` (yeni), `tests/core_test.js`, `tests/fidelity_core_test.js` (yeni), `tests/uart_test.js` (yeni) |
| 2 — Proteus paneli | Codex | `js/isis.js`, `js/editor.js`, `js/library.js`, `js/sim.js`, `js/scope.js`, `circuits/**`, `docs/proteus-ui.md`, `tests/library_test.js`, `tests/sim_test.js`, `tests/scope_test.js`, `tests/isis_test.js` (yeni), `tests/fidelity_sim_test.js` (yeni) |
| 3 — mikroC paneli + bağlama | Codex | `index.html`, `js/ide.js`, `js/debug.js`, `js/i18n.js` (yeni), `js/keys.js` (yeni), `tests/ide_test.js`, `tests/debug_test.js`, `tests/i18n_test.js` (yeni), `tests/keys_test.js` (yeni) |
| 4 — Derleme/shim/dosyalar | Codex | `server.py`, `eelab_paths.py`, `shim/**`, `templates/**`, `projeler/*.c`, `projeler/*.asm` (hiçbir `*.hex` değil), `tests/build_test.py`, `tests/server_test.py`, `tests/shim_timing_test.js` (yeni), `tests/fixtures/mikroc/**` (yeni) |
| 5 — Entegrasyon (1–4'ten sonra) | Opus/planlayıcı | `SPEC.md`, `FIDELITY_PLAN.md`, `EELAB_PLAN.md`, `KULLANIM.md`, `KURULUM.md`, `tests/run_all.sh`, `tests/e2e/**`, `packaging/selftest/golden.json` |

## Değişmez kurallar (Faz 4)
- `bash tests/run_all.sh` her commit'te yeşil (`0 başarısız`); yeni `tests/*_test.js|py` dosyaları otomatik çalışır.
- `server.GOLDEN` (11 md5) ve dondurulmuş `projeler/Task1.hex`/`Task2.hex` değişmez. md5 değiştirecek her şey (tam mikroC gecikmeleri, LCD zamanlaması) `libModel:'mikroc'` ayarının arkasında; varsayılan `'eelab'` bugünküyle bayt bayt aynı HEX üretir. Varsayılanı değiştirmek **kullanıcı kararı D2**'dir (A seçilirse 11 md5'ten 9'u değişir; `Lab2.hex` ve `Timer0_Interrupt.hex` değişmez; Task1 kronometresi 100 605 → ~100 0xx).
- Proteus paneli İngilizce; mikroC paneli varsayılan Türkçe + TR/EN anahtarı (D1). Gerçek mikroC tuşları (Ctrl+F9 derle, F9 hata ayıklayıcıyı başlat, Ctrl+F2 durdur, Ctrl+F8 dışarı çık …) eklenir, eski kısayollar (⌘B, ⇧F8, ⌘/) takma ad olarak kalır; Proteus tuşları (F5–F8, F10/F11, Ctrl+F12) yalnız devre paneli odaktayken (`body.dataset.focus`).
- Proteus varsayılanları ders dosyasındaki `ROOT.DSN`'den alınır: Processor Clock 1MHz, WDT 18m, Data EEPROM Write Delay 10m, CFGWORD 0x3F6B, 7SEG TTRIGMIN 1ms, Virtual Terminal 9600-8-N-1.
- Labcenter/MikroElektronika ikon, logo, sürüm/telif satırı kopyalanmaz; işlevsel mesaj metinleri (ör. `Stack overflow executing CALL instruction.`) kullanılabilir.

## Faz 4 — durum ve WS-5 entegrasyon notları (2026-11-12)

**Durum:** WS-1…WS-4 tamam, WS-5 entegrasyonu tamam; `bash tests/run_all.sh` → `0 başarısız`. Kararlar: D1 = A, D2 = B, D3 = A, D4 = A, D5 = A (`FIDELITY_PLAN.md` §5a ve durum tablosu). `server.GOLDEN`, `packaging/selftest/golden.json`, `EELAB_PLAN.md` Ek B ve dondurulmuş `projeler/Task1.hex`/`Task2.hex` değişmedi; Task1 kronometresi (eelab) 100 605 çevrim.

Bağlayıcı uygulama ayrıntıları (planla fark/ek):
- **D2:** `LIB_MODEL_DEFAULT = 'eelab'`; `POST /api/new` her yeni dosyaya `libModel:'mikroc'` yazar (şablonlu ya da boş). Ayarı olmayan dosya = `eelab`. Projeyi Düzenle › *Kütüphane zamanlaması* › "mikroC tam zamanlama" (yalnız C).
- **D3:** çekirdek varsayılanı `eeWriteDelay 0.010`, `eePersist true`. `core_test.js` EEPROM testi 4 ms beklentisini korur, ama artık `mk(..., {props:{eeWriteDelay:0.004}})` ile açıkça ister.
- **D4:** `localStorage eelab.clockLink` yalnız `'1'` ise saatler bağlıdır; varsayılan **ayrı**. PIC parçasında `clock` yoksa (yeni parçalar, tüm `circuits/*.json`, `.pdsprj` içe aktarımı) simülasyon proje saatinde çalışır; parça saati proje saatinden farklıysa `#clkwarn` şeridi. Edit Component'teki Processor Clock Frequency boşken proje saatini gösterir (`EDITOR.create({projectClock})`).
- **i18n:** mikroC paneli metinlerinin tek kaynağı `js/i18n.js`'tir (WS-3'ün `js/ide.js` içindeki 135 anahtarlık yedek sözlüğü taşındı). `IDE.ui.t` tarayıcıda `window.I18N`'i, Node'da `require('./i18n.js')`'i kullanır; `IDE.ui.missing()` boş olmalıdır.
- `warnUnimpl` varsayılanı `false` kalır (K-F1).

WS-5 entegrasyon düzeltmeleri (dosya:satır, 2026-11-12):
1. `tests/core_test.js:125` — EEPROM "~4 ms sonra EEIF" testi `{props:{eeWriteDelay:0.004}}` geçer (D3 ile çakışma).
2. `js/i18n.js:268-403` (tr) ve `js/i18n.js:650-785` (en) — WS-3'ün 135 anahtarı eklendi; `js/ide.js:965-971` yedek `DICT` boşaltıldı, `i18n()` (Node'da `require`) eklendi; `js/ide.js:984-993` `ui.t` bunu kullanır. `tests/ide_test.js:270` beklentisi `missing().length > 50` → `missing() == []` (yedek sözlük kaldırıldığı için tek zorunlu değişiklik).
3. `index.html:428` — `js/uart.js` yüklenmiyordu; tarayıcıda `UART` tanımsız olduğu için Virtual Terminal baud uyuşmazlığı (C12/P16) ve `uartRx(cfg)` çerçeve modeli eski yola düşüyordu. Artık 19200 baud terminal + 9600 baud PIC bozuk karakter verir.
4. `index.html:509` — `clockLink` varsayılanı kapalı (D4); `index.html:643` — `EDITOR.create`'e `projectClock:()=>fosc` (editör `editContext`'i değil `o.projectClock`'u okuyordu; aksi hâlde boş saat alanı `1MHz` gösterip OK ile parçaya yazıyordu).
5. `index.html:291, 297-301` — "Aygıt:" ve hata ayıklama çubuğu düğmeleri (Adım/Üzerinden/Dışarı/İmlece kadar/Komut) `data-i18n` almadığı için EN'de Türkçe kalıyordu.
6. `index.html:496` — durdurunca (`setMode('stop')`, Ctrl+F2, ■) hata ayıklama durum satırı "Çalışıyor · PC …" olarak kalıyordu; artık `dstText()` çağrılır.

Doğrulanan bağlantılar (değişiklik gerekmedi): `ISIS.create({debugCmd, animOptions})` (Debug menüsünün 13 öğesi ve System › Set Animation Options çalışıyor), `onUartTx(b,c,frame)` → `runner.uartTx`, `runner.uartRx(picFrameCfg())` + `core.rxPush(byte,{ferr})`, `core.setMclr(runner.pinLevel(U1,4))`, `runner.warnings()` → Simulation Log, `ED.onEditPart` → `core.setProps({wdtPeriod, eeWriteDelay})`.

Kalan elle kontroller: `tests/e2e/TARAYICI_KONTROL.md` #44, #45, #53, #56–#60 ve gerçek mikroC/Proteus verisi gerektiren açık maddeler (L5/L7 `.lst`, C18 ekran görüntüsü, C5 boşta MCLR).
