#!/usr/bin/env bash
# =============================================================================
# TOTEM — Botão de Pânico: Resetar Senha do Administrador (Linux)
#
# QUANDO USAR: O operador esqueceu a senha do painel admin.
# O QUE FAZ:   Redefine a senha para o padrão: 1234
#
# IMPORTANTE: Feche o aplicativo TOTEM antes de executar este script.
# =============================================================================
set -euo pipefail

echo ""
echo "============================================"
echo " TOTEM — Reset de Senha do Administrador"
echo "============================================"
echo ""
echo " ATENÇÃO: Feche o TOTEM antes de continuar."
echo " A senha será redefinida para: 1234"
echo ""
read -r -p " Pressione ENTER para continuar ou Ctrl+C para cancelar..."
echo ""

# ── Localiza o binário do TOTEM ───────────────────────────────────────────────
TOTEM_BIN=""

# AppImage extraído / instalado via snap / flatpak / instalador .deb
CANDIDATES=(
  "$HOME/.local/bin/totem"
  "/usr/local/bin/totem"
  "/opt/TOTEM/totem"
  "/opt/totem/totem"
  "$HOME/Applications/TOTEM.AppImage"
  "/usr/bin/totem"
)

for c in "${CANDIDATES[@]}"; do
  if [ -f "$c" ] && [ -x "$c" ]; then
    TOTEM_BIN="$c"
    break
  fi
done

# Tenta localizar via which como último recurso
if [ -z "$TOTEM_BIN" ] && command -v totem &>/dev/null; then
  TOTEM_BIN="$(command -v totem)"
fi

if [ -z "$TOTEM_BIN" ]; then
  echo "[ERRO] Executável do TOTEM não encontrado."
  echo ""
  echo " Caminhos verificados:"
  for c in "${CANDIDATES[@]}"; do echo "   $c"; done
  echo ""
  echo " Solução manual:"
  echo "   1. Localize o executável: find / -name 'totem' -type f 2>/dev/null"
  echo "   2. Execute: /caminho/para/totem --reset-password"
  echo ""
  echo " Alternativa via AppImage:"
  echo "   ./TOTEM-*.AppImage --reset-password"
  echo ""
  exit 1
fi

echo "[OK] TOTEM encontrado em: $TOTEM_BIN"
echo ""
echo " Executando reset de senha..."
echo ""

"$TOTEM_BIN" --reset-password

echo ""
echo " Processo concluído."
echo " Se a caixa de diálogo confirmou o sucesso, a senha é agora: 1234"
echo ""
