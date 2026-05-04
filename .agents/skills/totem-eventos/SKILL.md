# SKILL: TOTEM EVENTOS

## Descrição
Guia completo para criar, manter e distribuir aplicações kiosk para eventos e feiras usando Electron + React + SQLite. Cobre desde a arquitetura até o empacotamento e entrega ao operador.

---

## Stack Tecnológica

```
Electron 39          Desktop app (Windows/macOS/Linux)
React 19             Interface do usuário
electron-vite 5      Build e dev server
Vite 7               Bundler frontend
better-sqlite3       Banco local offline
express              Servidor HTTP interno (se necessário)
lucide-react         Ícones
qrcode.react         Geração de QR Codes
```

---

## Criar Projeto do Zero

### 1. Scaffold com electron-vite

```bash
npm create @quick-start/electron@latest meu-totem -- --template react
cd meu-totem
npm install
npm install better-sqlite3 express lucide-react qrcode.react react-player
npm install --save-dev electron-rebuild
```

### 2. Estrutura de pastas obrigatória

```
src/
  main/
    index.js      ← processo principal (window, IPC, protocol, WiFi)
    database.js   ← schema + migrations + handlers IPC
  preload/
    index.js      ← contextBridge (window.api)
  renderer/src/
    App.jsx       ← roteador de telas
    components/
      VideoPlayer.jsx
      LeadForm.jsx
      QuizEngine.jsx
      ThankYou.jsx
      Frame.jsx
      AdminPanel.jsx
      LoginScreen.jsx
      VirtualKeyboard.jsx
      useIdleTimer.js
build/
  icon.ico        ← ícone Windows
  icon.icns       ← ícone macOS
  icon.png        ← ícone Linux
scripts/
  gerar_kit_operador.bat
  instalar_build_tools.bat
  install_dependencies.bat
  resetar_senha_windows.bat
```

### 3. package.json — scripts essenciais

```json
{
  "scripts": {
    "dev":          "electron-vite dev",
    "build":        "electron-vite build",
    "build:win":    "npm run build && electron-builder --win",
    "postinstall":  "electron-builder install-app-deps",
    "kit:win":      "scripts\\gerar_kit_operador.bat",
    "setup:win":    "scripts\\instalar_build_tools.bat"
  }
}
```

### 4. electron-builder.yml mínimo

```yaml
appId: com.empresa.totem
productName: TOTEM
files:
  - '!src/*'
  - '!docker/*'
  - '!scripts/*'
asarUnpack:
  - resources/**
  - node_modules/better-sqlite3/**
npmRebuild: true
win:
  executableName: totem
  target:
    - target: nsis
      arch: [x64]
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

---

## Arquitetura IPC (regra fundamental)

```
Renderer (React) ──→ window.api.xxx() ──→ preload/index.js
                                              ↓ ipcRenderer.invoke
                                         main/index.js ou database.js
                                              ↓ ipcMain.handle
                                         better-sqlite3 / sistema
```

**NUNCA** acessar `better-sqlite3`, `fs`, `child_process` diretamente no renderer.

### Padrão preload/index.js

```js
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Expõe apenas o necessário
  getLeads:    ()     => ipcRenderer.invoke('get-leads'),
  saveLead:    (data) => ipcRenderer.invoke('save-lead', data),
  getSetting:  (key)  => ipcRenderer.invoke('get-setting', key),
  setSetting:  (k, v) => ipcRenderer.invoke('set-setting', k, v),
  // Eventos main → renderer
  onBlackout: (cb) => {
    ipcRenderer.on('screen:blackout', (_, state) => cb(state))
    return () => ipcRenderer.removeAllListeners('screen:blackout')
  }
})
```

---

## Banco de Dados (database.js)

### Schema base

```js
import Database from 'better-sqlite3'
import { app, ipcMain } from 'electron'
import { join } from 'path'

const db = new Database(join(app.getPath('userData'), 'app.db'))

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT, telefone TEXT, email TEXT, score INTEGER,
      data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS quiz_titles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, active INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER, text TEXT, options TEXT, correctIndex INTEGER);
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, type TEXT, source TEXT,
      active INTEGER DEFAULT 0, playlist_order INTEGER DEFAULT 0, duration INTEGER DEFAULT 60,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Migrations (sempre via try/catch)
  try { db.exec("ALTER TABLE leads ADD COLUMN telefone TEXT DEFAULT ''") } catch {}

  // Defaults
  db.prepare("INSERT OR IGNORE INTO settings VALUES ('admin_password', '1234')").run()

  setupHandlers()
}

