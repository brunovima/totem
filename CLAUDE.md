# TOTEM — Contexto do Projeto para Claude

## Persona de engenharia

Atuar como **Engenheiro de Software Sênior especialista em aplicações Desktop Offline-First**.

## Regras inegociáveis de código

1. **IPC estrito** — toda comunicação com o banco de dados passa exclusivamente pelo `contextBridge` via IPC (`ipcMain.handle` / `ipcRenderer.invoke`). Nunca acessar `better-sqlite3` diretamente no renderer.
2. **Kiosk Mode first** — design voltado para telas touch sem mouse. Considerar teclado virtual vs. físico: nunca bloquear eventos `keydown` nativos em inputs com `stopPropagation` no capture phase.
3. **JSX seguro para Vite** — todo componente React deve compilar sem erro: usar `<>` Fragments quando necessário, garantir wrapping de múltiplas tags raiz, nunca retornar arrays soltos.
4. **Offline-first e resiliência** — priorizar performance sem rede. Tratar erros silenciosamente (try/catch em IPC calls, JSON.parse defensivo, fallbacks visuais para mídia que falha ao carregar).

## O que é este projeto

<<<<<<< HEAD
Aplicação kiosk para eventos/feiras — roda em tela touch, exibe vídeos em loop, capta leads (nome + telefone + email opcional), aplica quiz e exibe placar final. Toda a gestão é feita por um painel admin protegido por senha.
=======
Aplicação kiosk para eventos/feiras — roda em tela touch, exibe vídeos em loop, capta leads, aplica quiz e exibe placar final. Toda a gestão é feita por um painel admin protegido por senha.
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618

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
<<<<<<< HEAD
      VideoPlayer.jsx     ← playlist de vídeos (local + YouTube)
      LeadForm.jsx        ← captura nome/telefone/email antes do quiz
      QuizEngine.jsx      ← motor do quiz com idle timer
      ThankYou.jsx        ← tela pós-quiz com countdown 10s
      Frame.jsx           ← moldura + logo sobrepostos em todas as telas públicas
      AdminPanel.jsx      ← painel admin (7 abas)
      LoginScreen.jsx     ← tela de login do admin
      VirtualKeyboard.jsx ← teclado QWERTY + modo numérico (prop numericMode)
      useIdleTimer.js
=======
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
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
```

---

## Banco de dados (SQLite via better-sqlite3)

Arquivo: `app.getPath('userData')/totem.db`

### Tabelas

| Tabela | Colunas relevantes |
|---|---|
| `quiz_titles` | `id, title, active` |
| `questions` | `id, quiz_id, text, options (JSON), correctIndex` |
<<<<<<< HEAD
| `leads` | `id, nome, telefone, email, score, data_hora` |
| `settings` | `key (PK), value` |
| `media` | `id, name, type, source, active, playlist_order, duration, schedule_*, local_file, download_status, created_at` |
=======
| `leads` | `id, nome, email, score, data_hora` |
| `settings` | `key (PK), value` |
| `media` | `id, name, type (file\|youtube\|instagram\|tiktok\|image\|webpage), source, active, playlist_order, duration, created_at` |
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618

### Migrations (aplicadas via try/catch em initDB)
```js
ALTER TABLE media ADD COLUMN playlist_order INTEGER DEFAULT 0
ALTER TABLE media ADD COLUMN duration INTEGER DEFAULT 60
<<<<<<< HEAD
ALTER TABLE media ADD COLUMN schedule_start_date TEXT DEFAULT ''
ALTER TABLE media ADD COLUMN schedule_end_date TEXT DEFAULT ''
ALTER TABLE media ADD COLUMN schedule_start_time TEXT DEFAULT ''
ALTER TABLE media ADD COLUMN schedule_end_time TEXT DEFAULT ''
ALTER TABLE media ADD COLUMN local_file TEXT DEFAULT ''
ALTER TABLE media ADD COLUMN download_status TEXT DEFAULT ''
ALTER TABLE leads ADD COLUMN telefone TEXT DEFAULT ''
=======
UPDATE media SET playlist_order = id WHERE active = 1 AND playlist_order = 0
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
```

### Settings keys usadas
| Chave | Descrição |
|---|---|
<<<<<<< HEAD
| `admin_username` | Usuário do painel admin (default: `admin`) |
=======
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
| `admin_password` | Senha do painel admin (default: `1234`) |
| `border_color` | Cor hex da moldura (default: `#2563eb`) |
| `border_width` | Espessura em px da moldura (default: `8`) |
| `logo_path` | Caminho absoluto do logo do evento |
| `logo_position` | `top-right \| top-left \| bottom-right \| bottom-left` |
| `logo_size` | Tamanho máximo do logo em px (default: `80`) |
<<<<<<< HEAD
| `energy_sleep_enabled` | `'true'` \| `'false'` |
| `energy_sleep_time` | Hora dormir (default: `23:00`) |
| `energy_wake_time` | Hora acordar (default: `07:00`) |
=======
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618

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
<<<<<<< HEAD
getLeads()             → array  (inclui campo telefone)
saveLead({nome, telefone, email, score}) → bool
deleteLeads(ids)       → bool
=======
getLeads()             → array
saveLead({nome, email, score}) → bool
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618

