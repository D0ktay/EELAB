# EELAB

A code + circuit lab for the PIC16F628A on macOS. EELAB compiles mikroC-compatible C and MPASM-compatible assembly, then runs the resulting HEX on a simulated PIC inside a schematic editor modelled on Proteus 8 Schematic Capture. It was built for a microprocessors course (EE321), so that the lab exercises can be done on a Mac without the Windows-only tools.

Everything runs locally: a small Python server (`server.py`) plus a single-page interface (`index.html`, `js/`) that opens in your browser. No internet connection is needed while it runs.

> EELAB is an independent project. It is not affiliated with, endorsed by, or derived from the code of Labcenter Electronics (Proteus) or MikroElektronika (mikroC). Those names are used only to describe compatibility.

## What it does

- **Code pane.** C (mikroC dialect) and assembly (MPASM dialect) editor with the mikroC PRO for PIC key bindings, code completion, a messages table, config-bit dialog, and a Turkish/English interface switch.
- **Compiler.** A bundled SDCC + gputils toolchain behind a shim that provides the mikroC libraries: `Delay_ms/us`, `Button`, `Lcd_*`, `Keypad_*`, `UART1_*`, `PWM1_*`, `EEPROM_Read/Write`, the `*ToStr` conversions, `sbit … at …`, bit access such as `PORTB.B0`, and `void interrupt()`.
- **Circuit pane.** Schematic editor with a parts library (LEDs, buttons, 7-segment displays, 7448, 74HC595, L293D, relays, LM016L and 20x4 LCDs, keypad, virtual terminal, potentiometer, voltmeter and more), wiring, net labels and multi-select.
- **Simulation.** A PIC16F628A core with timers, interrupts, comparator, USART, PWM, EEPROM, watchdog and reset behaviour, running at adjustable speed, with an oscilloscope and a logic analyser.
- **Debugger.** Breakpoints, single stepping, watch list, stopwatch and live register view.
- **Proteus import.** Reads the wiring out of `.pdsprj` project files (`pdsprj.py`, format notes in `docs/pdsprj-format.md`).
- **Export.** Schematic to SVG/PNG, and a zip "submission package" with the source, HEX and circuit.

## Install

Requirements: macOS 11 (Big Sur) or later, Intel or Apple Silicon. Xcode, Python and Homebrew are not required; the app bundles its own Python and toolchain.

EELAB is not notarized, so macOS blocks it on first launch. The installer script removes the quarantine flag for you:

```bash
bash /Volumes/EELAB/kur.sh
```

Run that after opening the DMG. It copies `EELAB.app` to `/Applications`, clears quarantine, verifies the signature and opens the app. Your projects in `~/Documents/EELAB` are left alone. To remove the app, run `bash /Volumes/EELAB/kaldir.sh`.

If you would rather install by hand, drag `EELAB.app` to Applications and then run:

```bash
xattr -dr com.apple.quarantine /Applications/EELAB.app
open /Applications/EELAB.app
```

The app opens `http://127.0.0.1:8321/` in your default browser (ports 8322 to 8399 are tried if 8321 is busy) and creates `~/Documents/EELAB/{Projelerim, Ornekler, Teslim}` for your projects, the bundled examples and submission packages.

The builds so far were produced and tested on an Intel Mac. The app and compilers are universal binaries, but the arm64 slices have only been checked statically. On Apple Silicon, open **EELAB › Tanılama** (Diagnostics) after installing: the compiler mode should read "yerel" (native) or "Rosetta 2", and the sample builds should pass their md5 check.

## Run from source

You need Python 3.9 or later. The toolchain in `toolchain/` is used as is.

```bash
python3 server.py                      # opens the browser on port 8321
python3 server.py --no-open --port 0   # any free port, no browser

# keep test data apart from your real projects
EELAB_HOME=/tmp/eelab EELAB_STATE_DIR=/tmp/eelab-state python3 server.py
```

## Tests

```bash
tests/run_all.sh             # unit, integration and end-to-end tests
tests/run_all.sh --no-e2e    # skip the end-to-end tests
tests/run_all.sh --package   # also check a built dist/EELAB.app
```

The tests need `python3` and `node`. Run them from a git checkout; one end-to-end check uses `git status` to confirm the server never writes into the source tree.

## Build the app

```bash
packaging/fetch_python.sh       # download and verify the bundled CPython
packaging/build_app.sh          # dist/EELAB.app
packaging/make_dmg.sh           # dist/EELAB-<version>.dmg and .zip
```

`packaging/build_toolchain.sh` rebuilds SDCC and gputils from source as universal binaries. Versions and checksums are pinned in `packaging/versions.json`.

## Repository layout

| Path | Contents |
|---|---|
| `server.py`, `eelab_paths.py` | Local server: build, workspaces, export, diagnostics |
| `index.html`, `js/` | Interface: editor, debugger, schematic editor, simulator core, instruments |
| `shim/` | mikroC compatibility layer compiled alongside user code |
| `toolchain/` | Bundled SDCC 4.5.0 and gputils 1.5.2 binaries, headers and libraries |
| `templates/`, `circuits/`, `projeler/` | New-file templates, example circuits, example programs |
| `pdsprj.py` | Proteus `.pdsprj` wiring decoder |
| `packaging/` | App launcher, installer scripts, DMG build, third-party licences |
| `tests/` | Test suites and fixtures |
| `docs/` | Notes on the `.pdsprj` format and the Proteus interface |

## Further documentation

The detailed guides are written in Turkish:

- [`KURULUM.md`](KURULUM.md): installation, updating, uninstalling, troubleshooting
- [`KULLANIM.md`](KULLANIM.md): full user guide (editor, simulation, debugger, schematic editor, instruments, import and export)
- [`SPEC.md`](SPEC.md), [`EELAB_PLAN.md`](EELAB_PLAN.md), [`FIDELITY_PLAN.md`](FIDELITY_PLAN.md): design contracts and the plans the app was built from

## Third-party software

EELAB bundles the following, unmodified and only recompiled. Licence texts are in `packaging/LICENSES/`, and source locations are listed in `packaging/LICENSES/KAYNAKLAR.txt`.

- SDCC 4.5.0, GNU GPL v2. Code generated by SDCC is not covered by the GPL.
- gputils 1.5.2, GNU GPL v2
- Boost 1.86.0 headers (build time only), Boost Software License 1.0
- CPython 3.12 from python-build-standalone, PSF License (app bundle only)

The PIC device header and library under `toolchain/nonfree/` and `toolchain/lib/` carry their own licence terms in the file headers.
