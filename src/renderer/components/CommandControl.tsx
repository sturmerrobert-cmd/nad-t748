import { useState } from 'react'
import type { CommandDef } from '../../shared/types'

interface Props {
  def: CommandDef
  value: string | undefined // current polled value
  supported: boolean // from capability probe; true if probe not run
  connected: boolean
}

export function CommandControl({ def, value, supported, connected }: Props): JSX.Element {
  const [irCode, setIrCode] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const disabled = !connected || !supported

  async function send(operator: '?' | '=' | '+' | '-', v?: string) {
    const r = await window.nad.sendCommand({ id: def.id, operator, value: v })
    setNote(r.ok ? r.response : `error: ${r.error ?? 'no reply'}`)
  }

  const body = () => {
    switch (def.kind) {
      case 'toggle':
        return (
          <div className="ctl-row">
            <button
              className={value === 'On' ? 'seg active' : 'seg'}
              disabled={disabled}
              onClick={() => send('=', 'On')}
            >
              On
            </button>
            <button
              className={value === 'Off' ? 'seg active' : 'seg'}
              disabled={disabled}
              onClick={() => send('=', 'Off')}
            >
              Off
            </button>
          </div>
        )
      case 'enum':
        return (
          <select
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => send('=', e.target.value)}
          >
            <option value="" disabled>
              {value ?? '—'}
            </option>
            {def.values?.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        )
      case 'stepper':
        return (
          <div className="ctl-row">
            <button disabled={disabled} onClick={() => send('-')}>
              −
            </button>
            <span className="stepper-value">{value ?? '—'}</span>
            <button disabled={disabled} onClick={() => send('+')}>
              ＋
            </button>
          </div>
        )
      case 'cycle':
        return (
          <div className="ctl-row">
            <button disabled={disabled} onClick={() => send('-')}>
              ◀ Prev
            </button>
            <button disabled={disabled} onClick={() => send('+')}>
              Next ▶
            </button>
          </div>
        )
      case 'readonly':
        return (
          <div className="ctl-row">
            <span className="stepper-value">{value ?? '—'}</span>
          </div>
        )
      case 'ir':
        return (
          <div className="ctl-row">
            <input
              type="text"
              placeholder="IR code"
              value={irCode}
              disabled={disabled}
              onChange={(e) => setIrCode(e.target.value)}
            />
            <button disabled={disabled || !irCode.trim()} onClick={() => send('=', irCode.trim())}>
              Send IR
            </button>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className={`command-control${disabled ? ' disabled' : ''}`}>
      <div className="cc-head">
        <span className="cc-label">{def.label}</span>
        <code className="cc-cmd">{def.cmd}</code>
        {!supported && connected && <span className="cc-badge">not supported</span>}
        {def.pollable && (
          <button
            className="cc-refresh"
            disabled={disabled}
            title="Read current value from the receiver"
            onClick={() => window.nad.pollState([def.id])}
          >
            ↻
          </button>
        )}
      </div>
      {def.description && <div className="cc-desc">{def.description}</div>}
      {body()}
      {note && <div className="cc-note">{note}</div>}
    </div>
  )
}
