/**
 * Phase 0 — standalone serial link probe for the NAD T748.
 *
 * Run on WINDOWS (PowerShell), NOT inside WSL — the COM port is a Windows
 * resource and `serialport` needs the Windows native binary.
 *
 *   # one-time, in the project folder:
 *   npm install
 *
 *   # list ports only:
 *   npm run probe
 *
 *   # open a specific port and run the four standard queries:
 *   npm run probe -- COM3
 *
 * It opens the port at 115200-8N1 (no flow control), sends Main.Model?,
 * Main.Power?, Main.Version? and Main.Volume?, and prints the raw replies.
 * Use the reported Main.Volume to choose a safe MAX_VOLUME_DB.
 */
import { SerialPort } from 'serialport'

const QUERIES = ['Main.Model?', 'Main.Power?', 'Main.Version?', 'Main.Volume?']
const TERMINATOR = '\r'
const BAUD = 115200
const TIMEOUT_MS = 1500

async function listPorts(): Promise<void> {
  const ports = await SerialPort.list()
  if (ports.length === 0) {
    console.log('No serial ports found.')
    return
  }
  console.log('Available serial ports:')
  for (const p of ports) {
    const extra = [p.manufacturer, (p as { friendlyName?: string }).friendlyName, p.pnpId]
      .filter(Boolean)
      .join(' | ')
    console.log(`  ${p.path}${extra ? '  — ' + extra : ''}`)
  }
}

function open(path: string): Promise<SerialPort> {
  return new Promise((resolve, reject) => {
    const port = new SerialPort(
      {
        path,
        baudRate: BAUD,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        rtscts: false,
        autoOpen: false
      },
      () => {}
    )
    port.open((err) => (err ? reject(err) : resolve(port)))
  })
}

function query(port: SerialPort, cmd: string): Promise<string> {
  return new Promise((resolve) => {
    let buf = ''
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('ascii')
      const m = buf.split(/[\r\n]/).map((s) => s.trim()).filter(Boolean)
      if (m.length > 0) {
        cleanup()
        resolve(m[0])
      }
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve('(timeout — no reply)')
    }, TIMEOUT_MS)
    function cleanup() {
      clearTimeout(timer)
      port.off('data', onData)
    }
    port.on('data', onData)
    port.write(cmd + TERMINATOR, (err) => {
      if (err) {
        cleanup()
        resolve(`(write error: ${err.message})`)
      }
    })
  })
}

async function main() {
  const target = process.argv[2]
  await listPorts()
  if (!target) {
    console.log('\nNo port given. Re-run with the COM port, e.g.:  npm run probe -- COM3')
    return
  }

  console.log(`\nOpening ${target} @ ${BAUD} 8N1, no flow control…`)
  let port: SerialPort
  try {
    port = await open(target)
  } catch (e) {
    console.error(`Failed to open ${target}: ${(e as Error).message}`)
    process.exit(1)
  }
  console.log('Connected. Sending standard queries:\n')

  for (const q of QUERIES) {
    const reply = await query(port, q)
    console.log(`  ${q.padEnd(16)} -> ${reply}`)
  }

  await new Promise<void>((r) => port.close(() => r()))
  console.log(
    '\nReport back: the COM port used + the four replies above.' +
      '\nThe Main.Volume value (in dB) is what you need to choose a safe MAX_VOLUME_DB.'
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
