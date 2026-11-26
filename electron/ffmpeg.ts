import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import { execFile } from 'node:child_process'
import type { Quality } from '../shared/types'

/**
 * ffmpeg-static ships a prebuilt binary. When the app is
 * packaged into an asar archive the binaries live in `app.asar.unpacked`
 * (configured via `asarUnpack` in package.json), so we rewrite the path.
 *
 * ffprobe is intentionally not bundled: ffprobe-static ships an Intel-only
 * binary even for darwin/arm64, which forces Rosetta on Apple Silicon.
 * The duration is read from ffmpeg's own output instead.
 */
function resolveBinary(p: string | null): string {
  if (!p) throw new Error('No se encontró el binario de FFmpeg.')
  return p.replace('app.asar', 'app.asar.unpacked')
}

const ffmpegPath = resolveBinary(ffmpegStatic as unknown as string)

ffmpeg.setFfmpegPath(ffmpegPath)

export { ffmpeg, ffmpegPath }

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

/**
 * Preferred hardware H.264 encoders per platform, in priority order.
 * The first one that the bundled ffmpeg build reports as available wins.
 * (VAAPI is intentionally excluded: it needs explicit device/hwupload setup.)
 */
const GPU_PRIORITY: Record<string, string[]> = {
  darwin: ['h264_videotoolbox'],
  win32: ['h264_nvenc', 'h264_qsv', 'h264_amf'],
  linux: ['h264_nvenc', 'h264_qsv'],
}

const GPU_LABELS: Record<string, string> = {
  h264_videotoolbox: 'GPU · VideoToolbox (H.264)',
  h264_nvenc: 'GPU · NVIDIA NVENC (H.264)',
  h264_qsv: 'GPU · Intel Quick Sync (H.264)',
  h264_amf: 'GPU · AMD AMF (H.264)',
}

const CPU_LABEL = 'CPU · libx264 (H.264)'

let cachedGpuEncoder: string | null | undefined

/** Resolve the best available hardware encoder for the current platform, or null. */
export async function getGpuEncoder(): Promise<string | null> {
  if (cachedGpuEncoder !== undefined) return cachedGpuEncoder
  const encoders = await listEncoders()
  const priority = GPU_PRIORITY[process.platform] ?? []
  cachedGpuEncoder = priority.find((enc) => encoders.includes(enc)) ?? null
  return cachedGpuEncoder
}

export async function isGpuAvailable(): Promise<boolean> {
  return (await getGpuEncoder()) !== null
}

/** Human-readable label for a resolved encoder (null → CPU). */
export function encoderLabel(gpuEncoder: string | null): string {
  if (!gpuEncoder) return CPU_LABEL
  return GPU_LABELS[gpuEncoder] ?? `GPU · ${gpuEncoder}`
}

/**
 * Read a media file's duration in seconds from `ffmpeg -i` (no ffprobe needed).
 * ffmpeg exits with an error because no output is given, but it still prints
 * the container info, e.g. "Duration: 00:01:23.45". Returns null on failure.
 */
export function probeDuration(inputPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(ffmpegPath, ['-hide_banner', '-i', inputPath], (_err, _stdout, stderr) => {
      const match = String(stderr ?? '').match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/)
      if (!match) return resolve(null)
      const d = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
      resolve(Number.isFinite(d) && d > 0 ? d : null)
    })
  })
}

const AUDIO_BITRATE: Record<Quality, string> = {
  high: '192k',
  medium: '160k',
  low: '128k',
}

/**
 * Build the fluent-ffmpeg output options for a given quality and engine.
 * When `gpuEncoder` is set, uses that hardware encoder (bitrate-based, portable
 * across NVENC / Quick Sync / AMF / VideoToolbox); otherwise libx264 (CRF-based).
 */
export function buildOutputOptions(quality: Quality, gpuEncoder: string | null): string[] {
  const audio = ['-c:a', 'aac']
  const faststart = ['-movflags', '+faststart']

  if (gpuEncoder) {
    const bitrate: Record<Quality, string> = {
      high: '10M',
      medium: '5M',
      low: '2M',
    }
    return [
      '-c:v',
      gpuEncoder,
      '-b:v',
      bitrate[quality],
      ...audio,
      '-b:a',
      AUDIO_BITRATE[quality],
      ...faststart,
    ]
  }

  const crf: Record<Quality, string> = { high: '18', medium: '23', low: '28' }
  const preset: Record<Quality, string> = {
    high: 'slow',
    medium: 'medium',
    low: 'veryfast',
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
    AUDIO_BITRATE[quality],
    ...faststart,
  ]
}

type GifPreset = {
  fps: number
  /** Max width in px; the source is never upscaled. */
  width: number
  colors: number
  /** palettegen stats mode: `full` weighs all frames equally, `diff` favours moving areas. */
  statsMode: 'full' | 'diff'
  /** paletteuse dither algorithm. Error-diffusion (sierra2_4a) looks far cleaner than bayer. */
  dither: string
}

const GIF_PRESET: Record<Quality, GifPreset> = {
  high: { fps: 20, width: 960, colors: 256, statsMode: 'full', dither: 'sierra2_4a' },
  medium: { fps: 15, width: 640, colors: 256, statsMode: 'diff', dither: 'sierra2_4a' },
  low: { fps: 10, width: 480, colors: 128, statsMode: 'diff', dither: 'bayer:bayer_scale=5' },
}

/**
 * Palette-based GIF export. `speed` > 1 accelerates playback (shorter GIF);
 * `speed` < 1 slows it down. Audio is dropped.
 */
export function buildGifOutputOptions(quality: Quality, speed: number): string[] {
  const preset = GIF_PRESET[quality]
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1
  const pts = `setpts=PTS/${safeSpeed}`
  // Never upscale: cap the width at the preset but keep smaller sources as-is.
  const scale = `scale=min(iw\\,${preset.width}):-2:flags=lanczos`
  const filter =
    `[0:v]${pts},fps=${preset.fps},${scale},split[s0][s1];` +
    `[s0]palettegen=max_colors=${preset.colors}:stats_mode=${preset.statsMode}[p];` +
    `[s1][p]paletteuse=dither=${preset.dither}:diff_mode=rectangle`

  return ['-filter_complex', filter, '-loop', '0', '-an']
}
