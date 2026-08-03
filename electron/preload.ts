import { contextBridge, ipcRenderer } from 'electron'
import type {
  ConverterApi,
  EncoderInfo,
  PickedFile,
  ProgressUpdate,
  Settings,
  VideoJob,
} from '../shared/types'

const api: ConverterApi = {
  pickFiles: () => ipcRenderer.invoke('files:pick') as Promise<PickedFile[]>,
  pickFolder: (kind) => ipcRenderer.invoke('folder:pick', kind) as Promise<string | null>,
  listFolder: (folderPath) =>
    ipcRenderer.invoke('folder:list', folderPath) as Promise<PickedFile[]>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<Settings>,
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings) as Promise<Settings>,
  getEncoderInfo: (useGpu) =>
    ipcRenderer.invoke('encoder:info', useGpu) as Promise<EncoderInfo>,
  startConversion: (jobs: VideoJob[], settings: Settings) =>
    ipcRenderer.invoke('conversion:start', jobs, settings) as Promise<void>,
  cancelAll: () => ipcRenderer.invoke('conversion:cancelAll') as Promise<void>,
  cancelJob: (id) => ipcRenderer.invoke('conversion:cancelJob', id) as Promise<void>,
  openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath) as Promise<void>,
  showInFolder: (targetPath) =>
    ipcRenderer.invoke('shell:showInFolder', targetPath) as Promise<void>,
  onProgress: (cb: (update: ProgressUpdate) => void) => {
    const listener = (_e: unknown, update: ProgressUpdate) => cb(update)
    ipcRenderer.on('conversion:progress', listener)
    return () => ipcRenderer.removeListener('conversion:progress', listener)
  },
}

contextBridge.exposeInMainWorld('converter', api)