// Settings
getSetting(key)        → string | null
setSetting(key, value) → bool

// Mídia — biblioteca
getMedia()             → array
saveMedia({name, type, source}) → lastInsertRowid
<<<<<<< HEAD
deleteMedia(id)        → bool

// Mídia — playlist
getPlaylist()          → array ordenado por playlist_order
togglePlaylist(id)     → bool
movePlaylistItem({id, direction: 'up'|'down'}) → bool
setMediaDuration({id, duration}) → bool
setMediaSchedule({id, startDate, endDate, startTime, endTime}) → bool

// Arquivos
uploadMedia({type})    → {name, filename} | null
=======
deleteMedia(id)        → bool (deleta arquivo físico se type==='file')

// Mídia — playlist
getPlaylist()          → array ordenado por playlist_order
togglePlaylist(id)     → bool (adiciona ao fim ou remove)
movePlaylistItem({id, direction: 'up'|'down'}) → bool
setMediaDuration({id, duration}) → bool

// Arquivos
pickVideoFile()        → {name, path} | null  (copia para userData/media/)
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
pickLogoFile()         → {name, path} | null

// WiFi
wifiScan()             → {networks: [{ssid, signal, secured}], error?}
wifiConnect({ssid, password}) → {success, error?}
wifiStatus()           → {connected, ssid}
```

---

<<<<<<< HEAD
## LeadForm — Campo Telefone (v1.2.0)

### Campos e obrigatoriedade
| Campo | Obrigatório | Validação |
|---|---|---|
| Nome | Sim | mínimo 3 caracteres |
| Telefone | Sim | mínimo 10 dígitos (DDD + número) |
| E-mail | Não | se preenchido, deve ser válido |

### Código de país
- Padrão: `+55` (Brasil), lista de 15 países em `COUNTRY_CODES`
- Selecionável via `<select>` (touch/click, sem VirtualKeyboard)

### Máscara de telefone
```
+55: (DD) XXXX-XXXX / (DD) XXXXX-XXXX (10 ou 11 dígitos)
Outros: grupos de 4 dígitos separados por espaço
```

### VirtualKeyboard — modo numérico
```jsx
<VirtualKeyboard numericMode={activeField === 'telefone'} />
// numericMode=true  → numpad 3x4 (0-9 + backspace)
// numericMode=false → QWERTY completo (padrão)
```

### Dado salvo no banco
```
telefone = "+55 (11) 99999-9999"
```

---

## Protocolo customizado `totem-media://`

Serve arquivos locais com suporte a **range requests** (necessário para `<video>`).

```js
// Registro ANTES de app.whenReady()
protocol.registerSchemesAsPrivileged([
  { scheme: 'totem-media', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
])
// Handler: createReadStream + HTTP 206. NÃO usar net.fetch('file://...')
```

### buildMediaUrl
=======
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
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
```js
function buildMediaUrl(filePath) {
  if (!filePath) return null
  const normalized = filePath.replace(/\\/g, '/')
  const withSlash = normalized.startsWith('/') ? normalized : '/' + normalized
  const encoded = withSlash.split('/').map(encodeURIComponent).join('/')
  return 'totem-media://' + encoded
}
```
<<<<<<< HEAD
**Crítico**: encode por segmento para preservar `/` e codificar espaços.
=======
**Crítico**: encode por segmento (não o path inteiro) para preservar `/` e codificar espaços como `Application Support`.
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618

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

<<<<<<< HEAD
=======
**Atenção**: a CSP padrão do electron-vite não inclui `totem-media:` nem `frame-src youtube` — sem isso vídeos e iframes YouTube são bloqueados silenciosamente.

>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
---

## Telas e fluxo

```
video → (toque) → lead → quiz → thankyou → (10s) → video
video → (ícone 🔒) → login → admin
```

<<<<<<< HEAD
---

## AdminPanel — abas (v1.2.0)
=======
- **Frame.jsx** é renderizado em todas as telas públicas (não no admin)
- **AdminPanel** renderiza via early return em App.jsx — não recebe `<Frame>`
- Logout do admin chama `window.location.reload()` para limpar estado

---

## AdminPanel — abas
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618

