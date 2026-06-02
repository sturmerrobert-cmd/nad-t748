import { useCallback, useEffect, useState } from 'react'
import type { AppConfig, LogEntry, PortInfo, ProbeResult, SerialStatus } from '../shared/types'
import { ConnectionTest } from './components/ConnectionTest'
import { ControlPanel } from './components/ControlPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { LogPanel } from './components/LogPanel'
import { OsdOnlyPanel } from './components/OsdOnlyPanel'
import { StatusBar } from './components/StatusBar'

type Tab = 'control' | 'connection' | 'settings' | 'osd' | 'log'

const TABS: { id: Tab; label: string }[] = [
  { id: 'control', label: 'Controls' },
  { id: 'connection', label: 'Connection Test' },
  { id: 'settings', label: 'Settings' },
  { id: 'osd', label: 'OSD-only (TV)' },
  { id: 'log', label: 'Serial Log' }
]

const MAX_LOG = 500

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('connection')
  const [status, setStatus] = useState<SerialStatus>({
    state: 'disconnected',
    port: null,
    baudRate: 115200
  })
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [state, setDeviceState] = useState<Record<string, string>>({})
  const [probe, setProbe] = useState<ProbeResult[] | null>(null)

  // Subscribe to main-process events.
  useEffect(() => {
    const offStatus = window.nad.onStatus(setStatus)
    const offLog = window.nad.onLog((e: LogEntry) =>
      setLog((prev) => [...prev.slice(-(MAX_LOG - 1)), e])
    )
    const offState = window.nad.onState((s) =>
      setDeviceState((prev) => ({ ...prev, ...s }))
    )
    window.nad.getStatus().then(setStatus)
    window.nad.getConfig().then(setConfig)
    refreshPorts()
    return () => {
      offStatus()
      offLog()
      offState()
    }
  }, [])

  const refreshPorts = useCallback(async () => {
    setPorts(await window.nad.listPorts())
  }, [])

  const updateConfig = useCallback(async (patch: Partial<AppConfig>) => {
    const next = await window.nad.setConfig(patch)
    setConfig(next)
  }, [])

  const poll = useCallback(async () => {
    if (status.state !== 'connected') return
    const s = await window.nad.pollState()
    setDeviceState((prev) => ({ ...prev, ...s }))
  }, [status.state])

  // Periodic polling so physical-remote changes are reflected.
  useEffect(() => {
    if (status.state !== 'connected' || !config) return
    poll()
    const id = setInterval(poll, Math.max(1500, config.pollIntervalMs))
    return () => clearInterval(id)
  }, [status.state, config?.pollIntervalMs, poll])

  const connected = status.state === 'connected'

  return (
    <div className="app">
      <header className="app-header">
        <h1>NAD T748 Control</h1>
        <StatusBar status={status} />
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'connection' && (
          <ConnectionTest
            status={status}
            ports={ports}
            onRefreshPorts={refreshPorts}
            onConnect={(p) => window.nad.connect(p)}
            onDisconnect={() => window.nad.disconnect()}
            onProbe={async () => {
              const r = await window.nad.probeCapabilities()
              setProbe(r)
              return r
            }}
            probe={probe}
          />
        )}

        {tab === 'control' && config && (
          <ControlPanel
            connected={connected}
            config={config}
            state={state}
            probe={probe}
            onPoll={poll}
          />
        )}

        {tab === 'settings' && config && (
          <SettingsPanel config={config} onChange={updateConfig} />
        )}

        {tab === 'osd' && <OsdOnlyPanel />}

        {tab === 'log' && <LogPanel log={log} onClear={() => setLog([])} />}
      </main>
    </div>
  )
}
