# Proteus 8 `.pdsprj` biçimi (EELAB içe aktarıcısının çözdüğü kadarı)

Kaynak: üç ders dosyası (`tests/fixtures/Lab3.pdsprj`, `LAB2.pdsprj`, `Led_Switch.pdsprj`; hepsi `RELEASE=806`, `FILEVER=814`) üzerinde bayt düzeyinde çözümleme. Uygulama: `pdsprj.py`. Tüm tamsayılar **little‑endian**.

## 1. Arşiv

`.pdsprj` sıradan bir zip'tir:

| Dosya | İçerik |
|---|---|
| `PROJECT.XML` | `<TIMESTAMP RELEASE="806" FILEVER="814" MODIFIED=… CREATED=…/>` — `FILEVER` biçim sürümüdür. |
| `ROOT.DSN` | Şema (ikili, sıkıştırılmamış). Parçalar, teller, terminaller, kavşaklar. |
| `ROOT.CDB` | Bileşen veritabanı: her bileşenin ref'i ve **pin listesi (ad, numara)**, değer/aygıt/paket/özellikler. |
| `SCRIPTS/PWRRAILS.DAT` | Güç rayları (`*RAILS` / `*BINDINGS`; ders dosyalarında boş). |

## 2. `ROOT.DSN`

Dosya `ISIS SCHEMATIC FILE` ile başlar; ardından stil tabloları ve kullanılan sembollerin kütüphane tanımları (`|COMPONENT`, `PIN`, `$MKRORIGIN`, `*PINOUT` …) gelir. Şemanın kendisi `ISIS CIRCUIT FILE` başlığından sonraki **`OBJECT DATA\0`** bölümündedir; ondan sonra gelen ikinci `ISIS CIRCUIT FILE` bölümü simülatör modellerini (`*.MDF`) taşır.

**Birim:** 10 nm. 1 th (mil) = 2540; 100 th = 254 000. Y ekseni yukarı doğrudur. Ders dosyalarındaki tüm koordinatlar 50 th ızgarasındadır.

**Nesne başvurusu:** Nesneler sırayla serileştirilir; nesneler birbirine **dosya ofsetiyle** (`uint32`, nesnenin ilk baytı) başvurur. Bu ofsetler bağlantının asıl kaynağıdır.

### 2.1 Metin nesnesi (bileşen ID/VALUE, terminal etiketi …)
```
ff  u8 n  char[n] text      görünen metin (boş olabilir: ff 00)
i32 x, i32 y                metin konumu
24 bayt                     yazı biçimi (yükseklik 0x05d048 = 150 th, genişlik, hizalama …)
ff  u8 görünür(0/1)
"Default Font\0"            yazı tipi adı (NUL sonlu)
"COMPONENT ID\0"            metin türü (NUL sonlu)
u32 0
```
İçe aktarıcı metni türün (ör. `COMPONENT ID\0`) konumundan geriye doğru arayarak bulur.

### 2.2 Bileşen
Bir bileşen ardışık dört metin nesnesiyle başlar: `COMPONENT ID` (ref; Lab3'teki göstergelerde boş), `COMPONENT VALUE` (değer: `10k`, `220`, `PIC16F628A`), `SUBCKT NAME`, `PROPERTIES` (görünen özellik metni). Ardından:
```
u32 L, char[L] props        tam özellik dizgesi "{CLOCK=8MHz}\n{CFGWORD=0x3F6B}…";
                            görünen PROPERTIES metniyle aynıysa YAZILMAZ (yalnız L vardır)
u16 npins
u8 n, char[n] device        aygıt adı: PIC16F628A, 7448, 7SEG-MPX1-CC, RES, RESISTOR, BUTTON, SWITCH, LED-BIRG …
i32 x, i32 y                bileşen orijini (sembol merkezi olmak zorunda değil)
i16 açı                     derecenin onda biri, saat yönünün TERSİ pozitif (0, 1800, -900 → 0°, 180°, 90° saat yönü)
u16 bayraklar               ders dosyalarında hep 0 (ayna bayrağı olduğu düşünülüyor — doğrulanmadı)
u32 nesne kimliği           ROOT.CDB'deki kimlikle aynı (bileşen ↔ CDB eşlemesi)
u32 ?, u32 ?                ikincisi etkileşimli parçalarda 0x10 (7SEG, BUTTON, SWITCH)
u8 0
u32 pin[npins]              pin başına bağlı NESNENİN ofseti (0 = bağlantısız)
```
**Pin sırası = `ROOT.CDB`'deki pin listesi sırası** (Lab3'te doğrulandı: PIC'in 9–12. girdileri RA0–RA3 → 7448'in A,B,C,D girdileri; 7448 pinleri `A,QA,B,QB,C,QC,D,QD,BI/RBO,QE,RBI,QF,LT,QG,VCC,GND` sırasında).

