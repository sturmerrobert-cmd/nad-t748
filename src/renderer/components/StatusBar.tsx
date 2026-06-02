import type { SerialStatus } from '../../shared/types'

export function StatusBar({ status }: { status: SerialStatus }): JSX.Element {
  const label =
    status.state === 'connected'
      ? `Connected — ${status.port} @ ${status.baudRate} 8N1`
      : status.state === 'connecting'
        ? `Connecting to ${status.port}…`
        : status.state === 'error'
          ? `Error: ${status.error ?? 'unknown'}`
          : 'Disconnected'

  return (
    <div className={`status-bar status-${status.state}`}>
      <span className="status-dot" />
      <span>{label}</span>
    </div>
  )
}
