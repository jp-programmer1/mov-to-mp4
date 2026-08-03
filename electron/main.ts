import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { ConversionManager } from './converter'
import { probeDuration, getGpuEncoder, encoderLabel } from './ffmpeg'
import { loadSettings, saveSettings } from './settings'
import type {
  EncoderInfo,
  PickedFile,
  ProgressUpdate,
  Settings,
  VideoJob,
} from '../shared/types'

// vite-plugin-electron builds the main process as CommonJS, so __dirname is
// available and points at dist-electron/ in a build.
process.env.APP_ROOT = path.join(__dirname, '..')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

const SUPPORTED_EXTENSIONS = ['.mov'] // Extend here for future formats (avi, mkv, webm...)

let mainWindow: BrowserWindow | null = null
let manager: ConversionManager | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    title: 'MOV → MP4',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  manager = new ConversionManager((update: ProgressUpdate) => {
    mainWindow?.webContents.send('conversion:progress', update)
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

async function buildPickedFile(inputPath: string): Promise<PickedFile> {
  let size = 0
  try {
    size = fs.statSync(inputPath).size
  } catch {
    /* ignore */
  }
  const durationSec = await probeDuration(inputPath)
  return {
    inputPath,
    fileName: path.basename(inputPath),
    size,
    durationSec,
  }
}

function registerIpc(): void {
  ipcMain.handle('files:pick', async (): Promise<PickedFile[]> => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Selecciona archivos .mov',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos QuickTime', extensions: ['mov'] }],
    })
    if (result.canceled) return []
    return Promise.all(result.filePaths.map(buildPickedFile))
  })

  ipcMain.handle('folder:pick', async (_e, _kind: 'input' | 'output'): Promise<string | null> => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Selecciona una carpeta',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('folder:list', async (_e, folderPath: string): Promise<PickedFile[]> => {
    let entries: string[] = []
    try {
      entries = fs.readdirSync(folderPath)
    } catch {
      return []
    }
    const matches = entries.filter((name) =>
      SUPPORTED_EXTENSIONS.includes(path.extname(name).toLowerCase()),
    )
    return Promise.all(matches.map((name) => buildPickedFile(path.join(folderPath, name))))
  })

  ipcMain.handle('settings:get', (): Settings => loadSettings())
  ipcMain.handle('settings:save', (_e, settings: Settings): Settings => saveSettings(settings))

  ipcMain.handle('encoder:info', async (_e, useGpu: boolean): Promise<EncoderInfo> => {
    const gpuEncoder = await getGpuEncoder()
    const gpuAvailable = gpuEncoder !== null
    const usingGpu = gpuAvailable && useGpu
    return {
      gpuAvailable,
      usingGpu,
      label: encoderLabel(usingGpu ? gpuEncoder : null),
    }
  })

  ipcMain.handle('conversion:start', async (_e, jobs: VideoJob[], settings: Settings) => {
    const gpuEncoder = settings.useGpu ? await getGpuEncoder() : null
    const effective: Settings = { ...settings, useGpu: gpuEncoder !== null }
    manager?.start(jobs, effective, gpuEncoder)
  })

  ipcMain.handle('conversion:cancelAll', () => manager?.cancelAll())
  ipcMain.handle('conversion:cancelJob', (_e, id: string) => manager?.cancelJob(id))

  ipcMain.handle('shell:openPath', async (_e, targetPath: string) => {
    await shell.openPath(targetPath)
  })
  ipcMain.handle('shell:showInFolder', (_e, targetPath: string) => {
    shell.showItemInFolder(targetPath)
  })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  manager?.cancelAll()
  if (process.platform !== 'darwin') app.quit()
})
