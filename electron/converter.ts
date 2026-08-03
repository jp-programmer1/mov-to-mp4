import fs from 'node:fs'
import path from 'node:path'
import type { FfmpegCommand } from 'fluent-ffmpeg'
import { ffmpeg, buildOutputOptions } from './ffmpeg'
import type { ProgressUpdate, Settings, VideoJob } from '../shared/types'

type Emit = (update: ProgressUpdate) => void

interface RunningJob {
  command: FfmpegCommand
  startTime: number
  outputPath: string
}

/** Convert an ffmpeg timemark ("HH:MM:SS.ms") into seconds. */
function timemarkToSeconds(timemark: string): number {
  if (!timemark) return 0
  const parts = timemark.split(':')
  if (parts.length !== 3) return 0
  const [h, m, s] = parts.map(Number)
  if ([h, m, s].some((n) => Number.isNaN(n))) return 0
  return h * 3600 + m * 60 + s
}

/**
 * Manages a queue of video conversions with a configurable concurrency limit,
 * streaming progress back through the `emit` callback.
 */
export class ConversionManager {
  private queue: VideoJob[] = []
  private running = new Map<string, RunningJob>()
  private cancelled = new Set<string>()
  private settings: Settings | null = null
  private active = false
  /** Resolved hardware encoder for this run, or null for CPU. */
  private gpuEncoder: string | null = null

  constructor(private emit: Emit) {}

  start(jobs: VideoJob[], settings: Settings, gpuEncoder: string | null): void {
    this.settings = settings
    this.gpuEncoder = gpuEncoder
    // Only (re)process jobs that are not already done.
    this.queue = jobs.filter((j) => j.status === 'pending' || j.status === 'error')
    this.cancelled.clear()
    this.active = true
    this.pump()
  }

  cancelAll(): void {
    this.active = false
    this.queue = []
    for (const [id, run] of this.running) {
      this.cancelled.add(id)
      try {
        run.command.kill('SIGKILL')
      } catch {
        /* ignore */
      }
    }
  }

  cancelJob(id: string): void {
    // Remove from the pending queue if it hasn't started.
    this.queue = this.queue.filter((j) => j.id !== id)
    const run = this.running.get(id)
    if (run) {
      this.cancelled.add(id)
      try {
        run.command.kill('SIGKILL')
      } catch {
        /* ignore */
      }
    } else {
      // Was only queued — report it as reset to pending.
      this.emit({ id, status: 'pending', progress: 0, etaSec: null, speed: null })
    }
  }

  private pump(): void {
    if (!this.active || !this.settings) return
    const max = Math.max(1, this.settings.maxConcurrent)
    while (this.running.size < max && this.queue.length > 0) {
      const job = this.queue.shift()!
      this.runJob(job)
    }
  }

  private resolveOutputPath(job: VideoJob): string {
    const settings = this.settings!
    const dir = settings.outputFolder || path.dirname(job.inputPath)
    fs.mkdirSync(dir, { recursive: true })
    const base = path.basename(job.fileName, path.extname(job.fileName))
    let out = path.join(dir, `${base}.mp4`)
    if (!settings.overwrite) {
      let i = 1
      while (fs.existsSync(out)) {
        out = path.join(dir, `${base} (${i}).mp4`)
        i += 1
      }
    }
    return out
  }

  private runJob(job: VideoJob, forceCpu = false): void {
    const settings = this.settings!
    let outputPath: string
    try {
      outputPath = this.resolveOutputPath(job)
    } catch (err) {
      this.emit({
        id: job.id,
        status: 'error',
        progress: 0,
        etaSec: null,
        speed: null,
        error: err instanceof Error ? err.message : 'No se pudo preparar la salida.',
      })
      this.pump()
      return
    }

    const encoder = forceCpu ? null : this.gpuEncoder
    const options = buildOutputOptions(settings.quality, encoder)
    const startTime = Date.now()

    const command = ffmpeg(job.inputPath)
      .outputOptions(options)
      .output(outputPath)

    this.running.set(job.id, { command, startTime, outputPath })
    this.emit({ id: job.id, status: 'converting', progress: 0, etaSec: null, speed: null })

    command
      .on('progress', (p) => {
        const processed = timemarkToSeconds(p.timemark ?? '')
        const elapsed = (Date.now() - startTime) / 1000
        const speed = elapsed > 0 ? processed / elapsed : null
        let progress = 0
        let etaSec: number | null = null
        if (job.durationSec && job.durationSec > 0) {
          progress = Math.min(99, (processed / job.durationSec) * 100)
          if (speed && speed > 0) {
            etaSec = Math.max(0, (job.durationSec - processed) / speed)
          }
        } else if (typeof p.percent === 'number' && Number.isFinite(p.percent)) {
          progress = Math.min(99, Math.max(0, p.percent))
        }
        this.emit({ id: job.id, status: 'converting', progress, etaSec, speed })
      })
      .on('end', () => {
        this.running.delete(job.id)
        this.emit({
          id: job.id,
          status: 'completed',
          progress: 100,
          etaSec: 0,
          speed: null,
          outputPath,
        })
        this.pump()
      })
      .on('error', (err: Error) => {
        this.running.delete(job.id)
        // Always clean up the partial file left behind.
        fs.rm(outputPath, { force: true }, () => {})

        if (this.cancelled.has(job.id)) {
          this.cancelled.delete(job.id)
          this.emit({ id: job.id, status: 'pending', progress: 0, etaSec: null, speed: null })
          this.pump()
          return
        }

        // If a hardware-accelerated attempt failed (e.g. the encoder is listed
        // but no compatible GPU is present), transparently retry on the CPU.
        if (!forceCpu && encoder) {
          this.runJob(job, true)
          return
        }

        this.emit({
          id: job.id,
          status: 'error',
          progress: 0,
          etaSec: null,
          speed: null,
          error: err.message,
        })
        this.pump()
      })
      .run()
  }
}
