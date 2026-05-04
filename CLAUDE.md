# TOTEM — Contexto do Projeto para Claude

## Persona de engenharia

Atuar como **Engenheiro de Software Sênior especialista em aplicações Desktop Offline-First**.

## Regras inegociáveis de código

1. **IPC estrito** — toda comunicação com o banco de dados passa exclusivamente pelo `contextBridge` via IPC (`ipcMain.handle` / `ipcRenderer.invoke`). Nunca acessar `better-sqlite3` diretamente no renderer.
2. **Kiosk Mode first** — design voltado para telas touch sem mouse. Considerar teclado virtual vs. físico: nunca bloquear eventos `keydown` nativos em inputs com `stopPropagation` no capture phase.
3. **JSX seguro para Vite** — todo componente React deve compilar sem erro: usar `<>` Fragments quando necessário, garantir wrapping de múltiplas tags raiz, nunca retornar arrays soltos.
4. **Offline-first e resiliência** — priorizar performance sem rede. Tratar erros silenciosamente (try/catch em IPC calls, JSON.parse defensivo, fallbacks visuais para mídia que falha ao carregar).

## O que é este projeto

Aplicação kiosk para eventos/feiras — roda em tela touch, exibe vídeos em loop, capta leads (nome + telefone + email opcional), aplica quiz e exibe placar final. Toda a gestão é feita por um painel admin protegido por senha.

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
      VideoPlayer.jsx     ← playlist de vídeos (local + YouTube)
      LeadForm.jsx        ← captura nome/telefone/email antes do quiz
      QuizEngine.jsx      ← motor do quiz com idle timer
      ThankYou.jsx        ← tela pós-quiz com countdown 10s
      Frame.jsx           ← moldura + logo sobrepostos em todas as telas públicas
      AdminPanel.jsx      ← painel admin (7 abas)
      LoginScreen.jsx     ← tela de login do admin
      VirtualKeyboard.jsx ← teclado QWERTY + modo numérico (prop numericMode)
      useIdleTimer.js
```

---

## Banco de dados (SQLite via better-sqlite3)

Arquivo: `app.getPath('userData')/totem.db`

### Tabelas

| Tabela | Colunas relevantes |
|---|---|
| `quiz_titles` | `id, title, active` |
| `questions` | `id, quiz_id, text, options (JSON), correctIndex` |
| `leads` | `id, nome, telefone, email, score, data_hora` |
| `settings` | `key (PK), value` |
| `media` | `id, name, type, source, active, playlist_order, duration, schedule_*, local_file, download_status, created_at` |

### Migrations (aplicadas via try/catch em initDB)
```js
ALTER TABLE media ADD COLUMN playlist_order INTEGER DEFAULT 0
ALTER TABLE media ADD COLUMN duration INTEGER DEFAULT 60
ALTER TABLE media ADD COLUMN schedule_start_date TEXT DEFAULT ''
ALTER TABLE media ADD COLUMN schedule_end_date TEXT DEFAULT ''
ALTER TABLE media ADD COLUMN schedule_start_time TEXT DEFAULT ''
ALTER TABLE media ADD COLUMN schedule_end_time TEXT DEFAULT ''
ALTER TABLE media ADD COLUMN local_file TEXT DEFAULT ''
ALTER TABLE media ADD COLUMN download_status TEXT DEFAULT ''
ALTER TABLE leads ADD COLUMN telefone TEXT DEFAULT ''
```

### Settings keys usadas
| Chave | Descrição |
|---|---|
| `admin_username` | Usuário do painel admin (default: `admin`) |
| `admin_password` | Senha do painel admin (default: `1234`) |
| `border_color` | Cor hex da moldura (default: `#2563eb`) |
| `border_width` | Espessura em px da moldura (default: `8`) |
| `logo_path` | Caminho absoluto do logo do evento |
| `logo_position` | `top-right \| top-left \| bottom-right \| bottom-left` |
| `logo_size` | Tamanho máximo do logo em px (default: `80`) |
| `energy_sleep_enabled` | `'true'` \| `'false'` |
| `energy_sleep_time` | Hora dormir (default: `23:00`) |
| `energy_wake_time` | Hora acordar (default: `07:00`) |

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
getLeads()             → array  (inclui campo telefone)
saveLead({nome, telefone, email, score}) → bool
deleteLeads(ids)       → bool

// Settings
getSetting(key)        → string | null
setSetting(key, value) → bool

// Mídia — biblioteca
getMedia()             → array
saveMedia({name, type, source}) → lastInsertRowid
deleteMedia(id)        → bool

// Mídia — playlist
getPlaylist()          → array ordenado por playlist_order
togglePlaylist(id)     → bool
movePlaylistItem({id, direction: 'up'|'down'}) → bool
setMediaDuration({id, duration}) → bool
setMediaSchedule({id, startDate, endDate, startTime, endTime}) → bool

// Arquivos
uploadMedia({type})    → {name, filename} | null
pickLogoFile()         → {name, path} | null

// WiFi
wifiScan()             → {networks: [{ssid, signal, secured}], error?}
wifiConnect({ssid, password}) → {success, error?}
wifiStatus()           → {connected, ssid}
```

---

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
```js
function buildMediaUrl(filePath) {
  if (!filePath) return null
  const normalized = filePath.replace(/\\/g, '/')
  const withSlash = normalized.startsWith('/') ? normalized : '/' + normalized
  const encoded = withSlash.split('/').map(encodeURIComponent).join('/')
  return 'totem-media://' + encoded
}
```
**Crítico**: encode por segmento para preservar `/` e codificar espaços.

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

---

## Telas e fluxo

```
video → (toque) → lead → quiz → thankyou → (10s) → video
video → (ícone 🔒) → login → admin
```

---

## AdminPanel — abas (v1.2.0)

| Aba | Funcionalidade |
|---|---|
| Quizzes | CRUD de quizzes + perguntas, ativar quiz |
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

---

## Deploy e Empacotamento

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

---

## CI/CD — GitHub Actions

Arquivo: `.github/workflows/build.yml`
- Gatilhos: push na `main` + `workflow_dispatch`
- Matriz: `windows-latest`, `macos-latest`, `ubuntu-latest`
- Cada OS compila nativamente (crítico para `better-sqlite3`)

---

## Bugs corrigidos / decisões importantes

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

---

## Comandos úteis

```bash
npm run dev           # desenvolvimento (hot reload)
npm run build         # compila sem empacotar
npm run build:win     # empacota .exe
npm run kit:win       # Kit do Operador no Desktop (Windows)
npm run setup:win     # instala pré-requisitos de build
npm run release:win   # ZIP de release
```
