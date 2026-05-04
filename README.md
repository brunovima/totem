# TOTEM — Manual de Instalação e Operação

Sistema de totem interativo para eventos e feiras. Exibe vídeos em loop, capta leads, aplica quiz e mostra placar. Roda 100% offline em modo kiosk de tela cheia.

**Stack:** Electron 39 · React 19 · SQLite (better-sqlite3) · electron-builder

---

## Índice

1. [Pré-requisitos de Build](#1-pré-requisitos-de-build)
2. [Instalação e Build](#2-instalação-e-build)
3. [Dependências Externas (yt-dlp / ffmpeg)](#3-dependências-externas)
4. [Credenciais Padrão](#4-credenciais-padrão)
5. [Configuração de Hardware e SO](#5-configuração-de-hardware-e-so)
6. [Checklist de Implantação](#6-checklist-de-implantação)
7. [Solução de Problemas](#7-solução-de-problemas)

---

## 1. Pré-requisitos de Build

A máquina de **desenvolvimento/build** precisa ter:

| Ferramenta | Versão mínima | Verificar |
|---|---|---|
| Node.js | 20 LTS | `node -v` |
| npm | 10+ | `npm -v` |
| Python 3 | 3.8+ (necessário para `node-gyp`) | `python3 --version` |
| Xcode CLT (macOS) | — | `xcode-select --install` |
| Visual Studio Build Tools (Windows) | 2019+ | `npm install --global windows-build-tools` |

> **Nota sobre melhor-sqlite3:** é um módulo nativo compilado via `node-gyp`. O script `postinstall` e o flag `npmRebuild: true` no `electron-builder.yml` garantem a recompilação automática para a arquitetura alvo.

---

## 2. Instalação e Build

### 2.1 Clonar e instalar dependências

```bash
git clone <url-do-repositório> totem
cd totem
npm install
# O script postinstall recompila better-sqlite3 automaticamente
```

### 2.2 Desenvolvimento (hot reload)

```bash
npm run dev
```

O app abre em modo janela (sem kiosk) para facilitar o desenvolvimento.

### 2.3 Build de produção

```bash
# Compila o código React/Electron (obrigatório antes de empacotar)
npm run build

# Empacota para cada plataforma:
npm run build:win    # → dist/totem-<versão>-setup.exe  (NSIS installer)
npm run build:mac    # → dist/totem-<versão>.dmg
npm run build:linux  # → dist/totem-<versão>.AppImage + .deb
```

> **Cross-compilation:** builds para Windows devem ser feitos em Windows; builds para macOS em macOS. Builds para Linux podem ser feitos em qualquer plataforma com Docker instalado (configure `electron-builder` com `--linux` em uma VM Linux se necessário).

### 2.4 Rebuild manual do módulo nativo (se necessário)

```bash
./node_modules/.bin/electron-rebuild -f -w better-sqlite3
```

---

## 3. Dependências Externas

O totem usa `yt-dlp` + `ffmpeg` para baixar vídeos do YouTube como MP4 local. Essas ferramentas devem ser instaladas **na máquina onde o totem roda**, não na máquina de build.

### Windows

```bat
# Execute como Administrador:
scripts\install_dependencies.bat
```

### macOS / Linux

```bash
chmod +x scripts/install_dependencies.sh
./scripts/install_dependencies.sh
```

### Instalação manual (alternativa)

```bash
# macOS
brew install yt-dlp ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg
sudo pip3 install -U yt-dlp

# Windows (PowerShell como Admin)
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

> **Funcionamento sem yt-dlp:** o totem roda normalmente. Apenas a função de "baixar YouTube como MP4 local" fica indisponível. Vídeos do YouTube continuam tocando via embed iframe.

---

## 4. Credenciais Padrão

| Campo | Valor padrão |
|---|---|
| Usuário admin | `admin` |
| Senha admin | `1234` |

**Altere a senha imediatamente após a primeira instalação** via Painel Admin → aba **Configurações**.

O banco de dados fica em:
- **Windows:** `%APPDATA%\totem-app\totem.db`
- **macOS:** `~/Library/Application Support/totem-app/totem.db`
- **Linux:** `~/.config/totem-app/totem.db`

---

## 5. Configuração de Hardware e SO

### 5.1 Windows (recomendado para eventos)

**Abrir:** `Configurações do Windows → Sistema`

#### Desativar suspensão e proteção de tela

```
Configurações → Sistema → Energia e suspensão
  ├── Tela: Nunca
  └── Suspensão: Nunca

Configurações → Personalização → Tela de bloqueio → Protetor de tela
  └── Protetor de tela: Nenhum
```

#### Desativar atualizações automáticas

```
Configurações → Windows Update → Opções avançadas
  └── Pausar atualizações: pausar pelo máximo de tempo disponível

# Via política de grupo (Pro/Enterprise):
gpedit.msc → Configuração do Computador → Modelos Administrativos
  → Componentes do Windows → Windows Update
  → Configurar Atualizações Automáticas: Desabilitado
```

#### Desativar notificações

```
Configurações → Sistema → Notificações
  └── Notificações: Desativar tudo
```

#### Configurar inicialização automática com a energia

```
# Opção 1: BIOS/UEFI
  Power Management → Power On By AC Power: Enabled
  (nome varia por fabricante — consulte o manual da placa-mãe)

# Opção 2: Colocar atalho na pasta de inicialização
  Win+R → shell:startup → copiar atalho do TOTEM.exe
```

#### Desativar ação ao fechar a tampa (notebooks)

```
Configurações → Sistema → Energia e suspensão → Configurações de energia adicionais
  → Escolher o que o botão de energia e a tampa fazem
  → Ao fechar a tampa: Não fazer nada (plugado e na bateria)
```

---

### 5.2 macOS

#### Desativar suspensão

```bash
# Via Terminal (permanente):
sudo pmset -a sleep 0 disksleep 0 displaysleep 0 powernap 0

# Via interface:
Preferências do Sistema → Bateria (ou Economia de Energia)
  └── Desligar tela: Nunca
```

#### Desativar atualizações automáticas

```
Preferências do Sistema → Atualização de Software
  └── Desmarcar "Manter meu Mac atualizado automaticamente"
```

#### Inicialização automática

```
Preferências do Sistema → Usuários e Grupos → Itens de Login
  → Adicionar TOTEM.app
```

#### Desativar notificações e "Não Perturbe"

```
Preferências do Sistema → Notificações e Foco
  └── Ativar Foco "Não Perturbe" 24h ou desativar notificações por app
```

---

### 5.3 Linux (Ubuntu/Debian — painéis/RPi)

```bash
# Desativar suspensão/screensaver via gsettings
gsettings set org.gnome.desktop.session idle-delay 0
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing'

# Ou via X11 (sessões sem GNOME):
xset s off          # desativa screensaver
xset -dpms          # desativa gerenciamento de energia do monitor
xset s noblank      # evita blank da tela

# Inicialização automática (systemd)
sudo nano /etc/systemd/system/totem.service
```

```ini
[Unit]
Description=TOTEM Kiosk
After=graphical.target

[Service]
Type=simple
User=<seu_usuario>
Environment=DISPLAY=:0
ExecStart=/opt/TOTEM/totem --no-sandbox
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
```

```bash
sudo systemctl enable totem
sudo systemctl start totem
```

---

## 6. Checklist de Implantação

Antes de deixar o totem operando no evento, valide cada item:

### Hardware

- [ ] Monitor conectado e resolução configurada (recomendado: 1920×1080)
- [ ] Tela touch calibrada (se aplicável)
- [ ] Teclado e mouse removidos ou guardados (modo kiosk — não são necessários)
- [ ] Computador preso/travado fisicamente no suporte do totem
- [ ] Fonte de alimentação com estabilizador ou no-break (UPS)
- [ ] Cabo de rede ou Wi-Fi configurado (se necessário para YouTube)

### Sistema Operacional

- [ ] Suspensão de tela: **Desativada**
- [ ] Protetor de tela: **Desativado**
- [ ] Atualizações automáticas: **Pausadas/Desativadas**
- [ ] Notificações do SO: **Desativadas**
- [ ] Inicialização automática do TOTEM: **Configurada**
- [ ] Reinicialização automática após corte de energia: **Configurada na BIOS**

### Aplicação

- [ ] `scripts/install_dependencies` executado na máquina hospedeira
- [ ] Senha do admin alterada (padrão: `1234`)
- [ ] Quiz ativo configurado com perguntas
- [ ] Playlist de vídeos configurada e testada
- [ ] Logo do evento adicionado
- [ ] Moldura com cor do evento configurada
- [ ] Lead form testado (nome + e-mail salvos corretamente)
- [ ] Tela de agradecimento exibindo estrelas e countdown corretamente
- [ ] Teste de ciclo completo: vídeo → lead → quiz → agradecimento → retorno ao vídeo

---

## 7. Solução de Problemas

### Vídeos não tocam (tela branca)

1. Verifique se o arquivo existe em `userData/media/` (Painel Admin → Diagnóstico)
2. Confirme que `totem-media://` está na CSP do `index.html`
3. Em desenvolvimento, verifique o console do Electron (`Ctrl+Shift+I`)

### yt-dlp não encontrado

```bash
# Verifique os caminhos buscados pelo app:
/usr/local/bin/yt-dlp
/opt/homebrew/bin/yt-dlp
/usr/bin/yt-dlp
<userData>/yt-dlp  ← coloque o binário aqui como fallback
```

### better-sqlite3 falha ao iniciar (módulo nativo errado)

```bash
# Recompila para a versão correta do Electron:
./node_modules/.bin/electron-rebuild -f -w better-sqlite3
# Ou:
npm run postinstall
```

### Teclado virtual não aparece

O `VirtualKeyboard.jsx` é exibido automaticamente quando um `<input>` recebe foco em modo kiosk. Se não aparecer, verifique se o componente está montado no `App.jsx` e se não há `e.stopPropagation()` capturando eventos `focus` no capture phase.

### App fecha com Alt+F4 / Cmd+Q mesmo em produção

Os `globalShortcut` do Electron são registrados por processo. Se outro processo tiver precedência, use o gerenciador de janelas do SO para bloquear atalhos de sistema adicionalmente:

```bash
# Linux/GNOME: desativar atalho de fechar janela
gsettings set org.gnome.desktop.wm.keybindings close "[]"
```

### API REST não responde (porta 3131)

```bash
# Verifica se a porta está em uso:
lsof -i :3131       # macOS/Linux
netstat -ano | findstr :3131  # Windows

# O app loga o IP ao iniciar:
[REST] API disponível em http://<IP>:3131
```

---

## Estrutura de Dados (userData)

```
<userData>/
  totem.db          ← banco SQLite (quizzes, leads, settings, playlist)
  media/
    vid_<ts>.mp4    ← vídeos locais enviados pelo admin
    img_<ts>.png    ← imagens locais
    logo_<ts>.png   ← logos do evento
    ytdlp_<id>_<ts>.mp4  ← downloads do YouTube via yt-dlp
```

---

## Licença

Uso interno — todos os direitos reservados.
