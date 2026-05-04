import { app, shell, BrowserWindow, ipcMain, dialog, protocol, session, net, globalShortcut } from 'electron'
import { join, basename, extname } from 'path'
<<<<<<< HEAD
import { copyFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, writeFileSync } from 'fs'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { pathToFileURL } from 'url'
import { networkInterfaces } from 'os'
import sharp from 'sharp'
=======
import { copyFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { networkInterfaces } from 'os'
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
import express from 'express'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDB, db } from './database'

const execFileAsync = promisify(execFile)

// Permite autoplay com áudio sem exigir interação prévia do usuário
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
// Evita congelamento de abas/renderizadores em background (crítico para kiosk 24/7)
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
<<<<<<< HEAD
// Habilita decodificação de vídeo por hardware (evita travamento)
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,single-on-top,underlay')
app.commandLine.appendSwitch('disable-software-rasterizer')
=======
app.commandLine.appendSwitch('ignore-gpu-blocklist')
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618

// Deve ser chamado ANTES de app.whenReady()
// stream:true habilita range requests necessários para seek/buffer de vídeo
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'totem-media',
    privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true }
  }
])

let mainWindow = null
let energyInterval = null

// ─── YouTube helpers ───────────────────────────────────────────────────────────

function detectSocialPlatform(url) {
  if (!url) return null
  if (/instagram\.com\/(p|reel|tv|stories)\//.test(url)) return 'instagram'
  if (/tiktok\.com\/@[\w.]+\/video\/\d+/.test(url) ||
      /vm\.tiktok\.com\//.test(url) ||
      /tiktok\.com\/t\//.test(url) ||
      /tiktok\.com\/v\//.test(url)) return 'tiktok'
  return null
}

function extractYouTubeVideoId(url) {
  if (!url) return null
  const m =
    url.match(/[?&]v=([^&#]+)/) ||
    url.match(/youtu\.be\/([^?&#]+)/) ||
    url.match(/youtube\.com\/embed\/([^?&#]+)/) ||
    url.match(/youtube\.com\/shorts\/([^?&#]+)/)
  return m ? m[1] : null
}

// ─── yt-dlp helper: spawn com timeout rigoroso de 60s + SIGKILL ──────────────
// Retorna Promise<{stdout, stderr}> — rejeita se timeout ou exit code != 0
function spawnWithTimeout(bin, args, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    proc.stdout.on('data', (d) => { stdout += d })
    proc.stderr.on('data', (d) => { stderr += d })

    const timer = setTimeout(() => {
      try { process.kill(proc.pid, 'SIGKILL') } catch {}
      reject(new Error(`yt-dlp timeout após ${timeoutMs / 1000}s`))
    }, timeoutMs)

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(stderr || `exit code ${code}`))
    })
    proc.on('error', (err) => { clearTimeout(timer); reject(err) })
  })
}

// ─── Helpers WiFi ─────────────────────────────────────────────────────────────

function parseMacWifi(output) {
  return output
    .split('\n')
    .slice(1)
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return null
      const match = trimmed.match(
        /^(.+?)\s{2,}([\da-fA-F]{2}(?::[\da-fA-F]{2}){5})\s+(-\d+)/
      )
      if (!match) return null
      const rssi = parseInt(match[3])
      return {
        ssid: match[1].trim(),
        signal: Math.max(0, Math.min(100, 2 * (rssi + 100))),
        secured: line.includes('WPA') || line.includes('WEP')
      }
    })
    .filter((n) => n?.ssid)
}

function parseLinuxWifi(output) {
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(':')
      if (!parts[0]) return null
      return {
        ssid: parts[0],
        signal: parseInt(parts[1]) || 0,
        secured: parts[2] !== '--' && parts.length > 2
      }
    })
    .filter(Boolean)
}

<<<<<<< HEAD
// Parseia saída do "netsh wlan show networks mode=bssid" (EN e PT)
function parseWindowsWifi(output) {
  const networks = []
  // Divide em blocos por "SSID N : nome" — funciona em EN e PT
  const blocks = output.replace(/\r/g, '').split(/\nSSID \d+ : /)
  for (const block of blocks.slice(1)) {
    const lines = block.split('\n')
    const ssid = lines[0]?.trim()
    if (!ssid) continue
    const signalMatch = block.match(/(\d+)%/)
    const signal = signalMatch ? parseInt(signalMatch[1]) : 50
    const lower = block.toLowerCase()
    const secured = lower.includes('wpa') || lower.includes('wep') || lower.includes('psk')
    if (!networks.find((n) => n.ssid === ssid)) {
      networks.push({ ssid, signal, secured })
    }
  }
  return networks
}

const netshExe = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'netsh.exe')

async function windowsWifiConnect(ssid, password) {
  if (!password) {
    await execFileAsync(netshExe, ['wlan', 'connect', `name=${ssid}`])
    return
  }
  const profileXml = `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${ssid}</name>
  <SSIDConfig><SSID><name>${ssid}</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>auto</connectionMode>
  <MSM>
    <security>
      <authEncryption>
        <authentication>WPA2PSK</authentication>
        <encryption>AES</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      <sharedKey>
        <keyType>passPhrase</keyType>
        <protected>false</protected>
        <keyMaterial>${password}</keyMaterial>
      </sharedKey>
    </security>
  </MSM>
</WLANProfile>`
  const tmpFile = join(app.getPath('temp'), `totem_wifi_${Date.now()}.xml`)
  writeFileSync(tmpFile, profileXml, 'utf8')
  try {
    await execFileAsync(netshExe, ['wlan', 'add', 'profile', `filename=${tmpFile}`])
    await execFileAsync(netshExe, ['wlan', 'connect', `name=${ssid}`])
  } finally {
    try { unlinkSync(tmpFile) } catch {}
  }
}

=======
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
async function getMacWifiInterface() {
  try {
    const { stdout } = await execFileAsync('/usr/sbin/networksetup', ['-listallhardwareports'])
    const match = stdout.match(/Wi-Fi[\s\S]*?Device:\s*(\w+)/)
    return match?.[1] || 'en0'
  } catch {
    return 'en0'
  }
}

// ─── Criação da janela ─────────────────────────────────────────────────────────

// ─── REST API helpers ──────────────────────────────────────────────────────────

const REST_PORT = 3131

function getLocalIP() {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces) {
      if (!iface.internal && iface.family === 'IPv4') return iface.address
    }
  }
  return '127.0.0.1'
}

function startRestApi() {
  const api = express()
  api.use(express.json())

  api.get('/api/status', (_, res) => res.json({ ok: true, version: '1.0', ip: getLocalIP(), port: REST_PORT }))

  api.get('/api/quizzes', (_, res) => res.json(db.prepare('SELECT * FROM quiz_titles').all()))
  api.post('/api/quizzes', (req, res) => {
    const { title } = req.body || {}
    if (!title) return res.status(400).json({ error: 'title required' })
    const r = db.prepare('INSERT INTO quiz_titles (title, active) VALUES (?,0)').run(title)
    res.json({ id: r.lastInsertRowid })
  })
  api.delete('/api/quizzes/:id', (req, res) => {
    const id = parseInt(req.params.id)
    db.prepare('DELETE FROM questions WHERE quiz_id=?').run(id)
    db.prepare('DELETE FROM quiz_titles WHERE id=?').run(id)
    res.json({ ok: true })
  })

  api.get('/api/media', (_, res) => res.json(db.prepare('SELECT * FROM media ORDER BY created_at DESC').all()))
  api.post('/api/media', (req, res) => {
    const { name, type, source } = req.body || {}
    if (!name || !type || !source) return res.status(400).json({ error: 'name,type,source required' })
    const r = db.prepare('INSERT INTO media (name,type,source) VALUES (?,?,?)').run(name, type, source)
    res.json({ id: r.lastInsertRowid })
  })
  api.delete('/api/media/:id', (req, res) => {
    const id = parseInt(req.params.id)
    const item = db.prepare('SELECT * FROM media WHERE id=?').get(id)
    if (item?.type === 'file' || item?.type === 'image') {
      const mediaDir = join(app.getPath('userData'), 'media')
      const filePath = item.source.includes('/') ? item.source : join(mediaDir, item.source)
      try { unlinkSync(filePath) } catch {}
    }
    db.prepare('DELETE FROM media WHERE id=?').run(id)
    res.json({ ok: true })
  })
  api.post('/api/media/:id/toggle-playlist', (req, res) => {
    const id = parseInt(req.params.id)
    const item = db.prepare('SELECT * FROM media WHERE id=?').get(id)
    if (!item) return res.status(404).json({ error: 'not found' })
    if (item.active) {
      db.prepare('UPDATE media SET active=0,playlist_order=0 WHERE id=?').run(id)
    } else {
      const max = db.prepare('SELECT MAX(playlist_order) as m FROM media WHERE active=1').get()
      db.prepare('UPDATE media SET active=1,playlist_order=? WHERE id=?').run((max?.m||0)+1, id)
    }
    res.json({ ok: true, active: !item.active })
  })

  api.get('/api/playlist', (_, res) => res.json(
    db.prepare(`SELECT * FROM media WHERE active=1
      AND (COALESCE(schedule_start_date,'')='' OR date('now','localtime')>=schedule_start_date)
      AND (COALESCE(schedule_end_date,'')  ='' OR date('now','localtime')<=schedule_end_date)
      AND (COALESCE(schedule_start_time,'')='' OR time('now','localtime')>=schedule_start_time)
      AND (COALESCE(schedule_end_time,'') ='' OR time('now','localtime')<=schedule_end_time)
      ORDER BY playlist_order ASC`).all()
  ))

  api.get('/api/leads', (_, res) => res.json(db.prepare('SELECT * FROM leads ORDER BY data_hora DESC').all()))
  api.get('/api/leads.csv', (_, res) => {
    const leads = db.prepare('SELECT * FROM leads ORDER BY data_hora DESC').all()
    const csv = ['Nome,Email,Score,Data', ...leads.map(l => `"${l.nome}","${l.email}",${l.score},"${l.data_hora}"`)].join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv')
    res.send('\uFEFF' + csv)
  })

  api.listen(REST_PORT, '0.0.0.0', () =>
    console.log(`[REST] API disponível em http://${getLocalIP()}:${REST_PORT}`)
  ).on('error', (err) => console.error('[REST] Falha ao iniciar API:', err.message))
}

// ─── Energy schedule ───────────────────────────────────────────────────────────

function checkEnergySchedule() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const enabled = db.prepare("SELECT value FROM settings WHERE key='energy_sleep_enabled'").get()?.value
  if (enabled !== 'true') return
  const sleepAt = db.prepare("SELECT value FROM settings WHERE key='energy_sleep_time'").get()?.value
  const wakeAt  = db.prepare("SELECT value FROM settings WHERE key='energy_wake_time'").get()?.value
  if (!sleepAt || !wakeAt) return

  const now = new Date()
  const hhmm = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0')

  let blackout = false
  if (sleepAt < wakeAt) {
    // e.g. sleep 23:00 wake 07:00 → overnight
    blackout = hhmm >= sleepAt || hhmm < wakeAt
  } else {
    // e.g. sleep 00:00 wake 23:00 → daytime blackout
    blackout = hhmm >= sleepAt && hhmm < wakeAt
  }

  mainWindow?.webContents.send('screen:blackout', blackout)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    autoHideMenuBar: true,
    fullscreen: !is.dev,
    kiosk: !is.dev,
    alwaysOnTop: !is.dev,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.on('closed', () => {
    clearInterval(energyInterval)
    energyInterval = null
    mainWindow = null
  })

  // ── Blindagem: bloqueia atalhos de fuga dentro da janela (produção) ────────
  if (!is.dev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const ctrl = input.control || input.meta
      // Bloqueia: Ctrl/Cmd+W, Ctrl/Cmd+Q, Alt+F4, Ctrl/Cmd+R (reload), F11
      if (
        (ctrl && (input.key === 'w' || input.key === 'W')) ||
        (ctrl && (input.key === 'q' || input.key === 'Q')) ||
        (ctrl && (input.key === 'r' || input.key === 'R')) ||
        (input.alt && input.key === 'F4') ||
        input.key === 'F11'
      ) {
        event.preventDefault()
      }
    })
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── Botão de Pânico: reset de senha via flag --reset-password ───────────────
// Uso: TOTEM.exe --reset-password   (Windows)
//      TOTEM.app/Contents/MacOS/TOTEM --reset-password  (macOS)
// Não abre janela — apenas reseta a senha e encerra.

if (process.argv.includes('--reset-password')) {
  app.whenReady().then(async () => {
    try {
      const dbPath = join(app.getPath('userData'), 'totem.db')

      // Importação dinâmica para garantir que o módulo nativo está disponível
      const Database = (await import('better-sqlite3')).default
      const panicDb  = new Database(dbPath)

      // Garante que a tabela existe (instalação nova ou corrompida)
      panicDb.exec(`
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)
      `)

      panicDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', '1234')").run()
      panicDb.close()

      await dialog.showMessageBox({
        type: 'info',
        title: 'TOTEM — Reset de Senha',
        message: 'Senha redefinida com sucesso.',
        detail: 'A senha do administrador voltou para: 1234\n\nO aplicativo será encerrado.',
        buttons: ['OK']
      })
    } catch (err) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'TOTEM — Erro no Reset',
        message: 'Não foi possível redefinir a senha.',
        detail: `Detalhe: ${err.message}\n\nVerifique se o aplicativo não está aberto em outra instância.`,
        buttons: ['OK']
      })
    } finally {
      app.quit()
    }
  })
} else {

// ─── Bootstrap (inicialização normal) ────────────────────────────────────────

app.whenReady().then(() => {
  initDB()
  startRestApi()
  // Reset stale download states from previous crash/close
  db.prepare("UPDATE media SET download_status='error' WHERE download_status='downloading'").run()
  energyInterval = setInterval(checkEnergySchedule, 60_000)

  // ── YouTube: spoof User-Agent (Electron é bloqueado pelo YouTube por padrão) ──
  session.defaultSession.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  )

  const youtubeFilter = {
    urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*', '*://*.googlevideo.com/*', '*://*.ytimg.com/*']
  }

  session.defaultSession.webRequest.onBeforeSendHeaders(youtubeFilter, (details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com'
      }
    })
  })

  session.defaultSession.webRequest.onHeadersReceived(youtubeFilter, (details, callback) => {
    const h = { ...details.responseHeaders }
    // Remove headers que bloqueiam embedding de iframes no Electron
    ;['x-frame-options', 'X-Frame-Options', 'content-security-policy',
      'Content-Security-Policy', 'content-security-policy-report-only'].forEach(k => delete h[k])
    callback({ responseHeaders: h })
  })

  // ── totem-media://: serve arquivos locais com range-request support ──
  // Dois modos:
