#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────────────────────
# TOTEM — Entrypoint Docker
# Inicia display virtual se necessário e executa o app Electron
# ─────────────────────────────────────────────────────────────────────────────

SCREEN_RES="${SCREEN_RESOLUTION:-1920x1080x24}"

# Se não houver display externo configurado, inicializa Xvfb
if [ -z "$DISPLAY" ]; then
    echo "[TOTEM] Iniciando display virtual Xvfb ($SCREEN_RES)..."
    rm -f /tmp/.X99-lock
    Xvfb :99 -screen 0 "$SCREEN_RES" -ac +extension GLX &
    export DISPLAY=:99

    # Aguarda Xvfb inicializar
    TIMEOUT=10
    until xdpyinfo -display :99 >/dev/null 2>&1; do
        TIMEOUT=$((TIMEOUT - 1))
        [ "$TIMEOUT" -le 0 ] && echo "[TOTEM] ERRO: Xvfb não iniciou." && exit 1
        sleep 0.5
    done
    echo "[TOTEM] Display :99 pronto."
fi

# Electron requer --no-sandbox dentro de containers Docker
# (user namespaces geralmente não disponíveis em containers)
exec ./node_modules/.bin/electron --no-sandbox out/main/index.js
