#!/usr/bin/env bash
# =============================================================================
# TOTEM — Gera o Kit do Operador para entrega (macOS)
#
# USO: bash scripts/gerar_kit_operador.sh [--skip-build]
#
#   --skip-build  Pula a etapa de compilação (usa dist/ existente)
#
# Pré-requisitos:
#   • Node.js + npm instalados
#   • electron-builder configurado (electron-builder.yml)
#   • Para build Windows: wine instalado (brew install --cask wine-stable)
#   • Para build Linux:   docker instalado ou ferramentas nativas
#
# O que gera:
#   ~/Desktop/Kit_Operador_TOTEM_V<versão>.zip
# =============================================================================
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[TOTEM]${NC} $*"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $*"; }
err()  { echo -e "${RED}[ERRO]${NC}  $*"; exit 1; }
step() { echo -e "\n${BOLD}$*${NC}"; }

# ── Lê versão do package.json ─────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -pe "require('./package.json').version" 2>/dev/null || echo "1.0.0")"
DESKTOP="$HOME/Desktop"
KIT_NAME="Kit_Operador_TOTEM_V${VERSION}"
KIT_DIR="$DESKTOP/$KIT_NAME"
ZIP_OUT="$DESKTOP/${KIT_NAME}.zip"
DIST_DIR="$PROJECT_DIR/dist"
SCRIPTS_DIR="$PROJECT_DIR/scripts"
SKIP_BUILD=false

# ── Flags ─────────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
  esac
done

echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}  TOTEM v${VERSION} — Gerador do Kit do Operador ${NC}"
echo -e "${BOLD}================================================${NC}"
echo ""

cd "$PROJECT_DIR"

# ── ETAPA 1: Compilação ───────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  step "[1/6] Compilando o projeto..."

  log "Rodando electron-vite build..."
  npm run build

  log "Empacotando para macOS..."
  npm run build:mac && log "✓ macOS concluído" || warn "Build macOS falhou — continuando sem binários macOS"

  # ATENÇÃO: build Windows cross-compilado do Mac gera better_sqlite3.node inválido no Windows.
  # O .exe para o kit DEVE vir do GitHub Actions (windows-latest runner).
  echo ""
  echo -e "${RED}${BOLD}  !! AVISO CRÍTICO — BUILD WINDOWS !!${NC}"
  echo -e "${YELLOW}  O instalador .exe NÃO deve ser gerado aqui (Mac).${NC}"
  echo -e "${YELLOW}  better-sqlite3 é um módulo nativo C++ — compilado no Mac,${NC}"
  echo -e "${YELLOW}  o arquivo .node resulta em erro no Windows:${NC}"
  echo -e "${YELLOW}  \"não é um aplicativo Win32 válido\"${NC}"
  echo ""
  echo -e "${BOLD}  SOLUÇÃO: usar o GitHub Actions para gerar o .exe${NC}"
  echo -e "  1. Acesse: seu repositório → Actions → \"Build TOTEM\""
  echo -e "  2. Clique em \"Run workflow\" (branch: main)"
  echo -e "  3. Aguarde ~10 min e baixe o artefato \"TOTEM-Windows\""
  echo -e "  4. Coloque o .exe baixado em dist/ e rode: bash scripts/gerar_kit_operador.sh --skip-build"
  echo ""
  warn "Pulando build Windows — use o artefato do GitHub Actions."

  log "Empacotando para Linux..."
  npm run build:linux && log "✓ Linux concluído" || warn "Build Linux falhou — continuando sem binários Linux"
else
  step "[1/6] Build pulado (--skip-build ativado)"
  warn "Usando instaladores existentes em dist/"
fi

# ── ETAPA 2: Cria a pasta de entrega ─────────────────────────────────────────
step "[2/6] Criando pasta de entrega..."
rm -rf "$KIT_DIR"
mkdir -p "$KIT_DIR"
log "Pasta criada: $KIT_DIR"

# ── ETAPA 3: Copia instaladores ───────────────────────────────────────────────
step "[3/6] Copiando instaladores de dist/..."

FOUND_INSTALLERS=0

copy_if_exists() {
  local pattern="$1"
  local label="$2"
  for f in $pattern; do
    [ -f "$f" ] || continue
    # Exclui pastas unpacked e arquivos de debug
    [[ "$f" == *"-unpacked"* ]] && continue
    [[ "$f" == *"blockmap"* ]]  && continue
    cp "$f" "$KIT_DIR/"
    log "✓ $(basename "$f")  ($label)"
    FOUND_INSTALLERS=$((FOUND_INSTALLERS + 1))
  done
}

