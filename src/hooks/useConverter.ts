import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  EncoderInfo,
  PickedFile,
  Settings,
  VideoJob,
} from '../../shared/types'

function pickedToJob(file: PickedFile): VideoJob {
  return {
    id: crypto.randomUUID(),
    inputPath: file.inputPath,
    fileName: file.fileName,
    size: file.size,
    durationSec: file.durationSec,
    status: 'pending',
    progress: 0,
    etaSec: null,
    speed: null,
    outputPath: null,
    error: null,
  }
}

export function useConverter() {
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [encoder, setEncoder] = useState<EncoderInfo | null>(null)
  const jobsRef = useRef<VideoJob[]>([])
  jobsRef.current = jobs

  // Load persisted settings + encoder info on mount, and subscribe to progress.
  useEffect(() => {
    let disposed = false
    window.converter.getSettings().then((s) => {
      if (disposed) return
      setSettings(s)
      window.converter.getEncoderInfo(s.useGpu).then(setEncoder)
    })

    const unsubscribe = window.converter.onProgress((update) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === update.id
            ? {
                ...j,
                status: update.status,
                progress: update.progress,
                etaSec: update.etaSec,
                speed: update.speed,
                outputPath: update.outputPath ?? j.outputPath,
                error: update.error ?? (update.status === 'error' ? j.error : null),
              }
            : j,
        ),
      )
    })
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  const persistSettings = useCallback((next: Settings) => {
    setSettings(next)
    window.converter.saveSettings(next)
    window.converter.getEncoderInfo(next.useGpu).then(setEncoder)
  }, [])

  const updateSettings = useCallback(
    (partial: Partial<Settings>) => {
      setSettings((prev) => {
        if (!prev) return prev
        const next = { ...prev, ...partial }
        window.converter.saveSettings(next)
        window.converter.getEncoderInfo(next.useGpu).then(setEncoder)
        return next
      })
    },
    [],
  )

  const addFiles = useCallback((files: PickedFile[]) => {
    setJobs((prev) => {
      const existing = new Set(prev.map((j) => j.inputPath))
      const additions = files.filter((f) => !existing.has(f.inputPath)).map(pickedToJob)
      return [...prev, ...additions]
    })
  }, [])

  const pickFiles = useCallback(async () => {
    const files = await window.converter.pickFiles()
    if (files.length) addFiles(files)
  }, [addFiles])

  const loadInputFolder = useCallback(async () => {
    if (!settings?.inputFolder) return
    const files = await window.converter.listFolder(settings.inputFolder)
    if (files.length) addFiles(files)
  }, [addFiles, settings])

  const chooseInputFolder = useCallback(async () => {
    const folder = await window.converter.pickFolder('input')
    if (!folder) return
    updateSettings({ inputFolder: folder })
    const files = await window.converter.listFolder(folder)
    if (files.length) addFiles(files)
  }, [addFiles, updateSettings])

  const chooseOutputFolder = useCallback(async () => {
    const folder = await window.converter.pickFolder('output')
    if (folder) updateSettings({ outputFolder: folder })
  }, [updateSettings])

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }, [])

  const clearCompleted = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status !== 'completed'))
  }, [])

  const clearAll = useCallback(() => setJobs([]), [])

  const start = useCallback(() => {
    if (!settings) return
    const pending = jobsRef.current.filter(
      (j) => j.status === 'pending' || j.status === 'error',
    )
    if (!pending.length) return
    // Optimistically flag them as converting-pending in the UI.
    setJobs((prev) =>
      prev.map((j) =>
        j.status === 'error' ? { ...j, status: 'pending', error: null } : j,
      ),
    )
    window.converter.startConversion(pending, settings)
  }, [settings])

  const cancelAll = useCallback(() => window.converter.cancelAll(), [])
  const cancelJob = useCallback((id: string) => window.converter.cancelJob(id), [])

  const stats = useMemo(() => {
    const total = jobs.length
    const completed = jobs.filter((j) => j.status === 'completed').length
    const converting = jobs.filter((j) => j.status === 'converting').length
    const pending = jobs.filter((j) => j.status === 'pending').length
    const errored = jobs.filter((j) => j.status === 'error').length
    const active = converting > 0 || (pending > 0 && converting > 0)
    // Global progress = average of per-job progress across all jobs.
    const globalProgress = total
      ? jobs.reduce((sum, j) => sum + (j.status === 'completed' ? 100 : j.progress), 0) / total
      : 0
    return { total, completed, converting, pending, errored, active, globalProgress }
  }, [jobs])

  const isConverting = stats.converting > 0

  return {
    jobs,
    settings,
    encoder,
    stats,
    isConverting,
    pickFiles,
    chooseInputFolder,
    chooseOutputFolder,
    loadInputFolder,
    removeJob,
    clearCompleted,
    clearAll,
    updateSettings,
    persistSettings,
    start,
    cancelAll,
    cancelJob,
  }
}
