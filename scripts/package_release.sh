#!/usr/bin/env bash
# =============================================================================
# TOTEM — Gera pacote de distribuição para operadores de evento
#
# Uso:
#   ./scripts/package_release.sh [mac|linux|all]
#
# Padrão (sem argumento): detecta a plataforma atual
#
# Resultado:
#   release/TOTEM-v<versão>-<plataforma>.zip
#     ├── TOTEM-<versão>.dmg / .AppImage
#     ├── install_dependencies.sh
#     └── README.md
# =============================================================================
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[RELEASE]${NC} $*"; }
warn() { echo -e "${YELLOW}[AVISO]${NC}  $*"; }
err()  { echo -e "${RED}[ERRO]${NC}   $*"; exit 1; }

# ── Lê versão do package.json ─────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('${ROOT_DIR}/package.json').version")"
PLATFORM="${1:-}"

# Detecta plataforma atual se nenhuma for passada
if [ -z "$PLATFORM" ]; then
  case "$(uname -s)" in
    Darwin) PLATFORM="mac" ;;
    Linux)  PLATFORM="linux" ;;
    *)      err "Plataforma não detectada. Passe 'mac', 'linux' ou 'all' como argumento." ;;
  esac
fi

echo ""
echo -e "${BOLD}=== TOTEM v${VERSION} — Gerador de Pacote de Release ===${NC}"
echo ""

build_and_pack() {
  local platform="$1"
  local dist_dir="${ROOT_DIR}/dist"
  local release_dir="${ROOT_DIR}/release"
  local pkg_name="TOTEM-v${VERSION}-${platform}"
  local pkg_dir="${release_dir}/${pkg_name}"

  log "Compilando código React/Electron..."
  cd "$ROOT_DIR"
  npm run build

  log "Empacotando para ${platform}..."
  case "$platform" in
    mac)   npm run build:mac   ;;
    linux) npm run build:linux ;;
    *)     err "Plataforma inválida: $platform. Use mac, linux ou all." ;;
  esac

  log "Montando pasta de distribuição: ${pkg_name}/"
  rm -rf "$pkg_dir"
  mkdir -p "$pkg_dir"

  # Copia o instalador gerado
  case "$platform" in
    mac)
      local dmg
      dmg="$(find "$dist_dir" -maxdepth 1 -name "*.dmg" | head -1)"
      [ -z "$dmg" ] && err "Nenhum .dmg encontrado em dist/. O build falhou?"
      cp "$dmg" "$pkg_dir/"
      log "✓ Copiado: $(basename "$dmg")"
      ;;
    linux)
      local appimage
      appimage="$(find "$dist_dir" -maxdepth 1 -name "*.AppImage" | head -1)"
      [ -z "$appimage" ] && err "Nenhum .AppImage encontrado em dist/. O build falhou?"
      cp "$appimage" "$pkg_dir/"
      chmod +x "${pkg_dir}/$(basename "$appimage")"
      log "✓ Copiado: $(basename "$appimage")"
      ;;
  esac

  # Copia scripts e documentação
  cp "${ROOT_DIR}/scripts/install_dependencies.sh" "$pkg_dir/"
  chmod +x "${pkg_dir}/install_dependencies.sh"
  cp "${ROOT_DIR}/README.md" "$pkg_dir/"
  log "✓ Copiados: install_dependencies.sh, README.md"

  # Compacta
  local zip_path="${release_dir}/${pkg_name}.zip"
  log "Compactando → ${pkg_name}.zip ..."
  cd "$release_dir"
  zip -r "${pkg_name}.zip" "${pkg_name}/"
  rm -rf "$pkg_dir"

  echo ""
  log "Pacote gerado com sucesso:"
  echo -e "  ${BOLD}${zip_path}${NC}"
  echo -e "  Tamanho: $(du -sh "$zip_path" | cut -f1)"
  echo ""
}

mkdir -p "${ROOT_DIR}/release"

if [ "$PLATFORM" = "all" ]; then
  build_and_pack mac
  build_and_pack linux
  log "Todos os pacotes gerados em: ${ROOT_DIR}/release/"
else
  build_and_pack "$PLATFORM"
fi