copy_if_exists "$DIST_DIR"/*.exe       "Windows — instalador NSIS"
copy_if_exists "$DIST_DIR"/*.dmg       "macOS — imagem de disco"
copy_if_exists "$DIST_DIR"/*.AppImage  "Linux — AppImage portável"

# macOS .zip (gerado pelo electron-builder para atualização automática)
for f in "$DIST_DIR"/*.zip; do
  [ -f "$f" ] || continue
  [[ "$(basename "$f")" == *"mac"* ]] || [[ "$(basename "$f")" == *"Mac"* ]] || continue
  cp "$f" "$KIT_DIR/"
  log "✓ $(basename "$f")  (macOS — zip do .app)"
  FOUND_INSTALLERS=$((FOUND_INSTALLERS + 1))
done

# Torna AppImages executáveis
for f in "$KIT_DIR"/*.AppImage; do
  [ -f "$f" ] && chmod +x "$f"
done

if [ "$FOUND_INSTALLERS" -eq 0 ]; then
  err "Nenhum instalador encontrado em dist/. Execute sem --skip-build ou verifique o build."
fi

log "Total de instaladores copiados: $FOUND_INSTALLERS"

# ── ETAPA 4: Copia scripts de suporte ────────────────────────────────────────
step "[4/6] Copiando scripts de instalação e reset de senha..."

# Scripts de dependências
cp "$SCRIPTS_DIR/install_dependencies.sh"  "$KIT_DIR/"
cp "$SCRIPTS_DIR/install_dependencies.bat" "$KIT_DIR/"
chmod +x "$KIT_DIR/install_dependencies.sh"
log "✓ install_dependencies.sh  (macOS/Linux)"
log "✓ install_dependencies.bat  (Windows)"

# Scripts de reset de senha (Botão de Pânico)
cp "$SCRIPTS_DIR/resetar_senha_mac.sh"      "$KIT_DIR/"
cp "$SCRIPTS_DIR/resetar_senha_linux.sh"    "$KIT_DIR/"
cp "$SCRIPTS_DIR/resetar_senha_windows.bat" "$KIT_DIR/"
chmod +x "$KIT_DIR/resetar_senha_mac.sh"
chmod +x "$KIT_DIR/resetar_senha_linux.sh"
log "✓ resetar_senha_mac.sh"
log "✓ resetar_senha_linux.sh"
log "✓ resetar_senha_windows.bat"

# ── ETAPA 5: Gera o LEIA-ME_Instrucoes.txt ───────────────────────────────────
step "[5/6] Gerando LEIA-ME_Instrucoes.txt..."

cat > "$KIT_DIR/LEIA-ME_Instrucoes.txt" << MANUAL
================================================================================
  TOTEM INTERATIVO v${VERSION}
  Manual de Instalação e Operação para o Evento
================================================================================

CONTEÚDO DESTE PACOTE
─────────────────────
  Instaladores:
    • TOTEM-${VERSION}-setup.exe       → Windows (instalador guiado)
    • TOTEM-${VERSION}.dmg             → macOS (arraste para /Applications)
    • TOTEM-${VERSION}.AppImage        → Linux (portável, sem instalação)

  Scripts de Dependências (execute UMA VEZ antes de usar):
    • install_dependencies.sh          → macOS / Linux
    • install_dependencies.bat         → Windows (como Administrador)

  Scripts de Reset de Senha (Botão de Pânico):
    • resetar_senha_mac.sh             → macOS
    • resetar_senha_linux.sh           → Linux
    • resetar_senha_windows.bat        → Windows


================================================================================
  PARTE 1 — INSTALAÇÃO
================================================================================

── WINDOWS ──────────────────────────────────────────────────────────────────

  1. Clique com botão direito em "install_dependencies.bat"
     → Executar como Administrador
     (instala yt-dlp e ffmpeg via winget)

  2. Execute "TOTEM-${VERSION}-setup.exe"
     Siga o assistente de instalação.

  3. Abra o TOTEM pelo atalho criado na Área de Trabalho.

  Solução de problemas:
    • "App não verificado": clique em "Mais informações" → "Executar mesmo assim"
    • Se a tela ficar preta: reinicie o computador e tente novamente.


── MACOS ─────────────────────────────────────────────────────────────────────

  1. Abra o Terminal e execute:
       bash install_dependencies.sh
     (instala yt-dlp e ffmpeg via Homebrew)

  2. Abra "TOTEM-${VERSION}.dmg" e arraste o ícone TOTEM para /Applications.

  3. Na primeira execução: clique com botão direito no ícone
     → Abrir → confirme a abertura.

  Solução de problemas:
    • "App danificado": no Terminal, execute:
        xattr -d com.apple.quarantine /Applications/TOTEM.app
    • Permissão negada no script .sh:
        chmod +x install_dependencies.sh && bash install_dependencies.sh


── LINUX ─────────────────────────────────────────────────────────────────────

  1. No Terminal:
       bash install_dependencies.sh
     (instala yt-dlp e ffmpeg via apt/dnf/pacman)

  2. Torne o AppImage executável:
       chmod +x TOTEM-${VERSION}.AppImage

  3. Execute:
       ./TOTEM-${VERSION}.AppImage

  Solução de problemas:
    • Erro de FUSE (AppImage não abre):
        sudo apt install libfuse2   (Debian/Ubuntu)
    • Sem permissão de execução:
        chmod +x TOTEM-${VERSION}.AppImage


================================================================================
  PARTE 2 — OPERAÇÃO DO TOTEM
================================================================================

  FLUXO PADRÃO:
    Tela de Vídeo → (toque na tela) → Formulário de Lead → Quiz → Resultado

  ACESSO AO PAINEL ADMIN:
    • Toque no canto inferior direito da tela (zona invisível 80×80px)
    • Usuário: admin  |  Senha padrão: 1234

  PAINEL ADMIN — ABAS:
    ┌──────────────────┬────────────────────────────────────────────────────┐
    │ Quizzes          │ Criar/editar perguntas e respostas                 │
    │ Leads            │ Ver e exportar participantes                       │
    │ Mídia            │ Playlist de vídeos (local, YouTube, Instagram, TikTok) │
    │ Wi-Fi            │ Conectar a redes sem fio                           │
    │ Personalização   │ Logo, cor e espessura da moldura                   │
    │ Configurações    │ Alterar senha do admin                             │
    └──────────────────┴────────────────────────────────────────────────────┘

  ADICIONANDO VÍDEOS:
    • Local: arraste o arquivo .mp4 ou clique em "Carregar Arquivo"
    • YouTube: cole o link (ex: https://youtube.com/watch?v=...)
    • Instagram/TikTok: cole o link — download ocorre em background (pode
      levar até 60s; o vídeo aparece automaticamente na playlist quando pronto)

  EXPORTAR LEADS:
    Painel Admin → aba Leads → botão "Exportar CSV"


================================================================================
  PARTE 3 — BOTÃO DE PÂNICO (RESET DE SENHA)
================================================================================

  USE QUANDO: Esqueceu a senha do painel admin.

  ── Windows ──
    1. Feche o TOTEM
    2. Clique duas vezes em "resetar_senha_windows.bat"
    3. Siga as instruções na tela
    4. A nova senha será: 1234

  ── macOS ──
    1. Feche o TOTEM
    2. No Terminal: bash resetar_senha_mac.sh
    3. A nova senha será: 1234

  ── Linux ──
    1. Feche o TOTEM
    2. No Terminal: bash resetar_senha_linux.sh
    3. A nova senha será: 1234


================================================================================
  SUPORTE TÉCNICO
================================================================================

  Em caso de problemas não cobertos neste manual:
    • Reinicie o computador e tente novamente
    • Verifique se yt-dlp e ffmpeg estão instalados (scripts de dependências)
    • Exporte os logs em: Painel Admin → Configurações → Diagnóstico

  Versão do software: ${VERSION}
  Data de geração:    $(date '+%d/%m/%Y %H:%M')
================================================================================
MANUAL

log "✓ LEIA-ME_Instrucoes.txt gerado"

# ── Pausa para inclusão de PDFs extras ───────────────────────────────────────
echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${YELLOW}  AÇÃO MANUAL — INCLUSÃO DE ARQUIVOS EXTRAS${NC}"
echo -e "${BOLD}================================================${NC}"
echo ""
echo "  A pasta do kit está disponível em:"
echo "  ${KIT_DIR}"
echo ""
echo "  Você pode adicionar agora:"
echo "    • Manual_Operador.pdf        (versão formatada das instruções)"
echo "    • Contrato_Evento.pdf        (documentos do contrato)"
echo "    • Qualquer arquivo extra"
echo ""
echo "  Conteúdo atual da pasta:"
ls -lh "$KIT_DIR" | awk '{print "    " $0}'
echo ""
read -r -p "  Pressione ENTER quando estiver pronto para gerar o .zip..."
echo ""

# ── ETAPA 6: Compacta o kit ───────────────────────────────────────────────────
step "[6/6] Compactando → $(basename "$ZIP_OUT")..."

rm -f "$ZIP_OUT"
cd "$DESKTOP"
zip -r "$(basename "$ZIP_OUT")" "$(basename "$KIT_DIR")/"
rm -rf "$KIT_DIR"

ZIP_SIZE="$(du -sh "$ZIP_OUT" 2>/dev/null | cut -f1)"

echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${GREEN}  KIT GERADO COM SUCESSO!${NC}"
echo -e "${BOLD}================================================${NC}"
echo ""
echo "  Arquivo:  $(basename "$ZIP_OUT")"
echo "  Tamanho:  ${ZIP_SIZE}"
echo "  Local:    ${ZIP_OUT}"
echo ""
echo "  Este arquivo contém tudo que o operador"
echo "  precisa para instalar e configurar o TOTEM."
echo ""
