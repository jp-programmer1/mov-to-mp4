import type { EncoderInfo, Quality, Settings } from '../../shared/types'

interface Props {
  settings: Settings
  encoder: EncoderInfo | null
  onChange: (partial: Partial<Settings>) => void
  onChooseInput: () => void
  onChooseOutput: () => void
  onLoadInput: () => void
}

const QUALITY_OPTIONS: { value: Quality; label: string }[] = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
]

function shortPath(p: string | null): string {
  if (!p) return 'Sin configurar'
  const parts = p.split(/[\\/]/)
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : p
}

export default function SettingsPanel({
  settings,
  encoder,
  onChange,
  onChooseInput,
  onChooseOutput,
  onLoadInput,
}: Props) {
  return (
    <aside className="settings">
      <h2>Configuración</h2>

      <div className="field">
        <label>Carpeta de entrada</label>
        <div className="path-row">
          <span className="path" title={settings.inputFolder ?? ''}>
            {shortPath(settings.inputFolder)}
          </span>
          <button className="mini-btn" onClick={onChooseInput}>
            Elegir
          </button>
        </div>
        {settings.inputFolder && (
          <button className="link-btn" onClick={onLoadInput}>
            Volver a listar videos de la carpeta
          </button>
        )}
      </div>

      <div className="field">
        <label>Carpeta de salida</label>
        <div className="path-row">
          <span className="path" title={settings.outputFolder ?? ''}>
            {shortPath(settings.outputFolder)}
          </span>
          <button className="mini-btn" onClick={onChooseOutput}>
            Elegir
          </button>
        </div>
        {!settings.outputFolder && (
          <p className="hint">Si no la defines, se usa la carpeta de cada video.</p>
        )}
      </div>

      <div className="field">
        <label>Calidad de exportación</label>
        <div className="segmented">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={settings.quality === opt.value ? 'seg active' : 'seg'}
              onClick={() => onChange({ quality: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Conversiones simultáneas</label>
        <div className="stepper">
          <button
            className="mini-btn"
            onClick={() => onChange({ maxConcurrent: Math.max(1, settings.maxConcurrent - 1) })}
          >
            −
          </button>
          <span className="stepper-value">{settings.maxConcurrent}</span>
          <button
            className="mini-btn"
            onClick={() => onChange({ maxConcurrent: Math.min(8, settings.maxConcurrent + 1) })}
          >
            +
          </button>
        </div>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={settings.overwrite}
          onChange={(e) => onChange({ overwrite: e.target.checked })}
        />
        Reemplazar archivos existentes
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={settings.useGpu}
          disabled={encoder ? !encoder.gpuAvailable : false}
          onChange={(e) => onChange({ useGpu: e.target.checked })}
        />
        Usar aceleración por GPU
      </label>

      {encoder && (
        <p className="engine">
          Motor: <strong>{encoder.label}</strong>
          {!encoder.gpuAvailable && ' (GPU no disponible en este equipo)'}
        </p>
      )}
    </aside>
  )
}
