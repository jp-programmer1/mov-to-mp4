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
  outputFormat: 'mp4',
  gifSpeed: 1,
}

const GIF_SPEED_MIN = 0.25
const GIF_SPEED_MAX = 4

export function clampGifSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULTS.gifSpeed
  const stepped = Math.round(value * 4) / 4
  return Math.min(GIF_SPEED_MAX, Math.max(GIF_SPEED_MIN, stepped))
}

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): Settings {
  try {
    const raw = fs.readFileSync(settingsFile(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULTS,
      ...parsed,
      outputFormat: parsed.outputFormat === 'gif' ? 'gif' : 'mp4',
      gifSpeed: clampGifSpeed(parsed.gifSpeed ?? DEFAULTS.gifSpeed),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: Settings): Settings {
  const merged: Settings = {
    ...DEFAULTS,
    ...settings,
    outputFormat: settings.outputFormat === 'gif' ? 'gif' : 'mp4',
    gifSpeed: clampGifSpeed(settings.gifSpeed),
  }
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(merged, null, 2), 'utf-8')
  } catch {
    /* non-fatal: settings just won't persist */
  }
  return merged
}
