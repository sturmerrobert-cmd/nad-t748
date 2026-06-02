import { useState } from 'react'
import type { AppConfig } from '../../shared/types'
import type { GuardedVolumeResult } from '../../shared/ipc'

interface Props {
  config: AppConfig
  currentDb: number | null
}

export function VolumeControl({ config, currentDb }: Props): JSX.Element {
  const [pending, setPending] = useState<string | null>(null)
  const [absInput, setAbsInput] = useState<string>('')

  const locked = config.maxVolumeDb === null

  function report(r: GuardedVolumeResult) {
    if (!r.ok && r.rejectedCode) {
      setPending(`Blocked (${r.rejectedCode}): ${r.message ?? ''}`)
    } else if (r.requiresConfirm && !r.applied) {
      setPending(null)
      const ok = window.confirm(
        `${r.message}\n\nProceed to set ${r.targetDb} dB?`
      )
      if (ok && r.targetDb !== undefined) {
        window.nad.setVolumeAbsolute({ targetDb: r.targetDb, confirmed: true }).then(report)
      }
    } else if (r.applied) {
      setPending(
        r.clamped
          ? `Set to ${r.targetDb} dB (clamped to cap). ${r.message ?? ''}`
          : `Set to ${r.targetDb} dB.`
      )
    }
  }

  async function step(direction: '+' | '-') {
    report(await window.nad.stepVolume({ direction }))
  }

  async function setAbsolute() {
    const v = Number(absInput)
    if (Number.isNaN(v)) {
      setPending('Enter a numeric dB value.')
      return
    }
    report(await window.nad.setVolumeAbsolute({ targetDb: v }))
  }

  if (locked) {
    return (
      <div className="volume-control locked">
        <h3>Master Volume — LOCKED</h3>
        <p className="warn-box">
          Volume control is disabled until you set <code>MAX_VOLUME_DB</code> in{' '}
          <strong>Settings</strong>. Current reading:{' '}
          <strong>{currentDb === null ? 'unknown' : `${currentDb} dB`}</strong> — use it to pick a
          safe cap.
        </p>
      </div>
    )
  }

  const aboveCap = currentDb !== null && config.maxVolumeDb !== null && currentDb > config.maxVolumeDb

  return (
    <div className="volume-control">
      <h3>Master Volume</h3>
      <div className="vol-readout">
        <span className="vol-current">{currentDb === null ? '—' : `${currentDb}`}</span>
        <span className="vol-unit">dB</span>
      </div>
      <div className="vol-meta">
        Cap (MAX_VOLUME_DB): <strong>{config.maxVolumeDb} dB</strong> · Max step:{' '}
        {config.maxStepDb} dB
        {config.warnVolumeDb !== null && <> · Warn above {config.warnVolumeDb} dB</>}
      </div>
      {aboveCap && (
        <p className="error">
          ⚠ Current volume is above the cap. The app will not raise it; it pulls down only if
          CLAMP_ON_OBSERVED / VOLUME_WATCHDOG is enabled.
        </p>
      )}

      <div className="row">
        <button onClick={() => step('-')}>− Down</button>
        <button onClick={() => step('+')}>＋ Up</button>
      </div>

      <div className="row">
        <input
          type="number"
          step="0.5"
          placeholder="Set exact dB"
          value={absInput}
          onChange={(e) => setAbsInput(e.target.value)}
        />
        <button onClick={setAbsolute}>Set dB</button>
      </div>

      {pending && <p className="muted">{pending}</p>}
    </div>
  )
}
