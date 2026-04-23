# TOTEM — Contexto do Projeto para Claude

## Persona de engenharia

Atuar como **Engenheiro de Software Sênior especialista em aplicações Desktop Offline-First**.

## Regras inegociáveis de código

1. **IPC estrito** — toda comunicação com o banco de dados passa exclusivamente pelo `contextBridge` via IPC (`ipcMain.handle` / `ipcRenderer.invoke`). Nunca acessar `better-sqlite3` diretamente no renderer.
2. **Kiosk Mode first** — design voltado para telas touch sem mouse. Considerar teclado virtual vs. físico: nunca bloquear eventos `keydown` nativos em inputs com `stopPropagation` no capture phase.
3. **JSX seguro para Vite** — todo componente React deve compilar sem erro: usar `<>` Fragments quando necessário, garantir wrapping de múltiplas tags raiz, nunca retornar arrays soltos.
4. **Offline-first e resiliência** — priorizar performance sem rede. Tratar erros silenciosamente (try/catch em IPC calls, JSON.parse defensivo, fallbacks visuais para mídia que falha ao carregar).

## O que é este projeto

Aplicação kiosk para eventos/feiras — roda em tela touch, exibe vídeos em loop, capta leads, aplica quiz e exibe placar final. Toda a gestão é feita por um painel admin protegido por senha.

Stack: **Electron 39 + React 19 + electron-vite 5 + Vite 7 + better-sqlite3**.

---

## Estrutura de arquivos relevantes

```
src/
  main/
    index.js          ← processo principal Electron (IPC, protocol, WiFi, dialogs)
    database.js       ← schema SQLite + todos os ipcMain.handle()
  preload/
    index.js          ← contextBridge expondo window.api ao renderer
  renderer/src/
    App.jsx           ← roteador de telas (video → lead → quiz → thankyou → admin)
    components/
      VideoPlayer.jsx   ← playlist de vídeos (local + YouTube)
      LeadForm.jsx      ← captura nome/email antes do quiz
      QuizEngine.jsx    ← motor do quiz com idle timer
      ThankYou.jsx      ← tela pós-quiz com countdown 10s
      Frame.jsx         ← moldura + logo sobrepostos em todas as telas públicas
      AdminPanel.jsx    ← painel admin (6 abas)
      LoginScreen.jsx   ← tela de login do admin
      VirtualKeyboard.jsx
      useIdleTimer.js
Dockerfile
docker-compose.yml
docker/entrypoint.sh
```

---

## Banco de dados (SQLite via better-sqlite3)

Arquivo: `app.getPath('userData')/totem.db`

### Tabelas

| Tabela | Colunas relevantes |
|---|---|
| `quiz_titles` | `id, title, active` |
| `questions` | `id, quiz_id, text, options (JSON), correctIndex` |
| `leads` | `id, nome, email, score, data_hora` |
| `settings` | `key (PK), value` |
| `media` | `id, name, type (file\|youtube\|instagram\|tiktok\|image\|webpage), source, active, playlist_order, duration, created_at` |

### Migrations (aplicadas via try/catch em initDB)
```js
ALTER TABLE media ADD COLUMN playlist_order INTEGER DEFAULT 0
ALTER TABLE media ADD COLUMN duration INTEGER DEFAULT 60
UPDATE media SET playlist_order = id WHERE active = 1 AND playlist_order = 0
```

### Settings keys usadas
| Chave | Descrição |
|---|---|
| `admin_password` | Senha do painel admin (default: `1234`) |
| `border_color` | Cor hex da moldura (default: `#2563eb`) |
| `border_width` | Espessura em px da moldura (default: `8`) |
| `logo_path` | Caminho absoluto do logo do evento |
| `logo_position` | `top-right \| top-left \| bottom-right \| bottom-left` |
| `logo_size` | Tamanho máximo do logo em px (default: `80`) |

---

## IPC — window.api (preload → main)

```js
// Quizzes
getQuizzes()           → array
createQuiz(title)      → bool
toggleQuiz({id, active})
deleteQuiz(id)         → bool (atômico via db.transaction)

// Perguntas
getQuestions(quizId?)  → array (options já parseado)
saveQuestion(q)        → bool
deleteQuestion(id)     → bool

// Leads
getLeads()             → array
saveLead({nome, email, score}) → bool

// Settings
getSetting(key)        → string | null
setSetting(key, value) → bool

// Mídia — biblioteca
getMedia()             → array
saveMedia({name, type, source}) → lastInsertRowid
deleteMedia(id)        → bool (deleta arquivo físico se type==='file')

// Mídia — playlist
getPlaylist()          → array ordenado por playlist_order
togglePlaylist(id)     → bool (adiciona ao fim ou remove)
movePlaylistItem({id, direction: 'up'|'down'}) → bool
setMediaDuration({id, duration}) → bool

// Arquivos
pickVideoFile()        → {name, path} | null  (copia para userData/media/)
pickLogoFile()         → {name, path} | null

// WiFi
wifiScan()             → {networks: [{ssid, signal, secured}], error?}
wifiConnect({ssid, password}) → {success, error?}
wifiStatus()           → {connected, ssid}
```

