# Claude Code Task — NAD T748 Serial Control App (Windows `.exe`)

> **No NAD T748 is connected during development** — see "Development mode" below. Build the full app now; serial verification and on-device checks happen later, on the end user's Windows PC.
> No `git push` without my review.

## Development mode — no device available (this governs the phases below)
The NAD T748 is NOT available during development; the end user (my brother, on his own Windows PC) will connect it and test later. Therefore:
- **Build the full app now without hardware.** Do not block on a live serial connection.
- **Phase 0 (serial link check)** becomes an in-app **"Connection Test"** screen the end user runs: pick the COM port, open at 115200-8N1, send `Main.Model?` / `Main.Power?` / `Main.Volume?`, show the raw replies. It is not a dev-time gate.
- **Phase 0.5 (capability discovery):** at BUILD time use only the official command list (downloadable, no device needed) to generate the UI. The empirical "which variables does this unit answer" check runs at **runtime** — on connect, the app probes each variable and greys-out/hides those that don't respond, logging raw command/response for each probe.
- **Volume safety with no current reading:** since the current volume can't be read now, **volume control stays locked until the user sets `MAX_VOLUME_DB` in settings.** On first connect the app reads and shows the current volume to help pick a safe cap. All other guard rules still apply.
- **Diagnostics:** include a visible log panel showing raw serial traffic and clear connection errors, so the brother's test yields useful data if something fails.
- **Output:** a single **portable `.exe`**, self-contained (bundles Node, Chromium and the prebuilt Windows-x64 `serialport` binary) so it runs on the brother's Windows PC with no install. **Copy the final `.exe` to the Desktop: `C:\Users\sturm\Desktop`.** Target Windows x64.

## Target & platform — read carefully
- Receiver: **NAD T748** (incl. T748 V2), connected to the PC via a **USB-to-RS232 adapter** → appears as a **Windows COM port** (e.g. `COM3`).
- Serial settings: **115200 baud, 8 data bits, 1 stop bit, no parity, no flow control**. Commands are ASCII, terminated with `\r`.
- This is a **Windows-native app. Build, run, and test on Windows (PowerShell) — NOT inside WSL.** The COM port is a Windows resource, `serialport` is a native module needing Windows binaries, and the deliverable is a Windows `.exe`. You may author files from WSL via the `/mnt/c/...` path, but `npm install`, build, run, packaging, and ALL serial testing use the **Windows** Node toolchain.
- Project: new standalone project **`nad-t748`** at `C:\Users\sturm\nad-t748` (WSL path: `/mnt/c/Users/sturm/nad-t748`). Fresh `git init`. Not linked to any other project.

## Stack
- **Electron** (main process owns the serial port via `serialport`) + **React + Vite** renderer, TypeScript throughout.
- Package to a **portable `.exe`** with **electron-builder** (`win` target, `portable`), output to `dist/`.
- (Alternative only if instructed: packaged Node + Fastify + `serialport` server that opens the UI in the browser, bundled with pkg. Default to Electron.)

## Phase 0 — Verify the serial link FIRST (on Windows; report; STOP)
Write a small standalone Node TS probe (`scripts/probe.ts`) plus the exact PowerShell commands to run it, then:
1. List serial ports (`SerialPort.list()`); identify the adapter's COM port (cross-check Device Manager → Ports (COM & LPT)).
2. Open it at 115200-8N1, no flow control.
3. Send `Main.Model?\r`, `Main.Power?\r`, `Main.Version?\r`, `Main.Volume?\r`; print raw replies (expect `Main.Model=...`, `Main.Power=On`, current `Main.Volume=<dB>`).
4. Report: COM port used + the four replies. **I need the current volume in dB to set the cap.** STOP for confirmation.

## Phase 0.5 — Capability discovery (the full setting set) — report; STOP
Goal of the app is to expose **every setting the RS-232 protocol supports**, so the OSD/TV is needed as little as possible. To do that faithfully:
1. Get the official NAD command list. NAD publishes protocol docs at https://nadelectronics.com/software (`NAD_TXX7_Protocol_Docs.zip` / `NAD_TXX5_Protocol_Docs.zip`). The T748 speaks the same V2.X ASCII protocol family — download the matching list, unzip, and parse the full `[Prefix].[Variable]` table (name, operators `?`/`=`/`+`/`-`, possible values, read-only flag).
2. **Empirically probe the T748**: query every variable from the list; the unit ignores variables it does not support, so record which actually return a value. The supported set = what the list defines AND the device answers.
3. Produce a report: the complete list of supported variables grouped logically (Main, Speaker, Source, Zone, Tuner, Tone, Trigger, Setup, ...), and a separate list of OSD-only settings the protocol does **not** expose.
4. **Honest coverage rule:** build UI for everything in the supported set. For settings that are NOT in the protocol (e.g. parts of speaker calibration), the app must clearly label them "requires on-screen menu (TV)" — never fake or silently omit them. STOP for my review of the coverage list before building the full UI.

