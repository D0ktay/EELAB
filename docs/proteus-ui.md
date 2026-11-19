# Proteus 8 "Schematic Capture" UI — findings used for the right-hand pane

Research notes (2026-11-11) behind the Proteus-style look of the EELAB circuit pane. Colours marked *measured* were sampled from Proteus 8.10 screenshots (PNG exact, JPEG ±2 per channel) and from Labcenter's own 2019 Getting Started Guide; they are what Proteus draws, not documented constants. Items marked *unverified* come from memory or forum snippets only. No Labcenter icons or logos are copied — EELAB draws its own simple SVG icons.

## Canvas colours (Template › Set Design Colours → "Edit Design Defaults")

| Item | Proteus default | EELAB |
|---|---|---|
| Paper (inside and outside the sheet) | `#E0E0D0` *measured* | `--paper` / `LIB.colors.paper` |
| Grid | `#000000` drawn faint → `#BDBDAF` on paper; Proteus 8 defaults to a **line** grid, **G** cycles lines / dots / off | same; `G` cycles |
| Sheet border ("World Box") | `#0000C0` | `LIB.colors.sheet` |
| Work-area box / Overview visible-area box | `#00C000` | Overview rectangle |
| Wire, junction dot, terminals | `#004000` | `LIB.colors.wire` |
| Component outline and pin lines | `#800000` | `LIB.colors.edge` |
| Component body fill | `#C8C8AA` (khaki) | `LIB.colors.body` |
| Part reference / value / pin text | `#000000`, Default Font = **Arial** | Arial, `#000` |
| Highlight (selected/tagged) | `#FF0000` | selected parts and wires drawn red |
| Logic '1' / '0' / '?' pin squares | `#FF4040` / `#4040FF` / `#808080` | `hi` / `lo` / `z` |
| Hover | object under the mouse gets a dashed outline ("twitch") | dashed grey outline |

## Window layout

- Title: `<project> - Proteus 8 Professional - Schematic Capture`; tabs "Home Page", "Schematic Capture", "PCB Layout". EELAB: `<design> - EELAB - Schematic Capture`, one "Schematic Capture" tab.
- Menu bar: **File Edit View Tool Design Graph Debug Library Template System Help**.
- Chrome is light blue (`#E1EBF0` / `#E9F3F8`); toolbar band `#E2F0F8 → #DCEDF7`; tab text `#224B6A`; selected mode icon background ≈`#ADCCDE`.
- Top toolbar groups: file (New/Open/Save/Close…), view (Refresh, Grid, False Origin, Pan, Zoom In, Zoom Out, Zoom to view entire sheet, Zoom to Area), edit (Undo, Redo, Cut, Copy, Paste, Block Copy/Move/Rotate/Delete, Pick parts, Make Device, Packaging Tool, Decompose), design (Wire Autorouter, Search & Tag, Property Assignment Tool, New/Remove Sheet, Exit to Parent, ERC).
- Left mode toolbar (22 icons, top to bottom): Selection, Component, Junction Dot, Wire Label (“LBL”), Text Script, Buses, Subcircuit, Terminals, Device Pins, Graph, Active Popup, Generator, Probe, Virtual Instruments, 2D Graphics Line / Box / Circle / Arc / Closed Path / Text / Symbols / Markers. EELAB implements Selection, Component, Wire Label, Terminals, Probe and Virtual Instruments; the rest are drawn greyed with a tooltip.
- Overview window (mini-map) above the Object Selector: paper colour, sheet outline `#0000C0`, visible area `#00C000`.
- Object Selector: blue **P** (Pick from libraries) and **L** (Library manager) buttons (`#004CD9`, white letters), a title that follows the mode (DEVICES, TERMINALS, INSTRUMENTS, PROBES…), white list, selected row `#0078D7`. Terminals list: DEFAULT, INPUT, OUTPUT, BIDIR, POWER, GROUND, CHASSIS, DYNAMIC, BUS, NC. Instruments: OSCILLOSCOPE, LOGIC ANALYSER, COUNTER TIMER, VIRTUAL TERMINAL, SPI/I2C DEBUGGER, SIGNAL/PATTERN GENERATOR, DC/AC VOLTMETER/AMMETER, WATTMETER.
- Rotate clockwise / anti-clockwise, angle box, X-Mirror, Y-Mirror: blue normally, **red when an object is tagged** (8.10 puts them in a narrow column top-left; Proteus 7 had them bottom-left — EELAB keeps them under the Object Selector).
- Bottom bar: animation control panel **Play / Step / Pause / Stop** (blue ≈`#0040DA`), message indicator (grey "i" **No Messages**, green "i" **N Message(s)**, red ⊗ **N Error(s)** — click opens the simulation log), hint field (**Root sheet 1**), coordinates `x:   -500.0  y:   +3600.0` and the unit **th** (thou). While simulating the bar shows simulation time and CPU load (`ANIMATING: … (CPU load N%)`; the exact format is *unverified*).

