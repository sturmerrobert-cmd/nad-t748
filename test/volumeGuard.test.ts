import { describe, it, expect } from 'vitest'
import {
  evaluateAbsoluteSet,
  evaluateRelativeStep,
  evaluateObserved,
  isVolumeControlEnabled,
  type VolumeGuardConfig
} from '@shared/volumeGuard'

const base: VolumeGuardConfig = {
  maxVolumeDb: -20,
  maxStepDb: 5,
  warnVolumeDb: null,
  clampOnObserved: false,
  volumeWatchdog: false
}

describe('isVolumeControlEnabled', () => {
  it('is locked when maxVolumeDb is null', () => {
    expect(isVolumeControlEnabled({ ...base, maxVolumeDb: null })).toBe(false)
  })
  it('is enabled when maxVolumeDb is set', () => {
    expect(isVolumeControlEnabled(base)).toBe(true)
  })
})

describe('evaluateAbsoluteSet — lock & current guards', () => {
  it('rejects when locked (no cap set)', () => {
    const d = evaluateAbsoluteSet(-30, -40, { ...base, maxVolumeDb: null })
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.code).toBe('LOCKED')
  })
  it('rejects when current volume is unknown', () => {
    const d = evaluateAbsoluteSet(-30, null, base)
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.code).toBe('NO_CURRENT')
  })
})

describe('evaluateAbsoluteSet — cap clamping', () => {
  it('clamps a request above the cap down to the cap', () => {
    // current -22, request -18 (above cap -20), delta 4 <= step 5
    const d = evaluateAbsoluteSet(-18, -22, base)
    expect(d.allowed).toBe(true)
    if (d.allowed) {
      expect(d.targetDb).toBe(-20)
      expect(d.clamped).toBe(true)
    }
  })
  it('at the cap is allowed and not clamped', () => {
    const d = evaluateAbsoluteSet(-20, -22, base)
    expect(d.allowed).toBe(true)
    if (d.allowed) {
      expect(d.targetDb).toBe(-20)
      expect(d.clamped).toBe(false)
    }
  })
  it('below the cap passes through unchanged', () => {
    const d = evaluateAbsoluteSet(-25, -22, base)
    expect(d.allowed).toBe(true)
    if (d.allowed) {
      expect(d.targetDb).toBe(-25)
      expect(d.clamped).toBe(false)
    }
  })
})

describe('evaluateAbsoluteSet — step overflow', () => {
  it('rejects a jump larger than MAX_STEP_DB', () => {
    // current -40, request -30 => delta 10 > step 5
    const d = evaluateAbsoluteSet(-30, -40, base)
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.code).toBe('STEP_OVERFLOW')
  })
  it('allows a jump exactly at MAX_STEP_DB', () => {
    const d = evaluateAbsoluteSet(-35, -40, base) // delta 5 == step 5
    expect(d.allowed).toBe(true)
  })
  it('step overflow is checked on intent even for a downward (negative) change', () => {
    const d = evaluateAbsoluteSet(-50, -40, base) // delta 10 down
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.code).toBe('STEP_OVERFLOW')
  })
})

describe('evaluateAbsoluteSet — warn threshold', () => {
  const warnCfg: VolumeGuardConfig = { ...base, maxVolumeDb: -10, warnVolumeDb: -25 }
  it('requires confirm above the warn threshold', () => {
    const d = evaluateAbsoluteSet(-22, -24, warnCfg) // -22 > warn -25
    expect(d.allowed).toBe(true)
    if (d.allowed) expect(d.requiresConfirm).toBe(true)
  })
  it('does not require confirm below the warn threshold', () => {
    const d = evaluateAbsoluteSet(-28, -26, warnCfg) // delta 2, below warn
    expect(d.allowed).toBe(true)
    if (d.allowed) expect(d.requiresConfirm).toBe(false)
  })
})

describe('evaluateRelativeStep', () => {
  it('rejects when locked', () => {
    const d = evaluateRelativeStep('+', -30, 1, { ...base, maxVolumeDb: null })
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.code).toBe('LOCKED')
  })
  it('rejects when current unknown (never forwards raw +)', () => {
    const d = evaluateRelativeStep('+', null, 1, base)
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.code).toBe('NO_CURRENT')
  })
  it('translates + to an absolute target', () => {
    const d = evaluateRelativeStep('+', -25, 1, base)
    expect(d.allowed).toBe(true)
    if (d.allowed) expect(d.targetDb).toBe(-24)
  })
  it('clamps a + step that would cross the cap', () => {
    const d = evaluateRelativeStep('+', -20, 1, base) // would be -19, above cap -20
    expect(d.allowed).toBe(true)
    if (d.allowed) {
      expect(d.targetDb).toBe(-20)
      expect(d.clamped).toBe(true)
    }
  })
  it('a negative (down) step is always below the cap and never clamped', () => {
    const d = evaluateRelativeStep('-', -20, 1, base)
    expect(d.allowed).toBe(true)
    if (d.allowed) {
      expect(d.targetDb).toBe(-21)
      expect(d.clamped).toBe(false)
    }
  })
  it('rejects a step larger than MAX_STEP_DB', () => {
    const d = evaluateRelativeStep('+', -30, 6, base)
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.code).toBe('STEP_OVERFLOW')
  })
})

describe('evaluateObserved', () => {
  it('no alert when at or below cap', () => {
    expect(evaluateObserved(-20, base).aboveCap).toBe(false)
    expect(evaluateObserved(-30, base).aboveCap).toBe(false)
  })
  it('alerts but does not clamp by default when above cap', () => {
    const d = evaluateObserved(-10, base)
    expect(d.aboveCap).toBe(true)
    expect(d.shouldClamp).toBe(false)
    expect(d.clampTargetDb).toBe(null)
  })
  it('clamps to cap when CLAMP_ON_OBSERVED is on', () => {
    const d = evaluateObserved(-10, { ...base, clampOnObserved: true })
    expect(d.shouldClamp).toBe(true)
    expect(d.clampTargetDb).toBe(-20)
  })
  it('clamps to cap when VOLUME_WATCHDOG is on', () => {
    const d = evaluateObserved(-5, { ...base, volumeWatchdog: true })
    expect(d.shouldClamp).toBe(true)
    expect(d.clampTargetDb).toBe(-20)
  })
  it('does nothing when control is locked', () => {
    const d = evaluateObserved(0, { ...base, maxVolumeDb: null })
    expect(d.aboveCap).toBe(false)
    expect(d.shouldClamp).toBe(false)
  })
})
