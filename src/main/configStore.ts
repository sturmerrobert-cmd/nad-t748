import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { DEFAULT_CONFIG, type AppConfig } from '../shared/types'

/**
 * Persists app config (COM port + volume-safety settings) to a JSON file in the
 * user data directory. MAX_VOLUME_DB stays null until the user sets it.
 */
export class ConfigStore {
  private path: string
  private config: AppConfig

  constructor() {
    this.path = join(app.getPath('userData'), 'nad-t748-config.json')
    this.config = this.load()
  }

  private load(): AppConfig {
    if (!existsSync(this.path)) return { ...DEFAULT_CONFIG }
    try {
      const raw = JSON.parse(readFileSync(this.path, 'utf-8'))
      // Merge over defaults so new fields get sane values; never invent a cap.
      return { ...DEFAULT_CONFIG, ...raw }
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  get(): AppConfig {
    return { ...this.config }
  }

  set(patch: Partial<AppConfig>): AppConfig {
    this.config = { ...this.config, ...patch }
    try {
      writeFileSync(this.path, JSON.stringify(this.config, null, 2), 'utf-8')
    } catch {
      // best-effort persistence; in-memory config remains authoritative
    }
    return this.get()
  }
}
