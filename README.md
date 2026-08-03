# MOV → MP4

Conversor de video **100 % local** para transformar archivos `.mov` a `.mp4`. Nada se sube a internet: la conversión usa la CPU (y la GPU cuando está disponible) de tu propia máquina mediante FFmpeg.

Construido con **Electron + React + Vite + TypeScript**, con **FFmpeg** embebido (`ffmpeg-static`), así que no necesitas instalar FFmpeg por separado.

## Características

- Selección de uno o varios archivos `.mov`, o listado automático desde una carpeta de entrada configurable.
- Estado por archivo: **Pendiente**, **Convirtiendo**, **Completado**, **Error**.
- Barra de progreso individual + barra de progreso global.
- Muestra nombre, tamaño, duración, porcentaje, velocidad (x) y tiempo estimado restante.
- Botón para iniciar y para cancelar todas las conversiones (o cancelar una sola).
- Carpeta de salida configurable; conserva el nombre original y solo cambia la extensión a `.mp4`.
- Calidad **Alta / Media / Baja**, opción de reemplazar archivos existentes y control de conversiones simultáneas.
- Aceleración por GPU en macOS (VideoToolbox) cuando el build de FFmpeg la soporta; si no, usa CPU (libx264) automáticamente.
- Los archivos de salida usan `+faststart`, ideales para reproducción web.

## Requisitos

- Node.js 18 o superior.

## Puesta en marcha (desarrollo)

```bash
cd mov-to-mp4
pnpm install
pnpm run dev
```

Se abrirá la ventana de la aplicación. La primera instalación descarga Electron y los binarios de FFmpeg, así que puede tardar un poco.

## Empaquetar como app de escritorio

```bash
pnpm run dist:mac     # .dmg   (macOS)
pnpm run dist:win     # .exe   (Windows, instalador NSIS)
pnpm run dist:linux   # .AppImage (Linux)
pnpm run dist         # empaqueta para el sistema operativo actual
```

El resultado queda en la carpeta `release/`. Los binarios de FFmpeg se copian sin comprimir (`asarUnpack`) para que funcionen dentro de la app empaquetada.

> **Importante:** cada instalador debe compilarse en su sistema operativo nativo. `electron-builder` **no** genera de forma fiable el `.exe` de Windows desde macOS. Tienes dos caminos recomendados:

### Opción A — GitHub Actions (recomendada, sin necesidad de una PC Windows)

El repo incluye `.github/workflows/build.yml`, que compila en runners nativos de **Windows** y **macOS** a la vez.

- Ejecución manual: pestaña **Actions → Build installers → Run workflow**. Los instaladores quedan como *artifacts* descargables.
- Al publicar un tag de versión, además se adjuntan a una Release:

  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```

### Opción B — Compilar localmente en Windows

En una máquina Windows con Node 18+ y pnpm:

```bash
pnpm install
pnpm run dist:win
```

El instalador NSIS permite elegir la carpeta de instalación y crea accesos directos en escritorio y menú inicio.

> El instalador de Windows no está firmado (sin certificado de código), así que SmartScreen puede mostrar una advertencia la primera vez: **Más información → Ejecutar de todas formas**. En macOS, al no estar firmada con cuenta de desarrollador de Apple, ábrela la primera vez con clic derecho → **Abrir**.

## Aceleración por hardware (GPU)

La app detecta automáticamente el mejor codificador disponible según el sistema y cae a CPU (libx264) si no hay ninguno:

| Sistema | Codificadores GPU (en orden de preferencia) |
| --- | --- |
| macOS | VideoToolbox |
| Windows | NVIDIA NVENC · Intel Quick Sync · AMD AMF |
| Linux | NVIDIA NVENC · Intel Quick Sync |

Si un codificador está listado pero el equipo no tiene el hardware compatible, la conversión reintenta automáticamente en CPU, de modo que nunca queda un archivo a medias.

## Estructura del proyecto

```
mov-to-mp4/
├── electron/          # Proceso principal (Node)
│   ├── main.ts        # Ventana, IPC, diálogos de archivos
│   ├── preload.ts     # Puente seguro renderer ↔ main (window.converter)
│   ├── converter.ts   # Cola de conversión, concurrencia, progreso, cancelación
│   ├── ffmpeg.ts      # Rutas de FFmpeg, detección de codificadores, calidad
│   └── settings.ts    # Persistencia de configuración
├── shared/types.ts    # Tipos compartidos entre main y renderer
├── src/               # Interfaz React
│   ├── App.tsx
│   ├── hooks/useConverter.ts
│   ├── components/     # FileRow, SettingsPanel, StatusBadge
│   └── lib/format.ts   # Formato de tamaño, duración y ETA
└── package.json
```

## Cómo se comunican frontend y backend

En lugar de un servidor HTTP, se usa el **IPC de Electron** (más rápido y sin abrir puertos). El proceso principal expone una API tipada en `window.converter` a través de `preload.ts` con `contextBridge`, manteniendo `contextIsolation` activado por seguridad.

## Extender a otros formatos (AVI, MKV, WEBM…)

El diseño ya está preparado para escalar:

1. En `electron/main.ts`, añade las extensiones a `SUPPORTED_EXTENSIONS` y al filtro del diálogo (`files:pick`).
2. La lógica de conversión en `converter.ts` / `ffmpeg.ts` es agnóstica al formato de entrada, así que normalmente no requiere cambios para nuevas entradas.

## Notas de rendimiento

- Los archivos grandes (varios GB) se procesan como streams por FFmpeg, sin cargarse en memoria.
- La concurrencia por defecto es 2; súbela si tu equipo tiene CPU/GPU de sobra, bájala para máxima estabilidad.
- Calidad **Alta** con CPU usa `preset slow` + `crf 18` (mejor calidad, más lento). **Baja** usa `veryfast` + `crf 28`.