## Dialogs

- **Pick Devices**: Keywords, *Match whole words?*, *Show only parts with models?*, Category (starts with "(All Categories)"), Sub-category, Manufacturer; Results table **Device | Library | Description**; Preview (khaki) with a model label such as "No Simulator Model" / "VSM DLL Model [PIC16]"; OK / Cancel. Category names used in EELAB are a subset of Proteus's: Analog ICs, Capacitors, Debugging Tools, Electromechanical, Microprocessor ICs, Miscellaneous, Optoelectronics, Resistors, Speakers & Sounders, Switches & Relays, Transistors, TTL 74 series, TTL 74HC series.
- **Edit Component** (PIC): Part Reference, Part Value, Element, PCB Package, Program File, Processor Clock Frequency, Program Configuration Word, Advanced Properties, Exclude from Simulation / PCB Layout / Bill of Materials. EELAB shows Part Reference, Part Value, Device, and for the PIC Program File, Processor Clock Frequency (4/8/20 MHz, linked to Fosc) and Program Configuration Word. Terminals use "Edit Terminal Label" with a *String* field.
- **Component context menu** (8.10): Drag Object, Edit Properties, Delete Object | Rotate Clockwise, Rotate Anti-Clockwise, Rotate 180 degrees, X-Mirror, Y-Mirror | Cut To Clipboard, Copy To Clipboard | Goto Child Sheet, … Display Model Help, Display Datasheet … Make Device, Packaging Tool, Decompose. Unavailable items are greyed.

## Live simulation and instruments

- Pin logic-state squares: blue = 0, red = 1, grey = floating (System › Set Animation Options → "Animated Circuit Configuration", "Show Logic State of Pins?"). Wire voltage colouring and current arrows exist but are off by default.
- Oscilloscope ("Digital Oscilloscope"): channels A–D, sections Horizontal, Trigger (Auto / One-Shot), Channel A–D, Cursors; dark screen, A yellow, B cyan/blue, C red, D green (*colours unverified*). Logic Analyser ("VSM Logic Analyser"): black trace area, green traces, Capture button, Cursors. Virtual Terminal: RXD/TXD/RTS/CTS, 300–57 600 baud.
- Message wording: "Simulation is not running in real time due to excessive CPU load.", "Logic contention(s) detected on net …", "Simulation FAILED due to …".

## Sources

- Labcenter, *Proteus Design Suite Getting Started Guide* (2019): https://tams.informatik.uni-hamburg.de/lectures/2022ss/vorlesung/es/doc/ProteusTutorials.pdf
- Proteus 8 help (mirror; use http): http://systembus.com/proteus/ — ISIS/GENERAL_CONCEPTS/Screen_Layout.htm, Co-ordinate_Display.htm, General_Editing_Facilities.htm; ISIS/TEMPLATES/Tutorial.htm; ISIS/OBJECT_SPECIFICS/Components.htm, Terminals.htm, Dots.htm; ISIS/ICON_REFERENCE_CHART/Icon_Reference_Chart.htm; LISA/INTERACTIVE_SIMULATION/Basic_Skills.htm, Taking_measurements.htm, Animation_Timestep_Control.htm; LISA/MICROPROCESSORS/Diagnostics.htm; Instruments/Oscilloscope/Oscilloscope.htm, Logic_Analyser/Logic_Analyser.htm, Virtual_Terminal/Virtual_Terminal.htm; PIC16/Properties.htm, PIC16/Warning_Messages.htm; pds/Application_Framework.htm
- ISIS 6 manual (2002, comparison): https://hobbielektronika.hu/forum/getfile.php?id=172924
- Proteus 8.10 screenshots (Çankaya Univ.): https://mece223.cankaya.edu.tr/uploads/files//Proteus_Tutorial.pdf
- Mustansiriyah lectures: https://uomustansiriyah.edu.iq/media/lectures/5/5_2023_02_19!09_23_42_PM.pdf, https://uomustansiriyah.edu.iq/media/lectures/5/5_2020_05_10!12_58_10_AM.pdf
- UPC digital systems: https://digsys.upc.edu/csd/units/Proteus/Proteus.html
- JUST lab guide: https://sanadaltaher.me/assets/pdf/GettingStartedwithProteus8.pdf
- Mode/selector names: https://hendrysose.blogspot.com/2017/09/menu-bagian-isis-proteus-dan-fungsinya.html, https://steemit.com/science/@kagantrky/proteus-shematic-capture-or-mode-descriptions-part-1, https://www.slideshare.net/slideshow/introduction-to-proteus/39460910, https://www.cnblogs.com/SharkJiao/articles/11352613.html
- Messages: https://forum.allaboutcircuits.com/threads/real-time-simulation-in-proteus.86978/, https://www.electronics-lab.com/forums/threads/simulation-is-not-running-in-real-time-due-to-excessive-cpu-load.279083/, https://ccsinfo.com/forum/viewtopic.php?p=199711, https://www.edaboard.com/threads/pic16f76-and-lcd-in-ccs-not-run-in-isis-proteus.282340/
- https://en.wikipedia.org/wiki/Proteus_Design_Suite

