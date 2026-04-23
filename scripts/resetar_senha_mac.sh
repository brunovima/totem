#!/usr/bin/env bash
# =============================================================================
# TOTEM — Botão de Pânico: Resetar Senha do Administrador (macOS)
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

# Caminho padrão após instalação do .dmg
if [ -f "/Applications/TOTEM.app/Contents/MacOS/TOTEM" ]; then
  TOTEM_BIN="/Applications/TOTEM.app/Contents/MacOS/TOTEM"

# Pasta do usuário (se arrastado para ~/Applications)
elif [ -f "$HOME/Applications/TOTEM.app/Contents/MacOS/TOTEM" ]; then
  TOTEM_BIN="$HOME/Applications/TOTEM.app/Contents/MacOS/TOTEM"

# Tenta localizar via Spotlight (mdfind)
else
  FOUND="$(mdfind 'kMDItemCFBundleIdentifier == "com.totem.app"' 2>/dev/null | head -1)"
  if [ -n "$FOUND" ] && [ -f "$FOUND/Contents/MacOS/TOTEM" ]; then
    TOTEM_BIN="$FOUND/Contents/MacOS/TOTEM"
  fi
fi

if [ -z "$TOTEM_BIN" ]; then
  echo "[ERRO] Executável do TOTEM não encontrado."
  echo ""
  echo " Caminhos verificados:"
  echo "   /Applications/TOTEM.app/Contents/MacOS/TOTEM"
  echo "   ~/Applications/TOTEM.app/Contents/MacOS/TOTEM"
  echo ""
  echo " Solução: edite este script e defina o caminho manualmente:"
  echo "   TOTEM_BIN=\"/caminho/para/TOTEM.app/Contents/MacOS/TOTEM\""
  echo ""
  exit 1
fi

echo "[OK] TOTEM encontrado em: $TOTEM_BIN"
echo ""
echo " Executando reset de senha..."
echo ""

# Executa o TOTEM com a flag de reset e aguarda encerramento
"$TOTEM_BIN" --reset-password

echo ""
echo " Processo concluído."
echo " Se a caixa de diálogo confirmou o sucesso, a senha é agora: 1234"
echo ""