function setupHandlers() {
  ipcMain.handle('get-leads',   () => db.prepare('SELECT * FROM leads ORDER BY data_hora DESC').all())
  ipcMain.handle('save-lead',   (_, l) => db.prepare('INSERT INTO leads (nome,telefone,email,score) VALUES (?,?,?,?)').run(l.nome, l.telefone||'', l.email||'', l.score).changes > 0)
  ipcMain.handle('get-setting', (_, key) => db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? null)
  ipcMain.handle('set-setting', (_, k, v) => db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(k, v).changes > 0)
}
```

---

## Protocolo de Mídia Local

> **CRÍTICO — Windows:** Nunca usar `filePath.split('/')` para construir URLs de arquivo.
> Em Windows, caminhos usam `\` e `split('/')` retorna 1 elemento com backslashes que ficam
> codificados como `%5C`, gerando URL inválida. Use `join()` do Node e `createReadStream` diretamente.
> Nunca usar `net.fetch('file://...')` — não garante range requests em todos os casos.

```js
import { statSync, createReadStream } from 'fs'

// ANTES de app.whenReady() — obrigatório
protocol.registerSchemesAsPrivileged([{
  scheme: 'totem-media',
  privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true }
}])

// DENTRO de app.whenReady() — handler com range requests correto para Windows e Unix
protocol.handle('totem-media', (request) => {
  const rawPath = request.url.slice('totem-media://'.length)
  let filePath

  if (rawPath.startsWith('media/')) {
    // Padrão: totem-media://media/filename.mp4 → userData/media/filename.mp4
    const filename = decodeURIComponent(rawPath.slice('media/'.length))
    filePath = join(app.getPath('userData'), 'media', filename)
  } else {
    // Legado: path absoluto codificado segmento a segmento
    filePath = rawPath.split('/').map(decodeURIComponent).join('/')
    if (!filePath.startsWith('/') && !filePath.match(/^[A-Za-z]:/)) filePath = '/' + filePath
  }

  try {
    const stat = statSync(filePath)
    const ext = filePath.split('.').pop().toLowerCase()
    const mime = {
      mp4:'video/mp4', webm:'video/webm', mkv:'video/x-matroska',
      mov:'video/quicktime', avi:'video/x-msvideo', ogg:'video/ogg',
      png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg',
      webp:'image/webp', gif:'image/gif', svg:'image/svg+xml'
    }[ext] || 'application/octet-stream'

    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      const [s, e] = rangeHeader.replace('bytes=', '').split('-')
      const start = parseInt(s, 10)
      const end   = e ? parseInt(e, 10) : Math.min(start + 1024 * 1024 - 1, stat.size - 1)
      return new Response(createReadStream(filePath, { start, end }), {
        status: 206,
        headers: {
          'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
          'Content-Length': String(end - start + 1),
          'Content-Type':   mime,
          'Accept-Ranges':  'bytes'
        }
      })
    }
    return new Response(createReadStream(filePath), {
      status: 200,
      headers: { 'Content-Length': String(stat.size), 'Content-Type': mime, 'Accept-Ranges': 'bytes' }
    })
  } catch (err) {
    console.error('[totem-media] erro:', filePath, err.message)
    return new Response('Not found', { status: 404 })
  }
})
```

---

## Fluxo de Telas

```
VideoPlayer
  └─ onStartQuiz  ──→ LeadForm
                          └─ onConfirm({nome, telefone, email})
                                └─ QuizEngine
                                      └─ onComplete({score, total})
                                            └─ ThankYou (10s countdown)
                                                  └─ onFinish → VideoPlayer

VideoPlayer
  └─ onAdminLogin ──→ LoginScreen
                          └─ onLoginSuccess → AdminPanel
                                └─ onLogout → VideoPlayer