## Phase 4 behaviour (WS-2, 2026-11-12)

What the right-hand pane does after `FIDELITY_PLAN.md` §4.2. Sources: [PH] = Proteus 8 help mirror (systembus.com/proteus), [GSG] = Labcenter Getting Started Guide, [DSN] = course `ROOT.DSN`, [DS] = Microchip DS40044G. Items marked *unverified* are implemented but the exact Proteus wording or key is not confirmed.

### Mouse

| Action | Behaviour | Source |
|---|---|---|
| Wheel | Zooms about the pointer (unchanged). Trackpad two-finger scroll pans. | [PH Screen_Layout] |
| Shift + left-drag on empty canvas | Draws a dashed box and zooms to it on release (aspect ratio kept, 4 % margin, boxes smaller than 5 units are ignored). Works while simulating. Shift-click on a part or wire still adds it to the selection; Ctrl/⌘ + drag on empty canvas adds a box selection. | [PH Screen_Layout] |
| Middle-drag | Pans (unchanged). | [GSG p.8] |
| Middle-click (no movement) | Toggles *track-pan*: the sheet follows the pointer, with no button held, until the next click of any button (that click is consumed). Right-click also ends it. | [GSG p.8] |
| Right-click while wiring | Removes the last anchor (one click's worth of segments); with no anchors left it cancels the wire. Backspace behaves the same, Esc cancels at once. | [PH Wiring_Up], [GSG p.42-45] |
| Ctrl/⌘ held while wiring | The next segment goes straight (diagonal) to the pointer; no Manhattan routing. | [PH Wiring_Up] |
| Right-click on the rotate buttons | `trot` (clockwise icon) right-click rotates anti-clockwise; `trotc` right-click rotates clockwise. Mirror is out of scope (no mirror in the data model). | [PH] |
| Right-click on the Virtual Terminal screen while simulating | Context menu: Clear Screen*, Pause, Copy, Paste, Hex Display Mode*, Echo Typed Characters (default off). *unverified* for the starred items. | [PH Virtual_Terminal] |

### Keyboard

EELAB's editor never registers F5–F8 itself (`FIDELITY_PLAN.md` K-F4); `js/keys.js`/`index.html` bind them to the `ED` API when the Proteus pane has focus.

| Key | API | Source |
|---|---|---|
| F6 / F7 | `ED.zoomKey('in' \| 'out', pt)`: ×1/1.25 and ×1.25, view re-centred on `pt` (last pointer position over the canvas; the view centre if none) | [PH Screen_Layout] |
| F8 | `ED.zoomKey('all')` = zoom to whole sheet (`fit()`) | [PH Screen_Layout] |
| F5 | `ED.zoomKey('centre', pt)` = re-centre on the cursor without zooming | [PH Screen_Layout] |
| Numpad `+` / `-` | Rotate anti-clockwise / clockwise while placing or with a selection (`e.code` `NumpadAdd`/`NumpadSubtract`). `R` stays (clockwise). | [GSG p.20-23] |
| Ctrl+E / ⌘E | `ED.editUnderPointer()`: Edit Component of the part under the pointer (or the single selected part) | [PH General_Editing_Facilities] |
| E | `ED.findAndEdit()`: prompt "Find and Edit Component — Reference:" then opens that part's dialog | [PH General_Editing_Facilities] |
| Ctrl+F12, Pause, Shift+Break, F10, F11, Ctrl+F11 | Shown as menu labels only; bound by WS-3 through `o.debugCmd(name)`. `Step Out Ctrl+F11` is *unverified* (constant `ISIS.STEP_OUT_KEY`). | [PH Source_Level_Debugging] |

### Menus

* View: `Toggle Grid G`, `Zoom In F6`, `Zoom Out F7`, `Zoom All F8`, `Centre At Cursor F5`.
* Debug: `Start VSM Debugging Ctrl+F12`, `Pause Animation Pause`, `Stop VSM Debugging Shift+Break`, `Step Over F10`, `Step Into F11`, `Step Out Ctrl+F11`, then `PIC CPU Registers / Data Memory / Program Memory / EPROM Memory / Source Code - <ref>`, `Watch Window`, then `Reset Persistent Model Data` (EEPROM now persists between runs; this clears it). Every item calls `o.debugCmd(name)` with `start pause stop stepOver stepInto stepOut popup:regs popup:data popup:prog popup:eeprom popup:source popup:watch resetPersistent`. Without that callback the old `run/pause/stop/step` callbacks still serve Start/Pause/Stop/Step, everything else is greyed.
* System: `Set Animation Options…` calls `o.animOptions()`; greyed if absent.
* Shortcut labels use `Ctrl+`, not `⌘`, as Proteus does; both modifiers work.
* Exported for tests: `ISIS.MENU_LABELS`, `ISIS.menuDefs(o, ED, hooks)`.

### Edit Component

Part fields live in the circuit JSON (K-F3). Defaults are not stored: a field returning to its default is deleted.

* **PIC16F628A**: *Processor Clock Frequency* (`clock`, free text via `LIB.parseEng`, 32 kHz–20 MHz; empty = project clock, D4), *Program Configuration Word* (`cfgword`, `0x0000`–`0x3FFF`, overridden by the HEX), *Advanced Properties*: *Watchdog Timer Period* (`wdtPeriod`, default `18m` [DSN]), *Data EEPROM Write Delay* (`eeDelay`, default `10m` [DSN]), *Initial contents of EEPROM* (`eeBin` file name + `eeBinB64` bytes), *Randomize Data Memory?* and *Model PIC Start-up Delays?* (fixed "No", disabled). `LIB.picProps(part, projectClockHz)` returns the numbers the core needs.
* **VIRTUAL-TERMINAL**: Baud Rate (editable list 110…57600), Data Bits 7/8, Parity NONE/EVEN/ODD, Stop Bits 1/2, Send XON/XOFF; Advanced RX/TX Polarity and RTS/CTS Polarity (Normal/Inverted) [DSN]. `LIB.termCfg(part)` normalises them.
* **LM016L / LM044L**: *Clock Frequency* (`clock`, default `250kHz` [DSN] [PH HD44780]); **7-segment** parts: *Minimum Trigger Time* (`ttrigmin`, default `1ms` [DSN]).
* `ED.onEditPart(cb)` / `o.onEditPart` fire after OK with `(part, {key: newValue})` so the glue can call `core.setProps(...)`.

### Terminal and UART

* With `js/uart.js` present, `runner.uartTx(byte, cyc, frame)` runs the byte through `UART.transfer` from the PIC frame (`frame.bitCyc`) to each attached terminal's own bit time (`fosc/4/baud`), data bits, parity, stop bits and RX/TX polarity: a baud mismatch now shows garbage. `runner.uartRx(picCfg)` is the mirror image and returns `{byte, ferr}` or `null`. Without `frame` or `UART` the old direct byte path is used.
* `termPut`: CR = new line, BS = backspace, BEL = flash (`state.bell` counter), **LF and every other code < 0x20 are ignored** [PH Virtual_Terminal].
* `runner.pinLevel(id, pin)` returns `0|1|2` (low / high / floating) for glue such as the MCLR pin (`pinLevel('U1', 4)`).

### Display timing

* **LCD busy** (C18): after each completed write the controller is busy for 40 µs (1.64 ms for Clear/Home) at the LCD `CLOCK` (scaled by 250 kHz / clock) [PH HD44780], converted to cycles with Fosc/4. A write while busy still executes and queues `Controller received command whilst busy.` / `...data whilst busy.` (wording *unverified*, constant `SIM.LCD_BUSY`) for `runner.warnings()` (`[{mod:'LM016L'|'LM044L', id, cyc, text, count?}]`, drained on read).
* **7-segment / LED minimum trigger** (C17): inside the 20 ms window an element counts as lit only if its cumulative on-time is at least `ttrigmin` (`1ms` default [DSN]). A 0.5 ms glitch does not light, a 2 ms pulse does, a multiplexed 4-digit display (5 ms slots) and PWM-driven LEDs stay visible. During the first `ttrigmin` of a run and while the simulation is not advancing (paused/stepping) the current state is shown unfiltered.
