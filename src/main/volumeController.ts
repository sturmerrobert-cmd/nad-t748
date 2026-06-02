import type { SerialService } from './serialService'
import type { ConfigStore } from './configStore'
import type { GuardedVolumeResult } from '../shared/ipc'
import {
  evaluateAbsoluteSet,
  evaluateObserved,
  evaluateRelativeStep,
  isVolumeControlEnabled,
  type VolumeGuardConfig
} from '../shared/volumeGuard'

const VOLUME_CMD = 'Main.Volume'

/** Parse a numeric dB value out of a reply like "Main.Volume=-20.5". */
export function parseVolumeReply(line: string | null): number | null {
  if (!line) return null
  const m = line.match(/Main\.Volume\s*=\s*(-?\d+(?:\.\d+)?)/i)
  return m ? Number(m[1]) : null
}

export class VolumeController {
  private currentDb: number | null = null

  constructor(
    private serial: SerialService,
    private config: ConfigStore
  ) {}

  getCurrent(): number | null {
    return this.currentDb
  }

  private guardConfig(): VolumeGuardConfig {
    const c = this.config.get()
    return {
      maxVolumeDb: c.maxVolumeDb,
      maxStepDb: c.maxStepDb,
      warnVolumeDb: c.warnVolumeDb,
      clampOnObserved: c.clampOnObserved,
      volumeWatchdog: c.volumeWatchdog
    }
  }

  /** Read the current volume from the device and cache it. Never writes. */
  async readCurrent(): Promise<number | null> {
    const res = await this.serial.send(`${VOLUME_CMD}?`, VOLUME_CMD)
    const v = parseVolumeReply(res.response)
    if (v !== null) {
      this.currentDb = v
      // Apply observed-volume safety (alert / optional clamp). Never raises.
      await this.handleObserved(v)
    }
    return this.currentDb
  }

  /** Evaluate an observed reading; pull down only if configured. Never raises. */
  async handleObserved(observedDb: number): Promise<void> {
    const decision = evaluateObserved(observedDb, this.guardConfig())
    if (decision.message) {
      this.serial.emit('log', {
        ts: Date.now(),
        direction: decision.shouldClamp ? 'warn' : 'warn',
        text: decision.message
      })
    }
    if (decision.shouldClamp && decision.clampTargetDb !== null) {
      // Pulling DOWN to the cap — allowed because it lowers volume.
      await this.sendAbsolute(decision.clampTargetDb)
      this.currentDb = decision.clampTargetDb
    }
  }

  private async sendAbsolute(targetDb: number): Promise<GuardedVolumeResult['result']> {
    const res = await this.serial.send(`${VOLUME_CMD}=${targetDb}`, VOLUME_CMD)
    const v = parseVolumeReply(res.response)
    if (v !== null) this.currentDb = v
    return res
  }

  async setAbsolute(targetDb: number, confirmed = false): Promise<GuardedVolumeResult> {
    const cfg = this.guardConfig()
    if (!isVolumeControlEnabled(cfg)) {
      return { ok: false, applied: false, rejectedCode: 'LOCKED', message: 'MAX_VOLUME_DB not set.' }
    }
    // Always work from a fresh reading so the step limit is enforced honestly.
    await this.readCurrent()
    const decision = evaluateAbsoluteSet(targetDb, this.currentDb, cfg)
    if (!decision.allowed) {
      return { ok: false, applied: false, rejectedCode: decision.code, message: decision.reason }
    }
    if (decision.requiresConfirm && !confirmed) {
      return {
        ok: true,
        applied: false,
        requiresConfirm: true,
        targetDb: decision.targetDb,
        clamped: decision.clamped,
        message: decision.warnings.join(' ')
      }
    }
    const result = await this.sendAbsolute(decision.targetDb)
    return {
      ok: true,
      applied: true,
      targetDb: decision.targetDb,
      clamped: decision.clamped,
      requiresConfirm: false,
      message: decision.warnings.join(' ') || undefined,
      result
    }
  }

  async step(direction: '+' | '-', confirmed = false): Promise<GuardedVolumeResult> {
    const cfg = this.guardConfig()
    if (!isVolumeControlEnabled(cfg)) {
      return { ok: false, applied: false, rejectedCode: 'LOCKED', message: 'MAX_VOLUME_DB not set.' }
    }
    // Read current FIRST, then translate to an absolute set. Never forward raw '+'.
    await this.readCurrent()
    const decision = evaluateRelativeStep(
      direction,
      this.currentDb,
      this.config.get().maxStepDb >= 1 ? 1 : this.config.get().maxStepDb,
      cfg
    )
    if (!decision.allowed) {
      return { ok: false, applied: false, rejectedCode: decision.code, message: decision.reason }
    }
    if (decision.requiresConfirm && !confirmed) {
      return {
        ok: true,
        applied: false,
        requiresConfirm: true,
        targetDb: decision.targetDb,
        clamped: decision.clamped,
        message: decision.warnings.join(' ')
      }
    }
    const result = await this.sendAbsolute(decision.targetDb)
    return {
      ok: true,
      applied: true,
      targetDb: decision.targetDb,
      clamped: decision.clamped,
      requiresConfirm: false,
      message: decision.warnings.join(' ') || undefined,
      result
    }
  }
}
