import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import { execFile } from 'node:child_process'
import type { Quality } from '../shared/types'

/**
 * ffmpeg-static / ffprobe-static ship prebuilt binaries. When the app is
 * packaged into an asar archive the binaries live in `app.asar.unpacked`
 * (configured via `asarUnpack` in package.json), so we rewrite the path.
 */
function resolveBinary(p: string | null): string {
  if (!p) throw new Error('No se encontró el binario de FFmpeg/FFprobe.')
  return p.replace('app.asar', 'app.asar.unpacked')
}

const ffmpegPath = resolveBinary(ffmpegStatic as unknown as string)
const ffprobePath = resolveBinary(ffprobeStatic.path)

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

export { ffmpeg, ffmpegPath, ffprobePath }

let cachedEncoders: string[] | null = null

/** Return the list of encoder names supported by the bundled ffmpeg build. */
export function listEncoders(): Promise<string[]> {
  if (cachedEncoders) return Promise.resolve(cachedEncoders)
  return new Promise((resolve) => {
    execFile(ffmpegPath, ['-hide_banner', '-encoders'], (err, stdout) => {
      if (err || !stdout) {
        cachedEncoders = []
        return resolve([])
      }
      const names: string[] = []
      for (const line of stdout.split('\n')) {
        // Lines look like: " V....D h264_videotoolbox   VideoToolbox H.264 Encoder"
        const match = line.trim().match(/^[A-Z.]{6}\s+([A-Za-z0-9_]+)/)
        if (match) names.push(match[1])
      }
      cachedEncoders = names
      resolve(names)
    })
  })
}

export async function isGpuAvailable(): Promise<boolean> {
  const encoders = await listEncoders()
  return encoders.includes('h264_videotoolbox')
}

/** Probe a media file for its duration in seconds. Returns null on failure. */
export function probeDuration(inputPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err || !data?.format?.duration) return resolve(null)
      const d = Number(data.format.duration)
      resolve(Number.isFinite(d) ? d : null)
    })
  })
}

/**
 * Build the fluent-ffmpeg output options for a given quality and engine.
 * GPU path uses VideoToolbox (bitrate-based); CPU path uses libx264 (CRF-based).
 */
export function buildOutputOptions(quality: Quality, useGpu: boolean): string[] {
  const audio = ['-c:a', 'aac']
  const faststart = ['-movflags', '+faststart']

  if (useGpu) {
    const bitrate: Record<Quality, string> = {
      high: '10M',
      medium: '5M',
      low: '2M',
    }
    const audioBitrate: Record<Quality, string> = {
      high: '192k',
      medium: '160k',
      low: '128k',
    }
    return [
      '-c:v',
      'h264_videotoolbox',
      '-b:v',
      bitrate[quality],
      ...audio,
      '-b:a',
      audioBitrate[quality],
      ...faststart,
    ]
  }

  const crf: Record<Quality, string> = { high: '18', medium: '23', low: '28' }
  const preset: Record<Quality, string> = {
    high: 'slow',
    medium: 'medium',
    low: 'veryfast',
  }
  const audioBitrate: Record<Quality, string> = {
    high: '192k',
    medium: '160k',
    low: '128k',
  }
  return [
    '-c:v',
    'libx264',
    '-preset',
    preset[quality],
    '-crf',
    crf[quality],
    '-pix_fmt',
    'yuv420p',
    ...audio,
    '-b:a',
    audioBitrate[quality],
    ...faststart,
  ]
}
