# EELAB — Phase 4 fidelity plan ("one-to-one with mikroC PRO for PIC + Proteus 8")

Date: 2026-11-12 · Tree: `EE321_Lab3_Studio/` · Status: **IMPLEMENTED** (WS-1…WS-5 done 2026-11-12; see the status table below and `SPEC.md` Faz 4).

### Status (WS-5, 2026-11-12)

| Item | State | Notes |
|---|---|---|
| WS-1 Core (`pic.js`, `uart.js`) | Done | All G-* in §2.1/§2.2 asserted (`fidelity_core_test.js`, `uart_test.js`). `warnUnimpl` stays `false` (contract default). |
| WS-2 Proteus pane | Done | Zoom keys API, mouse rules, Debug/View/System menus, PIC + Virtual Terminal Edit Component, LCD busy, 7-seg TTRIGMIN (`isis_test.js`, `fidelity_sim_test.js`). |
| WS-3 mikroC pane + glue | Done | Real keys + aliases, menus, TR/EN, Messages table, Watch/Stopwatch, `.lst/.asm/.log`, hooks wired. |
| WS-4 Build/shim/files | Done | `libModel`, exact delays/LCD, K-F5 messages, `.mcppi`, `/api/output`, conversions. All 11 GOLDEN md5s unchanged. |
| WS-5 Integration | Done | Fixes listed in `SPEC.md` Faz 4 › *WS-5 entegrasyon notları*. |
| D1 TR default + EN toggle | Applied | Araçlar › Seçenekler (F12). |
| D2 = B | Applied | `LIB_MODEL_DEFAULT='eelab'`; `/api/new` + templates → `mikroc`. GOLDEN, `golden.json`, Ek B unchanged; Task1 stopwatch 100 605 (eelab). |
| D3 = A | Applied | EEPROM 10 ms + persistence; `core_test` EEPROM test pins `eeWriteDelay:0.004` explicitly. |
| D4 = A | Applied | `clockLink` default **off** (separate clocks + banner); PIC part without `clock` (new parts, all shipped circuits) = project clock. |
| D5 = A | Applied | KULLANIM §3/§5 key tables + macOS ^F2/^F8 note. |
| Open data (L5/L7, C18 screenshot, C5) | Open | Needs a lab PC with real mikroC/Proteus (§5 tail). |

Earlier contracts still hold: `SPEC.md` §1–9, the "Faz 3" sections and `EELAB_PLAN.md` K1–K7. This document adds to them. Where it conflicts with them, this document wins for Phase 4 work only.

Implementers are **Codex agents running in parallel**. Each workstream brief in §4 is self-contained.
- Read §0, §3 (contracts) and your own §4.x.
- Do not edit files you do not own.
- Do not stop until every "Done" checkbox in your brief is true and `bash tests/run_all.sh` prints `0 başarısız`.

---

## 0. Ground rules

1. **No-regression baseline.**
   - `bash tests/run_all.sh` is green today and must stay green after every commit.
   - It runs every `tests/*_test.js` and `tests/*_test.py` automatically, so new test files are picked up without editing the runner.
2. **HEX baselines.**
   - `server.GOLDEN` (server.py:71-83) holds the 11 md5s of Ek B.
   - The frozen files `projeler/Task1.hex` and `projeler/Task2.hex` are never rewritten.
   - Anything that would change a GOLDEN md5 must sit behind a setting whose **default keeps today's output**. Flipping the default is a USER DECISION (§5) and is done only by WS-5.
3. No npm, no CDN, no network at runtime. Pure JS and Python 3.9 stdlib.
4. Language: the Proteus pane stays English. The mikroC pane stays Turkish by default and gains a TR/EN toggle (D1).
5. Do not copy Labcenter or MikroElektronika icons, logos, splash screens, copyright lines, version banners or product names into the UI. Functional message wording (e.g. "Stack overflow executing CALL instruction.") is fine. Product strings such as "PROSPICE 8.02 (C) Labcenter" or "mikroC PRO for PIC v7.6" are not.
6. Keep the existing code style: no unnecessary comments, compact JS, Turkish UI strings in the mikroC pane.
7. Mac reality.
   - EELAB runs in a browser on macOS. Wherever Windows uses `Ctrl`, accept both `Ctrl` and `⌘`.
   - Function keys may need `fn` on laptops.
   - macOS reserves some Ctrl+F-keys (^F2 "move focus to menu bar", ^F3 Dock, ^F8 status menus) when keyboard navigation shortcuts are enabled. Every such binding therefore keeps a non-F-key alias.

### Evidence sources

**[DSN]** — the course's own Proteus file `~/Downloads/Lab3_Files-20261111/Lab3.pdsprj` (same as `tests/fixtures/Lab3.pdsprj`). `ROOT.DSN` embeds Labcenter's library definitions for the installed release (RELEASE 806). These are first-hand defaults and win over web sources.
- PIC16F628A: `{CLOCK=1MHz} {WDT_PERIOD=18m} {EPR_WRITEDATA_DELAY=10m} {PORTTDLH=0} {PORTTDHL=0} {DBG_STARTUP_DELAY=0} {DBG_WAKEUP_DELAY=0} {DBG_RANDOM_PMEM=0} {DBG_RANDOM_DMEM=0} {DBG_GENERATE_CLKOUT=0} {MODDATA=128,255} {CFGWORD=0x3F6B}`.
- PIC16F628A property definitions: Program File (`*.HEX;*.d39;*.bas;*.cof`), Processor Clock Frequency, Program Configuration Word, Randomize Program Memory?, Randomize Data Memory?, Model PIC Start-up Delays?, Model PIC Wake-up Delays?, Generate Q clock on CLKOUT Pin?, Watchdog Timer Period, Data EEPROM Write Delay, Port Pin Low-High Delay, Port Pin High-Low Delay, Initial contents of EEPROM (`*.BIN`).
- PIC16F628A pin names: `RA0/AN0`, `RA1/AN1`, `RA2/AN2/VREF`, `RA3/AN3/CMP1`, `RA4/T0CKI/CMP2`, `RA5/$MCLR$`, `RA6/OSC2/CLKOUT`, `RA7/OSC1/CLKIN`, `RB0/INT`, `RB1/RX/DT`, `RB2/TX/CK`, `RB3/CCP1`, `RB4`, `RB5`, `RB6/T1OSO/T1CKI`, `RB7/T1OSI`.
- Virtual Terminal:
  - `BAUDRATE` KWDEDIT list `110,300,1200,2400,4800,9600,19200,38400,57600`, default 9600.
  - `DATABITS` 7|8, default 8. `PARITY` NONE|EVEN|ODD, default NONE. `STOPBITS` 1|2, default 1. `XONXOFF` default 0.
  - Advanced: `SIGPOL` "RX/TX Polarity" Normal|Inverted, `CTLPOL` "RTS/CTS Polarity" Normal|Inverted.
- 7SEG-MPX1-CC: `TTRIGMIN` "Minimum Trigger Time" = **1ms**. BUTTON: `R(0)=100M`, `R(1)=100m`, `TSWITCH=1m`. Oscilloscope: `TRIGAUTO=TRUE`, `TRIGEDGE=0`, `TRIGLEVEL=0`.