## VOLUME SAFETY — implement this FIRST in the app (main-process enforced, non-bypassable)
- **G1:** the app can never command volume above `MAX_VOLUME_DB`. **G2:** the app never raises volume on its own (startup, reconnect, source change).
1. `MAX_VOLUME_DB` is **required before any volume control is enabled** (louder = higher dB; the cap is the upper bound). Until it is set in settings, all volume controls are locked/disabled. No silent default.
2. Clamp every absolute set to `<= MAX_VOLUME_DB`; log a warning if a request was above it.
3. Relative/step (`Main.Volume+`): read current dB first, refuse if the result would exceed the cap. Never forward `+` blindly.
4. `MAX_STEP_DB` (default 5): reject any single command whose delta from current exceeds it. Rate-limit volume commands.
5. Startup/reconnect: read and display volume; do not set it. If observed `> MAX_VOLUME_DB`, alert; auto-pull-down only if `CLAMP_ON_OBSERVED=true` (default false).
6. Optional `VOLUME_WATCHDOG` (default false): clamps back to the cap if observed above it — **document loudly that this overrides the physical remote**, hence default off.
7. UI `WARN_VOLUME_DB` (below cap): above it, require an explicit confirm tap before sending.
8. No raw "set arbitrary dB" path that bypasses the guard.
9. **Unit tests required** for the clamp/step/relative logic (above cap, at cap, below cap, negative delta, step overflow). Most safety-critical code in the app.

## App (after Phase 0 confirmation)
- Serial service in the Electron main process: connect/reconnect, send-command-and-read-response with `\r` framing, a command queue, and per-command timeouts; expose to the renderer via IPC.
- **Full coverage:** auto-generate UI controls for **every variable in the supported set** from Phase 0.5, grouped (Main, Speaker, Source, Zone, Tuner, Tone, Trigger, Setup, ...). Render the right control per type (toggle for On/Off, dropdown for enumerated values, stepper/slider for numeric). Volume goes through the guard below; everything else through the same serial service. This is the headless OSD replacement.
- Show, in a clearly separated section, the OSD-only settings that the protocol cannot reach (from Phase 0.5), so the user knows exactly what still needs the TV.
- Poll state periodically so changes from the physical remote are reflected.
- Persist config (COM port, `MAX_VOLUME_DB`, `MAX_STEP_DB`, `WARN_VOLUME_DB`, watchdog flag) in a local config file.
- Single clean window.

## NAD T748 command reference (ASCII over serial; `?` query / `=` set / `+`/`-` step; terminate with `\r`)
`Main.Power` (On/Off) · `Main.Volume` (dB) · `Main.Mute` · `Main.Source` (1-12) · `Main.ListeningMode` · `Main.Dimmer` · `Main.Sleep` · `Tuner.Band` / `Tuner.FM.Frequency` / `Tuner.FM.Preset` / `Tuner.FM.Mute`. This command set is the one validated against the T748 by existing open-source NAD libraries. State is read by polling.

## Packaging
- electron-builder config for a **portable `.exe`** (`win` target, `portable`, x64), output to `dist/`, then **copy the final `.exe` to `C:\Users\sturm\Desktop`**. Self-contained — no Node install needed on the target PC.
- **README for the end user (my brother):** plug the USB-RS232 adapter into the receiver and the PC; find the COM port (Device Manager → Ports (COM & LPT)); run the `.exe`; open **Connection Test** and select the port; set `MAX_VOLUME_DB` (read the shown current volume first); then use it. Note: portable `.exe` for Windows x64, no install.
- README also includes the **PowerShell build** steps for me (install Node for Windows, `npm install`, build/package to `.exe`) — building needs no receiver.

## Working style
Confirm Phase 0 (serial link + current volume) before building the full app. State every assumption. No `git push` without my review. Add nothing beyond the serial protocol above.
