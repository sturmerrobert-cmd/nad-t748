import { useState } from 'react'
import type { AppConfig } from '../../shared/types'

interface Props {
  config: AppConfig
  onChange: (patch: Partial<AppConfig>) => void
}

export function SettingsPanel({ config, onChange }: Props): JSX.Element {
  const [maxVol, setMaxVol] = useState<string>(
    config.maxVolumeDb === null ? '' : String(config.maxVolumeDb)
  )
  const [warnVol, setWarnVol] = useState<string>(
    config.warnVolumeDb === null ? '' : String(config.warnVolumeDb)
  )

  function commitMaxVol() {
    if (maxVol.trim() === '') {
      onChange({ maxVolumeDb: null })
      return
    }
    const v = Number(maxVol)
    if (!Number.isNaN(v)) onChange({ maxVolumeDb: v })
  }

  function commitWarnVol() {
    if (warnVol.trim() === '') {
      onChange({ warnVolumeDb: null })
      return
    }
    const v = Number(warnVol)
    if (!Number.isNaN(v)) onChange({ warnVolumeDb: v })
  }

  return (
    <div className="panel settings">
      <h2>Settings</h2>

      <fieldset>
        <legend>Volume Safety (most important)</legend>

        <label className="field">
          <span>
            <strong>MAX_VOLUME_DB</strong> — required to unlock volume control. Upper bound (louder
            = higher dB). Leave empty to keep volume locked.
          </span>
          <span className="field-input">
            <input
              type="number"
              step="0.5"
              value={maxVol}
              onChange={(e) => setMaxVol(e.target.value)}
              onBlur={commitMaxVol}
              placeholder="e.g. -20"
            />
            <button onClick={commitMaxVol}>Save cap</button>
          </span>
        </label>
        {config.maxVolumeDb === null && (
          <p className="warn-box">Volume control is LOCKED until a cap is set.</p>
        )}

        <label className="field">
          <span><strong>MAX_STEP_DB</strong> — reject any single change larger than this.</span>
          <input
            type="number"
            step="0.5"
            value={config.maxStepDb}
            onChange={(e) => onChange({ maxStepDb: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span><strong>WARN_VOLUME_DB</strong> — require a confirm above this (empty = off).</span>
          <span className="field-input">
            <input
              type="number"
              step="0.5"
              value={warnVol}
              onChange={(e) => setWarnVol(e.target.value)}
              onBlur={commitWarnVol}
              placeholder="e.g. -25"
            />
            <button onClick={commitWarnVol}>Save</button>
          </span>
        </label>

        <label className="field checkbox">
          <input
            type="checkbox"
            checked={config.clampOnObserved}
            onChange={(e) => onChange({ clampOnObserved: e.target.checked })}
          />
          <span>
            <strong>CLAMP_ON_OBSERVED</strong> — if the volume read at startup/reconnect is above
            the cap, pull it down once. (default off)
          </span>
        </label>

        <label className="field checkbox">
          <input
            type="checkbox"
            checked={config.volumeWatchdog}
            onChange={(e) => onChange({ volumeWatchdog: e.target.checked })}
          />
          <span>
            <strong>VOLUME_WATCHDOG</strong> — continuously clamp back to the cap whenever the
            volume is observed above it.{' '}
            <em className="danger">
              This OVERRIDES the physical remote — turning the knob up past the cap will be undone.
            </em>{' '}
            (default off)
          </span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Connection</legend>
        <label className="field">
          <span>Baud rate (NAD T748 fixed at 115200)</span>
          <input type="number" value={config.baudRate} disabled />
        </label>
        <label className="field">
          <span>Poll interval (ms) — how often state is refreshed from the receiver.</span>
          <input
            type="number"
            min={1500}
            value={config.pollIntervalMs}
            onChange={(e) => onChange({ pollIntervalMs: Number(e.target.value) })}
          />
        </label>
        {config.comPort && <p className="muted">Last used port: {config.comPort}</p>}
      </fieldset>
    </div>
  )
}
