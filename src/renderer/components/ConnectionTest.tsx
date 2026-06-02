import { useState } from 'react'
import type { CommandResult, PortInfo, ProbeResult, SerialStatus } from '../../shared/types'

const STANDARD_QUERIES = ['Main.Model?', 'Main.Power?', 'Main.Version?', 'Main.Volume?']

interface Props {
  status: SerialStatus
  ports: PortInfo[]
  probe: ProbeResult[] | null
  onRefreshPorts: () => void
  onConnect: (port: string) => Promise<SerialStatus>
  onDisconnect: () => Promise<SerialStatus>
  onProbe: () => Promise<ProbeResult[]>
}

export function ConnectionTest({
  status,
  ports,
  probe,
  onRefreshPorts,
  onConnect,
  onDisconnect,
  onProbe
}: Props): JSX.Element {
  const [selected, setSelected] = useState<string>('')
  const [replies, setReplies] = useState<CommandResult[]>([])
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)

  const connected = status.state === 'connected'
  const port = selected || ports[0]?.path || ''

  async function runStandard() {
    setBusy(true)
    const out: CommandResult[] = []
    for (const q of STANDARD_QUERIES) {
      out.push(await window.nad.sendRaw(q))
    }
    setReplies(out)
    setBusy(false)
  }

  async function sendRaw() {
    if (!raw.trim()) return
    const r = await window.nad.sendRaw(raw.trim())
    setReplies((prev) => [r, ...prev].slice(0, 50))
  }

  return (
    <div className="panel">
      <h2>Connection Test</h2>
      <p className="muted">
        Pick the COM port for the USB-to-RS232 adapter (cross-check Device Manager → Ports
        (COM &amp; LPT)), connect at 115200-8N1, and run the standard queries. Use the volume
        shown below to choose a safe <code>MAX_VOLUME_DB</code> in Settings.
      </p>

      <div className="row">
        <select value={port} onChange={(e) => setSelected(e.target.value)} disabled={connected}>
          {ports.length === 0 && <option value="">No ports found</option>}
          {ports.map((p) => (
            <option key={p.path} value={p.path}>
              {p.path}
              {p.friendlyName ? ` — ${p.friendlyName}` : p.manufacturer ? ` — ${p.manufacturer}` : ''}
            </option>
          ))}
        </select>
        <button onClick={onRefreshPorts} disabled={connected}>
          Refresh
        </button>
        {!connected ? (
          <button className="primary" onClick={() => port && onConnect(port)} disabled={!port}>
            Connect
          </button>
        ) : (
          <button onClick={() => onDisconnect()}>Disconnect</button>
        )}
      </div>

      {status.state === 'error' && <p className="error">Connection error: {status.error}</p>}

      <div className="row">
        <button onClick={runStandard} disabled={!connected || busy}>
          Run standard queries
        </button>
        <button onClick={onProbe} disabled={!connected}>
          Probe capabilities
        </button>
      </div>

      <div className="row">
        <input
          type="text"
          placeholder="Raw command e.g. Main.Volume?"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendRaw()}
          disabled={!connected}
        />
        <button onClick={sendRaw} disabled={!connected}>
          Send (\r appended)
        </button>
      </div>

      {replies.length > 0 && (
        <div className="replies">
          <h3>Replies</h3>
          <table>
            <thead>
              <tr>
                <th>Sent</th>
                <th>Reply</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {replies.map((r, i) => (
                <tr key={i}>
                  <td><code>{r.command}</code></td>
                  <td><code>{r.response ?? '—'}</code></td>
                  <td>{r.ok ? 'ok' : r.timedOut ? 'timeout' : `error: ${r.error}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {probe && (
        <div className="replies">
          <h3>Capability probe ({probe.filter((p) => p.supported).length}/{probe.length} supported)</h3>
          <table>
            <thead>
              <tr>
                <th>Variable</th>
                <th>Supported</th>
                <th>Raw response</th>
              </tr>
            </thead>
            <tbody>
              {probe.map((p) => (
                <tr key={p.id} className={p.supported ? '' : 'unsupported'}>
                  <td><code>{p.cmd}</code></td>
                  <td>{p.supported ? '✓' : '—'}</td>
                  <td><code>{p.rawResponse ?? '(no reply)'}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