---

## Protocolo customizado `totem-media://`

Serve arquivos locais (vídeo/imagem) ao renderer com suporte a **range requests** (necessário para `<video>`).

### Registro obrigatório ANTES de `app.whenReady()`
```js
protocol.registerSchemesAsPrivileged([
  { scheme: 'totem-media', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
])
```

### Handler (dentro de `app.whenReady()`)
Usa `createReadStream` + resposta HTTP 206 para range requests. **Não usar `net.fetch('file://...')`** — não suporta range requests e quebra streaming de vídeo.

### buildMediaUrl (usado em VideoPlayer, Frame, AdminPanel)
```js
function buildMediaUrl(filePath) {
  if (!filePath) return null
  const normalized = filePath.replace(/\\/g, '/')
  const withSlash = normalized.startsWith('/') ? normalized : '/' + normalized
  const encoded = withSlash.split('/').map(encodeURIComponent).join('/')
  return 'totem-media://' + encoded
}
```
**Crítico**: encode por segmento (não o path inteiro) para preservar `/` e codificar espaços como `Application Support`.

---

## CSP (src/renderer/index.html)

```
default-src 'self' totem-media:;
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: totem-media: blob:;
media-src 'self' totem-media: blob:;
frame-src https://www.youtube.com;
connect-src 'self' totem-media:;
```

**Atenção**: a CSP padrão do electron-vite não inclui `totem-media:` nem `frame-src youtube` — sem isso vídeos e iframes YouTube são bloqueados silenciosamente.

---

## Telas e fluxo

```
video → (toque) → lead → quiz → thankyou → (10s) → video
video → (ícone 🔒) → login → admin
```

- **Frame.jsx** é renderizado em todas as telas públicas (não no admin)
- **AdminPanel** renderiza via early return em App.jsx — não recebe `<Frame>`
- Logout do admin chama `window.location.reload()` para limpar estado

---

## AdminPanel — abas

| Aba | Funcionalidade |
|---|---|
| Quizzes | CRUD de quizzes + perguntas, ativar quiz |
| Leads | Listagem de participantes com score |
| Mídia | Playlist ordenada (▲▼) + biblioteca + upload local + URL YouTube |
| Wi-Fi | Status, scan de redes, conectar com senha |
| Personalização | Preview 16:9, cor/espessura da moldura, upload logo, posição, tamanho |
| Configurações | Alterar senha do admin |

---

## Playlist de vídeos

- `active=1` + `playlist_order` determinam a sequência
- Vídeos locais (`file`): avança via `onEnded` (quando há mais de 1 item)
- YouTube: avança via `setTimeout(handleNext, duration * 1000)`; fallback para local_file se iframe falhar
- Loop: se só 1 item, vídeo local faz `loop`, YouTube reinicia via parâmetro `loop=1&playlist=ID`
- **Instagram / TikTok:** exigem download via yt-dlp antes de reproduzir — sem iframe fallback
  - Ao adicionar: `saveMedia` → `startYoutubeDownload` imediato → `download_status: 'downloading'`
  - Enquanto baixa: VideoPlayer exibe overlay "Baixando conteúdo…" e gradient animado
  - Após conclusão: `onDownloadProgress` → `localFileStatus` resetado → reproduz como `<video>`
  - Erro de download: overlay de erro + skip automático após 6s

## IPC adicional — Social Media

```js
processSocial(url) → { type: 'instagram'|'tiktok'|'invalid', platform? }
```

`detectSocialPlatform()` em `main/index.js` valida padrões de URL Instagram e TikTok antes de aceitar.

---

## Tela de agradecimento (ThankYou.jsx)

- Countdown de 10s com `setInterval` + `clearInterval` no cleanup
- Estrelas: 0–3 baseado em percentual de acertos (< 50% = 0, < 75% = 1, < 100% = 2, 100% = 3)
- Auto-retorna à tela de vídeo ao fim do countdown

---

## WiFi

- **macOS**: `airport -s` para scan, `networksetup -setairportnetwork` para conectar
- **Linux**: `nmcli` para scan e conexão
- Usa `execFile` (não `exec`) — evita shell injection
- Interface detectada dinamicamente via `networksetup -listallhardwareports`

---

## Docker

```bash
docker-compose up --build   # sobe container com Xvfb
```

- `docker/entrypoint.sh` inicia `Xvfb :99` se `$DISPLAY` não definido
- Electron roda com `--no-sandbox` no container
- Volume `totem-data` persiste `userData` (banco + mídia)
- Requer `NET_ADMIN` capability para gestão WiFi

