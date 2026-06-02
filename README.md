# NAD T748 Control

A small Windows app to control a **NAD T748 / T748 V2** A/V receiver over its
RS-232 serial port (via a USB-to-RS232 adapter), so you rarely need the on-screen
menu (TV). It is a headless replacement for the OSD for everything the receiver's
RS-232 protocol exposes.

- **Electron + React + Vite + TypeScript.** The Electron main process owns the
  serial port; the UI talks to it over IPC.
- Ships as a single **portable `.exe`** (Windows x64) — no install needed.
- **Volume safety is enforced in the main process and cannot be bypassed by the UI.**

> Serial settings: **115200 baud, 8 data bits, 1 stop bit, no parity, no flow
> control.** Commands are ASCII, terminated with `\r`.

---

## For the end user (running the app)

1. **Plug in the adapter.** Connect the USB-to-RS232 adapter to the receiver's
   **RS-232** port and to a USB port on the PC. Power on the receiver.
2. **Find the COM port.** Open **Device Manager → Ports (COM & LPT)** and note the
   adapter's port (e.g. `COM3`).
3. **Run the app.** Double-click `nad-t748-control-<version>-portable.exe`
   (on the Desktop). No install.
4. **Connection Test tab.** Pick the COM port, click **Connect**, then **Run
   standard queries**. You should see replies like `Main.Model=...`,
   `Main.Power=On`, and the current `Main.Volume=<dB>`.
   - If nothing comes back, check the port, the cable, and that the receiver is
     on. The **Serial Log** tab shows the raw traffic — copy it if you need help.
5. **Set the volume cap (required).** Go to **Settings** and set
   **`MAX_VOLUME_DB`** to a safe upper limit. Use the current volume shown in the
   Connection Test to choose it. **Volume control stays locked until you set this.**
   Remember: louder = higher dB, so the cap is the *upper* bound (e.g. `-20`).
6. **(Optional) Probe capabilities.** In Connection Test, click **Probe
   capabilities**. The app asks the receiver about every variable and greys out the
   ones this unit doesn't answer.
7. **Use the Controls tab.** Power, source, listening mode, tuner, speakers, etc.
   The **OSD-only (TV)** tab lists settings the protocol can't reach.

### Volume safety, briefly
- The app can **never** command a volume above `MAX_VOLUME_DB`.
- It **never raises** volume on its own (startup, reconnect, source change).
- Single changes larger than `MAX_STEP_DB` (default 5 dB) are rejected.
- `WARN_VOLUME_DB` (optional) asks for a confirm above that level.
- `VOLUME_WATCHDOG` (default **off**) will keep pulling the volume back down to
  the cap — **this overrides the physical remote**, so leave it off unless you
  want that.

---

## For the builder (producing the `.exe`) — Windows PowerShell

> Build and run on **Windows**, not WSL. The COM port is a Windows resource and
> `serialport` is a native module needing Windows binaries. **No receiver is
> needed to build.**

1. **Install Node for Windows** (LTS, x64) from <https://nodejs.org>. Verify:
   ```powershell
   node -v
   npm -v
   ```
2. **Install dependencies** (from the project folder `C:\Users\sturm\nad-t748`):
   ```powershell
   npm install
   ```
3. **Run the volume-safety unit tests** (recommended):
   ```powershell
   npm test
   ```
4. **Develop / run locally** (optional):
   ```powershell
   npm run dev
   ```
5. **Build the portable `.exe`:**
   ```powershell
   npm run package
   ```
   The portable executable is written to `dist\nad-t748-control-<version>-portable.exe`.
6. **Copy it to the Desktop:**
   ```powershell
   Copy-Item .\dist\nad-t748-control-*-portable.exe "$env:USERPROFILE\Desktop\"
   ```

### Phase 0 — standalone serial probe (optional, needs the receiver)
A tiny CLI that lists ports and runs the four standard queries:
```powershell
npm run probe                 # list serial ports only
npm run probe -- COM3         # open COM3 and query Model/Power/Version/Volume
```
Report the COM port and the four replies; the `Main.Volume` value is what you use
to pick `MAX_VOLUME_DB`.

---

## Protocol coverage

Commands are the NAD **TXX7 V2.x ASCII** protocol family, the set validated
against the **T748v2** by the open-source
[`joopert/nad_receiver`](https://github.com/joopert/nad_receiver) library:

| Group | Variables |
|-------|-----------|
| Main  | `Main.Power`, `Main.Volume`, `Main.Mute`, `Main.Source` (1–12), `Main.ListeningMode`, `Main.Dimmer`, `Main.Sleep`, `Main.SpeakerA`, `Main.SpeakerB`, `Main.Tape1` |
| Info  | `Main.Model`, `Main.Version` (read-only) |
| Tuner | `Tuner.Band`, `Tuner.FM.Frequency`, `Tuner.FM.Preset`, `Tuner.FM.Mute`, `Tuner.AM.Frequency`, `Tuner.AM.Preset` |
| Advanced | `Main.IR` (send raw remote IR code) |

Operators: `?` query · `=` set · `+` increment · `-` decrement. `Main.ListeningMode`,
`Main.Sleep` and the tuner frequencies expose **step only** (`+`/`-`), so they are
shown as next/previous controls with no live read-back.

The actual supported set on a given unit = what the protocol defines **and** what
the device answers (determined at runtime by the capability probe). Settings the
protocol does **not** expose (speaker calibration, tone controls, zone/video setup,
…) are listed in the **OSD-only (TV)** tab — never faked or silently omitted.

---

## Project layout

```
src/
  shared/        commands.ts (protocol table), volumeGuard.ts (safety logic), types.ts, ipc.ts
  main/          index.ts (window + IPC), serialService.ts (port + queue), volumeController.ts, configStore.ts
  preload/       index.ts (contextBridge -> window.nad)
  renderer/      React UI (App + components)
scripts/probe.ts Phase 0 standalone serial probe
test/            volumeGuard.test.ts (safety unit tests)
```

Config (COM port, volume-safety settings) is stored in
`%APPDATA%\nad-t748-control\nad-t748-config.json`.
