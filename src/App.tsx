import { useConverter } from './hooks/useConverter'
import SettingsPanel from './components/SettingsPanel'
import FileRow from './components/FileRow'

export default function App() {
  const c = useConverter()

  if (!c.settings) {
    return <div className="loading">Cargando…</div>
  }

  const hasPending = c.jobs.some((j) => j.status === 'pending' || j.status === 'error')
  const globalPct = Math.round(c.stats.globalProgress)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">MOV</span>
          <span className="arrow">→</span>
          <span className={`logo ${c.settings.outputFormat}`}>{c.settings.outputFormat.toUpperCase()}</span>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={c.pickFiles}>
            Agregar videos…
          </button>
          {!c.isConverting ? (
            <button className="btn primary" onClick={c.start} disabled={!hasPending}>
              Iniciar conversión
            </button>
          ) : (
            <button className="btn danger" onClick={c.cancelAll}>
              Cancelar todo
            </button>
          )}
        </div>
      </header>

      {c.stats.total > 0 && (
        <div className="global">
          <div className="global-head">
            <span>
              Progreso global · {c.stats.completed}/{c.stats.total} completados
              {c.stats.errored > 0 && ` · ${c.stats.errored} con error`}
            </span>
            <span>{globalPct}%</span>
          </div>
          <div className="progress big">
            <div className="progress-fill" style={{ width: `${globalPct}%` }} />
          </div>
        </div>
      )}

      <div className="body">
        <main className="list">
          {c.jobs.length === 0 ? (
            <div className="empty">
              <p className="empty-title">No hay videos en la cola</p>
              <p className="empty-sub">
                Agrega archivos .mov o configura una carpeta de entrada para listarlos
                automáticamente.
              </p>
              <div className="empty-actions">
                <button className="btn" onClick={c.pickFiles}>
                  Seleccionar archivos
                </button>
                <button className="btn ghost" onClick={c.chooseInputFolder}>
                  Elegir carpeta
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="list-toolbar">
                <span className="count">{c.stats.total} en cola</span>
                <div className="list-toolbar-actions">
                  {c.stats.completed > 0 && (
                    <button className="link-btn" onClick={c.clearCompleted}>
                      Limpiar completados
                    </button>
                  )}
                  <button className="link-btn" onClick={c.clearAll}>
                    Vaciar lista
                  </button>
                </div>
              </div>
              {c.jobs.map((job) => (
                <FileRow
                  key={job.id}
                  job={job}
                  onRemove={c.removeJob}
                  onCancel={c.cancelJob}
                  onReveal={(p) => window.converter.showInFolder(p)}
                />
              ))}
            </>
          )}
        </main>

        <SettingsPanel
          settings={c.settings}
          encoder={c.encoder}
          onChange={c.updateSettings}
          onChooseInput={c.chooseInputFolder}
          onChooseOutput={c.chooseOutputFolder}
          onLoadInput={c.loadInputFolder}
        />
      </div>
    </div>
  )
}