---

## Deploy e Empacotamento

### Estratégia
**Não usar Docker para produção.** Empacotamento nativo via `electron-builder` em ambientes reais (Windows, macOS, Linux) para garantir compilação correta do `better-sqlite3`.

### Blindagem Kiosk (produção)

Em `src/main/index.js`, a `BrowserWindow` de produção usa:
```js
fullscreen: !is.dev,
kiosk: !is.dev,
alwaysOnTop: !is.dev,
```

Dupla camada de bloqueio de atalhos de saída:
1. **`before-input-event`** — bloqueia `Ctrl/Cmd+W/Q/R`, `Alt+F4`, `F11` dentro da janela
2. **`globalShortcut`** — registra os mesmos como no-op no nível do sistema
3. **`globalShortcut.unregisterAll()`** no `will-quit` para não vazar registros

### Scripts de empacotamento

| Script | Resultado |
|---|---|
| `npm run build:win` | `dist/totem-<v>-setup.exe` |
| `npm run build:mac` | `dist/totem-<v>-x64.dmg` + `arm64.dmg` |
| `npm run build:linux` | `dist/totem-<v>.AppImage` |
| `npm run release:mac` | `release/TOTEM-v<v>-mac.zip` (instalador + scripts + README) |
| `npm run release:linux` | `release/TOTEM-v<v>-linux.zip` |
| `npm run release:win` | `release\TOTEM-v<v>-windows.zip` |

Pacotes de release ficam em `release/` (ignorado pelo git).

### Dependências externas (máquina hospedeira)

- `yt-dlp` + `ffmpeg` devem ser instalados na máquina do evento (não no build)
- Scripts: `scripts/install_dependencies.sh` (macOS/Linux) e `scripts/install_dependencies.bat` (Windows)
- O app busca `yt-dlp` em: `/usr/local/bin`, `/opt/homebrew/bin`, `/usr/bin`, `userData/yt-dlp`

### electron-builder.yml — targets definitivos

| Plataforma | Target | Arch |
|---|---|---|
| Windows | `nsis` | x64 |
| macOS | `dmg` + `zip` | x64 + arm64 |
| Linux | `AppImage` | x64 |

- `npmRebuild: true` — recompila `better-sqlite3` para a arquitetura alvo
- `asarUnpack: node_modules/better-sqlite3/**` — binários nativos fora do asar

---

## CI/CD — GitHub Actions

Arquivo: `.github/workflows/build.yml`

**Gatilhos:** push na `main` + `workflow_dispatch` (manual)

**Matriz:** `windows-latest`, `macos-latest`, `ubuntu-latest` — cada OS compila nativamente (crítico para `better-sqlite3`)

**Fluxo por runner:**
1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 20)
3. `actions/setup-python@v5` (para `node-gyp`)
4. Dependências de sistema (Linux: `apt`, Windows: `windows-build-tools`)
5. `npm ci` → aciona `postinstall` → recompila módulo nativo
6. `npm run release` → `electron-vite build` + `electron-builder`
7. `actions/upload-artifact@v4` → artefatos disponíveis em **Actions → workflow → Artifacts**

`CSC_IDENTITY_AUTO_DISCOVERY: false` desativa notarização macOS (exige conta paga Apple).

---

## Bugs corrigidos / decisões importantes

1. **`saveLead` undefined** — preload chamava IPC inexistente; handler adicionado em database.js
2. **`delete-quiz` não atômico** — substituído por `db.transaction()`
3. **Teclado físico bloqueado no admin** — `window.addEventListener('keydown', ..., true)` com `stopPropagation` impedia inputs; removido (desnecessário quando outros handlers estão desmontados)
4. **Vídeos não tocavam (tela branca)** — duas causas:
   - `protocol.registerSchemesAsPrivileged` ausente → range requests falhavam
   - CSP não incluía `totem-media:` → recursos bloqueados silenciosamente
   - `net.fetch('file://...')` não suporta range requests → substituído por `createReadStream` com HTTP 206
5. **Logo não aparecia** — `buildMediaUrl` não encodava espaços no path; corrigido com encode por segmento
6. **JSON.parse crash** — coluna `options` malformada no DB; envolvido em try/catch

---

## Comandos úteis

```bash
npm run dev           # desenvolvimento (hot reload)
npm run build         # compila React/Electron (sem empacotar)
npm run build:mac     # empacota .dmg para macOS
npm run build:linux   # empacota AppImage para Linux
npm run build:win     # empacota .exe para Windows
npm run release:mac   # build + zip para operador (macOS)
npm run release:linux # build + zip para operador (Linux)
npm run release:win   # build + zip para operador (Windows)
npm run start:container  # roda build no container (--no-sandbox)
```