| Aba | Funcionalidade |
|---|---|
| Quizzes | CRUD de quizzes + perguntas, ativar quiz |
<<<<<<< HEAD
| Leads | Tabela com Nome/Telefone/Email/Score, exportar CSV |
| Mídia | Playlist ordenada + biblioteca + upload + agendamento |
| Wi-Fi | Status, scan, conectar (Windows via netsh) |
| Personalização | Logo (upload+posição+tamanho), cor+espessura da moldura |
| Configurações | Senha do admin, agendamento de energia |
| Diagnóstico | Painel técnico DiagnosticPanel |

### Focus ring (v1.1.0+)
AdminPanel injeta CSS global:
```js
'input:focus,textarea:focus,select:focus { outline: 2px solid #2563eb !important; }'
```
**NUNCA** usar `outline: 'none'` no `S.input` — remove indicador visual de campo ativo.

---

## WiFi — Implementação por plataforma

| Plataforma | Scan | Connect | Status |
|---|---|---|---|
| Windows | `netsh wlan show networks mode=bssid` | XML profile + `netsh wlan connect` | `netsh wlan show interfaces` |
| macOS | `airport -s` (fallback: `system_profiler`) | `networksetup -setairportnetwork` | `networksetup -getairportnetwork` |
| Linux | `nmcli -t dev wifi list` | `nmcli dev wifi connect` | `nmcli connection show --active` |

**Windows**: serviço `WLAN AutoConfig` deve estar iniciado. Senha cria XML temporário em `app.getPath('temp')`.
=======
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
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618

---

## Deploy e Empacotamento

<<<<<<< HEAD
### CRÍTICO — `better_sqlite3.node`
O binário `.node` DEVE ser compilado no SO alvo:
- **Windows**: `npx electron-rebuild -f -w better-sqlite3` executado no Windows + `electron-builder --win`
- **Nunca** cross-compilar do Mac para Windows

### Developer Mode (Windows)
Obrigatório para symlinks durante o build:
```bat
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /v AllowDevelopmentWithoutDevLicense /t REG_DWORD /d 1 /f
```
O `scripts/gerar_kit_operador.bat` ativa via UAC automaticamente.

### Dependências de runtime (máquina do evento)
- `Visual C++ 2022 Redistributable x64` — para `better_sqlite3.node`
- `yt-dlp` + `ffmpeg` — para downloads sociais
- Script: `scripts/install_dependencies.bat`

### Scripts Windows

| Comando | O que faz |
|---|---|
| `npm run setup:win` | Instala Node.js 20 + Python + VS Build Tools |
| `npm run kit:win` | Build completo + Kit no Desktop |
| `npm run release:win` | ZIP simples em `release/` |
=======
### Estratégia
**Não usar Docker para produção.** Empacotamento nativo via `electron-builder` em ambientes reais (Windows, macOS, Linux) para garantir compilação correta do `better-sqlite3`.

> **CRÍTICO — Instalador Windows:**
> `npm run build:win` executado no macOS gera um `.exe` com `better_sqlite3.node` compilado para macOS.
> O Windows recusa carregar esse binário com erro "não é um aplicativo Win32 válido".
> **O `.exe` para distribuição DEVE vir do artefato `TOTEM-Windows` gerado pelo GitHub Actions (`windows-latest`).**
> Fluxo correto do kit:
> 1. Push → CI roda → baixar artefato `TOTEM-Windows` do GitHub Actions
> 2. Copiar o `.exe` para `dist/`
> 3. Executar `bash scripts/gerar_kit_operador.sh --skip-build`

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
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618

---

## CI/CD — GitHub Actions

Arquivo: `.github/workflows/build.yml`
<<<<<<< HEAD
- Gatilhos: push na `main` + `workflow_dispatch`
- Matriz: `windows-latest`, `macos-latest`, `ubuntu-latest`
- Cada OS compila nativamente (crítico para `better-sqlite3`)
=======

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
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618

---

## Bugs corrigidos / decisões importantes

