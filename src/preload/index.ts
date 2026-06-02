import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { NadApi } from '../shared/ipc'
import type { LogEntry, SerialStatus } from '../shared/types'

const api: NadApi = {
  listPorts: () => ipcRenderer.invoke(IPC.listPorts),
  connect: (port) => ipcRenderer.invoke(IPC.connect, port),
  disconnect: () => ipcRenderer.invoke(IPC.disconnect),
  getStatus: () => ipcRenderer.invoke(IPC.getStatus),
  sendRaw: (command) => ipcRenderer.invoke(IPC.sendRaw, command),
  sendCommand: (args) => ipcRenderer.invoke(IPC.sendCommand, args),
  setVolumeAbsolute: (args) => ipcRenderer.invoke(IPC.setVolumeAbsolute, args),
  stepVolume: (args) => ipcRenderer.invoke(IPC.stepVolume, args),
  probeCapabilities: () => ipcRenderer.invoke(IPC.probeCapabilities),
  pollState: () => ipcRenderer.invoke(IPC.pollState),
  getConfig: () => ipcRenderer.invoke(IPC.getConfig),
  setConfig: (patch) => ipcRenderer.invoke(IPC.setConfig, patch),
  onStatus: (cb: (s: SerialStatus) => void) => {
    const listener = (_e: unknown, s: SerialStatus) => cb(s)
    ipcRenderer.on(IPC.onStatus, listener)
    return () => ipcRenderer.removeListener(IPC.onStatus, listener)
  },
  onLog: (cb: (e: LogEntry) => void) => {
    const listener = (_e: unknown, entry: LogEntry) => cb(entry)
    ipcRenderer.on(IPC.onLog, listener)
    return () => ipcRenderer.removeListener(IPC.onLog, listener)
  },
  onState: (cb: (state: Record<string, string>) => void) => {
    const listener = (_e: unknown, state: Record<string, string>) => cb(state)
    ipcRenderer.on(IPC.onState, listener)
    return () => ipcRenderer.removeListener(IPC.onState, listener)
  }
}

contextBridge.exposeInMainWorld('nad', api)
