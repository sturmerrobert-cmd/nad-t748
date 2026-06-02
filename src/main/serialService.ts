import { EventEmitter } from 'events'
import { SerialPort } from 'serialport'
import type {
  CommandResult,
  LogEntry,
  PortInfo,
  SerialStatus
} from '../shared/types'

// Classic NAD serial protocol (T748 family) frames every command with a
// carriage return on BOTH sides: \r CMD \r. The leading CR is required — the
// T748 ignores commands that arrive with only a trailing CR (confirmed against
// the nad_receiver reference library, tested on the T748v2).
const LEAD = '\r'
const TERMINATOR = '\r'
const DEFAULT_TIMEOUT_MS = 1500

interface QueueItem {
  command: string // without terminator
  /** Prefix that identifies the reply, e.g. "Main.Volume" -> matches "Main.Volume=..." */
  expectPrefix: string | null
  timeoutMs: number
  resolve: (r: CommandResult) => void
}

/**
 * Owns the serial port. Single-threaded command queue with \r framing and
 * per-command timeouts. The renderer never touches the port directly; it goes
 * through IPC -> this service, so the volume guard cannot be bypassed.
 */
export class SerialService extends EventEmitter {
  private port: SerialPort | null = null
  private rxBuffer = ''
  private queue: QueueItem[] = []
  private inFlight: QueueItem | null = null
  private inFlightTimer: NodeJS.Timeout | null = null
  private status: SerialStatus = {
    state: 'disconnected',
    port: null,
    baudRate: 115200
  }
  // Minimum gap between commands (rate limiting); NAD units dislike flooding.
  private readonly minGapMs = 60
  private lastWriteAt = 0

  getStatus(): SerialStatus {
    return { ...this.status }
  }

  private setStatus(patch: Partial<SerialStatus>): void {
    this.status = { ...this.status, ...patch }
    this.emit('status', this.getStatus())
  }

  private log(direction: LogEntry['direction'], text: string): void {
    const entry: LogEntry = { ts: Date.now(), direction, text }
    this.emit('log', entry)
  }

  async listPorts(): Promise<PortInfo[]> {
    const ports = await SerialPort.list()
    return ports.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer,
      friendlyName: (p as { friendlyName?: string }).friendlyName,
      pnpId: p.pnpId
    }))
  }

  async connect(path: string, baudRate = 115200): Promise<SerialStatus> {
    await this.disconnect()
    this.setStatus({ state: 'connecting', port: path, baudRate, error: undefined })
    this.log('info', `Opening ${path} @ ${baudRate} 8N1, no flow control`)

    return new Promise<SerialStatus>((resolve) => {
      const port = new SerialPort(
        {
          path,
          baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          rtscts: false,
          xon: false,
          xoff: false,
          autoOpen: false
        },
        // open callback below via .open()
        () => {}
      )

      port.open((err) => {
        if (err) {
          this.setStatus({ state: 'error', error: err.message })
          this.log('error', `Open failed: ${err.message}`)
          resolve(this.getStatus())
          return
        }
        this.port = port
        this.rxBuffer = ''
        this.setStatus({ state: 'connected', port: path, baudRate })
        this.log('info', `Connected to ${path}`)
        resolve(this.getStatus())
      })

      port.on('data', (chunk: Buffer) => this.onData(chunk))
      port.on('error', (err: Error) => {
        this.setStatus({ state: 'error', error: err.message })
        this.log('error', `Port error: ${err.message}`)
      })
      port.on('close', () => {
        if (this.status.state === 'connected') {
          this.setStatus({ state: 'disconnected', port: null })
          this.log('warn', 'Port closed')
        }
      })
    })
  }

  async disconnect(): Promise<SerialStatus> {
    this.failInFlight('disconnected')
    this.queue.forEach((q) =>
      q.resolve({ command: q.command, response: null, ok: false, error: 'disconnected' })
    )
    this.queue = []
    if (this.port && this.port.isOpen) {
      await new Promise<void>((resolve) => this.port!.close(() => resolve()))
    }
    this.port = null
    this.setStatus({ state: 'disconnected', port: null })
    return this.getStatus()
  }

  private onData(chunk: Buffer): void {
    this.rxBuffer += chunk.toString('ascii')
    // NAD frames replies with \r (sometimes \r\n). Split on either.
    let idx: number
    while ((idx = this.rxBuffer.search(/[\r\n]/)) !== -1) {
      const line = this.rxBuffer.slice(0, idx).trim()
      this.rxBuffer = this.rxBuffer.slice(idx + 1)
      if (line.length === 0) continue
      this.log('rx', line)
      this.matchReply(line)
    }
  }

  private matchReply(line: string): void {
    if (!this.inFlight) return
    const { expectPrefix } = this.inFlight
    // If we expect a specific variable, only resolve on a line for that variable.
    if (expectPrefix && !line.startsWith(expectPrefix)) {
      return // unrelated async notification; keep waiting
    }
    const item = this.inFlight
    this.clearInFlight()
    item.resolve({ command: item.command, response: line, ok: true })
    this.pump()
  }

  private clearInFlight(): void {
    if (this.inFlightTimer) {
      clearTimeout(this.inFlightTimer)
      this.inFlightTimer = null
    }
    this.inFlight = null
  }

  private failInFlight(error: string): void {
    if (this.inFlight) {
      const item = this.inFlight
      this.clearInFlight()
      item.resolve({ command: item.command, response: null, ok: false, error })
    }
  }

  /**
   * Send a command and await the matching reply.
   * @param command e.g. "Main.Volume?" or "Main.Volume=-20"
   * @param expectPrefix variable prefix to match the reply, e.g. "Main.Volume".
   *        Pass null to resolve on the first line received.
   */
  send(
    command: string,
    expectPrefix: string | null,
    timeoutMs = DEFAULT_TIMEOUT_MS
  ): Promise<CommandResult> {
    if (!this.port || !this.port.isOpen) {
      return Promise.resolve({
        command,
        response: null,
        ok: false,
        error: 'not connected'
      })
    }
    return new Promise<CommandResult>((resolve) => {
      this.queue.push({ command, expectPrefix, timeoutMs, resolve })
      this.pump()
    })
  }

  private pump(): void {
    if (this.inFlight || this.queue.length === 0) return
    if (!this.port || !this.port.isOpen) {
      this.failInFlight('not connected')
      return
    }
    const gap = Date.now() - this.lastWriteAt
    if (gap < this.minGapMs) {
      setTimeout(() => this.pump(), this.minGapMs - gap)
      return
    }

    const item = this.queue.shift()!
    this.inFlight = item
    this.lastWriteAt = Date.now()

    this.port.write(LEAD + item.command + TERMINATOR, (err) => {
      if (err) {
        this.log('error', `Write failed: ${err.message}`)
        this.failInFlight(err.message)
        this.pump()
        return
      }
      this.log('tx', item.command)
    })

    this.inFlightTimer = setTimeout(() => {
      this.log('warn', `Timeout waiting for reply to "${item.command}"`)
      const timedOut = this.inFlight
      this.clearInFlight()
      if (timedOut) {
        timedOut.resolve({
          command: timedOut.command,
          response: null,
          ok: false,
          timedOut: true,
          error: 'timeout'
        })
      }
      this.pump()
    }, item.timeoutMs)
  }
}
