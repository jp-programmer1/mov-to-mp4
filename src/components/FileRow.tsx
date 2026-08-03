import type { VideoJob } from '../../shared/types'
import { formatDuration, formatEta, formatSize } from '../lib/format'
import StatusBadge from './StatusBadge'

interface Props {
  job: VideoJob
  onRemove: (id: string) => void
  onCancel: (id: string) => void
  onReveal: (path: string) => void
}

export default function FileRow({ job, onRemove, onCancel, onReveal }: Props) {
  const showBar = job.status === 'converting' || job.status === 'completed'

  return (
    <div className={`row row-${job.status}`}>
      <div className="row-main">
        <div className="row-head">
          <span className="row-name" title={job.inputPath}>
            {job.fileName}
          </span>
          <StatusBadge status={job.status} />
        </div>

        <div className="row-meta">
          <span>{formatSize(job.size)}</span>
          <span>·</span>
          <span>{formatDuration(job.durationSec)}</span>
          {job.status === 'converting' && (
            <>
              <span>·</span>
              <span>{Math.round(job.progress)}%</span>
              <span>·</span>
              <span>Restante: {formatEta(job.etaSec)}</span>
              {job.speed != null && (
                <>
                  <span>·</span>
                  <span>{job.speed.toFixed(1)}x</span>
                </>
              )}
            </>
          )}
          {job.status === 'error' && job.error && (
            <span className="row-error" title={job.error}>
              {job.error}
            </span>
          )}
        </div>

        {showBar && (
          <div className="progress">
            <div
              className={`progress-fill ${job.status === 'completed' ? 'done' : ''}`}
              style={{ width: `${job.status === 'completed' ? 100 : job.progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="row-actions">
        {job.status === 'converting' ? (
          <button className="icon-btn" onClick={() => onCancel(job.id)} title="Cancelar">
            Cancelar
          </button>
        ) : job.status === 'completed' && job.outputPath ? (
          <button
            className="icon-btn"
            onClick={() => onReveal(job.outputPath!)}
            title="Mostrar archivo"
          >
            Mostrar
          </button>
        ) : (
          <button className="icon-btn" onClick={() => onRemove(job.id)} title="Quitar">
            Quitar
          </button>
        )}
      </div>
    </div>
  )
}