<<<<<<< HEAD
  //   totem-media://media/filename.mp4  → userData/media/filename (padrão)
  //   totem-media:///caminho/absoluto   → caminho absoluto legado (logos)
  //
  // IMPORTANTE: usa net.fetch + pathToFileURL — o padrão recomendado pelo Electron.
  // NÃO usar createReadStream diretamente em new Response(): Node.js Readable ≠
  // Web ReadableStream; passa silenciosamente mas o body fica ilegível em alguns casos.
  protocol.handle('totem-media', (request) => {
    const rawPath = request.url.slice('totem-media://'.length)
    let filePath

    if (rawPath.startsWith('media/')) {
      const filename = decodeURIComponent(rawPath.slice('media/'.length))
      filePath = join(app.getPath('userData'), 'media', filename)
    } else if (rawPath.startsWith('imagens_memoria/')) {
      const filename = decodeURIComponent(rawPath.slice('imagens_memoria/'.length))
      filePath = join(app.getPath('userData'), 'imagens_memoria', filename)
    } else {
      // Legado: path absoluto codificado segmento a segmento
      filePath = rawPath.split('/').map(decodeURIComponent).join('/')
      if (!filePath.startsWith('/') && !filePath.match(/^[A-Za-z]:/)) {
        filePath = '/' + filePath
      }
    }

    // pathToFileURL converte caminhos Windows (com \) para file:///C:/... corretamente
    const fileUrl = pathToFileURL(filePath).toString()
    const headers = Object.fromEntries(request.headers.entries())

    return net.fetch(fileUrl, { headers }).catch((err) => {
      console.error('[totem-media] erro:', fileUrl, err.message)
=======
  //   totem-media://media/filename.mp4  → userData/media/filename (novo padrão)
  //   totem-media:///caminho/absoluto   → file:///caminho/absoluto  (legado: logos)
  protocol.handle('totem-media', (request) => {
    const rawPath = request.url.slice('totem-media://'.length)
    let fileUrl

    if (rawPath.startsWith('media/')) {
      const filename  = decodeURIComponent(rawPath.slice('media/'.length))
      const mediaDir  = join(app.getPath('userData'), 'media')
      const filePath  = join(mediaDir, filename)
      fileUrl = 'file://' + filePath.split('/').map(encodeURIComponent).join('/')
    } else {
      // Legado: path absoluto já codificado na URL
      fileUrl = 'file://' + rawPath
    }

    const headers = Object.fromEntries(request.headers.entries())
    return net.fetch(fileUrl, { headers }).catch((err) => {
      console.error('[totem-media] fetch falhou:', fileUrl, err.message)
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
      return new Response('Not found', { status: 404 })
    })
  })

  electronApp.setAppUserModelId('com.totem')

  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  // ── Seleção de logo ──────────────────────────────────────────────────────
  ipcMain.handle('pick-logo-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar Logo do Evento',
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths.length) return null

    const src = filePaths[0]
    const mediaDir = join(app.getPath('userData'), 'media')
    if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true })

    const ext = extname(basename(src))
    const dest = join(mediaDir, `logo_${Date.now()}${ext}`)
    copyFileSync(src, dest)

    return { name: basename(src), path: dest }
  })

  // ── Upload de mídia (vídeo ou imagem): pick → copy → retorna filename ────
  ipcMain.handle('upload-media', async (_e, { type }) => {
    const isImage = type === 'image'
    const filters = isImage
      ? [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }]
      : [{ name: 'Vídeos', extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'ogg'] }]

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: isImage ? 'Selecionar Imagem' : 'Selecionar Vídeo',
      filters,
      properties: ['openFile']
    })
    if (canceled || !filePaths.length) return null

    const src     = filePaths[0]
    const mediaDir = join(app.getPath('userData'), 'media')
    if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true })

    const ext      = extname(basename(src))
    const prefix   = isImage ? 'img' : 'vid'
    const filename = `${prefix}_${Date.now()}${ext}`
    copyFileSync(src, join(mediaDir, filename))

    return { name: basename(src), filename }
  })

