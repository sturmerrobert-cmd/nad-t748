import { useEffect, useRef } from 'react'
import type { LogEntry } from '../../shared/types'

function fmt(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

export function LogPanel({ log, onClear }: { log: LogEntry[]; onClear: () => void }): JSX.Element {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [log.length])

  return (
    <div className="panel log-panel">
      <div className="control-toolbar">
        <h2>Serial Log</h2>
        <button onClick={onClear}>Clear</button>
      </div>
      <p className="muted">Raw serial traffic and connection events — share this if a test fails.</p>
      <div className="log-view">
        {log.length === 0 && <div className="muted">No traffic yet.</div>}
        {log.map((e, i) => (
          <div key={i} className={`log-line log-${e.direction}`}>
            <span className="log-ts">{fmt(e.ts)}</span>
            <span className="log-dir">{e.direction.toUpperCase()}</span>
            <span className="log-text">{e.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
