import type { EncoderInfo, OutputFormat, Quality, Settings } from '../../shared/types'

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

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: 'mp4', label: 'MP4' },
  { value: 'gif', label: 'GIF' },
]

const GIF_SPEED_PRESETS = [0.5, 1, 1.5, 2, 3]
const GIF_SPEED_MIN = 0.25
const GIF_SPEED_MAX = 4

function formatSpeed(speed: number): string {
  const rounded = Number.isInteger(speed) ? speed.toFixed(0) : speed.toFixed(2).replace(/0+$/, '')
  return `${rounded}×`
}

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
        <label>Formato de salida</label>
        <div className="segmented">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={settings.outputFormat === opt.value ? 'seg active' : 'seg'}
              onClick={() => onChange({ outputFormat: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {settings.outputFormat === 'gif' && (
        <div className="field">
          <label>Velocidad del GIF</label>
          <div className="speed-row">
            <input
              className="speed-slider"
              type="range"
              min={GIF_SPEED_MIN}
              max={GIF_SPEED_MAX}
              step={0.25}
              value={settings.gifSpeed ?? 1}
              onChange={(e) => onChange({ gifSpeed: Number(e.target.value) })}
            />
            <span className="speed-value">{formatSpeed(settings.gifSpeed)}</span>
          </div>
          <div className="segmented speed-presets">
            {GIF_SPEED_PRESETS.map((speed) => (
              <button
                key={speed}
                className={settings.gifSpeed === speed ? 'seg active' : 'seg'}
                onClick={() => onChange({ gifSpeed: speed })}
              >
                {formatSpeed(speed)}
              </button>
            ))}
          </div>
          <p className="hint">
            Más de 1× acelera el GIF; menos de 1× lo ralentiza. El original no se modifica.
          </p>
        </div>
      )}

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
        {settings.outputFormat === 'gif' && (
          <p className="hint">En GIF controla resolución, fotogramas y colores.</p>
        )}
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
          disabled={settings.outputFormat === 'gif' || (encoder ? !encoder.gpuAvailable : false)}
          onChange={(e) => onChange({ useGpu: e.target.checked })}
        />
        Usar aceleración por GPU
      </label>

      {settings.outputFormat === 'gif' ? (
        <p className="engine">
          Motor: <strong>GIF · paleta (CPU)</strong>
        </p>
      ) : (
        encoder && (
          <p className="engine">
            Motor: <strong>{encoder.label}</strong>
            {!encoder.gpuAvailable && ' (GPU no disponible en este equipo)'}
          </p>
        )
      )}
    </aside>
  )
}