**[PH]** Proteus 8 help mirror, http://systembus.com/proteus/:
- ISIS/GENERAL_CONCEPTS/{General_Editing_Facilities,Screen_Layout,Co-ordinate_Display,Wiring_Up}.htm
- LISA/INTERACTIVE_SIMULATION/{Basic_Skills,Animation_Timestep_Control,Taking_measurements}.htm
- LISA/MICROPROCESSORS/{Diagnostics,Popup_Windows,WatchWindow,Source_Level_Debugging}.htm
- PIC16/{Properties,Warning_Messages,Run_Time_Disassembler}.htm
- Instruments/{Virtual_Terminal,Oscilloscope}/*.htm
- DISPLAYS/HD44780/HD44780.htm

**[GSG]** Labcenter Getting Started Guide: https://tams.informatik.uni-hamburg.de/lectures/2022ss/vorlesung/es/doc/ProteusTutorials.pdf (page numbers as printed).

**[LOG]** Proteus simulation log lines quoted in a forum post: https://www.ccsinfo.com/forum/viewtopic.php?p=219034

**[MCM]** mikroC PRO for PIC manual v101: https://download.mikroe.com/documents/compilers/mikroc/pic/mikroc-pic-manual-v101.pdf

**[MCH]** mikroC help: https://download.mikroe.com/documents/compilers/mikroc/pic/help/ — pages keyboard_shortcuts, messages_window, built-in_routines, lcd_library, uart_library, pwm_library, keypad_library, button_library, conversions_library, eeprom_library.

**[MCR]** Real mikroC output for a P16F628A project (.mcppi, .lst, .asm, .log):
- https://github.com/mudaradev/-Interfacing-a-16-2-LCD-with-a-PIC-Microcontroller
- https://github.com/mudaradev/Microcontroller-Implemented-LED-Chaser
- https://github.com/mudaradev/-Interrupt-Handling-with-a-PIC-Microcontroller
- A Turkish-locale log: https://github.com/timurinan/Mikrodenetleyiciler-2025-2026/blob/main/Uygulama7.log

**[DS]** Microchip DS40044G, PIC16F627A/628A/648A datasheet: https://ww1.microchip.com/downloads/en/DeviceDoc/40044G.pdf (page = PDF page). Items marked "DS33023" are from the mid-range reference manual and still need to be checked against it.

Anything marked **UNVERIFIED** must not be hard-coded as a golden value. Implement it behind a named constant and note it in the test as `// UNVERIFIED`.

---

## 1. Gap audit

Severity is how much it hurts an EE321 student:
- **H**: wrong result, or a habit that will fail in the real lab.
- **M**: visible difference, confusing.
- **L**: cosmetic.

Effort: **S** < ½ day · **M** 1–2 days · **L** > 2 days. **WS** is the owning workstream (§4).

### 1a. UI — Proteus pane (English)

| # | Real Proteus 8 | EELAB now | Sev | Eff | WS |
|---|---|---|---|---|---|
| P1 | **Zoom keys.** F6 zoom in, F7 zoom out, F8 zoom to whole sheet, F5 re-centre on the cursor. Keyboard zoom re-centres on the cursor. [PH Screen_Layout], [GSG p.7-8] | No F5–F8 at all. Zoom only via wheel (editor.js:475-480), buttons, or View menu items without shortcuts (isis.js:140). | M | S | 2 |
| P2 | **Wheel** zooms about the pointer. [PH] | Same (editor.js:479 `zoomAt(pt(e))`). Trackpad two-finger scroll pans. Keep it. | — | — | — |
| P3 | **Pan.** A middle-button click toggles track-pan (the sheet follows the mouse until the next click). Shift + bumping the edge pans. Clicking the Overview re-centres. [GSG p.8] | Middle-*drag* pans (editor.js:335). No click-toggle track-pan. Overview click works (isis.js:115-124). | L | S | 2 |
| P4 | **Shift + left-drag = zoom to area.** [PH Screen_Layout] | Shift + drag adds a band to the selection (editor.js:383-385). | M | S | 2 |
| P5 | **Placement.** Pick a device in the Object Selector, then click in the editing window (ghost follows), click again to place. Placement repeats; **right-click exits**. Numeric keypad `+`/`-` rotate while placing or dragging. [GSG p.20-23] | Placement works (editor.js:362-366). Rotation is `R` (editor.js:797). Right-click in place mode returns to select (editor.js:467): OK. No keypad `+`/`-`. | L | S | 2 |
| P6 | **Wiring.** No wire tool; click a pin end (green pencil cursor), click anchors, click the target. **Right-click or Backspace removes the last anchor.** Ctrl held disables the auto-router (diagonal wire). Double-clicking the next pin repeats the previous route. [PH Wiring_Up], [GSG p.42-45] | Pin-to-pin wiring in any mode works (editor.js:368-369). There is also a W wire tool (non-Proteus; keep it as an extra). Backspace removes an anchor (editor.js:801). **Right-click cancels the whole wire** (editor.js:465). No Ctrl-diagonal. No wire repeat. | M | M | 2 |
| P7 | **Edit.** Double-click = Edit Properties. **Ctrl+E** edits the object under the mouse. **E** = "Find and Edit Component" (by reference). [PH General_Editing_Facilities] | Double-click works (editor.js:446-460). No Ctrl+E or E. | L | S | 2 |
| P8 | **Right-click on an object** tags it and opens the context menu. Block copy, move, rotate and delete come from right-click inside a tag box. Delete key deletes. [PH] | Matches (editor.js:463-473). Block copy is ⌘D or ⌘C/⌘V rather than "Block Copy, click to place copies". | L | M | 2 |
| P9 | **Rotate/mirror icons.** Left-click rotates anticlockwise, right-click clockwise. Mirror icon: left = X, right = Y. Icons turn red when an object is tagged. [PH] | Separate rotate CW and CCW buttons; red-when-tagged is implemented (isis.js `onSelect`). No left/right-click semantics. | L | S | 2 |
| P10 | **Grid and snap.** `G` cycles line → dot → off. Snap defaults to 100th; snap keys are F4/F3/F2/Ctrl+F1 (order in [PH]; the finest-to-coarsest mapping is UNVERIFIED). `O` sets the false origin (the readout turns magenta). | `G` works (editor.js:799). The EELAB data model requires a 10-unit (= 100th) grid (SPEC §1). | L | — | won't do (keeps the §1 schema) |
| P11 | **Menus.** File Edit View Tool Design Graph Debug Library Template System Help. Debug: Start VSM Debugging **Ctrl+F12**, Pause (**Pause key**), Stop (**Shift+Break**), Step Over **F10**, Step Into **F11**, Step Out, Step To. F9 toggles a breakpoint in the Source window. Watch Window, per-CPU popups (PIC CPU …), Configure Diagnostics, Reset Persistent Model Data. System: Set Animation Options. [PH Source_Level_Debugging, Basic_Skills], [GSG p.200] | Menus exist (isis.js:128-151), but View has no F-key labels, Debug has no keys, and most items are inert (`null`). "Reset Persistent Model Data" is inert, which is correct today only because EEPROM is not persistent (C7). | M | M | 2 (+3 glue) |
| P12 | **System › Set Animation Options:** Frames per Second 20, Timestep per Frame 50 ms (= 1/fps), Single Step Time, Show Logic State of Pins (toggle), Show Wire Voltage by Colour (off), Show Wire Current with Arrows (off). [PH Animation_Timestep_Control] | Speed is a select (index.html:319). STEP = 50 ms (title at index.html:318). No dialog and no pin-state toggle. | M | M | 2 (+3) |
| P13 | **Debug popups** show only while paused: PIC CPU Registers (top line = disassembly of the instruction at PC, e.g. `MOVWF INDF:0x0070`), Data Memory, Program Memory, EPROM Memory, Source Code, Variables. The Watch Window updates live (Add Item by Name / by Address, Ctrl+R/F2 rename, format bin/oct/dec/hex, watchpoint conditions). [PH Popup_Windows, WatchWindow, Run_Time_Disassembler]. Exact titles and columns are UNVERIFIED. | A one-line `PIC CPU Registers - U1` bar (index.html:315, 444-445). Full debugging lives in the mikroC pane (debug.js). | M | M | 2 (+3) |
| P14 | **Simulation messages / Advisor.** A status-bar indicator shows the most severe type and a count; a click opens a list. Message wording from [LOG] and [PH PIC16/Warning_Messages]: `[PIC16] PC=0x0354. Processor has been reset by watchdog timer expiring at time 2.304000. [U3]`, `[PIC16 MEMORY] PC=0x0311. Attempt to write unimplemented memory location 0x008F with 0x71 ignored. [U3]`, `Stack overflow executing CALL instruction.`, `Stack underflow executing RETURN instruction.`, `Attempt to execute illegal opcode (<op>) - NOP executed.`, `Attempt to set EECON1<WR> without 0x55/0xAA sequence to EECON2 has been ignored.`, `Cannot set EECON1<WR> without first setting EECON1<WREN> in a previous instruction.` | The indicator exists (index.html:320, 520). **The core emits no PIC warnings at all**, and an illegal opcode throws (pic.js:407). | H | M | 1 (+3) |
| P15 | **Status bar while animating:** simulation time + CPU load ("ANIMATING" label per forum; exact format UNVERIFIED). | `ANIMATING: hh:mm:ss.ssssss (CPU load N%)` (index.html:436-441). Keep it. | — | — | — |
| P16 | **Virtual Terminal Edit Component dialog:** Baud Rate (editable list 110…57600), Data Bits 7/8, Parity NONE/EVEN/ODD, Stop Bits 1/2, Send XON/XOFF; Advanced RX/TX Polarity, RTS/CTS Polarity [DSN]. Right-click on the terminal window: Pause, Copy, Paste, Echo Typed Characters [PH] (Clear Screen, Hex Display Mode, Font, Set Colours UNVERIFIED). Only CR, BS and BEL are handled; LF and other codes are ignored. Typed characters are not echoed by default. The terminal window pops up when the simulation starts. | Fixed "9600 baud, 8N1" (library.js:114). No properties, no right-click menu. **The byte is handed over directly, so a baud mismatch is invisible** (sim.js:707-728, index.html:380). | H | M | 2 (+1 uart.js) |
| P17 | **Oscilloscope:** 4 channels, 20 V/div … 2 mV/div, 200 ms/div … 0.5 µs/div, AC/DC/GND/OFF, Invert, A+B/C+D, trigger Auto vs One-Shot, Level, Edge, Cursors (click, drag, context Delete Cursor / Clear All Cursors). [PH Oscilloscope] | Digital scope panel with cursors (scope.js). Ranges and Auto/One-Shot not matched. | L | M | 2 |
| P18 | **PIC Edit Component:** Program File, Processor Clock Frequency (free float with units, default **1MHz** [DSN]), Program Configuration Word (overridden by the HEX), plus Advanced Properties listed in [DSN] with their defaults. | Program File, Clock (4/8/20 MHz select linked to project Fosc), Config Word. No Advanced Properties. | M | M | 2 (+1 props, +3 glue) |
| P19 | **Animation panel:** PAUSE while stopped starts the simulation paused at t=0. STEP advances one single-step interval; holding STEP keeps running. STOP unloads and keeps actuator positions. [GSG p.199] | Play/Step/Pause/Stop exist. "Pause from stopped" and "hold Step" are not verified. | L | S | 3 |

### 1b. UI — mikroC pane (Turkish default)

| # | Real mikroC PRO for PIC | EELAB now | Sev | Eff | WS |
|---|---|---|---|---|---|
| M1 | **Keyboard** [MCM "Keyboard shortcuts"], [MCH keyboard_shortcuts]. **Build Ctrl+F9**, Build All Shift+F9, Build+Program Ctrl+F11. **Start Debugger F9**, **Stop Debugger Ctrl+F2**, Run/Pause F6, Step Into F7, Step Over F8, **Step Out Ctrl+F8**, Run To Cursor F4, Toggle Breakpoint F5, Jump To Interrupt F2. View Breakpoints Shift+F4, Clear Breakpoints Ctrl+Shift+F5, Watch Window Shift+F5, Add to Watch Ctrl+F5, Disassembly Alt+D. Editor: Ctrl+Space code assistant, Ctrl+Shift+Space parameter assistant, Ctrl+J code template, Ctrl+G go to line, Ctrl+L routine list, Ctrl+D find declaration, Ctrl+F find, F3 / Shift+F3 next / previous, Ctrl+R replace, Ctrl+Y delete line, Ctrl+Shift+Z redo, Ctrl+Shift+. comment, Ctrl+Shift+, uncomment, Ctrl+Shift+I / U indent / unindent, Ctrl+Shift+0-9 set bookmark, Ctrl+0-9 go to bookmark, Ctrl+Shift+E edit project, Ctrl+Q quick converter, Ctrl+T USART terminal, F12 options. | Build is **⌘B** (index.html:968). F4/F5/F6/F7/F8 match (index.html:971-973). **Step Out = ⇧F8** (should be Ctrl+F8). **No F9 start or Ctrl+F2 stop** (debugging starts implicitly). ⌘/ comment (ide.js). Ctrl+G and Ctrl+J exist (ide.js:777-779). Ctrl+Space exists (ide.js:773). | H | M | 3 |
| M2 | **Menus:** File Edit View Project Run Tools Help; Build items live under Project [MCM]. (Real labels are English-only, see D1.) | Three menus: Dosya / Devre / Proje (index.html:256, 920-927). | M | M | 3 |
| M3 | **Messages window.** Columns: Line · Message No. · Message Text · Unit (type icon: error, warning, hint). Double-click jumps to the line. Filter checkboxes Errors / Warnings / Hints. [MCH messages_window]. Exact successful-build text [MCR log]: see §2.3 G-MSG. | Free-text lines in Turkish (index.html:676-693). SDCC raw messages pass through diagnostics() (server.py:539-558). | H | M | 3 + 4 |
| M4 | **Project Settings panel:** Device (P16F628A), MCU clock in MHz (e.g. `4.000000`), Build/Debugger Type Release / ICD Debug. **Library Manager:** checkbox tree of libraries, buttons Refresh / Rebuild / Check All / Clear All / Restore; only checked libraries link. [MCM] | Fosc select + "Projeyi Düzenle" config dialog (index.html:266, 342-352). Libraries are auto-detected (server.py:250 `lib_uses`). No Library Manager. | M | M | 3 + 4 |
| M5 | **Watch Values window:** "Select variable from list" dropdown + Add, "Search the variable by assembly name", Remove / Add All / Remove All. Columns Name · Value · Address. Changed values red. Double-click → Edit Value. Formats Dec/Hex/Bin/Float/Char, "Signed" checkbox. [MCM] | İzleme tab with Adres / Değer / Biçim / Bayt columns (debug.js:183-240). Free-text add. | M | S | 3 |
| M6 | **Stopwatch window:** Cycles, Time, Delta (between the last two stops), editable clock that recomputes only the display. [MCM] | Kronometre (debug.js:84-85) shows cycles and time between stops. No editable clock. | L | S | 3 |
| M7 | **Code Explorer / Routine List (Ctrl+L) / Project Manager tree** (Sources, Headers, Binaries, Output Files). [MCM] | Proje Yöneticisi dialog (index.html:355). No routine list. | L | M | 3 |
| M8 | **Statistics:** RAM/ROM pies, functions sorted by size/address, memory summary. [MCM] | İstatistik tab (debug.js:88) with ROM/RAM and function words. | L | S | 3 |
| M9 | **Title bar / UI language.** English-only IDE. Message dates follow the Windows locale, e.g. `Finished (with errors): 15 Eki 2025, 12:23:41` [MCR Uygulama7.log]. | Turkish UI. Product name removed in Faz 3 (M1). Keep EELAB naming. | M | M | 3 (D1) |

### 1c. Calculations and simulation fidelity

| # | Real (source) | EELAB now | Sev | Eff | WS |
|---|---|---|---|---|---|
| C1 | **Instruction timing.** GOTO, CALL, RETURN, RETLW and RETFIE take 2 Tcy. DECFSZ, INCFSZ, BTFSC and BTFSS take 2 Tcy when they skip. Any write to PCL (MOVWF/ADDWF/BSF … PCL) takes 2 Tcy. CLRW sets Z. RLF/RRF affect only C. SUBWF/SUBLW C = NOT borrow. [DS p.117-130] | Correct (pic.js:357-406; PCL +1 cycle at pic.js:296). **No exhaustive test exists.** | H | S | 1 (tests only) |
| C2 | **Illegal opcode:** Proteus executes a NOP and logs `Attempt to execute illegal opcode (0x3B00) - NOP executed.` [PH Warning_Messages] | Throws `Bilinmeyen komut` and the simulation dies (pic.js:407). | M | S | 1 |
| C3 | **Stack:** 8 levels, circular, no flag [DS p.30]. Proteus logs `Stack overflow executing CALL instruction.` / `Stack underflow executing RETURN instruction.` | Circular (pic.js:350-351). No warning. | H | S | 1 |
| C4 | **Reset values per cause** [DS Table 14-6 p.105, 14-7 p.106]. WDT and MCLR reset leave many registers **unchanged (u)**: W, TMR0, FSR, PORTB, TMR1L/H, T1CON, CCPR1L/H, EEDATA, EEADR, PORTA bits 7:5. PCON = `---- 1-uu` (POR bit kept). WDT reset STATUS = `0000 uuuu` (TO=0, **PD unchanged**). MCLR-in-Sleep STATUS = `0001 0uuu`. EECON1 = `---- q000` (WRERR=1 if a write was cut off). | `sfrReset` zeroes all SFRs, clears latches, forces PD=1 and PCON=0x08 (pic.js:144-153, 226-231). | M | M | 1 |
| C5 | **MCLR pin:** with MCLRE=1, RA5 low holds the device in reset and the rising edge restarts at 0x000 with MCLR values (min pulse 2 µs [DS]). With MCLRE=0, RA5 is a digital input. **What Proteus does with a floating MCLR is UNVERIFIED**; treat floating as high. | No MCLR pin reset. RA5 is always read as an input (pic.js:83). | H | S | 1 (+2 net, +3 glue) |
| C6 | **No config word in HEX:** Proteus uses the part property CFGWORD, whose library default is **0x3F6B** [DSN] (WDTE=0, MCLRE=1, PWRTE=1, BOREN=1, LVP=0). | `P.cfg = null` → WDT off, MCLR ignored (pic.js:140, 161). | L | S | 1 |
| C7 | **Data EEPROM.** Proteus write delay **10 ms** default (`EPR_WRITEDATA_DELAY=10m` [DSN], [PH Properties]); the datasheet gives TDEW typ 4 / max 8 ms [DS D122 p.141]. EEPROM contents **persist between runs** until Debug › Reset Persistent Model Data; initial contents 128 × 0xFF (`MODDATA=128,255`) or a `.BIN` file. A read is valid in the next cycle. | 4 ms (pic.js:342). EEPROM is reloaded from HEX/0xFF on every reset (pic.js:156). No warnings (C2-style) for a missing 55/AA sequence or WREN. | H | S | 1 (+2 property, +3 menu) |
| C8 | **WDT period** 18 ms default, Proteus property `WDT_PERIOD` [DSN]; datasheet 7/18/33 ms min/typ/max [DS p.147]; postscaler via PSA. Reset log line `[PIC16] PC=0x%04X. Processor has been reset by watchdog timer expiring at time %.6f.` [LOG] | 18 ms fixed (pic.js:141), no log line. | M | S | 1 |
| C9 | **TMR0.** A write inhibits the increment for the next 2 Tcy, and a TMR0 write clears the prescaler if assigned [DS p.47-48]. DS33023 Fig. 11-2 (to be checked): after `MOVWF TMR0` with value NT0, three consecutive `MOVF TMR0,W` read NT0 and the fourth reads NT0+1. | Implemented (t0inh=3, pic.js:295; see pic.js:237). **No golden test.** | M | S | 1 (tests) |
| C10 | **TMR1 prescaler** is cleared on a write to TMR1L or TMR1H [DS §7.7 p.53]. | Not cleared (0x0E/0x0F missing from SW, pic.js:18). | M | S | 1 |
| C11 | **TMR2/PWM.** Period = (PR2+1)·4·Tosc·prescale. Duty = (CCPR1L:DC1B)·Tosc·prescale. Duty is latched at the period start. Duty 0 never sets the pin. Duty ≥ period never clears it. The postscaler does not affect PWM. Writing TMR2 or T2CON clears the prescaler and postscaler. [DS p.54-61] | Implemented (pic.js:183-197, 302-303). Golden test exists for one case (scope_test). Add the edge cases. | M | S | 1 (tests) |
| C12 | **USART.** Baud = Fosc/(16(X+1)) with BRGH=1, Fosc/(64(X+1)) with BRGH=0 [DS Table 12-1]. At 4 MHz, BRGH=1: 9600→SPBRG 25 (9615.385, +0.16%), 19200→12 (+0.16%), 38400→6 (−6.99%). TX frame LSB first. 2-deep RX FIFO, OERR on the 3rd byte, FERR when the stop bit reads 0. | Bit timing is correct (pic.js:142). Byte-level transfer to the terminal ignores both sides' baud/format, and FERR is never set (pic.js:218-225). | H | M | 1 (uart.js) + 2 |
| C13 | **Interrupt latency** 3 Tcy for synchronous sources, 3–4 for INT/RB change. The current instruction completes, then 2 dummy cycles, then 0004h [DS Fig 14-15 p.110]. Sleep with GIE=1: the instruction after SLEEP runs first. A pending flag+enable before SLEEP makes SLEEP a NOP [DS p.112-113]. | Implemented (pic.js:416-424, 368). **No golden test.** | M | S | 1 (tests) |
| C14 | **Comparator / VREF** [DS p.63-69]. CMCON resets to 0x00, so RA0–RA3 are analog and read 0. VR = (VR/24)·VDD with VRR=1, VDD/4 + (VR/32)·VDD with VRR=0. | Implemented (pic.js:21-22, 281). Keep it, and add a golden test for the "forgot CMCON=7" read-modify-write trap. | H | S | 1 (tests) |
| C15 | **Port read-modify-write** uses pin levels. RA4 is open-drain. RA5 is input-only. Weak pull-ups only on inputs with RBPU=0. [DS p.33-46] | Implemented (pic.js:83, 134-137). Add a golden test. | H | S | 1 (tests) |
| C16 | **Processor Clock Frequency** is a *Proteus part property*, independent of the mikroC project clock. Library default 1 MHz [DSN]. A mismatch (mikroC 8 MHz, Proteus 1 MHz) makes `Delay_ms` 8× slower: a classic lab mistake. | Linked: one Fosc for both sides (index.html:266; SPEC Faz 2 §8). | H | M | 3 + 2 (D4) |
| C17 | **7-segment / LED display:** `TTRIGMIN=1ms` [DSN]. A segment shows lit only if it was continuously driven for ≥ 1 ms (filters ghosting). | 20 ms union window; a transition frame can show both states (sim.js:500, 705, 744; SPEC Faz 3 "Gösterge kalıcılığı"). | M | M | 2 |
| C18 | **LM016L (HD44780)** `CLOCK=250kHz` sets command timing and cursor blink [PH HD44780]. HD44780 datasheet execution times: 37 µs at 270 kHz → **40 µs at 250 kHz**; Clear/Home 1.52 ms → **1.64 ms**. Proteus warns when the controller is written while busy (exact wording UNVERIFIED). | Commands execute instantly, with no busy model (sim.js:416-422). | M | M | 2 |
| C19 | **Virtual Terminal:** only CR, BS and BEL are interpreted; LF is ignored [PH]. | termPut handling of LF must be checked (sim.js:729). | M | S | 2 |
| C20 | **Real-time pacing:** 20 fps × 50 ms timestep [PH]. | rAF loop + speed select. Acceptable; expose fps and timestep in Animation Options. | L | S | 3 |

### 1d. mikroC library behaviour vs the SDCC shim

| # | Real mikroC (source) | EELAB shim now | Sev | Eff | WS |
|---|---|---|---|---|---|
| L1 | **Delay_ms / Delay_us** are inline built-ins with a constant argument and are **cycle-exact** [MCH built-in_routines], [MCR]. `Delay_ms(100)` @4 MHz = `MOVLW 130; MOVWF R12; MOVLW 221; MOVWF R13; L: DECFSZ R13,1; GOTO L; DECFSZ R12,1; GOTO L; NOP; NOP` = **100 000 cycles exactly**. At 8 MHz `Delay_ms(100)` uses 3 counters (R11=2, R12=4, R13=186). `Delay_1us` @8 MHz = 2 NOPs. `Vdelay_ms(var)` is a library loop, "not as precise". `Delay_Cyc(n)` = n×10 cycles, 3 ≤ n ≤ 255. | `mc_delay_ms(n)` runtime loop with per-call and per-ms overhead (mikroc_lib.c:2-41). `Delay_us` = `mc_delay_k` with A=17, B=10 rounding (mikroc.h:30-50). Measured effect: Task1's 100 ms tick is **100 605** cycles (debug_test.js:278-305), against about 100 000 + loop overhead with real mikroC. | H | M | 4 (D2) |
| L2 | **Lcd library** [MCR .lst]. Lcd_Init: pins → output and low; 3× Delay_5500us (16.5 ms); nibble 0x3 three times, each EN pulse = EN high, Delay_1us, EN low, followed by 5.5 ms; nibble 0x2; then 0x28 and further commands (decoded as 0x01 and a 0x0F-type; exact tail UNVERIFIED). Lcd_Cmd: two nibbles, then waits **5.5 ms after a command** (RS=0) or **50 µs after data**. Row bases 1→0x80, 2→0xC0, 3→0x94, 4→0xD4, others → 0x80; start = base + col − 1. | Init 20 ms + 5 + 1 + 1 + 1 ms, then 0x28, 0x08, 0x01, 0x06, 0x0F (mikroc_lib.c:96-121). 50 µs after every byte plus 2 ms after cmd<4 (mikroc_lib.c:88-93, 124-128). Row ≠ 2/3/4 → 0x80 matches. | M | S | 4 (D2) |
| L3 | **UART1_Init(const baud)** is computed at compile time. Build hint (message 1509, a *warning* line in the log): `Generated baud rate is 9615 bps (error = 0.16 percent)`. Error when impossible: `Cannot establish this baud rate at [%s] MHz clock` [MCM error list]. The BRGH selection rule is UNVERIFIED; at 4 MHz/9600 the result BRGH=1, SPBRG=25 matches the real hint. | Same SPBRG/BRGH (mikroc.h:86-88), no hint, no error. | M | S | 4 |
| L4 | **PWM1_Init(const freq)** uses Timer2 and starts at duty 0. `PWM1_Set_Duty(0..255)`: 0 → 0 %, 127 → 50 %, 255 → 100 %. The prescaler/PR2 choice is UNVERIFIED. | mikroc.h:104-111, mikroc_lib.c:272-303. PWM1_Init(5000)@4 MHz → PR2=199, prescale 1 (e2e 200-cycle period). Keep it, and emit an `Argument is out of range` error when PR2 cannot fit at /16 [MCM]. | L | S | 4 |
| L5 | **Keypad 4×4:** `Keypad_Key_Press` returns 1..16 or 0. `Keypad_Key_Click` blocks until press **and release** and returns the first key. Mapping in the doc example: 1,2,3,A / 4,5,6,B / 7,8,9,C / *,0,#,D. **Row/column nibble assignment UNVERIFIED.** | mikroc_lib.c:167-205: drives the high nibble and reads the low. | M | S | 4 (verify, then fix) |
| L6 | **Conversions:** ByteToStr 4 chars incl. NUL (`" 24"`), ShortToStr 5 (`" -24"`), WordToStr 6 (`"  437"`), IntToStr 7 (`" -4220"`), LongToStr 12, ByteToHex 3, WordToHex 5; `…WithZeros` variants. [MCH conversions_library] | Byte/Short/Word/Int match (mikroc_lib.c:331-368). Long, Hex and WithZeros variants are missing. | M | S | 4 |
| L7 | **EEPROM_Write:** the docs say keep ≥ 20 ms between writes and reads; it clears and restores GIE. Whether it waits for completion is UNVERIFIED. | Waits for the previous WR (mikroc_lib.c:315-328). This is more forgiving than real hardware if mikroC does not wait; check against a real `.lst`. | M | S | 4 (verify) |
| L8 | **Button(&port, pin, time, active):** tests now, again after `time` ms, returns 255 or 0. [MCH] | Same (mikroc_lib.c:64-73). | — | — | — |
| L9 | **Build messages** [MCR log], [MCM error list]. Errors 324 `Undeclared identifier '%s' in expression`, 402 `; expected, but '%s' found`, 371 `Specifier needed`, 315 `Invalid expression`, 424 `'}' expected '%s' found`. Hints 1163 `Variable '%s' has been declared, but not used`, 1164 `Variable '%s' has been eliminated by optimizer`. ROM-full: `Output limit has raised 2K words`. | SDCC text (server.py:539-558). | H | M | 4 (data) + 3 (render) |

### 1e. Files and workflows

| # | Real | EELAB now | Sev | Eff | WS |
|---|---|---|---|---|---|
| F1 | **`.mcppi`** is INI [MCR Lab_5.mcppi]: `[DEVICE] Name=P16F628A Clock=4000000`, `[MEMORY_MODEL] Value=0`, `[BUILD_TYPE] Value=0`, `[ACTIVE_TAB] Value=x.c`, `[USE_EEPROM]`, `[USE_HEAP]`, `[HEAP_SIZE]`, `[EEPROM_DEFINITION]`, `[FILES] File0=x.c Count=1`, `[BINARIES] Count=0`, `[IMAGES] Count=0 ActiveImageIndex=-1`, `[OPENED_FILES] File0=x.c Count=1`, `[EEPROM] Count=0`, `[ACTIVE_COMMENTS_FILES] Count=0`, `[OTHER_FILES] Count=0`, `[SEARCH_PATH] Count=0`, `[HEADER_PATH] Count=0`, `[HEADERS] Count=0`, `[PLDS] Count=0`, `[Useses] File0=Lcd File1=Lcd_Constants Count=2`, `[EXPANDED_NODES] Count=0`, `[LIB_EXPANDED_NODES] 0=mikroE Libraries 1=System Libraries Count=2`. | Not supported. | M | M | 4 (+3 menu) |
| F2 | **Build outputs** next to the project: `.hex`, `.asm` (no addresses, `;file.c,N :: src` comments), `.lst` (header `;  LST file generated by mikroListExporter - v.2.0`, `; Date/Time: …`, then `;Address Opcode ASM` with rows like `0x0000\t0x2903      \tGOTO       259`), `.log`, `.cfg`, `.brk`, `.dbg`, … [MCR] | Only `<base>.hex` is written (server.py:783-786). | M | M | 4 + 1 (disasm style) + 3 |
| F3 | Proteus **Program File** accepts HEX/COF; the CFGWORD property is overridden by the HEX; Clock is a part property. | Program File label + Load HEX (index.html:303). Fine; clock: see C16. | — | — | — |
| F4 | **Initial EEPROM contents** from a `.BIN` file (Advanced). | Only from the HEX 0x2100 records (pic.js:37). | L | S | 2 + 3 |

---

## 2. Golden values (tests must use these numbers; sources in §0)

### 2.1 Core (WS-1)

**G-CYC: cycles per instruction at the instruction level.**
Run each case on a fresh core with `P.cyc=0` and step once. Report `P.cyc`.

| Case | Expect |
|---|---|
| NOP, MOVLW, ADDLW, MOVWF f (f≠PCL), BSF f,b | 1 |
| GOTO, CALL, RETURN, RETLW, RETFIE | 2 |
| DECFSZ f (result ≠ 0) / (result = 0) | 1 / 2 |
| INCFSZ (result ≠ 0) / (result = 0) | 1 / 2 |
| BTFSC (bit = 1) / (bit = 0) | 1 / 2 |
| BTFSS (bit = 0) / (bit = 1) | 1 / 2 |
| MOVWF PCL | 2 |
| ADDWF PCL,F | 2 |
| BSF PCL,0 | 2 |

**G-FLAG: status bits.**
- ADDLW: W=0xFF, k=0x01 → W=0, C=1, DC=1, Z=1.
- SUBLW: W=0x05, k=0x05 → C=1, Z=1.
- SUBLW: W=0x06, k=0x05 → C=0, Z=0, W=0xFF.
- RLF with C=1, f=0x80 → f=0x01, C=1, Z unchanged.
- CLRW → Z=1.
- SLEEP → TO=1, PD=0.
- CLRWDT → TO=1, PD=1.

**G-T0: TMR0 write inhibit (DS33023 Fig. 11-2, check it).**
With T0CS=0 and PSA=1 (prescaler to WDT), run: `MOVLW 0x10; MOVWF TMR0; MOVF TMR0,W ×5`. The successive W values are `0x10, 0x10, 0x10, 0x11, 0x12`.
- This is today's behaviour; the test pins it.
- If DS33023 shows otherwise, mark the test `// UNVERIFIED` and keep today's numbers.

**G-T0P: prescaler clear.**
With PSA=0 and PS=111 (1:256), run 100 NOPs, write TMR0=0, then run 255 NOPs. TMR0 must still be 0. After 256 + 2 more cycles, TMR0=1.
- The exact +2 comes from the inhibit, which also applies with a prescaler (DS33023 to be checked).
- Assert TMR0 ∈ {0} at +255 and TMR0=1 at +258.

**G-T1P: TMR1 prescaler clear on write (new behaviour).**
With T1CON=0x31 (1:8, on), run 5 NOPs, write TMR1L=0 (`CLRF TMR1L`), then run 7 NOPs. TMR1L must be 0. After one more NOP it is 1.

**G-PWM.**
- Fosc 4 MHz, PR2=199, T2CON=0x04, CCPR1L=100, DC1B=0: period 200 Tcy, high 100 Tcy.
- CCPR1L=0, DC1B=0: RB3 never goes high.
- CCPR1L=250 (duty > period): RB3 never goes low after the first period start.
- Changing CCPR1L mid-period takes effect only at the next period.
- T2CON postscaler 1:16 does not change the PWM period.

**G-UART-TX.** SPBRG=25, BRGH=1, Fosc 4 MHz. One bit = 104 Tcy and a 10-bit frame = 1040 Tcy. `onUartTx(byte, endCyc, …)` fires at `txStart + 1040`.

**G-RESET.** Use the [DS] Table 14-6/14-7 columns. After a WDT time-out reset from normal run:
- STATUS = `0000 uuuu`: TO=0, PD keeps its previous value.
- PC=0.
- PCON bits 1 and 3 keep their previous values.
- These registers are unchanged: TMR0, FSR, PORTB latch, TMR1L/H, T1CON, CCPR1L/H, EEDATA, EEADR.
- These registers take their reset values: INTCON = `0000 000u`, PIR1=0, PIE1=0, PCLATH=0, TMR2=0, T2CON=0, CCP1CON=0, RCSTA = `0000 000x` (use 0), TXSTA=0x02, SPBRG=0, CMCON=0, VRCON=0, OPTION=0xFF, TRISA=TRISB=0xFF, PR2=0xFF.
- POR: STATUS=0x18, PCON=0x08, all of the above 0 or the documented value (x → 0).
- MCLR during Sleep: STATUS `0001 0uuu` (TO=1, PD=0).
- Wake from Sleep by WDT: PC = address after SLEEP, STATUS TO=0, PD=0, no reset.
- Wake by interrupt with GIE=1: the instruction after SLEEP executes, then 0x0004.

**G-INT.** With GIE=1 and T0IE=1, place an instruction that overflows TMR0. The first ISR instruction (0x0004) executes 3 Tcy after the cycle in which T0IF was set: 1 to finish the current instruction + 2 dummy cycles.
- Assert `cycAtISR − cycFlagSet` ∈ {2, 3} with today's implementation and pin the measured value.

**G-WDT.** Fosc 4 MHz, WDTE=1, PSA=0: reset after 4500 Tcy (18 ms). With PSA=1 and PS=111: after 4500·128 = 576 000 Tcy. The log text at 4 MHz after 18 ms is `Processor has been reset by watchdog timer expiring at time 0.018000.`

**G-EE.** At 4 MHz with the default property, a write completes (WR=0, EEIF=1, data visible) at `start + 10 000` Tcy (10 ms), and not at `start + 9 999`. At 8 MHz it is +20 000. With the property set to 4 ms it is +4 000.

**G-EEW (warnings).** BSF EECON1,WR without the 55/AA sequence emits `Attempt to set EECON1<WR> without 0x55/0xAA sequence to EECON2 has been ignored.` Setting WR in the same instruction as WREN (`MOVLW 0x06; MOVWF EECON1` after 55/AA) emits `Cannot set EECON1<WR> without first setting EECON1<WREN> in a previous instruction.`

**G-STK.** Nine nested CALLs emit `Stack overflow executing CALL instruction.` once. RETURN at depth 0 emits `Stack underflow executing RETURN instruction.` The circular behaviour is unchanged.

**G-ILL.** Opcode 0x3B00 does not throw: it takes 1 cycle and emits `Attempt to execute illegal opcode (0x3B00) - NOP executed.`

**G-CMP (the student trap).** Fresh POR (CMCON=0), TRISA=0, run `BSF PORTA,0` then `BSF PORTA,1`:
- The PORTA latch ends as 0x02, because bit 0 was read back as 0 since it is analog.
- With `CMCON=7` first, the latch ends as 0x03.

**G-PORT.**
- RA4 latch=1 with TRISA4=0 → pin floating (2) unless pulled up.
- RA5 with TRISA5=0 → still an input.
- RBPU=0: TRISB=0xFF with floating pins reads 0xFF.
- RBPU=0, TRISB=0x00 → no pull-ups.

**G-MCLR.** With cfg 0x3F6B (MCLRE=1): `core.setMclr(0)` stops execution (PC frozen and cycles count as "in reset"). `core.setMclr(1)` → PC=0, STATUS per the MCLR column. With MCLRE=0, setMclr is ignored and RA5 reads as data.

### 2.2 UART line model (WS-1 writes `js/uart.js`; WS-2 uses it)

**G-UART-ID.** `decode(encode(bytes, {bitCyc:104}), {bitCyc:104})` returns every byte 0..255 unchanged with `ferr=0`.

**G-UART-PPM.** With `bitCyc` 104 (PIC at 9615 bps) and 104.1667 (terminal at 9600 with Fosc 4 MHz = 1e6/9600), all 256 bytes pass unchanged.

**G-UART-MIS (hand-computed).** Encode 'A' (0x41) with bitCyc 104, 8N1, idle high before and after. The line is low on [0,104) (start), high on [104,208) (b0=1), low on [208,728), high on [728,832) (b6=1), low on [832,936) (b7=0), and high from 936 on (stop + idle).

Decode with bitCyc 52, 8N1, using one sample at the bit centre `t0 + 52·k + 26`, where k=0 is the start bit:

| Frame | Start | Data samples | Byte | Stop sample | Result |
|---|---|---|---|---|---|
| 1 | falling edge at 0 | 78, 130, …, 442 → bits 0,1,1,0,0,0,0,0 | 0x06 | t=494 reads 0 | **ferr=1** |
| 2 | next falling edge at 832 | → bits 0,1,1,1,1,1,1,1 | 0xFE | t=1326 reads 1 | ferr=0 |

The receiver rule is: after a frame, wait for the line to be high, then for a falling edge.

Expected result: `[{byte:0x06, ferr:1}, {byte:0xFE, ferr:0}]`.

**G-UART-PAR.** Encode 0x41 with 8E1 (parity bit = even parity of the data = 0 for 0x41, which has 2 ones). Decoding as 8E1 gives `perr=0`. Decoding as 8O1 gives `perr=1`.

### 2.3 Build, shim and messages (WS-4)

**G-DLY (exact mode only, `libModel:"mikroc"`).** Measured on pic.js with breakpoints or port-write timestamps around the call, with the difference taken between two builds so constant overhead cancels:

| Expression | Cycles |
|---|---|
| `Delay_ms(200)` − `Delay_ms(100)` @4 MHz | 100 000 |
| `Delay_ms(100)` @4 MHz, absolute (port write to port write, minus the measured cost of the port write itself) | 100 000 |
| `Delay_ms(10)` @8 MHz | 20 000 |
| `Delay_us(50)` @4 MHz | 50 |
| `Delay_us(1)` @8 MHz | 2 |
| `Delay_Cyc(3)` | 30 |
| `Delay_Cyc(255)` | 2550 |
| `Delay_1sec()` @20 MHz | 5 000 000 |

**G-DLY-TASK1.** In exact mode, the Task1.c `ones++` breakpoint stopwatch becomes `100 000 + loop overhead`. Measure the overhead and record the number; WS-4 reports it, it is not pre-specified. It must be < 100 300. Legacy mode stays at **100 605** (debug_test.js:304).

**G-LCD (exact mode).** Measure at the LCD E falling edges:
- First E pulse at ≥ 16.5 ms after reset.
- Gaps of 5.5 ms after each init nibble.
- After a command byte, the next E high is ≥ 5.5 ms later.
- After a data byte, it is ≥ 50 µs later.
- E high width = 1 µs (= 1 Tcy at 4 MHz plus instruction granularity; assert ≥ 1 Tcy).

**G-BAUD.** Build `UART1_Init(9600)` @4 MHz:
- The result has `mc` message `{type:"warning", no:1509, key:"baud", args:[9615, "0.16"]}`.
- The EN text is `Generated baud rate is 9615 bps (error = 0.16 percent)`.
- SPBRG=25, TXSTA.BRGH=1.
- `UART1_Init(115200)` @4 MHz (SPBRG 1, +8.5 %) still builds, with hint `Generated baud rate is 125000 bps (error = 8.51 percent)`. Whether real mikroC refuses it is UNVERIFIED; do not add an error.

**G-MSG (successful build, EN mode, exact strings from [MCR]).**

| Type | Line | No | Text | Unit |
|---|---|---|---|---|
| hint | 0 | 1139 | `Available RAM: 224 [bytes], Available ROM: 2048 [bytes]` | — |
| diagnostics | 0 | 122 | `Compilation Started` | `<file>.c` |
| diagnostics | `<lines>` | 123 | `Compiled Successfully` | `<file>.c` |
| diagnostics | 0 | 127 | `All files Compiled in <ms> ms` | — |
| hint | 0 | 1144 | `Used RAM (bytes): <n> (<p>%)  Free RAM (bytes): <m> (<q>%)` | — |
| hint | 0 | 1144 | `Used ROM (program words): <n> (<p>%)  Free ROM (program words): <m> (<q>%)` | — |
| diagnostics | 0 | 125 | `Project Linked Successfully` | `<project>.mcppi` |
| diagnostics | 0 | 128 | `Linked in <ms> ms` | — |
| diagnostics | 0 | 129 | `Project '<project>.mcppi' completed: <ms> ms` | — |
| diagnostics | 0 | 103 | `Finished successfully: <d Mon yyyy, HH:MM:SS>` | `<project>.mcppi` |

- Failure: `error | 0 | 102 | Finished (with errors): <date>`.
- The real log shows `Available RAM: 208` for P16F628A because mikroC reserves registers; EELAB reports its own number, so do not hard-code 208.
- Percentages are rounded to integers as in the real log (430/2048 → 21 %, free 1618 → 79 %).
- Dates: EN `26 Jun 2025, 10:31:51`, TR `15 Eki 2025, 12:23:41`, both with the 24-hour clock.

**G-ERR (mapping SDCC → mikroC numbers; regex on the SDCC text, case-insensitive).**

| SDCC text | mikroC no | mikroC text |
|---|---|---|
| `undefined identifier '(\w+)'` | 324 | `Undeclared identifier '$1' in expression` |
| `syntax error: token -> '([^']*)'` | 402 | `; expected, but '$1' found` |
| anything else | 0 | raw SDCC text, type error/warning as today |

**G-CONV (exact mode and legacy, new functions).**

| Call | Output |
|---|---|
| `LongToStr(-12345, s)` | `"     -12345"` (11 chars + NUL) |
| `ByteToHex(2, s)` | `"02"` |
| `WordToHex(0x457, s)` | `"0457"` |
| `IntToStrWithZeros(-42, s)` | `"-00042"` |
| `ByteToStrWithZeros(7, s)` | `"007"` |

---

## 3. Interface contracts (bind all workstreams; names are exact)

**K-F1 — core options** (WS-1 implements, WS-3 passes them). `PIC.create(opts)` accepts these extra fields, all optional and defaulting to Proteus [DSN] values:
```js
opts.props = { wdtPeriod: 0.018, eeWriteDelay: 0.010, cfgDefault: 0x3F6B, eePersist: true }
opts.onWarn = w => {}   // w = { mod:'PIC16'|'PIC16 MEMORY'|'PIC16 EEPROM'|'PIC16 CORE', pc:number, cyc:number, text:string }
```
- `core.setProps(partialProps)` updates them at runtime.
- `core.setMclr(level)`: 1 = high or floating, 0 = asserted.
- `core.resetPersistent()`: EEPROM → `eeInit` (HEX data or 0xFF).
- `core.reset()` keeps EEPROM when `eePersist` is true; only the first `load()`, a new HEX or `resetPersistent()` reinitialises it.

**Warnings.**
- Rate limit: each `(text, pc)` pair at most once per `reset()`.
- `mod` values: illegal opcode, stack and WDT → `'PIC16'`; unimplemented memory → `'PIC16 MEMORY'`; EECON → `'PIC16 EEPROM'`.
- Unimplemented-memory warnings are **off by default** (`props.warnUnimpl:false`), because SDCC output may legitimately touch them. WS-1 checks with the 11 projects; if none warn, the default may become true.

**`onUartTx`.** `opts.onUartTx(byte, endCyc, frame)` gains a third argument `frame = {bitCyc, dataBits:8|9, ninth}`. Existing 2-argument callers keep working.

**RX.** `core.rxPush(byte, flags)` with `flags = {ferr:0|1}` sets RCSTA.FERR for that byte (FERR is buffered with the byte as in [DS]).

**Disassembly.** `PIC.disasm(op, addr, {style:'mikroc'})` returns mikroC .lst style: uppercase mnemonic, decimal literal or address, register names from `o.names` else `R<n>` for 0x70-0x7F else decimal address. Example: `0x2903` at 0 → `GOTO       259`. The column padding (mnemonic padded to 11 chars) is part of the contract.

**K-F2 — `js/uart.js`** (new, WS-1). Browser: `window.UART`; Node: `module.exports`.
```js
UART.encode(bytes, { bitCyc, dataBits=8, parity='NONE'|'EVEN'|'ODD', stopBits=1, invert=false, t0=0, gap=0 })
  -> { edges: [[cyc, level], ...], end }        // level 0/1, idle = 1 (or 0 if invert)
UART.decode(edges, { bitCyc, dataBits=8, parity='NONE', stopBits=1, invert=false, until })
  -> [{ byte, ferr, perr, t }]                  // single centre sample per bit, rule as in G-UART-MIS
UART.transfer(byte, txCfg, rxCfg) -> [{byte, ferr, perr}]   // encode+decode of one isolated frame, idle after
```

**K-F3 — Proteus pane props and runner** (WS-2 implements, WS-3 wires).
- **PIC part fields** (circuit JSON, optional, Proteus names): `clock` (string, e.g. `"4MHz"`, default `"1MHz"` only if D4 = Proteus), `cfgword`, `wdtPeriod` (`"18m"`), `eeDelay` (`"10m"`), `eeBin` (filename).
- **Parser.** `LIB.parseEng("18m") → 0.018`, `"1MHz" → 1e6`, `"32.768kHz" → 32768`. Accept the SI prefixes p n u µ m k M (case-sensitive m vs M).
- **VIRTUAL-TERMINAL fields:** `baud` (default 9600), `dataBits` (8), `parity` ('NONE'), `stopBits` (1), `xonxoff` (0), `sigPol` (0), `ctlPol` (0).
- **Runner.** `runner.uartTx(byte, cyc, frame)` decodes with UART.transfer against each attached terminal's cfg. `runner.termKey()` queues bytes; `runner.uartRx(picFrameCfg)` returns `{byte, ferr}|null` after a transfer at terminal cfg → PIC cfg. Old `uartRx()` without an argument returns a bare number, unchanged.
- **MCLR pin level:** `runner.pinLevel('U1', 4) → 0|1|2`, used by WS-3 to call `core.setMclr`.
- **Warnings and edit events.** `runner.warnings()` drains `[{mod:'LM016L'|'VTERM'|…, id, cyc, text}]` (LCD busy etc.). `ED.onEditPart(cb)` fires after the Edit Component OK so WS-3 can push `core.setProps`.
- **Hooks WS-2 exposes for WS-3 to bind:** `ISIS.create(o)` accepts the extra callbacks `o.debugCmd(name)` and `o.animOptions()`.
  - `debugCmd` names: `'start'`, `'pause'`, `'stop'`, `'stepOver'`, `'stepInto'`, `'stepOut'`, `'resetPersistent'`, `'popup:regs'`, `'popup:data'`, `'popup:prog'`, `'popup:eeprom'`, `'popup:source'`, `'popup:watch'`.
  - WS-2 only renders the menu items with these labels and keys and calls the callback. WS-3 implements them.

**K-F4 — keys and focus** (WS-3).
- `index.html` sets `document.body.dataset.focus = 'ide'|'isis'` on pointerdown inside either pane (default `'ide'`).
- mikroC bindings apply only when focus = ide. Proteus bindings (F5–F8 view, F10/F11/F12, Pause, Shift+Break, Ctrl+E, E, keypad ±) apply only when focus = isis.
- `js/keys.js` (new): `KEYS.match(event, 'Ctrl+F9')` treats Ctrl and ⌘ as equal; `KEYS.table = {ide:[…], isis:[…]}` serves as the single source for menus and help.
- **Old aliases stay:** ⌘B build, ⇧F8 step out, ⌘/ comment, ⌘S save.
- WS-2 must not register global F5–F8 handlers. It exposes `ED.zoomKey('in'|'out'|'all'|'centre', pt)`, and WS-3 binds the keys.

**K-F5 — server build result** (WS-4 produces, WS-3 renders).
- `POST /api/build` adds `mc: [{type:'error'|'warning'|'hint'|'diagnostics', line, no, key, args, unit}]`. All existing fields (`ok, messages, hex, hexPath, fosc, diag, debug`) remain unchanged.
- `key` is a stable id: `'avail'`, `'compStart'`, `'compOk'`, `'allComp'`, `'usedRam'`, `'usedRom'`, `'linked'`, `'linkedIn'`, `'completed'`, `'finishedOk'`, `'finishedErr'`, `'baud'`, `'undeclared'`, `'expected'`, `'raw'`. `args` is an array of strings or numbers.
- `js/i18n.js` (WS-3) owns the TR and EN templates. The EN templates must equal G-MSG.
- `GET /api/info` gains `libModels:['eelab','mikroc']`.
- Settings `/api/settings` accepts:
  - `libModel: 'eelab'|'mikroc'` per file. Absent means the server default `LIB_MODEL_DEFAULT`, a module constant set to `'eelab'` until D2.
  - `uiLang: 'tr'|'en'` at workspace level, stored under the `.eelab.json` top-level key `ui`.
- **Exact mode switch.** In `libModel:'mikroc'` the build defines `-DMC_EXACT=1` and convert() rewrites constant-argument delays (§4 WS-4). `'eelab'` must produce byte-identical HEX to today.
- **`POST /api/output {name, kind:'lst'|'asm'|'log', text}`** writes `<base>.<kind>` into the workspace next to the source. Only those three kinds, and `name` must be an existing source file.
- **`POST /api/import-mcppi`** body `{mcppi:text, files:{'x.c':code,...}}` → `{ok, name, fosc, warnings}`. It reads `[DEVICE] Name` (warns if ≠ P16F628A), `Clock` → fosc, `[FILES] File0` → main source, and copies `files` into the workspace (existing names get `_2`).
- **`GET /api/export-mcppi?name=X.c`** → zip bytes containing `X.mcppi` (sections exactly as F1, `[Useses]` from `lib_uses`), `X.c`, and `X.hex`, `X.lst`, `X.asm`, `X.log` where present.

---

## 4. Workstreams (run in parallel; strict ownership)

| WS | Owner | Files it may edit (only these) |
|---|---|---|
| **WS-1 Core** | Codex | `js/pic.js`, `js/uart.js` (new), `tests/core_test.js`, `tests/fidelity_core_test.js` (new), `tests/uart_test.js` (new) |
| **WS-2 Proteus pane** | Codex | `js/isis.js`, `js/editor.js`, `js/library.js`, `js/sim.js`, `js/scope.js`, `circuits/**`, `docs/proteus-ui.md`, `tests/library_test.js`, `tests/sim_test.js`, `tests/scope_test.js`, `tests/isis_test.js` (new), `tests/fidelity_sim_test.js` (new) |
| **WS-3 mikroC pane + glue** | Codex | `index.html`, `js/ide.js`, `js/debug.js`, `js/i18n.js` (new), `js/keys.js` (new), `tests/ide_test.js`, `tests/debug_test.js`, `tests/i18n_test.js` (new), `tests/keys_test.js` (new) |
| **WS-4 Build/shim/files** | Codex | `server.py`, `eelab_paths.py`, `shim/**`, `templates/**`, `projeler/*.c`, `projeler/*.asm` (never any `projeler/*.hex`), `tests/build_test.py`, `tests/server_test.py`, `tests/shim_timing_test.js` (new), `tests/fixtures/mikroc/**` (new) |
| **WS-5 Integration (after 1–4)** | Opus / planner | `SPEC.md`, `FIDELITY_PLAN.md`, `EELAB_PLAN.md`, `KULLANIM.md`, `KURULUM.md`, `tests/run_all.sh`, `tests/e2e/**`, `packaging/selftest/golden.json`; applies the D-decisions (§5); small integration patches elsewhere only with a note |

**Shared rules.**
- Read-only use of other modules is fine. For example, WS-4's `shim_timing_test.js` may `require('../js/pic.js')`, and WS-2 may `require('../js/uart.js')`.
- If a module you depend on is not there yet, feature-detect it (`typeof UART !== 'undefined'`) and fall back to today's behaviour.
- **Never** change another WS's test expectations. If an existing test in a file you do not own breaks, your change is wrong: revert or guard it behind a flag.
- Commit messages: `Faz4 WS-n: <what>`. Commit only your own files. (The planner does not run git; implementers follow the coordinator's git rules.)
- Final check for every WS: `bash tests/run_all.sh` → last line `N paket, 0 başarısız`.

### 4.1 WS-1 — Core (`js/pic.js`, `js/uart.js`)

Goal: datasheet- and Proteus-exact CPU behaviour, plus warnings and properties per K-F1/K-F2, with **zero change** for existing callers that pass no new options. One exception: EEPROM persistence and the 10 ms delay are new defaults, so check that `core_test.js` and the e2e EEPROM checks still pass. If a test relies on 4 ms, do not edit that test; tell WS-5. Note that `Eeprom_Demo` waits on WR, so it is unaffected.

**Steps (in this order, run `node tests/core_test.js` after each):**
1. Add `tests/fidelity_core_test.js` that pins **today's** correct behaviour first: G-CYC, G-FLAG, G-T0, G-PWM, G-UART-TX, G-INT, G-CMP, G-PORT. Use a helper that assembles raw opcodes into `prog` (no toolchain needed). All of these must pass before you change anything.
2. Warnings infrastructure: `opts.onWarn`, a per-reset dedupe set, and a `warn(mod, text)` helper using `(P.pc - 1) & 0x1FFF` as the PC of the executing instruction.
3. Illegal opcode → NOP plus warning (replaces the `throw` at pic.js:407). Test G-ILL.
4. Stack overflow and underflow warnings (pic.js:350-351, using `depth`). Test G-STK.
5. EEPROM: `props.eeWriteDelay` (default 0.010 s), the two EECON warnings, and persistence (`eePersist`) with `resetPersistent()`. Tests G-EE and G-EEW.
6. TMR1 prescaler clear on writes to 0x0E/0x0F (add them to `SW`, handle them in `wr`). Test G-T1P.
7. Reset table: split `sfrReset` into `resetBy(cause)` with cause ∈ `'por'|'mclr'|'mclrSleep'|'wdt'|'bor'` implementing G-RESET exactly. `reset()` = POR. WDT time-out calls `resetBy('wdt')` and emits `Processor has been reset by watchdog timer expiring at time X.XXXXXX.` with X = cyc·4/fosc, 6 decimals. Test G-RESET and G-WDT.
8. MCLR: `setMclr(level)`. While MCLRE (cfg bit 5) = 1 and level = 0, `step()` only advances `P.cyc` (`P.inReset = true`). The rising edge calls `resetBy(P.sleepAtAssert ? 'mclrSleep' : 'mclr')`. A null cfg uses `props.cfgDefault` 0x3F6B **only for MCLR and WDT decisions** (`decodeConfig` output for display stays null). Test G-MCLR.
9. `props.wdtPeriod` replaces the 0.018 constant (pic.js:141).
10. `onUartTx` third argument and `rxPush(byte, {ferr})` (K-F1).
11. `PIC.disasm` `style:'mikroc'`. Test: `disasm(0x2903, 0, {style:'mikroc'}) === 'GOTO       259'`; `disasm(0x3021, 3, {style:'mikroc'}) === 'MOVLW      33'`.
12. Write `js/uart.js` per K-F2, plus `tests/uart_test.js` with G-UART-ID, G-UART-PPM, G-UART-MIS and G-UART-PAR.

**Done:**
- [ ] All G-* in §2.1 and §2.2 are asserted.
- [ ] Core speed: `node tests/core_test.js` timing test (if present) or a 10 M-cycle Task1 run is no more than 5 % slower than before (measure before and after, and print both).
- [ ] `bash tests/run_all.sh` passes with 0 failures.
- [ ] No other WS file is touched.

### 4.2 WS-2 — Proteus pane (`isis.js`, `editor.js`, `library.js`, `sim.js`, `scope.js`)

Goal: Proteus mouse, keyboard and menu behaviour (P1–P12, P16–P18), the terminal format and baud model (C12/P16), LCD busy (C18), 7-seg min trigger (C17), and LF handling (C19).

**Steps:**
1. `ED.zoomKey(kind, pt)`:
   - `'in'` zooms by 1/1.25 and `'out'` by 1.25, both centred on `pt` (the last pointer position over the canvas; the view centre if none).
   - `'all'` = `fit()`.
   - `'centre'` re-centres on `pt` without zooming.
   - Export it on the ED API. **Do not** bind F-keys yourself (K-F4).
   - Add View-menu labels `Zoom In  F6`, `Zoom Out  F7`, `Zoom All  F8`, `Centre At Cursor  F5`.
2. Mouse:
   - Shift + left-drag on empty canvas draws a dashed box and zooms to it on release (replaces shift-band). Additive selection remains Ctrl/⌘-click.
   - Middle-click without movement toggles track-pan: the view follows the pointer until the next click. Middle-drag panning stays.
   - Numeric keypad `+` / `-` (`e.code === 'NumpadAdd' | 'NumpadSubtract'`) rotate anticlockwise / clockwise while placing or with a selection. `R` stays.
   - While wiring, right-click removes the last anchor; with no anchors left, it cancels. Esc cancels.
   - Ctrl held during wiring places the next segment straight/diagonal (no Manhattan) to the pointer.
   - `Ctrl+E` / `⌘E` = edit the part under the pointer. `E` opens a prompt "Find and Edit Component — Reference:", then opens that part's dialog.
   - Rotate buttons: right-click on `trot` rotates anticlockwise. Mirror is out of scope (no mirror in the data model).
3. Menus (isis.js MENUS):
   - Debug: `Start VSM Debugging  Ctrl+F12`, `Pause Animation  Pause`, `Stop VSM Debugging  Shift+Break`, `Step Over  F10`, `Step Into  F11`, `Step Out  Ctrl+F11`, separator, `PIC CPU Registers - U1`, `PIC CPU Data Memory - U1`, `PIC CPU Program Memory - U1`, `PIC CPU EPROM Memory - U1`, `PIC CPU Source Code - U1`, `Watch Window`, separator, `Reset Persistent Model Data`. Each calls `o.debugCmd(name)` (K-F3); grey them out if the callback is absent.
   - `Step Out Ctrl+F11` is UNVERIFIED: keep the label but put it in a constant.
   - System: `Set Animation Options…` calls `o.animOptions()`.
   - Labels use `Ctrl+`, not `⌘`, as in Proteus.
4. Edit Component, PIC: add the fields Processor Clock Frequency (free text, validated with `LIB.parseEng`, 32 kHz–20 MHz), Program Configuration Word, and an "Advanced Properties" disclosure with Watchdog Timer Period (`18m`), Data EEPROM Write Delay (`10m`), Initial contents of EEPROM (.BIN filename, read-only label plus a file chooser that stores bytes in the part as `eeBin` base64), Randomize Data Memory? (No; disabled), Model PIC Start-up Delays? (No; disabled). Store everything in the part fields (K-F3) and fire `ED.onEditPart`.
5. Virtual Terminal:
   - Edit Component with Baud Rate (editable combo, list per [DSN]), Data Bits, Parity, Stop Bits, Send XON/XOFF, Advanced RX/TX Polarity, RTS/CTS Polarity.
   - Right-click menu on the terminal display: Clear Screen, Pause, Copy, Paste, Hex Display Mode, Echo Typed Characters (default off). Clear Screen and Hex mode are UNVERIFIED; implement them anyway, harmlessly.
   - `runner.uartTx(byte, cyc, frame)`: when `typeof UART !== 'undefined'` and `frame` is given, run `UART.transfer(byte, {bitCyc: frame.bitCyc, dataBits: frame.dataBits === 9 ? 9 : 8}, {bitCyc: (fosc/4)/baud, dataBits, parity, stopBits, invert: sigPol})` and `termPut` each decoded byte. Otherwise keep today's path.
   - `termPut`: CR = carriage return/new line, BS = backspace, BEL = flash, **LF and all other control codes < 0x20 are ignored** (not displayed). Hex mode shows `41 ` etc.
   - The `uartRx(picCfg)` path is symmetric (K-F3).
6. LCD busy (sim.js `lcdExec`):
   - Keep a per-LCD `busyUntil` in cycles = now + (clear/home ? 1.64 ms : 40 µs)·fosc/4, using the LCD's `clock` property (default 250 kHz, scaled by 250k/clock).
   - An E falling edge while busy queues the warning `Controller received command whilst busy.` (data: `Controller received data whilst busy.`; wording UNVERIFIED, keep it in a constant) in `runner.warnings()`, **and still executes** (do not drop it: keeps demos alive).
   - Test in `tests/fidelity_sim_test.js`: two commands 20 µs apart at 4 MHz → 1 warning; 50 µs apart → 0.
7. 7-segment and LED min-trigger:
   - In `Runner.frame()`, a segment/LED counts as lit in the frame if, within the window, it was continuously on for ≥ `TTRIGMIN` (default 1 ms → `fosc/4·0.001` cycles; part property `ttrigmin`).
   - Keep the 20 ms window for the union. Mux displays (4 digits × 5 ms) must remain fully visible.
   - Tests:
     - A 0.5 ms glitch does not light.
     - A 2 ms pulse does.
     - mux4_demo shows 4 digits.
     - `tests/e2e/e2e_test.js` must stay green (run it).
8. `docs/proteus-ui.md`: append a "Phase 4 behaviour" section listing every mouse and key rule above with its source.

**Tests (`tests/isis_test.js`, `tests/fidelity_sim_test.js`; jsdom is not available, so test pure functions and data):**
- [ ] `LIB.parseEng`: `'18m'` → 0.018, `'10m'` → 0.01, `'1MHz'` → 1e6, `'250kHz'` → 250000, `'100m'` → 0.1, `'100M'` → 1e8.
- [ ] Terminal default fields equal [DSN]. `LIB.types['VIRTUAL-TERMINAL']` has baud list `[110,300,1200,2400,4800,9600,19200,38400,57600]`.
- [ ] `termPut` with "A\nB\r" yields the line "AB" plus a new line, and the LF is not shown.
- [ ] A uartTx mismatch (PIC 19200 bitCyc 52 → terminal 9600) yields garbage per UART.transfer and **not** the original byte.
- [ ] isis MENUS contain the exact Debug and View labels above (export `ISIS.MENU_LABELS` for the test).
- [ ] LCD busy and 7-seg tests as in steps 6–7.

**Done:** all of the above checked, `bash tests/run_all.sh` passes with 0 failures, and nothing outside the WS-2 files is edited.

### 4.3 WS-3 — mikroC pane + glue (`index.html`, `ide.js`, `debug.js`, new `i18n.js`, `keys.js`)

Goal: the real mikroC keys (M1), menus (M2), Messages window (M3), Project Settings and Library Manager (M4), Watch/Stopwatch (M5/M6), the TR/EN toggle (D1), plus wiring of every WS-1/WS-2 hook and the Proteus F-keys.

**Steps:**
1. **`js/keys.js`** per K-F4, with `KEYS.table`:

   ide (mikroC):

   | Action | Key | Alias kept |
   |---|---|---|
   | build | Ctrl+F9 | ⌘B |
   | buildAll | Shift+F9 | — |
   | startDebug | F9 | — |
   | stopDebug | Ctrl+F2 | ⌘. |
   | runPause | F6 | — |
   | stepInto | F7 | — |
   | stepOver | F8 | — |
   | stepOut | Ctrl+F8 | ⇧F8 |
   | runToCursor | F4 | — |
   | toggleBp | F5 | — |
   | jumpToInterrupt | F2 | — |
   | viewBps | Shift+F4 | — |
   | clearBps | Ctrl+Shift+F5 | — |
   | watch | Shift+F5 | — |
   | addWatch | Ctrl+F5 | — |
   | disasm | Alt+D | — |
   | editProject | Ctrl+Shift+E | — |
   | codeAssist | Ctrl+Space | — |
   | paramAssist | Ctrl+Shift+Space | — |
   | template | Ctrl+J | — |
   | gotoLine | Ctrl+G | — |
   | routineList | Ctrl+L | — |
   | find | Ctrl+F | — |
   | findNext | F3 | — |
   | findPrev | Shift+F3 | — |
   | replace | Ctrl+R | — |
   | deleteLine | Ctrl+Y | — |
   | redo | Ctrl+Shift+Z | — |
   | comment | Ctrl+Shift+. | ⌘/ |
   | uncomment | Ctrl+Shift+, | — |
   | bookmarkSet | Ctrl+Shift+0..9 | — |
   | bookmarkGo | Ctrl+0..9 | — |
   | indent | Ctrl+Shift+I | — |
   | unindent | Ctrl+Shift+U | — |
   | save | Ctrl+S | — |
   | options | F12 | — |

   - Replace only with Ctrl, never ⌘R (⌘R is browser reload).
   - `jumpToInterrupt` = run until PC = 0x0004.
   - Ctrl+Y on Mac must use real Ctrl only (⌘Y opens history in some browsers).

   isis (Proteus): `zoomIn` F6, `zoomOut` F7, `zoomAll` F8, `centre` F5, `startDebug` Ctrl+F12, `pause` Pause, `stop` Shift+Break (alias Shift+Escape), `stepOver` F10, `stepInto` F11, `toggleBp` F9 (only in the source popup), `edit` Ctrl+E, `find` E.

   - **Starting the debugger (F9).** Today debugging is implicit when running. Make F9 = build if needed, load the HEX, reset, and stop at the first source line (or 0x0000 for asm), i.e. "Start Debugger" as in mikroC. Ctrl+F2 = stop simulation.
   - **Behaviour change to check:** F6 when stopped must keep today's behaviour (run) so `debug_test`/`e2e` stay green.
2. **Focus.** Set `body.dataset.focus` per K-F4. Route keys through `KEYS`. Replace index.html:966-977 with a table-driven handler. Keep the S/R button shortcuts and `TERM_FOCUS`.
3. **Menus.** The mikroC pane menu bar becomes Dosya · Düzen · Görünüm · Proje · Çalıştır · Araçlar · Yardım (EN: File · Edit · View · Project · Run · Tools · Help), with items from M1/M2 showing their keys. Existing Devre items move under Dosya › Devre. All existing functions stay reachable.
4. **i18n.**
   - `js/i18n.js`: `I18N.t(key, args, lang)`, `I18N.lang()` / `setLang()` (localStorage `eelab.ui.lang`, and `/api/settings {ui:{lang}}` when the server supports it), plus the dictionaries `tr`/`en` for every mikroC-pane string you touch, and all K-F5 message keys.
   - The EN message templates must equal G-MSG/G-ERR exactly.
   - TR templates, as a suggestion (WS-3 may refine the wording, but keep the numbers/args):
     - `Derleme Başladı`
     - `Başarıyla Derlendi`
     - `Tüm dosyalar <ms> ms'de derlendi`
     - `Kullanılan RAM (bayt): <n> (%<p>)  Boş RAM (bayt): <m> (%<q>)`
     - `Kullanılan ROM (program word): …`
     - `Proje Başarıyla Bağlandı`
     - `Başarıyla bitti: <tarih>`
     - `Hatalarla bitti: <tarih>`
     - `Tanımlanmamış tanıtıcı '<x>' (ifade içinde)`
     - `';' bekleniyordu, '<x>' bulundu`
     - `Üretilen baud hızı <b> bps (hata = %<e>)`
   - Settings dialog (Araçlar › Seçenekler, F12): "Arayüz dili (mikroC paneli): Türkçe / English". The Proteus pane is unaffected.
5. **Messages window.**
   - Render `build.mc` (K-F5) as a table with columns Satır · Mesaj No. · Mesaj Metni · Birim (EN: Line · Message No. · Message Text · Unit), plus a type icon (error ⛔, warning ⚠, hint ℹ, diagnostics none).
   - Filter checkboxes: Hatalar / Uyarılar / İpuçları.
   - Double-click jumps to the line (today's single-click also stays).
   - Fallback when `mc` is absent: today's log.
   - Also render core warnings (K-F1 `onWarn`) and `runner.warnings()` in the Proteus pane's message indicator / Simulation Log list, formatted `[<mod>] PC=0x<4 hex>. <text> [<partId>]`.
6. **Output files.** After each successful build, generate the `.lst` from `build.debug` + `PIC.disasm(...,{style:'mikroc'})` in [MCR] format (header lines, `;Address Opcode ASM`, `;<file>.c,<line> :: <src>` before the first address of each line) and POST it to `/api/output`. Also generate the `.asm` (same, without the address/opcode columns) and the `.log` (EN G-MSG lines, `type: line no text unit`). Feature-detect the endpoint.
7. **Project Settings panel (M4).** Make it a docked panel or tab: Aygıt P16F628A (read-only), MCU Saati [MHz] (text `4.000000`; allowed 0.032–20), Derleme/Hata ayıklayıcı türü: Release (ICD disabled with tooltip). Library Manager is a checkbox list from `/api/libs` (or the existing Kütüphane tab data); for now it displays the auto-detected set as checked and read-only, with the note "EELAB kullanılan kütüphaneleri otomatik bağlar".
8. **Watch Values (M5).**
   - Columns İsim · Değer · Adres (EN Name · Value · Address).
   - "Listeden değişken seç" dropdown from `debug.symbols` + Ekle, plus the free-text "Assembly adına göre ara" field.
   - Buttons Kaldır / Tümünü Ekle / Tümünü Kaldır.
   - Changed value red.
   - Double-click opens Değer Düzenle with formats Dec/Hex/Bin/Char/Float and an İşaretli checkbox. Keep persistence of watches.
9. **Stopwatch (M6).** Fields Çevrim / Zaman / Delta and an editable Saat (MHz) that only recomputes the display.
10. **Glue.**
    - Pass `props` and `onWarn` to `PICM.create`.
    - On Edit Component OK (`ED.onEditPart`), call `core.setProps({wdtPeriod, eeWriteDelay})`.
    - Bind `ISIS` `debugCmd`/`animOptions` (Animation Options dialog: Frames per Second 20, Timestep per Frame 50ms, Single Step Time 50ms, Show Logic State of Pins? Yes, Show Wire Voltage by Colour? No; persist in circuit settings), and Reset Persistent Model Data → `core.resetPersistent()`.
    - Call `core.setMclr(runner.pinLevel(picId, 4) === 0 ? 0 : 1)` on each port solve.
    - Paused-only popups: PIC CPU Registers (top line = `PIC.disasm` of the instruction at PC, then W, STATUS, PCL, PCLATH, FSR, INTCON, OPTION, TRISA/B, PORTA/B), Data Memory (hex grid 0x000–0x1FF), Program Memory (disasm list), EPROM Memory (128 bytes). Reuse debug.js renderers where possible; hide them while running.
11. **C16 clock (D4).** Implement the setting `clockLink: true|false` (default true = today). When false, the PIC part `clock` field drives the core and the runner, the project MCU clock drives only the compiler, and a mismatch shows a yellow banner "Uyarı: Proteus saat frekansı (X) ≠ mikroC proje saati (Y)".

**Tests (`tests/keys_test.js`, `tests/i18n_test.js`, plus additions to `ide_test.js`/`debug_test.js` that do not change existing expectations):**
- [ ] `KEYS.match` maps every M1 key, accepts Ctrl or ⌘, and the old aliases still resolve.
- [ ] `I18N.t('usedRom', [430, 21, 1618, 79], 'en') === 'Used ROM (program words): 430 (21%)  Free ROM (program words): 1618 (79%)'`.
- [ ] `I18N.t('finishedOk', [new Date(2025,5,26,10,31,51)], 'en') === 'Finished successfully: 26 Jun 2025, 10:31:51'`.
- [ ] TR date for 2025-10-15 12:23:41 is `15 Eki 2025, 12:23:41`.
- [ ] The `.lst` generator on the Task2 build produces a first data row matching `/^0x0000\t0x[0-9A-F]{4}\s+\tGOTO\s+\d+$/`.
- [ ] The existing `debug_test.js` 100 605 assertion is unchanged (legacy mode).

**Done:** all checked, a manual browser checklist appended to the WS-3 commit message (not to `tests/e2e/TARAYICI_KONTROL.md`, which WS-5 owns), `bash tests/run_all.sh` passes with 0 failures.

### 4.4 WS-4 — Build, shim and files (`server.py`, `shim/**`)

Goal: exact mikroC library timing behind `libModel:'mikroc'` (L1–L4), conversions (L6), mikroC-style messages (L9, K-F5), `.mcppi` import/export (F1) and output files (F2). **`'eelab'` mode must stay byte-identical**, so all 11 GOLDEN md5s stay unchanged.

**Steps:**
1. **Settings.** Add `libModel` and `ui` to `_clean_setting` (server.py:137) and the `LIB_MODEL_DEFAULT = 'eelab'` constant. `build()` reads the per-file `libModel`.
2. **Exact delays (only when `libModel == 'mikroc'`).**
   - In `convert()`, find `Delay_ms(<expr>)`, `Delay_us(<expr>)` and `Delay_Cyc(<expr>)` where `<expr>` is an integer literal or a simple constant arithmetic expression (evaluate with a safe `ast` walk: numbers and `+ - * / //` only).
   - Replace each with `MC_DLY_<n>();` and generate, in the same translation unit, one `static void` function per distinct cycle count: an inline `__asm` block using **shared-bank counters `mc_r11..mc_r13` placed at `__at(0x7D..0x7F)`** (no BANKSEL, so cycle math is exact; check with the .map that SDCC doesn't use 0x7D-0x7F, otherwise choose free shared bytes and assert in the build).
   - Python `delay_plan(cycles)` returns the counter values plus NOP padding, so that call + body + return = `cycles` **exactly**, with 2-cycle CALL and RETURN included. If you inline instead of calling, document it.
   - Use mikroC's pattern: 1, 2 or 3 nested `DECFSZ/GOTO` loops, then NOP pad.
   - Units: `Delay_ms(n)` → `round(n·fosc/4000)` cycles, `Delay_us(n)` → `round(n·fosc/4e6)`, `Delay_Cyc(n)` → `10·n` (error `Argument is out of range` if n < 3 or n > 255).
   - Non-constant arguments → `Vdelay_ms` runtime (today's `mc_delay_ms`).
   - **Unit tests in `tests/server_test.py`:** `delay_plan(c)` simulated by a tiny Python cycle counter equals `c` for c ∈ {5, 10, 50, 1000, 10000, 100000, 1000000, 5000000}, and for 100000 @4 MHz, R12=130, R13=221 is a valid plan (informational, not required).
3. **Lcd (mikroc mode).** Implement a `MC_EXACT` branch in `mikroc_lib.c`:
   - Init: 3 × 5.5 ms, nibble 3 with 5.5 ms each ×3, nibble 2, `0x28`, `0x08`, `0x01`, `0x06`, `0x0F`. Keep the same tail as today since the real tail is UNVERIFIED.
   - EN pulse = EN high, 1 µs, EN low.
   - After a command byte 5.5 ms, after a data byte 50 µs.
   - Delays use the exact generator (constant cycles).
4. **UART.**
   - In convert() (both modes, no HEX change, messages only), compute baud error for constant `UART1_Init(b)` and add an `mc` message per G-BAUD.
   - Out-of-range (SPBRG > 255 even with BRGH=0) → error `Cannot establish this baud rate at <MHz> MHz clock` (no 0; use type error, no. 0, key `'raw'`).
5. **Conversions (L6):** `LongToStr`, `LongWordToStr`, `ByteToHex`, `ShortToHex`, `WordToHex`, `IntToHex`, `ByteToStrWithZeros`, `ShortToStrWithZeros`, `WordToStrWithZeros`, `IntToStrWithZeros`, with widths per [MCH] and G-CONV. Add them to `LIBS` (server.py ~313) and `lib_uses`. Unused functions must not be linked (same `MC_USE_*` mechanism), so GOLDEN is unchanged.
6. **Messages (K-F5).**
   - Build the `mc` array: on success the G-MSG rows (RAM/ROM from `_map_info`); on failure the mapped errors (G-ERR) plus `finishedErr`. Unit = file name / `<base>.mcppi`.
   - Hint 1163 for unused globals is optional.
   - `messages` and `diag` stay as today.
7. **`.mcppi`.** Implement `/api/import-mcppi` and `/api/export-mcppi` exactly per K-F5/F1. Fixture `tests/fixtures/mikroc/Lab_5.mcppi`: write it yourself, matching the F1 sections, not downloaded. Round-trip test: export Task1.c → zip contains `Task1.mcppi` with `[DEVICE]\nName=P16F628A\nClock=4000000`; import that zip's `.mcppi` + `.c` → `fosc == 4000000`.
8. **`/api/output`** per K-F5. Reject other kinds, path traversal, and missing sources.
9. **Keypad / EEPROM_Write verification (L5/L7).** Do NOT change behaviour without evidence. Add `tests/fixtures/mikroc/README.md` listing what a lab PC with real mikroC should produce (`Keypad_Demo` .lst; `EEPROM_Write` .lst), so the user can supply real listings later.
10. **`tests/shim_timing_test.js`.** Uses `require('../js/pic.js')` and builds via `server.build` through a child `python3 -c` call or a small HTTP server like the e2e helper. Asserts G-DLY, G-DLY-TASK1 (prints the measured exact-mode value) and G-LCD in mikroc mode, and that `'eelab'` mode Task1 still gives 100 605.

**Done:**
- [ ] `python3 tests/build_test.py` shows all 11 md5 `=` (unchanged).
- [ ] New server_test cases pass.
- [ ] `node tests/shim_timing_test.js` passes and prints the exact-mode Task1 period.
- [ ] `bash tests/run_all.sh` passes with 0 failures.
- [ ] The WS-4 final report lists the md5s each of the 11 projects would get in mikroc mode (for D2).

### 4.5 WS-5 — Integration (after WS-1..4 report done)

1. Run `bash tests/run_all.sh` and fix integration glitches with minimal patches (note each in `SPEC.md` Faz 4).
2. Apply the user's decisions D1–D5 (§5). For D2 = A:
   - Set `LIB_MODEL_DEFAULT='mikroc'`.
   - Update `server.GOLDEN`, `packaging/selftest/golden.json` and `EELAB_PLAN.md` Ek B with the WS-4-reported md5s for the 9 affected files.
   - Update the `debug_test.js` 100 605 expectation to the measured value. This is the only allowed edit of another WS's test, and only under D2 = A.
   - Keep the frozen `projeler/Task1.hex`/`Task2.hex` untouched.
3. Update `KULLANIM.md` (new keys table TR, TR/EN toggle, Proteus mouse/keys), `tests/e2e/TARAYICI_KONTROL.md` (manual checks for P1–P9, M1, M3, P16), and `EELAB_PLAN.md` status.

---

## 5a. DECISIONS TAKEN (user, 2026-11-12) — binding for all workstreams

| # | Decision |
|---|---|
| D1 | **A** — mikroC pane Turkish by default + "Türkçe / English" toggle in Araçlar › Seçenekler (mikroC pane only; Proteus pane always English). |
| D2 | **B** — `libModel:'mikroc'` (exact mikroC Delay_ms/LCD timing) is the default ONLY for newly created files (`/api/new`) and templates. Existing/shipped example files (projeler, Ornekler, migrated user files, Task1/Task2) keep `libModel:'eelab'` → all GOLDEN md5 baselines stay unchanged. A file with no `libModel` setting = `eelab`. Per-file setting is visible/changeable in the Edit Project dialog ("mikroC tam zamanlama"). |
| D3 | **A** — Proteus EEPROM model: 10 ms write, contents persist across runs until Debug › Reset Persistent Model Data. |
| D4 | **A** — separate Proteus "Processor Clock Frequency" (part property) and mikroC project clock, with a mismatch warning banner; new PIC parts default to the project clock. |
| D5 | **A** (default) — real keys + old aliases + KULLANIM note. |

## 5. Decisions needed from the user (original options)

| # | Question | Options (recommendation first) | Consequence |
|---|---|---|---|
| **D1** | mikroC pane language | **A (rec.)**: Turkish default + Araçlar › Seçenekler toggle "Türkçe / English" (mikroC pane only; Proteus pane always English). B: English default (real mikroC is English-only [MCM]). C: Turkish only. | A/B: WS-3 builds i18n either way; only the default differs. |
| **D2** | Exact mikroC delays/LCD timing (`libModel:'mikroc'`) as default? | **A (rec.)**: yes for all files, so Delay_ms(100) = exactly 100 000 cycles like real mikroC. B: only for new files and templates; the shipped examples stay on `eelab`. C: keep `eelab` default and expose it as a per-project option ("mikroC tam zamanlama"). | **A changes 9 of 11 GOLDEN md5s**: Task1, Task2, Lab1_LedSwitch, Lcd_Demo, Keypad_Demo, Mux4_Demo, Pwm_Demo, Uart_Demo, Eeprom_Demo (all use Delay_ms/Lcd). Unchanged: `Lab2.hex` (asm) and `Timer0_Interrupt.hex` (no delay call). Task1's breakpoint stopwatch changes from 100 605 to roughly 100 0xx (WS-4 measures it). The frozen repo files `projeler/Task1.hex`/`Task2.hex` and `core_test` are **not** affected. B: GOLDEN unchanged for examples; templates change. C: no baseline change. |
| **D3** | EEPROM model defaults | **A (rec.)**: Proteus defaults: 10 ms write, contents persist across runs until Debug › Reset Persistent Model Data. B: datasheet typical: 4 ms, reset each run (today). | A is what students see in Proteus. It may change e2e EEPROM timing expectations, which WS-5 then adjusts. |
| **D4** | Proteus clock vs mikroC clock | **A (rec.)**: two separate values as in the real tools, with a mismatch warning banner. New PIC parts default to the project clock rather than Proteus's 1 MHz, so first runs are not 4–20× slow. B: fully Proteus: new part = 1 MHz. C: keep linked (today). | A/B teach the real "Processor Clock Frequency" step from the lab sheets. B reproduces the classic mistake by default. |
| **D5** | Keys on macOS | **A (rec.)**: real mikroC/Proteus keys + old aliases (K-F4) + a note in KULLANIM that ^F2/^F8 may be captured by macOS keyboard-navigation shortcuts (then use ⌘. / ⇧F8). B: also add a "Mac F-key mode" that uses ⌥ instead of Ctrl. | No baseline impact. |

Also open, needing data the user can supply from a lab PC with real mikroC and Proteus (not decisions):
- the mikroC `.lst` of a Keypad and an EEPROM_Write program (L5/L7);
- one Proteus simulation-log screenshot with an LCD busy warning (C18);
- whether a floating MCLR resets in Proteus (C5).

---

## 6. Out of scope (Phase 4)

- Proteus sub-sheets, buses, 2D graphics modes, the P10 snap grid.
- Proteus PCB, Graph-based simulation, SPICE analog.
- mikroICD.
- `.cof` output (EELAB keeps its own debug map).
- Writing `.pdsprj` (closed format, see EELAB_PLAN).
- Copying Labcenter/MikroElektronika artwork or product banners.