### 2.3 Tel
```
+0x00 u8 bayrak (00)
+0x01 23 bayt stil özellikleri (renk, kalınlık …)
+0x18 "\x7fWIRE\0"          stil adı (veri yolu için "\x7fBUS WIRE\0")
      u16 0, u16 n
      n × (i32 x, i32 y)    dik açılı çoklu çizgi
```
Bir pinin işaretçisi telin `+0x00` ofsetini gösterir. Üç dosyadaki 48 + 19 + 8 tel bu düzende çözüldü.

### 2.4 Terminal
```
u8 0x10, i32 x, i32 y, i32 açı
u8 n, "$TERPOWER" | "$TERGROUND" | "$TERDEFAULT" | "$TERINPUT" | "$TEROUTPUT" | "$TERBIDIR" | "$TERBUS"
0d 00 00 00 00 00
metin nesnesi (etiket, ör. "VCC"; boşsa varsayılan ray) … "TERMINAL LABEL\0" u32 0
u32 tel işaretçisi
```

### 2.5 Kavşak (junction / nokta)
```
u8 0x01, i32 x, i32 y, u32 tel[4]   (0 = boş yuva)
```
Üç ya da daha çok telin buluştuğu noktada yazılır ve buluşan telleri doğrudan listeler (Lab3'te 4, Led_Switch'te 1 adet).

### 2.6 Diğer
- `WIRE LABEL` (tel etiketi) ve `$TERBUS`/`BUS WIRE` ders dosyalarında yalnız stil/kütüphane tanımı olarak geçiyor; şemada örneği yok. İçe aktarıcı tel etiketini terminal düzeniyle aynı varsayar (metin + `u32 0` + `u32 tel işaretçisi`; işaretçi tanınmazsa etiket konumundaki tel). **Doğrulanmadı.**

## 3. `ROOT.CDB`

Uzunluk önekli dizgiler (`u8 n` + `n` bayt). Bileşen başına bir kayıt:
```
u32 ?, u32 ?, u32 0, u32 nesne kimliği
u8 n, ref                   ("U1", "START/STOP"; ref'siz parçada boş)
u32 npins
npins × (u8 n, pin adı; u8 m, pin numarası)    ("RA7/OSC1/CLKIN","16"), ("A",""), ("1","") …
u32 k, k bayt               ek veri (PIC'te 128 bayt EEPROM içeriği = 0xFF)
```
Ardından ikinci bir tablo: `ref, değer, aygıt, paket` (u8 önekli) + `u32 L` + özellik dizgesi (`{PROGRAM=test\test.hex}`, `{CLOCK=8MHz}`, `{CFGWORD=0x3F6B}` …). İçe aktarıcı, DSN'deki nesne kimliğini (`u32 0, u32 kimlik`) CDB'de arar ve pin sayısı tutan kaydı kullanır.

## 4. Bağlantı (ağ) çıkarımı

Birleşim‑bul (union‑find) düğümleri: pinler ve nesne ofsetleri.
1. Her bileşen pini → işaretçinin gösterdiği tel/terminal nesnesi.
2. Her terminal → kendi tel işaretçisi. `POWER`/`GROUND` (ya da etiketi VCC/VDD/+5V, GND/VSS olan terminal) bir EELAB parçası olur (`PWRn`, `GNDn`). Etiketli diğer terminaller **aynı etiketle** birleşir, parça üretmez.
3. Kavşak nesneleri listeledikleri telleri birleştirir.
4. Geometri (yedek): bir telin ucu başka bir telin ucuyla çakışıyor ya da onun bir parçası üzerindeyse teller birleşir. Üç dosyada (1–3) tek başına (4) ile **aynı** sonucu veriyor; iki bağımsız yol birbirini doğruluyor.
5. Gizli besleme pinleri atlanır (PIC 5/14, 7448/7447 8/16).

Sonuç SPEC §1 `nets` biçimindedir (`"PARÇA.pin"`); teller taşınmaz (EELAB sembolleri farklı), editör `SIM.route` ile yeniden çizer.

## 5. Parça eşleme (`pdsprj.DEVICE_MAP`)

