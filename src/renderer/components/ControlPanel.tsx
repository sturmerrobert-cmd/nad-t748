import { useMemo } from 'react'
import type { AppConfig, ProbeResult } from '../../shared/types'
import { COMMANDS } from '../../shared/commands'
import { VolumeControl } from './VolumeControl'
import { CommandControl } from './CommandControl'

interface Props {
  connected: boolean
  config: AppConfig
  state: Record<string, string>
  probe: ProbeResult[] | null
  onPoll: () => void
}

export function ControlPanel({ connected, config, state, probe, onPoll }: Props): JSX.Element {
  // Map id -> supported (from probe). If no probe was run, treat all as supported.
  const supportedMap = useMemo(() => {
    const m: Record<string, boolean> = {}
    if (probe) for (const p of probe) m[p.id] = p.supported
    return m
  }, [probe])

  const isSupported = (id: string) => (probe ? !!supportedMap[id] : true)

  // Non-volume commands grouped for layout.
  const groups = useMemo(() => {
    const byGroup = new Map<string, typeof COMMANDS>()
    for (const def of COMMANDS) {
      if (def.kind === 'volume') continue
      const arr = byGroup.get(def.group) ?? []
      arr.push(def)
      byGroup.set(def.group, arr)
    }
    return Array.from(byGroup.entries())
  }, [])

  const currentVolume = state['main_volume'] !== undefined ? Number(state['main_volume']) : null

  if (!connected) {
    return (
      <div className="panel">
        <p className="warn-box">
          Not connected. Open <strong>Connection Test</strong>, select the COM port and connect
          first.
        </p>
      </div>
    )
  }

  return (
    <div className="panel control-panel">
      <div className="control-toolbar">
        <button onClick={onPoll}>Refresh state</button>
        {probe && (
          <span className="muted">
            Showing {COMMANDS.filter((c) => c.kind !== 'volume' && isSupported(c.id)).length} supported
            controls (capability probe applied)
          </span>
        )}
      </div>

      <VolumeControl config={config} currentDb={currentVolume} />

      {groups.map(([group, defs]) => {
        const visible = defs.filter((d) => isSupported(d.id))
        if (visible.length === 0) return null
        return (
          <section key={group} className="control-group">
            <h3>{group}</h3>
            <div className="control-grid">
              {visible.map((def) => (
                <CommandControl
                  key={def.id}
                  def={def}
                  value={state[def.id]}
                  supported={isSupported(def.id)}
                  connected={connected}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
