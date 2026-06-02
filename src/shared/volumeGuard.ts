// ---------------------------------------------------------------------------
// VOLUME SAFETY GUARD — the most safety-critical code in the app.
//
// Pure functions only (no I/O), so they are exhaustively unit-tested and so the
// main process can enforce them in one place that the renderer cannot bypass.
//
// Invariants:
//   G1  The app can NEVER command a volume above MAX_VOLUME_DB.
//   G2  The app NEVER raises volume on its own (startup, reconnect, source change).
//
// Convention: louder = higher dB. MAX_VOLUME_DB is the UPPER bound.
// ---------------------------------------------------------------------------

export interface VolumeGuardConfig {
  maxVolumeDb: number | null // REQUIRED; null => volume control locked
  maxStepDb: number // reject any single command whose delta from current exceeds this
  warnVolumeDb: number | null // require explicit confirm above this; null => no warn
  clampOnObserved: boolean // on observing volume > cap at startup/reconnect, pull down
  volumeWatchdog: boolean // continuously clamp back to cap if observed above it
}

export type GuardRejectCode =
  | 'LOCKED' // MAX_VOLUME_DB not set
  | 'NO_CURRENT' // current volume unknown — cannot enforce step/relative safely
  | 'STEP_OVERFLOW' // delta from current exceeds MAX_STEP_DB

export interface GuardReject {
  allowed: false
  code: GuardRejectCode
  reason: string
}

export interface GuardAllow {
  allowed: true
  /** Absolute dB to actually send (relative requests are translated to absolute). */
  targetDb: number
  /** True if the request was clamped down to the cap. */
  clamped: boolean
  /** True if the UI must get an explicit confirm before sending (above warn threshold). */
  requiresConfirm: boolean
  warnings: string[]
}

export type GuardDecision = GuardReject | GuardAllow

export function isVolumeControlEnabled(cfg: VolumeGuardConfig): boolean {
  return cfg.maxVolumeDb !== null
}

function reject(code: GuardRejectCode, reason: string): GuardReject {
  return { allowed: false, code, reason }
}

/**
 * Finalize an intended absolute target against the cap + warn threshold.
 * Clamps DOWN to the cap (never up). Never raises above cap.
 */
function finalize(targetDb: number, cfg: VolumeGuardConfig): GuardAllow {
  const cap = cfg.maxVolumeDb as number // caller guarantees not null
  const warnings: string[] = []
  let clamped = false
  let value = targetDb

  if (value > cap) {
    warnings.push(
      `Requested ${targetDb} dB exceeds MAX_VOLUME_DB (${cap} dB); clamped to ${cap} dB.`
    )
    value = cap
    clamped = true
  }

  const requiresConfirm =
    cfg.warnVolumeDb !== null && value > cfg.warnVolumeDb
  if (requiresConfirm) {
    warnings.push(
      `${value} dB is above WARN_VOLUME_DB (${cfg.warnVolumeDb} dB) — confirm required.`
    )
  }

  return { allowed: true, targetDb: value, clamped, requiresConfirm, warnings }
}

/**
 * Evaluate an ABSOLUTE set request (Main.Volume=<dB>).
 * Requires the current volume to be known so the per-command step limit can be
 * enforced. Clamps to MAX_VOLUME_DB; rejects if the jump exceeds MAX_STEP_DB.
 */
export function evaluateAbsoluteSet(
  requestedDb: number,
  currentDb: number | null,
  cfg: VolumeGuardConfig
): GuardDecision {
  if (!isVolumeControlEnabled(cfg)) {
    return reject('LOCKED', 'MAX_VOLUME_DB is not set — volume control is locked.')
  }
  if (currentDb === null) {
    return reject(
      'NO_CURRENT',
      'Current volume is unknown — wait for a reading before changing volume.'
    )
  }
  // Step limit is judged on the user's INTENT (requested vs current), before clamping.
  const delta = Math.abs(requestedDb - currentDb)
  if (delta > cfg.maxStepDb) {
    return reject(
      'STEP_OVERFLOW',
      `Change of ${delta} dB exceeds MAX_STEP_DB (${cfg.maxStepDb} dB).`
    )
  }
  return finalize(requestedDb, cfg)
}

/**
 * Evaluate a RELATIVE step (Main.Volume+ / Main.Volume-).
 * Per the safety rules we NEVER forward a raw '+'; we read current, compute the
 * absolute target, verify it against the cap and step limit, and the caller
 * sends an absolute set instead.
 */
export function evaluateRelativeStep(
  direction: '+' | '-',
  currentDb: number | null,
  stepDb: number,
  cfg: VolumeGuardConfig
): GuardDecision {
  if (!isVolumeControlEnabled(cfg)) {
    return reject('LOCKED', 'MAX_VOLUME_DB is not set — volume control is locked.')
  }
  if (currentDb === null) {
    return reject(
      'NO_CURRENT',
      'Current volume is unknown — cannot step relative to it.'
    )
  }
  if (stepDb > cfg.maxStepDb) {
    return reject(
      'STEP_OVERFLOW',
      `Step of ${stepDb} dB exceeds MAX_STEP_DB (${cfg.maxStepDb} dB).`
    )
  }
  const target = direction === '+' ? currentDb + stepDb : currentDb - stepDb
  return finalize(target, cfg)
}

export interface ObservedDecision {
  aboveCap: boolean
  /** True if the app should actively pull the volume down to the cap. */
  shouldClamp: boolean
  clampTargetDb: number | null
  message: string | null
}

/**
 * Evaluate an OBSERVED volume (read at startup/reconnect or during polling).
 * Per G2 the app never raises volume; it only alerts, and only pulls down when
 * CLAMP_ON_OBSERVED or VOLUME_WATCHDOG is enabled.
 */
export function evaluateObserved(
  observedDb: number,
  cfg: VolumeGuardConfig
): ObservedDecision {
  if (!isVolumeControlEnabled(cfg)) {
    return { aboveCap: false, shouldClamp: false, clampTargetDb: null, message: null }
  }
  const cap = cfg.maxVolumeDb as number
  const aboveCap = observedDb > cap
  if (!aboveCap) {
    return { aboveCap: false, shouldClamp: false, clampTargetDb: null, message: null }
  }
  const shouldClamp = cfg.clampOnObserved || cfg.volumeWatchdog
  return {
    aboveCap: true,
    shouldClamp,
    clampTargetDb: shouldClamp ? cap : null,
    message: shouldClamp
      ? `Observed volume ${observedDb} dB is above the cap (${cap} dB) — pulling down to ${cap} dB.`
      : `Observed volume ${observedDb} dB is above the cap (${cap} dB).`
  }
}