```

---

## Formulário de Leads — Boas Práticas

```jsx
// Campo telefone com máscara brasileira
const applyPhoneMask = (digits, countryCode = '+55') => {
  const d = digits.slice(0, 11)
  if (countryCode !== '+55') return d.match(/.{1,4}/g)?.join(' ') || d
  if (d.length <= 2)  return `(${d}`
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`
}

// Validação: nome obrigatório, telefone obrigatório, email opcional
const handleSubmit = () => {
  if (nome.trim().length < 3)   { setError('Nome muito curto.'); return }
  if (telefoneDigits.length < 10) { setError('Telefone inválido.'); return }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('E-mail inválido.'); return }
  onConfirm({ nome: nome.trim(), telefone: `${countryCode} ${applyPhoneMask(telefoneDigits)}`, email })
}
```

---

## Teclado Virtual

O `VirtualKeyboard` aceita a prop `numericMode`:
- `numericMode={false}` (padrão): QWERTY PT-BR completo com Shift/Backspace
- `numericMode={true}`: Numpad 3×4 (1-9, 0, Backspace) para campos numéricos

```jsx
// Uso
<VirtualKeyboard
  onKeyPress={updateField}
  numericMode={activeField === 'telefone'}
/>
```

**Regra de ouro**: usar `onMouseDown={e => { e.preventDefault(); onKeyPress(key) }}` em todas as teclas para **não tirar o foco** do input ao pressionar a tecla.

---

## Kiosk Mode (produção)

```js
// BrowserWindow em produção
const mainWindow = new BrowserWindow({
  fullscreen: !is.dev,
  kiosk:      !is.dev,
  alwaysOnTop: !is.dev,
  frame:      false,
  ...
})

// Bloquear atalhos de saída
mainWindow.webContents.on('before-input-event', (_, input) => {
  if ((input.control || input.meta) && ['w','q','r'].includes(input.key.toLowerCase())) {
    return // block
  }
  if (input.key === 'F11' || (input.alt && input.key === 'F4')) return
})

globalShortcut.register('Alt+F4', () => {})
globalShortcut.register('CommandOrControl+W', () => {})
```

---

## AdminPanel — Checklist de Abas

| Aba | Recursos mínimos |
|---|---|
| Quizzes | CRUD quizzes + perguntas, ativar/desativar |
| Leads | Tabela com nome/telefone/email/score, exportar CSV |
| Mídia | Playlist drag/sort, upload local, YouTube, Instagram, TikTok |
| Wi-Fi | Scan redes + conectar com senha (multiplataforma) |
| Personalização | Logo upload + posição + tamanho; moldura cor + espessura |
| Configurações | Alterar senha, agendamento de energia (sleep/wake) |
| Diagnóstico | Status de arquivos, versões, logs de download |

### Focus ring (obrigatório)
```js
useEffect(() => {
  const s = document.createElement('style')
  s.textContent = 'input:focus,select:focus{outline:2px solid #2563eb!important;box-shadow:0 0 0 4px rgba(37,99,235,.15)!important}'
  document.head.appendChild(s)
  return () => s.remove()
}, [])
```

---

## Build para Windows — Passo a Passo

### Primeira vez (máquina nova)

```bat
:: 1. Instalar pré-requisitos (como Admin)
scripts\instalar_build_tools.bat

:: 2. REINICIAR o computador

:: 3. Gerar o Kit completo
scripts\gerar_kit_operador.bat
```

### O que o `gerar_kit_operador.bat` faz
1. Verifica/instala Node.js via winget
2. Habilita Developer Mode (UAC) para symlinks
3. `npm ci` → postinstall recompila `better-sqlite3`
4. `npx electron-rebuild -f -w better-sqlite3`
5. `electron-vite build`
6. `electron-builder --win --x64`
7. Monta pasta: installer + scripts + README
8. Compacta em `Kit_Operador_TOTEM_vX.X.X.zip` no Desktop

### Kit do Operador — conteúdo
```
Kit_Operador_TOTEM_vX.X.X.zip
  totem-app-X.X.X-setup.exe      ← instalador NSIS
  install_dependencies.bat        ← VC++ 2022, yt-dlp, ffmpeg
  resetar_senha_windows.bat       ← reset senha admin → 1234
  LEIA-ME.txt                     ← instruções do operador
```

---

## Checklist de Entrega ao Operador

- [ ] `install_dependencies.bat` executado como Admin
- [ ] Computador reiniciado após dependências
- [ ] TOTEM instalado (`*-setup.exe`)
- [ ] Primeira abertura: tela de vídeo aparece em loop
- [ ] Acesso ao admin: canto inferior direito | senha: `1234`
- [ ] Quiz configurado (aba Quizzes)
- [ ] Mídia adicionada (aba Mídia)
- [ ] Logo e moldura configurados (aba Personalização)
- [ ] Wi-Fi conectado se usar YouTube/redes sociais
- [ ] Senha do admin alterada (aba Configurações)

---

## Problemas Comuns e Soluções

| Erro | Causa | Solução |
|---|---|---|
| "não é um aplicativo Win32 válido" | `better_sqlite3.node` compilado no Mac | Compilar no Windows; nunca cross-compilar |
| Wi-Fi "Plataforma não suportada" | Código só para macOS/Linux | Implementar via `netsh wlan` no Windows |
| `outline: none` esconde cursor | S.input tinha `outline: 'none'` | Injetar CSS global de focus ring |
| `ref={inputRef}` em botão | Ref colocado no elemento errado | Verificar que refs de input estão em `<input>` |
| BOM no package.json | PowerShell salva UTF-16 LE | Usar `[System.IO.File]::WriteAllText` com `UTF8Encoding($false)` |
| Symlinks proibidos no build | Developer Mode desativado | `reg add ... AllowDevelopmentWithoutDevLicense /d 1` |
| Tela preta na troca de mídia | Race condition com `videoReady` | Usar estado numérico `readyIdx` para reset síncrono |
| npm bloqueado no PowerShell | Política de execução | `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| Cursor não pisca em input com VirtualKeyboard | `readOnly` impede caret | Remover `readOnly`, usar `inputMode="none"` + `onChange={() => {}}` + `caretColor` |
| Vídeo não toca após upload (Windows) | `totem-media://` gera URL com `%5C` (backslash codificado) em vez de `/` | Usar `createReadStream` com `join()` nativo; nunca `filePath.split('/')` em Windows |
| `net.fetch('file://...')` sem range requests | Electron não garante Range header para file:// | Substituir por `createReadStream` + resposta `new Response(stream, {status:206, headers:{Content-Range,...}})` |
| Código de país não cobre todos os países | Lista fixa de países | Adicionar opção `{ code: 'outro', label: '✏️ Outro...' }` no final da lista com input customizado |
