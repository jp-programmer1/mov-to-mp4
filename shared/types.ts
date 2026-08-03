// Shared type definitions used by both the Electron main process and the React renderer.

export type JobStatus = 'pending' | 'converting' | 'completed' | 'error'

export type Quality = 'high' | 'medium' | 'low'

export interface Settings {
  inputFolder: string | null
  outputFolder: string | null
  quality: Quality
  overwrite: boolean
  maxConcurrent: number
  useGpu: boolean
}

/** Data describing a single video file queued for conversion. */
export interface VideoJob {
  id: string
  inputPath: string
  fileName: string
  /** Size in bytes. */
  size: number
  /** Duration in seconds, if it could be probed. */
  durationSec: number | null
  status: JobStatus
  /** 0-100 */
  progress: number
  /** Estimated seconds remaining, null when unknown. */
  etaSec: number | null
  /** Encoding speed multiplier (e.g. 2.5 means 2.5x realtime). */
  speed: number | null
  outputPath: string | null
  error: string | null
}

/** Minimal file info returned when picking / listing files. */
export interface PickedFile {
  inputPath: string
  fileName: string
  size: number
  durationSec: number | null
}

/** Progress payload streamed from main to renderer during conversion. */
export interface ProgressUpdate {
  id: string
  status: JobStatus
  progress: number
  etaSec: number | null
  speed: number | null
  outputPath?: string | null
  error?: string | null
}

export interface EncoderInfo {
  /** Human-readable engine name, e.g. "GPU (VideoToolbox)" or "CPU (libx264)". */
  label: string
  gpuAvailable: boolean
  usingGpu: boolean
}

/** The API surface exposed to the renderer through the preload bridge. */
export interface ConverterApi {
  pickFiles: () => Promise<PickedFile[]>
  pickFolder: (kind: 'input' | 'output') => Promise<string | null>
  listFolder: (folderPath: string) => Promise<PickedFile[]>
  getSettings: () => Promise<Settings>
  saveSettings: (settings: Settings) => Promise<Settings>
  getEncoderInfo: (useGpu: boolean) => Promise<EncoderInfo>
  startConversion: (jobs: VideoJob[], settings: Settings) => Promise<void>
  cancelAll: () => Promise<void>
  cancelJob: (id: string) => Promise<void>
  openPath: (targetPath: string) => Promise<void>
  showInFolder: (targetPath: string) => Promise<void>
  onProgress: (cb: (update: ProgressUpdate) => void) => () => void
}

declare global {
  interface Window {
    converter: ConverterApi
  }
}
