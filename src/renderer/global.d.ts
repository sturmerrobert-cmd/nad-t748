import type { NadApi } from '../shared/ipc'

declare global {
  interface Window {
    nad: NadApi
  }
}

export {}
