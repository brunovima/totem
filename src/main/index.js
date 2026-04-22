import { app, shell, BrowserWindow, ipcMain, dialog, protocol, session, net, globalShortcut } from 'electron'
import { join, basename, extname } from 'path'
import { copyFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { networkInterfaces } from 'os'
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
app.commandLine.appendSwitch('ignore-gpu-blocklist')

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

function extractYouTubeVideoId(url) {
  if (!url) return null
  const m =
    url.match(/[?&]v=([^&#]+)/) ||
    url.match(/youtu\.be\/([^?&#]+)/) ||
    url.match(/youtube\.com\/embed\/([^?&#]+)/) ||
    url.match(/youtube\.com\/shorts\/([^?&#]+)/)
  return m ? m[1] : null
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

// ─── Bootstrap ────────────────────────────────────────────────────────────────

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

  // ── yt-dlp: download YouTube como MP4 local ──────────────────────────────
  ipcMain.handle('start-ytdlp-download', async (_e, { id, url }) => {
    const ytdlpCandidates = [
      '/usr/local/bin/yt-dlp',
      '/opt/homebrew/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      join(app.getPath('userData'), 'yt-dlp')
    ]
    const ytdlpBin = ytdlpCandidates.find((p) => existsSync(p))
    if (!ytdlpBin) {
      return { ok: false, error: 'yt-dlp não encontrado. Instale com: brew install yt-dlp' }
    }
    const mediaDir = join(app.getPath('userData'), 'media')
    if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true })
    const filename = `ytdlp_${id}_${Date.now()}.mp4`
    const outPath  = join(mediaDir, filename)
    db.prepare("UPDATE media SET download_status='downloading' WHERE id=?").run(id)
    mainWindow?.webContents.send('download:progress', { id, status: 'downloading' })
    try {
      await execFileAsync(ytdlpBin, [
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '-o', outPath,
        url
      ])
      db.prepare("UPDATE media SET download_status='done', local_file=? WHERE id=?").run(filename, id)
      mainWindow?.webContents.send('download:progress', { id, status: 'done', filename })
      return { ok: true, filename }
    } catch (err) {
      db.prepare("UPDATE media SET download_status='error' WHERE id=?").run(id)
      mainWindow?.webContents.send('download:progress', { id, status: 'error', error: err.message })
      return { ok: false, error: err.message }
    }
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

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
