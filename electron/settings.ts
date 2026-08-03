import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { Settings } from '../shared/types'

const DEFAULTS: Settings = {
  inputFolder: null,
  outputFolder: null,
  quality: 'medium',
  overwrite: false,
  maxConcurrent: 2,
  useGpu: true,
}

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): Settings {
  try {
    const raw = fs.readFileSync(settingsFile(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: Settings): Settings {
  const merged: Settings = { ...DEFAULTS, ...settings }
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(merged, null, 2), 'utf-8')
  } catch {
    /* non-fatal: settings just won't persist */
  }
  return merged
}
