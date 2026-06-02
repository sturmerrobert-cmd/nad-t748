// IPC channel names and the typed surface exposed to the renderer via preload.

import type {
  AppConfig,
  CommandResult,
  LogEntry,
  PortInfo,
  ProbeResult,
  SerialStatus
} from './types'

export const IPC = {
  listPorts: 'serial:listPorts',
  connect: 'serial:connect',
  disconnect: 'serial:disconnect',
  getStatus: 'serial:getStatus',
  sendRaw: 'serial:sendRaw', // diagnostics / connection-test only
  sendCommand: 'serial:sendCommand', // structured command for a CommandDef
  setVolumeAbsolute: 'volume:setAbsolute',
  stepVolume: 'volume:step',
  probeCapabilities: 'serial:probe',
  pollState: 'serial:pollState',
  getConfig: 'config:get',
  setConfig: 'config:set',
  // main -> renderer events
  onStatus: 'evt:status',
  onLog: 'evt:log',
  onState: 'evt:state' // pushed polled state {id: value}
} as const

export interface SendCommandArgs {
  id: string // CommandDef id
  operator: '?' | '=' | '+' | '-'
  value?: string // for '=' operator
}

export interface VolumeStepArgs {
  direction: '+' | '-'
  /** Caller-confirmed flag for values above WARN_VOLUME_DB. */
  confirmed?: boolean
}

export interface VolumeSetArgs {
  targetDb: number
  confirmed?: boolean
}

export interface GuardedVolumeResult {
  ok: boolean
  applied: boolean
  targetDb?: number
  clamped?: boolean
  requiresConfirm?: boolean
  rejectedCode?: string
  message?: string
  result?: CommandResult
}

// The API object that preload exposes on window.nad
export interface NadApi {
  listPorts(): Promise<PortInfo[]>
  connect(port: string): Promise<SerialStatus>
  disconnect(): Promise<SerialStatus>
  getStatus(): Promise<SerialStatus>
  sendRaw(command: string): Promise<CommandResult>
  sendCommand(args: SendCommandArgs): Promise<CommandResult>
  setVolumeAbsolute(args: VolumeSetArgs): Promise<GuardedVolumeResult>
  stepVolume(args: VolumeStepArgs): Promise<GuardedVolumeResult>
  probeCapabilities(): Promise<ProbeResult[]>
  pollState(ids?: string[]): Promise<Record<string, string>>
  getConfig(): Promise<AppConfig>
  setConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  onStatus(cb: (s: SerialStatus) => void): () => void
  onLog(cb: (e: LogEntry) => void): () => void
  onState(cb: (state: Record<string, string>) => void): () => void
}
