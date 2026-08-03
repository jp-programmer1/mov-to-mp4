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
pnpm run dist:mac    # genera un .dmg en release/ (macOS)
# npm run dist       # empaqueta para el sistema operativo actual
```

El resultado queda en la carpeta `release/`. Los binarios de FFmpeg se copian sin comprimir (`asarUnpack`) para que funcionen dentro de la app empaquetada.

> En macOS, como la app no está firmada con una cuenta de desarrollador de Apple, la primera vez debes abrirla con clic derecho → **Abrir**.

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