<<<<<<< HEAD
1. **`saveLead` undefined** — handler IPC adicionado em database.js
2. **`delete-quiz` não atômico** — `db.transaction()`
3. **Teclado físico bloqueado no admin** — `stopPropagation` removido
4. **Vídeos não tocavam** — `registerSchemesAsPrivileged` + CSP `totem-media:`
5. **Logo não aparecia** — encode por segmento em `buildMediaUrl`
6. **JSON.parse crash** — try/catch em `options`
7. **`better-sqlite3.node` inválido no Windows** — compilar SEMPRE em Windows
8. **GitHub Actions YAML inválido** — step sem `run`/`uses` removido
9. **Tela preta na troca de mídia** — `readyIdx` síncrono
10. **ABI mismatch (testes)** — `pretest`/`posttest` recompilam
11. **Wi-Fi "Plataforma não suportada"** — netsh implementado para Windows
12. **BOM UTF-16 no package.json** — `[System.IO.File]::WriteAllText` com `UTF8Encoding($false)`
13. **Developer Mode para symlinks** — `AllowDevelopmentWithoutDevLicense=1`
14. **`outline: none` nos inputs** — removido; focus ring via CSS global
15. **`ref={inputRef}` em botão** — ref estava no botão "Selecionar Vídeo"
16. **Campo telefone ausente** — adicionado em v1.2.0 com máscara e numpad
17. **Cursor não piscava em LeadForm/LoginScreen** — inputs tinham `readOnly` que impede o caret; corrigido removendo `readOnly` e adicionando `inputMode="none"` (bloqueia teclado nativo touch) + `onChange={() => {}}` + `caretColor`
18. **Vídeos não executavam no Windows** — `filePath.split('/')` em paths com `\` (Windows) retornava 1 elemento com backslashes codificados como `%5C`, gerando URL inválida. Fix definitivo: `pathToFileURL(join(...)).toString()` + `net.fetch(fileUrl, { headers })`. **NUNCA** usar `createReadStream` direto em `new Response()` — Node.js `Readable` ≠ Web `ReadableStream`; o body fica ilegível silenciosamente em alguns contextos do Electron
19. **`createReadStream` em `new Response()`** — Node.js Readable passado para `Response` pode funcionar em alguns casos mas falha silenciosamente em outros (Electron 39). Solução correta: `net.fetch(pathToFileURL(path).toString(), { headers })` — delega ao stack de rede do Chromium que suporta Range requests nativamente para `file://`
20. **Aba Personalização** — removida definitivamente do projeto; não recriar
=======
1. **`saveLead` undefined** — preload chamava IPC inexistente; handler adicionado em database.js
2. **`delete-quiz` não atômico** — substituído por `db.transaction()`
3. **Teclado físico bloqueado no admin** — `window.addEventListener('keydown', ..., true)` com `stopPropagation` impedia inputs; removido (desnecessário quando outros handlers estão desmontados)
4. **Vídeos não tocavam (tela branca)** — duas causas:
   - `protocol.registerSchemesAsPrivileged` ausente → range requests falhavam
   - CSP não incluía `totem-media:` → recursos bloqueados silenciosamente
   - `net.fetch('file://...')` não suporta range requests → substituído por `createReadStream` com HTTP 206
5. **Logo não aparecia** — `buildMediaUrl` não encodava espaços no path; corrigido com encode por segmento
6. **JSON.parse crash** — coluna `options` malformada no DB; envolvido em try/catch
7. **`better-sqlite3.node` inválido no Windows** — erro "não é um aplicativo Win32 válido" ao instalar o .exe gerado no Mac. Causa: `npmRebuild: true` no `electron-builder.yml` não consegue cross-compilar módulos nativos C++ do macOS para Windows — o `.node` incluído no instalador é o binário macOS. **Solução definitiva: o instalador Windows (.exe) DEVE ser gerado pelo GitHub Actions em um runner `windows-latest`.** Nunca gerar o .exe para Windows a partir do macOS.
8. **GitHub Actions YAML inválido (Linha 42)** — step com `name`/`if`/`continue-on-error` mas sem `run` ou `uses` é YAML inválido. Corrigido removendo o step vazio e deixando apenas um comentário inline na etapa anterior.
9. **Tela preta + só áudio na troca de mídia** — race condition: `videoReady` resetado via `useEffect([idx])` rodava após o render, expondo o frame preto. Corrigido com `readyIdx` (estado numérico): `videoReady = readyIdx === idx` é reset síncrono no render, sem delay.
10. **ABI mismatch better-sqlite3 (testes)** — 15 testes falhavam: Node do sistema (ABI 127) vs Electron (ABI 140). Corrigido com `pretest`/`posttest` no package.json que recompilam o módulo antes e depois dos testes.
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618

---

## Comandos úteis

```bash
npm run dev           # desenvolvimento (hot reload)
<<<<<<< HEAD
npm run build         # compila sem empacotar
npm run build:win     # empacota .exe
npm run kit:win       # Kit do Operador no Desktop (Windows)
npm run setup:win     # instala pré-requisitos de build
npm run release:win   # ZIP de release
=======
npm run build         # compila React/Electron (sem empacotar)
npm run build:mac     # empacota .dmg para macOS
npm run build:linux   # empacota AppImage para Linux
npm run build:win     # empacota .exe para Windows
npm run release:mac   # build + zip para operador (macOS)
npm run release:linux # build + zip para operador (Linux)
npm run release:win   # build + zip para operador (Windows)
npm run start:container  # roda build no container (--no-sandbox)
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
```
