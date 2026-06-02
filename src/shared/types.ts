// Shared types used across main, preload and renderer.

export type Operator = '?' | '=' | '+' | '-'

export type ControlKind =
  | 'toggle' // On/Off, sent as =On / =Off
  | 'enum' // dropdown of discrete values
  | 'stepper' // bounded numeric with +/- (and usually =)
  | 'cycle' // only +/- available (no query): "next/previous"
  | 'volume' // special-cased: routed through the volume guard
  | 'readonly' // query-only (?), display value
  | 'ir' // raw IR remote code sender (Main.IR=<code>)

export interface EnumValue {
  value: string
  label: string
}

export interface CommandDef {
  /** Stable id used by IPC and the UI. */
  id: string
  /** The raw protocol command prefix, e.g. "Main.Volume". */
  cmd: string
  /** Human label shown in the UI. */
  label: string
  /** Logical group for layout: Main, Speaker, Source, Tuner, Tone, Zone, Trigger, Setup ... */
  group: string
  /** Operators the protocol defines for this variable. */
  operators: Operator[]
  /** Which control to render. */
  kind: ControlKind
  /** Enumerated choices (toggle/enum). */
  values?: EnumValue[]
  /** Numeric bounds (stepper/volume). */
  min?: number
  max?: number
  step?: number
  unit?: string
  /** True when the variable supports '?' and so can be polled for current state. */
  pollable: boolean
  description?: string
}

/** A setting that the RS-232 protocol does NOT expose — on-screen menu (TV) only. */
export interface OsdOnlySetting {
  label: string
  group: string
  note: string
}

// ---- Serial / connection ----

export interface PortInfo {
  path: string
  manufacturer?: string
  friendlyName?: string
  pnpId?: string
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface SerialStatus {
  state: ConnectionState
  port: string | null
  baudRate: number
  error?: string
}

export interface CommandResult {
  command: string // exactly what was written (without trailing \r)
  response: string | null // first matching reply line, or null on timeout
  ok: boolean
  error?: string
  timedOut?: boolean
}

export interface LogEntry {
  ts: number
  direction: 'tx' | 'rx' | 'info' | 'warn' | 'error'
  text: string
}

/** Result of the runtime capability probe for one variable. */
export interface ProbeResult {
  id: string
  cmd: string
  supported: boolean
  rawResponse: string | null
}

// ---- Config ----

export interface AppConfig {
  comPort: string | null
  baudRate: number
  // Volume safety
  maxVolumeDb: number | null // REQUIRED before volume control unlocks; null = locked
  maxStepDb: number // default 5
  warnVolumeDb: number | null // confirm above this; null = no warn threshold
  clampOnObserved: boolean // default false
  volumeWatchdog: boolean // default false — overrides physical remote, documented loudly
  pollIntervalMs: number
}

export const DEFAULT_CONFIG: AppConfig = {
  comPort: null,
  baudRate: 115200,
  maxVolumeDb: null,
  maxStepDb: 5,
  warnVolumeDb: null,
  clampOnObserved: false,
  volumeWatchdog: false,
  pollIntervalMs: 4000
}
