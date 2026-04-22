#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TOTEM — Script de instalação de dependências externas (macOS / Linux)
# Execute UMA VEZ na máquina hospedeira antes de iniciar o totem.
#
# Dependências instaladas:
#   • yt-dlp  — download de vídeos do YouTube como MP4 local
#   • ffmpeg  — mescla streams de áudio+vídeo (exigido pelo yt-dlp)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[TOTEM]${NC} $*"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $*"; }
err()  { echo -e "${RED}[ERRO]${NC}  $*"; exit 1; }

echo ""
echo -e "${BOLD}=== TOTEM — Instalação de Dependências ===${NC}"
echo ""

# ── Detecta plataforma ────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
log "Plataforma: $OS / $ARCH"

# ── macOS ─────────────────────────────────────────────────────────────────────
if [ "$OS" = "Darwin" ]; then
  # Verifica Homebrew
  if ! command -v brew &>/dev/null; then
    warn "Homebrew não encontrado. Instalando..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi

  log "Atualizando Homebrew..."
  brew update --quiet

  log "Instalando yt-dlp..."
  brew install yt-dlp || brew upgrade yt-dlp

  log "Instalando ffmpeg..."
  brew install ffmpeg || brew upgrade ffmpeg

# ── Linux (Debian / Ubuntu / Raspbian) ───────────────────────────────────────
elif [ "$OS" = "Linux" ]; then
  if command -v apt-get &>/dev/null; then
    log "Atualizando repositórios apt..."
    sudo apt-get update -q

    log "Instalando ffmpeg..."
    sudo apt-get install -y ffmpeg

    log "Instalando yt-dlp via pip3 (versão mais recente)..."
    if ! command -v pip3 &>/dev/null; then
      sudo apt-get install -y python3-pip
    fi
    sudo pip3 install -U yt-dlp

  elif command -v dnf &>/dev/null; then
    log "Instalando ffmpeg (Fedora/RHEL)..."
    sudo dnf install -y ffmpeg yt-dlp

  elif command -v pacman &>/dev/null; then
    log "Instalando ffmpeg e yt-dlp (Arch Linux)..."
    sudo pacman -S --noconfirm ffmpeg yt-dlp

  else
    err "Gerenciador de pacotes não suportado. Instale manualmente: https://ffmpeg.org e https://github.com/yt-dlp/yt-dlp"
  fi

else
  err "Sistema operacional não suportado: $OS"
fi

# ── Validação ─────────────────────────────────────────────────────────────────
echo ""
log "Verificando instalações..."

if command -v yt-dlp &>/dev/null; then
  log "✓ yt-dlp $(yt-dlp --version)"
else
  warn "yt-dlp não encontrado no PATH. Downloads de YouTube ficarão indisponíveis."
fi

if command -v ffmpeg &>/dev/null; then
  log "✓ ffmpeg $(ffmpeg -version 2>&1 | head -1 | cut -d' ' -f3)"
else
  warn "ffmpeg não encontrado. Qualidade de download pode ser reduzida."
fi

echo ""
log "Instalação concluída. Você já pode iniciar o TOTEM."
echo ""
