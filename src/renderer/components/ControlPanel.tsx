import { useEffect, useMemo } from 'react'
import type { AppConfig, ProbeResult } from '../../shared/types'
import { COMMANDS } from '../../shared/commands'
import { VolumeControl } from './VolumeControl'
import { CommandControl } from './CommandControl'

interface Props {
  connected: boolean
  config: AppConfig
  state: Record<string, string>
  probe: ProbeResult[] | null
}

export function ControlPanel({ connected, config, state, probe }: Props): JSX.Element {
  // Map id -> supported (from probe). If no probe was run, treat all as supported.
  const supportedMap = useMemo(() => {
    const m: Record<string, boolean> = {}
    if (probe) for (const p of probe) m[p.id] = p.supported
    return m
  }, [probe])

  // A command counts as supported if: it can't be probed (no '?', so we can't
  // tell — show it), or no probe has run yet, or the probe saw it answer.
  const isSupported = (def: { id: string; pollable: boolean }) =>
    !def.pollable ? true : probe ? !!supportedMap[def.id] : true

  // Every supported, pollable command — the on-demand "read current values" set.
  const supportedPollableIds = useMemo(
    () => COMMANDS.filter((c) => c.pollable && isSupported(c)).map((c) => c.id),
    [supportedMap, probe]
  )
  const refreshAll = () => window.nad.pollState(supportedPollableIds)

  // Auto-load current values once a capability probe has run (the supported set
  // is then small enough not to flood the port). Without a probe the user pulls
  // values on demand (per-control ↻ or the toolbar button) to avoid ~150 queries.
  useEffect(() => {
    if (connected && probe) window.nad.pollState(supportedPollableIds)
  }, [connected, probe, supportedPollableIds])

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
        <button onClick={refreshAll}>↻ Refresh all values</button>
        {probe ? (
          <span className="muted">
            Showing {COMMANDS.filter((c) => c.kind !== 'volume' && isSupported(c)).length} supported
            controls (capability probe applied). Run the probe again from Connection Test if you
            change inputs/modules.
          </span>
        ) : (
          <span className="muted">
            Showing the full RS-232 protocol. Run <strong>Probe capabilities</strong> in Connection
            Test to grey out what this T748 doesn’t support.
          </span>
        )}
      </div>

      <VolumeControl config={config} currentDb={currentVolume} />

      {groups.map(([group, defs]) => {
        const visible = defs.filter((d) => isSupported(d))
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
                  supported={isSupported(def)}
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