Aygıt adı → `(EELAB tipi, pin eşlemesi)`. Pin eşlemesi `'num'` (CDB pin numarası: PIC, 7448/7447, LM016L/LM044L, DIPSW_8, 74HC595, L293D) ya da ad → EELAB `num` sözlüğüdür (7SEG: `A..G`, `H`/`DP` → `DP`, ortak `1` → `K`/`COM`; RES/BUTTON/SWITCH: `1`,`2`; SWITCH `COM`/`NO` → `1`/`2`; LED `A`/`K` …). `RES*`/`MINRES*`/`CAP*` önekli 2 pinli aygıtlar da tanınır. `LED-BIRG`/`LED-BIBY`/`LED-BIGY` (iki renkli) ters paralel iki LED'e açılır (A1→A2 yönü ilk renk; **doğrulanmadı**). Eşlenemeyenler `unsupported` listesine ve uyarılara yazılır.

Kimlikler: Proteus ref'i `[A-Za-z0-9_]+` ve tekse aynen; değilse önek+numara. BUTTON/SWITCH/LOGICSTATE'te rakamsız ref (ör. `START/STOP`, `RESET`) etiket sayılır: kimlik `SWn`, ad `value`'ya yazılır (klavye kısayolu = ilk harf).

## 6. Yerleşim

Parça merkezi = orijin ile bağlı tellerin pine yakın uçlarının sınır kutusu merkezi. 100 th → 10 SVG birimi, y çevrilir. EELAB sembolleri Proteus'unkinden büyük olduğundan ölçek 1 → 2 arasında çakışma kalmayana dek artırılır; kalan çakışmalar küçük itmelerle giderilir (`SIM.overlaps` ile aynı ölçüt: anahat + 10 boşluk). Ölçek `meta.scale`'dedir. Dönüş: `rot = (-açı/10) mod 360`, 90'a yuvarlanır.

## 7. Çıktı (EELAB_PLAN K4)

```
{ version:1, parts:[{id,type,x,y,rot,value}], nets:[[…]], wires:[],
  meta:{clock, program, cfgword, release, filever, scale}, unsupported:[{ref,device,reason}], warnings:[…] }
```
Bozuk/kesik girdi → `ValueError` (sunucu `{error}` döndürür). Bilinmeyen `FILEVER` → uyarı; işaretçiler çözülemezse yalnız parça listesi. Bağlantı hiç çözülemez ve parça envanteri Lab3'e uyarsa son çare olarak `circuits/lab3.json` şablonu yüklenir (uyarıyla).

## 8. Doğrulama (`tests/pdsprj_test.py`)

| Dosya | Sonuç |
|---|---|
| Lab3 | 16 parça, 40 ağ. `circuits/lab3.json` (altın: `tests/fixtures/lab3_nets.json` = `SIM.pinNets`) ile **eşdeğer**: Proteus dosyasında 220 Ω seri dirençler yok (7448 çıkışları göstergelere doğrudan bağlı), bu yüzden karşılaştırmada altın dosyadaki 21 seri direnç kısa devre sayılır, POWER/GROUND tek ağda toplanır ve aynı tipteki parça kimlikleri eşlenir (DS1↔DS3, R1/R2↔R10/R11). Tek bir pinin değişmesi eşleşmeyi bozar (negatif denetim yapıldı). |
| LAB2 | 11 parça, 19 ağ (RB0..RB3 → 7448 A..D, 7×220 Ω → gösterge, K → GND). Altın: `lab2_nets.json`. |
| Led_Switch | 9 parça (iki renkli LED → D1+D2), 6 ağ (RA7 ← SWITCH + 10k çekme direnci, RA0 → LED → 330 Ω → GND). Altın: `led_switch_nets.json`. |

Ayrıca: tüm tipler `LIB.types`'ta, tüm pin adresleri geçerli, `SIM.route` her ağı eksiksiz çiziyor, `SIM.overlaps` yanlış; 150 rastgele bozulmuş/kesik DSN'de yalnız `ValueError` ya da geçerli sözlük.

## 9. Bilinen sınırlar
- Ayna (mirror) bayrağı, tel etiketi ve veri yolu kayıtları örneksiz; veri yolları alınmaz (uyarı).
- Telsiz doğrudan pin–pin / terminal–pin teması: pin işaretçisi terminali gösterirse desteklenir; bileşeni gösterirse atlanır.
- Çok sayfalı (hiyerarşik) şemalar denenmedi; tüm `OBJECT DATA` sonrası taranır, etiketler sayfalar arası birleşir.
- Yalnız `FILEVER=814` doğrulandı.
