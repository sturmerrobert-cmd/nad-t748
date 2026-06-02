import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { SerialService } from './serialService'
import { ConfigStore } from './configStore'
import { VolumeController } from './volumeController'
import { COMMANDS, POLLABLE_COMMANDS, LIVE_POLL_IDS, commandById } from '../shared/commands'
import { IPC, type SendCommandArgs, type VolumeSetArgs, type VolumeStepArgs } from '../shared/ipc'
import type { CommandResult, ProbeResult } from '../shared/types'

let mainWindow: BrowserWindow | null = null
const serial = new SerialService()
let config: ConfigStore
let volume: VolumeController

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: 'NAD T748 Control',
    backgroundColor: '#15171c',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.removeMenu()

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Forward serial events to the renderer.
serial.on('status', (s) => mainWindow?.webContents.send(IPC.onStatus, s))
serial.on('log', (e) => mainWindow?.webContents.send(IPC.onLog, e))

/** Extract the value portion of a reply like "Main.Source=3" -> "3". */
function parseValue(cmd: string, line: string | null): string | null {
  if (!line) return null
  const prefix = `${cmd}=`
  if (line.startsWith(prefix)) return line.slice(prefix.length).trim()
  return null
}

function registerIpc(): void {
  ipcMain.handle(IPC.listPorts, () => serial.listPorts())

  ipcMain.handle(IPC.connect, async (_e, port: string) => {
    const cfg = config.get()
    const status = await serial.connect(port, cfg.baudRate)
    if (status.state === 'connected') {
      config.set({ comPort: port })
      // G2: read (never set) the current volume on connect so the user can pick a cap.
      await volume.readCurrent()
    }
    return status
  })

  ipcMain.handle(IPC.disconnect, () => serial.disconnect())
  ipcMain.handle(IPC.getStatus, () => serial.getStatus())

  // Raw send — used by the Connection Test screen and diagnostics only.
  ipcMain.handle(IPC.sendRaw, (_e, command: string): Promise<CommandResult> => {
    const trimmed = command.replace(/[\r\n]+$/, '')
    return serial.send(trimmed, null)
  })

  // Structured command for a CommandDef. Volume is BLOCKED here — it must go
  // through the guarded volume IPC channels, never the generic path.
  ipcMain.handle(IPC.sendCommand, (_e, args: SendCommandArgs): Promise<CommandResult> => {
    const def = commandById(args.id)
    if (!def) {
      return Promise.resolve({ command: args.id, response: null, ok: false, error: 'unknown command' })
    }
    if (def.kind === 'volume') {
      return Promise.resolve({
        command: def.cmd,
        response: null,
        ok: false,
        error: 'volume must use the guarded channel'
      })
    }
    if (!def.operators.includes(args.operator)) {
      return Promise.resolve({
        command: def.cmd,
        response: null,
        ok: false,
        error: `operator ${args.operator} not supported`
      })
    }
    let wire = def.cmd + args.operator
    if (args.operator === '=' && args.value !== undefined) {
      wire = `${def.cmd}=${args.value}`
    }
    return serial.send(wire, def.cmd)
  })

  ipcMain.handle(IPC.setVolumeAbsolute, (_e, args: VolumeSetArgs) =>
    volume.setAbsolute(args.targetDb, args.confirmed)
  )
  ipcMain.handle(IPC.stepVolume, (_e, args: VolumeStepArgs) =>
    volume.step(args.direction, args.confirmed)
  )

  // Runtime capability probe: ask each pollable variable; the unit ignores ones
  // it doesn't support, so a timeout/no-match means unsupported.
  ipcMain.handle(IPC.probeCapabilities, async (): Promise<ProbeResult[]> => {
    const results: ProbeResult[] = []
    for (const def of POLLABLE_COMMANDS) {
      const res = await serial.send(`${def.cmd}?`, def.cmd, 800)
      const supported = res.ok && !!res.response && res.response.startsWith(def.cmd)
      results.push({ id: def.id, cmd: def.cmd, supported, rawResponse: res.response })
    }
    return results
  })

  // Poll current state. With no ids, poll only the light "live" set (so periodic
  // polling never floods the port with ~150 queries); with ids, poll just those.
  ipcMain.handle(IPC.pollState, async (_e, ids?: string[]): Promise<Record<string, string>> => {
    const targets = ids && ids.length
      ? POLLABLE_COMMANDS.filter((c) => ids.includes(c.id))
      : POLLABLE_COMMANDS.filter((c) => LIVE_POLL_IDS.includes(c.id))
    const state: Record<string, string> = {}
    for (const def of targets) {
      const res = await serial.send(`${def.cmd}?`, def.cmd, 800)
      const value = parseValue(def.cmd, res.response)
      if (value !== null) state[def.id] = value
    }
    mainWindow?.webContents.send(IPC.onState, state)
    return state
  })

  ipcMain.handle(IPC.getConfig, () => config.get())
  ipcMain.handle(IPC.setConfig, (_e, patch) => config.set(patch))
}

app.whenReady().then(() => {
  config = new ConfigStore()
  volume = new VolumeController(serial, config)
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  serial.disconnect().finally(() => app.quit())
})

// Surface the command count at startup for sanity in dev.
console.log(`[main] NAD T748 Control — ${COMMANDS.length} protocol commands loaded`)