<<<<<<< HEAD
  // ── Upload de imagens para Jogo da Memória: dialog multi + sharp resize ──
  ipcMain.handle('upload-imagens-memoria', async (_e, { jogoId }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar Imagens para o Jogo da Memória',
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (canceled || !filePaths.length) return []

    const imgDir = join(app.getPath('userData'), 'imagens_memoria')
    if (!existsSync(imgDir)) mkdirSync(imgDir, { recursive: true })

    const saved = []
    for (const src of filePaths) {
      const filename = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`
      const dest = join(imgDir, filename)
      await sharp(src).resize(400, 400, { fit: 'cover' }).webp({ quality: 80 }).toFile(dest)
      const id = db.prepare(
        'INSERT INTO imagens_memoria (jogo_id, caminho_arquivo) VALUES (?, ?)'
      ).run(jogoId, filename).lastInsertRowid
      saved.push({ id: Number(id), caminho_arquivo: filename })
    }
    return saved
  })

  // ── Kiosk mode controls (uso exclusivo do admin) ────────────────────────
=======
  // ── Sair do modo kiosk/tela cheia (uso exclusivo do admin) ─────────────
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
  ipcMain.handle('exit-kiosk', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.setKiosk(false)
    mainWindow.setFullScreen(false)
    mainWindow.setAlwaysOnTop(false)
  })

<<<<<<< HEAD
  ipcMain.handle('enter-kiosk', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.setAlwaysOnTop(true)
    mainWindow.setFullScreen(true)
    mainWindow.setKiosk(true)
  })

  ipcMain.handle('get-kiosk-state', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false
    return mainWindow.isKiosk()
  })

  ipcMain.handle('open-external', (_e, url) => {
    const { shell } = require('electron')
    shell.openExternal(url)
  })

=======
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
  // ── Dormir tela imediatamente ────────────────────────────────────────────
  ipcMain.handle('display-sleep', async () => {
    try {
      if (process.platform === 'darwin') {
        await execFileAsync('pmset', ['displaysleepnow'])
      } else if (process.platform === 'linux') {
        await execFileAsync('xset', ['dpms', 'force', 'off'])
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ── Informações da API REST ──────────────────────────────────────────────
  ipcMain.handle('get-api-info', () => ({ ip: getLocalIP(), port: REST_PORT }))

  // ── Seleção de arquivo de vídeo ──────────────────────────────────────────
  ipcMain.handle('pick-video-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar Arquivo de Vídeo',
      filters: [{ name: 'Vídeos', extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'ogg'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths.length) return null

    const src = filePaths[0]
    const mediaDir = join(app.getPath('userData'), 'media')
    if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true })

    const ext = extname(basename(src))
    const name = basename(src, ext)
    const dest = join(mediaDir, `${name}_${Date.now()}${ext}`)
    copyFileSync(src, dest)

    return { name: basename(src), path: dest }
  })

  // ── Validação de URL Instagram / TikTok ─────────────────────────────────
  ipcMain.handle('process-social', (_e, url) => {
    const platform = detectSocialPlatform(url)
    if (!platform) return { type: 'invalid' }
    return { type: platform, platform }
  })

  // ── yt-dlp: download como MP4 local (YouTube, Instagram, TikTok) ─────────
  // Estratégia: tenta sem cookies → chrome → edge/brave → safari → firefox
  // Timeout rigoroso de 60s com SIGKILL para não travar a fila.
  ipcMain.handle('start-ytdlp-download', async (_e, { id, url }) => {
    const ytdlpCandidates = [
      '/usr/local/bin/yt-dlp',
      '/opt/homebrew/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      join(app.getPath('userData'), 'yt-dlp')
    ]
    const ytdlpBin = ytdlpCandidates.find((p) => existsSync(p))
    if (!ytdlpBin) {
      db.prepare("UPDATE media SET download_status='error' WHERE id=?").run(id)
      mainWindow?.webContents.send('download:progress', { id, status: 'error', error: 'yt-dlp não encontrado' })
      return { ok: false, error: 'yt-dlp não encontrado. Instale com: brew install yt-dlp' }
    }

    const mediaDir = join(app.getPath('userData'), 'media')
    if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true })
    const filename = `ytdlp_${id}_${Date.now()}.mp4`
    const outPath  = join(mediaDir, filename)

    db.prepare("UPDATE media SET download_status='downloading' WHERE id=?").run(id)
    mainWindow?.webContents.send('download:progress', { id, status: 'downloading' })

    const baseArgs = [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '-o', outPath
    ]

    // Sequência de tentativas: sem cookies primeiro, depois por navegador
    const cookieStrategies = [null, 'chrome', 'edge', 'brave', 'safari', 'firefox']

    let lastError = null
    for (const browser of cookieStrategies) {
      try {
        const args = browser
          ? [...baseArgs, '--cookies-from-browser', browser, url]
          : [...baseArgs, url]
        await spawnWithTimeout(ytdlpBin, args, 60_000)
        // Sucesso: ativa o item na playlist e marca como concluído
        db.prepare("UPDATE media SET download_status='done', local_file=?, active=1 WHERE id=?").run(filename, id)
        mainWindow?.webContents.send('download:progress', { id, status: 'done', filename })
        return { ok: true, filename }
      } catch (err) {
        lastError = err
        // Timeout → não adianta tentar outros navegadores
        if (err.message.includes('timeout')) break
        // Arquivo parcial gerado — remove antes de nova tentativa
        try { if (existsSync(outPath)) unlinkSync(outPath) } catch {}
      }
    }

    db.prepare("UPDATE media SET download_status='error' WHERE id=?").run(id)
    mainWindow?.webContents.send('download:progress', { id, status: 'error', error: lastError?.message })
    return { ok: false, error: lastError?.message }
  })

  // ── Validação + pipeline YouTube ────────────────────────────────────────
  // Retorna: {type: 'short'|'invalid'|'restricted'|'embed', videoId?}
  ipcMain.handle('process-youtube', async (_e, url) => {
    // 1. Rejeita Shorts (não fazem embed corretamente)
    if (url && url.includes('/shorts/')) return { type: 'short' }

    const videoId = extractYouTubeVideoId(url)
    if (!videoId) return { type: 'invalid' }

    // 2. Valida embed via oEmbed (rápido, ~200ms — 403/404 = bloqueado)
    try {
      const res = await net.fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      )
      if (!res.ok) return { type: 'restricted', videoId }
    } catch {
      // Sem internet → tenta embed mesmo assim (fallback local assume se falhar)
      return { type: 'embed', videoId, offline: true }
    }

    return { type: 'embed', videoId }
  })

  // ── Diagnóstico de mídia (usado para depurar 404) ────────────────────────
  ipcMain.handle('debug-media', () => {
    const userData = app.getPath('userData')
    const mediaDir = join(userData, 'media')
    let files = []
    try { files = readdirSync(mediaDir) } catch {}
    return { userData, mediaDir, files }
  })

  // ── Verifica se arquivo local de mídia existe no disco ───────────────────
  ipcMain.handle('check-file-exists', (_e, filename) => {
    if (!filename) return false
    const mediaDir = join(app.getPath('userData'), 'media')
    const filePath = (filename.includes('/') || filename.includes('\\'))
      ? filename
      : join(mediaDir, filename)
    return existsSync(filePath)
  })

  // ── Wi-Fi: scan ──────────────────────────────────────────────────────────
  ipcMain.handle('wifi-scan', async () => {
    try {
      if (process.platform === 'linux') {
        const { stdout } = await execFileAsync('nmcli', [
          '-t', '-f', 'SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list'
        ])
        return { networks: parseLinuxWifi(stdout) }
      }
      if (process.platform === 'darwin') {
        const airportPaths = [
          '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport',
          '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/A/Resources/airport'
        ]
        let lastErr = null
        for (const airport of airportPaths) {
          if (!existsSync(airport)) continue
          try {
            const { stdout } = await execFileAsync(airport, ['-s'])
            const networks = parseMacWifi(stdout)
            if (networks.length > 0) return { networks }
            // Airport ran but returned nothing — may need a retry or use system_profiler
          } catch (e) { lastErr = e }
        }
        // Fallback: system_profiler (slower but doesn't need privileged binary)
        try {
          const { stdout } = await execFileAsync('system_profiler', ['SPAirPortDataType'])
          const networks = []
          const blocks = stdout.split(/Other Local Wi-Fi Networks:|Current Network Information:|/g)
          const lineRe = /^\s{10,}(.+):$/
          const rssiRe = /Signal \/ Noise:\s*(-\d+)\s*dBm/
          const secRe  = /Security:\s*(.+)/
          let current = null
          for (const line of stdout.split('\n')) {
            const nm = line.match(lineRe)
            if (nm && nm[1] !== 'Other Local Wi-Fi Networks' && nm[1] !== 'Current Network Information') {
              current = { ssid: nm[1].trim(), signal: 50, secured: false }
              networks.push(current)
            }
            if (current) {
              const r = line.match(rssiRe)
              if (r) current.signal = Math.max(0, Math.min(100, 2 * (parseInt(r[1]) + 100)))
              const s = line.match(secRe)
              if (s) current.secured = !s[1].includes('None') && !s[1].includes('Open')
            }
          }
          if (networks.length > 0) return { networks }
        } catch {}
        return { networks: [], error: lastErr?.message || 'Nenhuma rede encontrada. Verifique se o Wi-Fi está ativo.' }
      }
<<<<<<< HEAD
      if (process.platform === 'win32') {
        const { stdout } = await execFileAsync(netshExe, ['wlan', 'show', 'networks', 'mode=bssid'])
        return { networks: parseWindowsWifi(stdout) }
      }
=======
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
      return { networks: [], error: 'Plataforma não suportada para gestão de Wi-Fi.' }
    } catch (err) {
      return { networks: [], error: err.message }
    }
  })

  // ── Wi-Fi: conectar ──────────────────────────────────────────────────────
  ipcMain.handle('wifi-connect', async (_e, { ssid, password }) => {
    try {
      if (process.platform === 'linux') {
        await execFileAsync('nmcli', ['dev', 'wifi', 'connect', ssid, 'password', password])
      } else if (process.platform === 'darwin') {
        const iface = await getMacWifiInterface()
        await execFileAsync('/usr/sbin/networksetup', [
          '-setairportnetwork',
          iface,
          ssid,
          password
        ])
<<<<<<< HEAD
      } else if (process.platform === 'win32') {
        await windowsWifiConnect(ssid, password)
=======
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
      } else {
        return { success: false, error: 'Plataforma não suportada.' }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── Wi-Fi: status ────────────────────────────────────────────────────────
  ipcMain.handle('wifi-status', async () => {
    try {
      if (process.platform === 'linux') {
        const { stdout } = await execFileAsync('nmcli', [
          '-t',
          '-f',
          'NAME,DEVICE,STATE',
          'connection',
          'show',
          '--active'
        ])
        const wifi = stdout
          .trim()
          .split('\n')
          .find((l) => l.includes('wlan') || l.includes('wifi'))
        const ssid = wifi?.split(':')?.[0] || null
        return { connected: !!ssid, ssid }
      }
      if (process.platform === 'darwin') {
        const iface = await getMacWifiInterface()
        const { stdout } = await execFileAsync('/usr/sbin/networksetup', [
          '-getairportnetwork',
          iface
        ])
        const match = stdout.match(/Current Wi-Fi Network:\s*(.+)/)
        return match
          ? { connected: true, ssid: match[1].trim() }
          : { connected: false, ssid: null }
      }
<<<<<<< HEAD
      if (process.platform === 'win32') {
        const { stdout } = await execFileAsync(netshExe, ['wlan', 'show', 'interfaces'])
        const ssidMatch = stdout.match(/^\s+SSID\s+:\s+(.+)$/m)
        const stateMatch = stdout.match(/^\s+State\s+:\s+(.+)$/im) ||
                           stdout.match(/^\s+Estado\s+:\s+(.+)$/im)
        const connected = stateMatch?.[1]?.trim().toLowerCase().startsWith('connect') ?? false
        return { connected, ssid: connected ? ssidMatch?.[1]?.trim() ?? null : null }
      }
=======
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
      return { connected: false, ssid: null }
    } catch {
      return { connected: false, ssid: null }
    }
  })

  createWindow()

  // ── Blindagem: registra globalShortcuts para bloquear saída do kiosk ──────
  if (!is.dev) {
    // CommandOrControl+W / Q fecham a janela/app — bloqueados em produção
    globalShortcut.register('CommandOrControl+W', () => {})
    globalShortcut.register('CommandOrControl+Q', () => {})
    // Alt+F4 fecha janelas no Windows — interceptado aqui como fallback
    globalShortcut.register('Alt+F4', () => {})
    // Evita reload acidental que resetaria estado do totem
    globalShortcut.register('CommandOrControl+R', () => {})
    globalShortcut.register('F5', () => {})
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

} // fim do else (modo normal)

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
