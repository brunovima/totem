# ─────────────────────────────────────────────────────────────────────────────
# TOTEM — Electron Kiosk Container
# Compatível com Linux x64 e Raspberry Pi (arm64/armv7)
# Uso: docker-compose up
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-bookworm-slim

# Dependências de sistema para Electron (GTK3, X11, audio, GPU)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Electron core
    libgtk-3-0 \
    libnss3 \
    libxss1 \
    libxtst6 \
    libgbm1 \
    libdrm2 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libatspi2.0-0 \
    libnotify4 \
    # Fonte e áudio
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-liberation \
    fonts-noto \
    # Display virtual (kiosk sem monitor dedicado)
    xvfb \
    x11-utils \
    # Utilitários de rede (WiFi via nmcli)
    network-manager \
    # Limpeza
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências primeiro (cache layer)
COPY package*.json ./
RUN npm ci

# Copia o código-fonte e faz o build
COPY . .
RUN npm run build

# Volume para persistência: banco SQLite + arquivos de mídia
VOLUME ["/root/.config/totem"]

# Porta de desenvolvimento (opcional)
EXPOSE 5173

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
