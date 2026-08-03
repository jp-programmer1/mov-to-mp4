import type { JobStatus } from '../../shared/types'

const LABELS: Record<JobStatus, string> = {
  pending: 'Pendiente',
  converting: 'Convirtiendo',
  completed: 'Completado',
  error: 'Error',
}

export default function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>
}
