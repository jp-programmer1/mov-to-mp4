#!/bin/sh
# Reinstala el binario de Electron sin usar el instalador de Node
# (descarga el zip con curl y lo descomprime con ditto, nativo de macOS).
set -e
VERSION=33.4.11
ARCH=arm64
cd "$(dirname "$0")"
EL="node_modules/.pnpm/electron@${VERSION}/node_modules/electron"
ZIP="/tmp/electron-v${VERSION}-darwin-${ARCH}.zip"

[ -d "$EL" ] || { echo "No encuentro $EL — corré pnpm install primero"; exit 1; }

echo "→ Descargando Electron ${VERSION} (${ARCH})…"
curl -fL --progress-bar -o "$ZIP" \
  "https://github.com/electron/electron/releases/download/v${VERSION}/electron-v${VERSION}-darwin-${ARCH}.zip"

echo "→ Descomprimiendo…"
rm -rf "$EL/dist"
mkdir -p "$EL/dist"
ditto -x -k "$ZIP" "$EL/dist"
printf 'Electron.app/Contents/MacOS/Electron' > "$EL/path.txt"
rm -f "$ZIP"

echo "→ Listo: $(du -sh "$EL/dist" | cut -f1) instalados. Ahora corré: pnpm dev"
