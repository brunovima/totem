"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const util = require("util");
const url = require("url");
const os = require("os");
const sharp = require("sharp");
const express = require("express");
const utils = require("@electron-toolkit/utils");
const Database = require("better-sqlite3");
const icon = path.join(__dirname, "../../resources/icon.png");
const dbPath = path.join(electron.app.getPath("userData"), "totem.db");
const db = new Database(dbPath);
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      active INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER,
      text TEXT,
      options TEXT,
      correctIndex INTEGER
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT, telefone TEXT, email TEXT, score INTEGER,
      data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS jogos_memoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      ativo INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS imagens_memoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jogo_id INTEGER NOT NULL,
      caminho_arquivo TEXT NOT NULL
    );
  `);
  try {
    db.exec("ALTER TABLE media ADD COLUMN playlist_order INTEGER DEFAULT 0");
  } catch {
  }
  try {
    db.exec("ALTER TABLE media ADD COLUMN duration INTEGER DEFAULT 60");
  } catch {
  }
  try {
    db.exec("ALTER TABLE media ADD COLUMN schedule_start_date TEXT DEFAULT ''");
  } catch {
  }
  try {
    db.exec("ALTER TABLE media ADD COLUMN schedule_end_date TEXT DEFAULT ''");
  } catch {
  }
  try {
    db.exec("ALTER TABLE media ADD COLUMN schedule_start_time TEXT DEFAULT ''");
  } catch {
  }
  try {
    db.exec("ALTER TABLE media ADD COLUMN schedule_end_time TEXT DEFAULT ''");
  } catch {
  }
  try {
    db.exec("ALTER TABLE media ADD COLUMN local_file TEXT DEFAULT ''");
  } catch {
  }
  try {
    db.exec("ALTER TABLE leads ADD COLUMN telefone TEXT DEFAULT ''");
  } catch {
  }
  try {
    db.exec("ALTER TABLE leads ADD COLUMN autorizado INTEGER DEFAULT 0");
  } catch {
  }
  db.prepare("UPDATE settings SET value='0' WHERE key='border_width' AND value='8'").run();
  try {
    db.exec("ALTER TABLE media ADD COLUMN download_status TEXT DEFAULT ''");
  } catch {
  }
  db.prepare("UPDATE media SET schedule_start_date='' WHERE schedule_start_date IS NULL").run();
  db.prepare("UPDATE media SET schedule_end_date=''   WHERE schedule_end_date   IS NULL").run();
  db.prepare("UPDATE media SET schedule_start_time='' WHERE schedule_start_time IS NULL").run();
  db.prepare("UPDATE media SET schedule_end_time=''   WHERE schedule_end_time   IS NULL").run();
  const absRows = db.prepare(
    "SELECT id, source FROM media WHERE type IN ('file','image') AND source LIKE '/%'"
  ).all();
  for (const row of absRows) {
    db.prepare("UPDATE media SET source = ? WHERE id = ?").run(path.basename(row.source), row.id);
  }
  db.prepare("UPDATE media SET playlist_order = id WHERE active = 1 AND playlist_order = 0").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_username', 'admin')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password', '1234')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('border_width', '0')").run();
  setupIpcHandlers();
}
function setupIpcHandlers() {
  electron.ipcMain.handle("get-quizzes", () => db.prepare("SELECT * FROM quiz_titles").all());
  electron.ipcMain.handle(
    "create-quiz",
    (e, title) => db.prepare("INSERT INTO quiz_titles (title, active) VALUES (?, 0)").run(title).changes > 0
  );
  electron.ipcMain.handle("toggle-quiz", (e, { id, active }) => {
    db.prepare("UPDATE quiz_titles SET active = 0").run();
    if (active) db.prepare("UPDATE quiz_titles SET active = 1 WHERE id = ?").run(id);
    return true;
  });
  const deleteQuizTx = db.transaction((id) => {
    db.prepare("DELETE FROM questions WHERE quiz_id = ?").run(id);
    return db.prepare("DELETE FROM quiz_titles WHERE id = ?").run(id).changes > 0;
  });
  electron.ipcMain.handle("delete-quiz", (e, id) => deleteQuizTx(id));
  electron.ipcMain.handle("get-questions", (e, quizId) => {
    const id = quizId || db.prepare("SELECT id FROM quiz_titles WHERE active = 1").get()?.id;
    if (!id) return [];
    const rows = db.prepare("SELECT * FROM questions WHERE quiz_id = ?").all(id);
    return rows.map((r) => {
      let options = [];
      try {
        options = JSON.parse(r.options);
      } catch {
      }
      return { ...r, options };
    });
  });
  electron.ipcMain.handle(
    "save-question",
    (e, q) => db.prepare("INSERT INTO questions (quiz_id, text, options, correctIndex) VALUES (?, ?, ?, ?)").run(q.quizId, q.text, JSON.stringify(q.options), q.correctIndex).changes > 0
  );
  electron.ipcMain.handle(
    "delete-question",
    (e, id) => db.prepare("DELETE FROM questions WHERE id = ?").run(id).changes > 0
  );
  electron.ipcMain.handle(
    "get-leads",
    () => db.prepare("SELECT * FROM leads ORDER BY data_hora DESC").all()
  );
  electron.ipcMain.handle(
    "save-lead",
    (_e, lead) => db.prepare("INSERT INTO leads (nome, telefone, email, score, autorizado) VALUES (?, ?, ?, ?, ?)").run(lead.nome, lead.telefone || "", lead.email || "", lead.score, lead.autorizado ? 1 : 0).changes > 0
  );
  electron.ipcMain.handle("delete-leads", (_e, ids) => {
    const stmt = db.prepare("DELETE FROM leads WHERE id = ?");
    const tx = db.transaction((list) => {
      for (const id of list) stmt.run(id);
    });
    tx(ids);
    return true;
  });
  electron.ipcMain.handle("get-setting", (_e, key) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    return row?.value ?? null;
  });
  electron.ipcMain.handle(
    "set-setting",
    (_e, key, value) => db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value).changes > 0
  );
  electron.ipcMain.handle(
    "get-media",
    () => db.prepare("SELECT * FROM media ORDER BY created_at DESC").all()
  );
  electron.ipcMain.handle(
    "save-media",
    (_e, { name, type, source }) => db.prepare("INSERT INTO media (name, type, source) VALUES (?, ?, ?)").run(name, type, source).lastInsertRowid
  );
  electron.ipcMain.handle("delete-media", (_e, id) => {
    const item = db.prepare("SELECT * FROM media WHERE id = ?").get(id);
    if (item?.type === "file" || item?.type === "image") {
      const mediaDir = path.join(electron.app.getPath("userData"), "media");
      const filePath = item.source.includes("/") ? item.source : path.join(mediaDir, item.source);
      try {
        fs.unlinkSync(filePath);
      } catch {
      }
    }
    return db.prepare("DELETE FROM media WHERE id = ?").run(id).changes > 0;
  });
  electron.ipcMain.handle(
    "get-playlist",
    () => db.prepare(`
      SELECT * FROM media WHERE active = 1
        AND (COALESCE(schedule_start_date,'') = '' OR date('now','localtime') >= schedule_start_date)
        AND (COALESCE(schedule_end_date,'')   = '' OR date('now','localtime') <= schedule_end_date)
        AND (COALESCE(schedule_start_time,'') = '' OR time('now','localtime') >= schedule_start_time)
        AND (COALESCE(schedule_end_time,'')   = '' OR time('now','localtime') <= schedule_end_time)
        AND (type NOT IN ('instagram','tiktok')
             OR (COALESCE(local_file,'') != '' AND download_status = 'done'))
      ORDER BY playlist_order ASC
    `).all()
  );
  electron.ipcMain.handle("toggle-playlist", (_e, id) => {
    const item = db.prepare("SELECT * FROM media WHERE id = ?").get(id);
    if (!item) return false;
    if (item.active) {
      db.prepare("UPDATE media SET active = 0, playlist_order = 0 WHERE id = ?").run(id);
    } else {
      const max = db.prepare("SELECT MAX(playlist_order) as m FROM media WHERE active = 1").get();
      const nextOrder = (max?.m || 0) + 1;
      db.prepare("UPDATE media SET active = 1, playlist_order = ? WHERE id = ?").run(nextOrder, id);
    }
    return true;
  });
  electron.ipcMain.handle("move-playlist-item", (_e, { id, direction }) => {
    const item = db.prepare("SELECT * FROM media WHERE id = ?").get(id);
    if (!item?.active) return false;
    const sibling = direction === "up" ? db.prepare("SELECT * FROM media WHERE active = 1 AND playlist_order < ? ORDER BY playlist_order DESC LIMIT 1").get(item.playlist_order) : db.prepare("SELECT * FROM media WHERE active = 1 AND playlist_order > ? ORDER BY playlist_order ASC LIMIT 1").get(item.playlist_order);
    if (!sibling) return false;
    const swap = db.transaction(() => {
      db.prepare("UPDATE media SET playlist_order = ? WHERE id = ?").run(sibling.playlist_order, id);
      db.prepare("UPDATE media SET playlist_order = ? WHERE id = ?").run(item.playlist_order, sibling.id);
    });
    swap();
    return true;
  });
  electron.ipcMain.handle(
    "set-media-duration",
    (_e, { id, duration }) => db.prepare("UPDATE media SET duration = ? WHERE id = ?").run(duration, id).changes > 0
  );
  electron.ipcMain.handle(
    "set-media-schedule",
    (_e, { id, startDate, endDate, startTime, endTime }) => db.prepare("UPDATE media SET schedule_start_date=?,schedule_end_date=?,schedule_start_time=?,schedule_end_time=? WHERE id=?").run(startDate || "", endDate || "", startTime || "", endTime || "", id).changes > 0
  );
  electron.ipcMain.handle(
    "get-jogos",
    () => db.prepare(`
      SELECT j.*, COUNT(i.id) as total_imagens
      FROM jogos_memoria j
      LEFT JOIN imagens_memoria i ON i.jogo_id = j.id
      GROUP BY j.id
      ORDER BY j.id DESC
    `).all()
  );
  electron.ipcMain.handle(
    "create-jogo",
    (_e, nome) => db.prepare("INSERT INTO jogos_memoria (nome, ativo) VALUES (?, 0)").run(nome).changes > 0
  );
  electron.ipcMain.handle("toggle-jogo", (_e, { id, ativo }) => {
    db.prepare("UPDATE jogos_memoria SET ativo = 0").run();
    if (ativo) db.prepare("UPDATE jogos_memoria SET ativo = 1 WHERE id = ?").run(id);
    return true;
  });
  const deleteJogoTx = db.transaction((id) => {
    const imagens = db.prepare("SELECT caminho_arquivo FROM imagens_memoria WHERE jogo_id = ?").all(id);
    const imgDir = path.join(electron.app.getPath("userData"), "imagens_memoria");
    for (const img of imagens) {
      try {
        fs.unlinkSync(path.join(imgDir, img.caminho_arquivo));
      } catch {
      }
    }
    db.prepare("DELETE FROM imagens_memoria WHERE jogo_id = ?").run(id);
    return db.prepare("DELETE FROM jogos_memoria WHERE id = ?").run(id).changes > 0;
  });
  electron.ipcMain.handle("delete-jogo", (_e, id) => deleteJogoTx(id));
  electron.ipcMain.handle(
    "get-imagens-jogo",
    (_e, jogoId) => db.prepare("SELECT * FROM imagens_memoria WHERE jogo_id = ? ORDER BY id ASC").all(jogoId)
  );
  electron.ipcMain.handle("delete-imagem-memoria", (_e, id) => {
    const img = db.prepare("SELECT caminho_arquivo FROM imagens_memoria WHERE id = ?").get(id);
    if (img) {
      try {
        fs.unlinkSync(path.join(electron.app.getPath("userData"), "imagens_memoria", img.caminho_arquivo));
      } catch {
      }
    }
    return db.prepare("DELETE FROM imagens_memoria WHERE id = ?").run(id).changes > 0;
  });
  electron.ipcMain.handle("get-jogo-ativo", () => {
    const jogo = db.prepare("SELECT * FROM jogos_memoria WHERE ativo = 1").get();
    if (!jogo) return null;
    const imagens = db.prepare("SELECT * FROM imagens_memoria WHERE jogo_id = ? ORDER BY id ASC").all(jogo.id);
    return { ...jogo, imagens };
  });
  electron.ipcMain.handle(
    "save-imagem-memoria",
    (_e, { jogoId, caminho_arquivo }) => db.prepare("INSERT INTO imagens_memoria (jogo_id, caminho_arquivo) VALUES (?, ?)").run(jogoId, caminho_arquivo).lastInsertRowid
  );
}
const execFileAsync = util.promisify(child_process.execFile);
electron.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
electron.app.commandLine.appendSwitch("disable-renderer-backgrounding");
electron.app.commandLine.appendSwitch("disable-background-timer-throttling");
electron.app.commandLine.appendSwitch("ignore-gpu-blocklist");
electron.app.commandLine.appendSwitch("enable-gpu-rasterization");
electron.app.commandLine.appendSwitch("enable-zero-copy");
electron.app.commandLine.appendSwitch("enable-hardware-overlays", "single-fullscreen,single-on-top,underlay");
electron.app.commandLine.appendSwitch("disable-software-rasterizer");
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: "totem-media",
    privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true }
  }
]);
let mainWindow = null;
let energyInterval = null;
function detectSocialPlatform(url2) {
  if (!url2) return null;
  if (/instagram\.com\/(p|reel|tv|stories)\//.test(url2)) return "instagram";
  if (/tiktok\.com\/@[\w.]+\/video\/\d+/.test(url2) || /vm\.tiktok\.com\//.test(url2) || /tiktok\.com\/t\//.test(url2) || /tiktok\.com\/v\//.test(url2)) return "tiktok";
  return null;
}
function extractYouTubeVideoId(url2) {
  if (!url2) return null;
  const m = url2.match(/[?&]v=([^&#]+)/) || url2.match(/youtu\.be\/([^?&#]+)/) || url2.match(/youtube\.com\/embed\/([^?&#]+)/) || url2.match(/youtube\.com\/shorts\/([^?&#]+)/);
  return m ? m[1] : null;
}
function spawnWithTimeout(bin, args, timeoutMs = 6e4) {
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d;
    });
    proc.stderr.on("data", (d) => {
      stderr += d;
    });
    const timer = setTimeout(() => {
      try {
        process.kill(proc.pid, "SIGKILL");
      } catch {
      }
      reject(new Error(`yt-dlp timeout após ${timeoutMs / 1e3}s`));
    }, timeoutMs);
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `exit code ${code}`));
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
function parseMacWifi(output) {
  return output.split("\n").slice(1).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const match = trimmed.match(
      /^(.+?)\s{2,}([\da-fA-F]{2}(?::[\da-fA-F]{2}){5})\s+(-\d+)/
    );
    if (!match) return null;
    const rssi = parseInt(match[3]);
    return {
      ssid: match[1].trim(),
      signal: Math.max(0, Math.min(100, 2 * (rssi + 100))),
      secured: line.includes("WPA") || line.includes("WEP")
    };
  }).filter((n) => n?.ssid);
}
function parseLinuxWifi(output) {
  return output.trim().split("\n").filter(Boolean).map((line) => {
    const parts = line.split(":");
    if (!parts[0]) return null;
    return {
      ssid: parts[0],
      signal: parseInt(parts[1]) || 0,
      secured: parts[2] !== "--" && parts.length > 2
    };
  }).filter(Boolean);
}
function parseWindowsWifi(output) {
  const networks = [];
  const blocks = output.replace(/\r/g, "").split(/\nSSID \d+ : /);
  for (const block of blocks.slice(1)) {
    const lines = block.split("\n");
    const ssid = lines[0]?.trim();
    if (!ssid) continue;
    const signalMatch = block.match(/(\d+)%/);
    const signal = signalMatch ? parseInt(signalMatch[1]) : 50;
    const lower = block.toLowerCase();
    const secured = lower.includes("wpa") || lower.includes("wep") || lower.includes("psk");
    if (!networks.find((n) => n.ssid === ssid)) {
      networks.push({ ssid, signal, secured });
    }
  }
  return networks;
}
const netshExe = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "netsh.exe");
async function windowsWifiConnect(ssid, password) {
  if (!password) {
    await execFileAsync(netshExe, ["wlan", "connect", `name=${ssid}`]);
    return;
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
</WLANProfile>`;
  const tmpFile = path.join(electron.app.getPath("temp"), `totem_wifi_${Date.now()}.xml`);
  fs.writeFileSync(tmpFile, profileXml, "utf8");
  try {
    await execFileAsync(netshExe, ["wlan", "add", "profile", `filename=${tmpFile}`]);
    await execFileAsync(netshExe, ["wlan", "connect", `name=${ssid}`]);
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
    }
  }
}
async function getMacWifiInterface() {
  try {
    const { stdout } = await execFileAsync("/usr/sbin/networksetup", ["-listallhardwareports"]);
    const match = stdout.match(/Wi-Fi[\s\S]*?Device:\s*(\w+)/);
    return match?.[1] || "en0";
  } catch {
    return "en0";
  }
}
const REST_PORT = 3131;
function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (!iface.internal && iface.family === "IPv4") return iface.address;
    }
  }
  return "127.0.0.1";
}
function startRestApi() {
  const api = express();
  api.use(express.json());
  api.get("/api/status", (_, res) => res.json({ ok: true, version: "1.0", ip: getLocalIP(), port: REST_PORT }));
  api.get("/api/quizzes", (_, res) => res.json(db.prepare("SELECT * FROM quiz_titles").all()));
  api.post("/api/quizzes", (req, res) => {
    const { title } = req.body || {};
    if (!title) return res.status(400).json({ error: "title required" });
    const r = db.prepare("INSERT INTO quiz_titles (title, active) VALUES (?,0)").run(title);
    res.json({ id: r.lastInsertRowid });
  });
  api.delete("/api/quizzes/:id", (req, res) => {
    const id = parseInt(req.params.id);
    db.prepare("DELETE FROM questions WHERE quiz_id=?").run(id);
    db.prepare("DELETE FROM quiz_titles WHERE id=?").run(id);
    res.json({ ok: true });
  });
  api.get("/api/media", (_, res) => res.json(db.prepare("SELECT * FROM media ORDER BY created_at DESC").all()));
  api.post("/api/media", (req, res) => {
    const { name, type, source } = req.body || {};
    if (!name || !type || !source) return res.status(400).json({ error: "name,type,source required" });
    const r = db.prepare("INSERT INTO media (name,type,source) VALUES (?,?,?)").run(name, type, source);
    res.json({ id: r.lastInsertRowid });
  });
  api.delete("/api/media/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const item = db.prepare("SELECT * FROM media WHERE id=?").get(id);
    if (item?.type === "file" || item?.type === "image") {
      const mediaDir = path.join(electron.app.getPath("userData"), "media");
      const filePath = item.source.includes("/") ? item.source : path.join(mediaDir, item.source);
      try {
        fs.unlinkSync(filePath);
      } catch {
      }
    }
    db.prepare("DELETE FROM media WHERE id=?").run(id);
    res.json({ ok: true });
  });
  api.post("/api/media/:id/toggle-playlist", (req, res) => {
    const id = parseInt(req.params.id);
    const item = db.prepare("SELECT * FROM media WHERE id=?").get(id);
    if (!item) return res.status(404).json({ error: "not found" });
    if (item.active) {
      db.prepare("UPDATE media SET active=0,playlist_order=0 WHERE id=?").run(id);
    } else {
      const max = db.prepare("SELECT MAX(playlist_order) as m FROM media WHERE active=1").get();
      db.prepare("UPDATE media SET active=1,playlist_order=? WHERE id=?").run((max?.m || 0) + 1, id);
    }
    res.json({ ok: true, active: !item.active });
  });
  api.get("/api/playlist", (_, res) => res.json(
    db.prepare(`SELECT * FROM media WHERE active=1
      AND (COALESCE(schedule_start_date,'')='' OR date('now','localtime')>=schedule_start_date)
      AND (COALESCE(schedule_end_date,'')  ='' OR date('now','localtime')<=schedule_end_date)
      AND (COALESCE(schedule_start_time,'')='' OR time('now','localtime')>=schedule_start_time)
      AND (COALESCE(schedule_end_time,'') ='' OR time('now','localtime')<=schedule_end_time)
      ORDER BY playlist_order ASC`).all()
  ));
  api.get("/api/leads", (_, res) => res.json(db.prepare("SELECT * FROM leads ORDER BY data_hora DESC").all()));
  api.get("/api/leads.csv", (_, res) => {
    const leads = db.prepare("SELECT * FROM leads ORDER BY data_hora DESC").all();
    const csv = ["Nome,Email,Score,Data", ...leads.map((l) => `"${l.nome}","${l.email}",${l.score},"${l.data_hora}"`)].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
    res.send("\uFEFF" + csv);
  });
  api.listen(
    REST_PORT,
    "0.0.0.0",
    () => console.log(`[REST] API disponível em http://${getLocalIP()}:${REST_PORT}`)
  ).on("error", (err) => console.error("[REST] Falha ao iniciar API:", err.message));
}
function checkEnergySchedule() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const enabled = db.prepare("SELECT value FROM settings WHERE key='energy_sleep_enabled'").get()?.value;
  if (enabled !== "true") return;
  const sleepAt = db.prepare("SELECT value FROM settings WHERE key='energy_sleep_time'").get()?.value;
  const wakeAt = db.prepare("SELECT value FROM settings WHERE key='energy_wake_time'").get()?.value;
  if (!sleepAt || !wakeAt) return;
  const now = /* @__PURE__ */ new Date();
  const hhmm = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
  let blackout = false;
  if (sleepAt < wakeAt) {
    blackout = hhmm >= sleepAt || hhmm < wakeAt;
  } else {
    blackout = hhmm >= sleepAt && hhmm < wakeAt;
  }
  mainWindow?.webContents.send("screen:blackout", blackout);
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    autoHideMenuBar: true,
    fullscreen: !utils.is.dev,
    kiosk: !utils.is.dev,
    alwaysOnTop: !utils.is.dev,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      webviewTag: true,
      autoplayPolicy: "no-user-gesture-required"
    }
  });
  mainWindow.on("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    clearInterval(energyInterval);
    energyInterval = null;
    mainWindow = null;
  });
  if (!utils.is.dev) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      const ctrl = input.control || input.meta;
      if (ctrl && (input.key === "w" || input.key === "W") || ctrl && (input.key === "q" || input.key === "Q") || ctrl && (input.key === "r" || input.key === "R") || input.alt && input.key === "F4" || input.key === "F11") {
        event.preventDefault();
      }
    });
  }
  mainWindow.webContents.setWindowOpenHandler(({ url: url2 }) => {
    if (url2.startsWith("https://")) electron.shell.openExternal(url2);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
if (process.argv.includes("--reset-password")) {
  electron.app.whenReady().then(async () => {
    try {
      const dbPath2 = path.join(electron.app.getPath("userData"), "totem.db");
      const Database2 = (await import("better-sqlite3")).default;
      const panicDb = new Database2(dbPath2);
      panicDb.exec(`
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)
      `);
      panicDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', '1234')").run();
      panicDb.close();
      await electron.dialog.showMessageBox({
        type: "info",
        title: "TOTEM — Reset de Senha",
        message: "Senha redefinida com sucesso.",
        detail: "A senha do administrador voltou para: 1234\n\nO aplicativo será encerrado.",
        buttons: ["OK"]
      });
    } catch (err) {
      await electron.dialog.showMessageBox({
        type: "error",
        title: "TOTEM — Erro no Reset",
        message: "Não foi possível redefinir a senha.",
        detail: `Detalhe: ${err.message}

Verifique se o aplicativo não está aberto em outra instância.`,
        buttons: ["OK"]
      });
    } finally {
      electron.app.quit();
    }
  });
} else {
  electron.app.whenReady().then(() => {
    initDB();
    startRestApi();
    db.prepare("UPDATE media SET download_status='error' WHERE download_status='downloading'").run();
    energyInterval = setInterval(checkEnergySchedule, 6e4);
    electron.session.defaultSession.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );
    const youtubeFilter = {
      urls: ["*://*.youtube.com/*", "*://*.youtube-nocookie.com/*", "*://*.googlevideo.com/*", "*://*.ytimg.com/*"]
    };
    electron.session.defaultSession.webRequest.onBeforeSendHeaders(youtubeFilter, (details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          "Referer": "https://www.youtube.com/",
          "Origin": "https://www.youtube.com"
        }
      });
    });
    electron.session.defaultSession.webRequest.onHeadersReceived(youtubeFilter, (details, callback) => {
      const h = { ...details.responseHeaders };
      [
        "x-frame-options",
        "X-Frame-Options",
        "content-security-policy",
        "Content-Security-Policy",
        "content-security-policy-report-only"
      ].forEach((k) => delete h[k]);
      callback({ responseHeaders: h });
    });
    electron.protocol.handle("totem-media", (request) => {
      const rawPath = request.url.slice("totem-media://".length);
      let filePath;
      if (rawPath.startsWith("media/")) {
        const filename = decodeURIComponent(rawPath.slice("media/".length));
        filePath = path.join(electron.app.getPath("userData"), "media", filename);
      } else if (rawPath.startsWith("imagens_memoria/")) {
        const filename = decodeURIComponent(rawPath.slice("imagens_memoria/".length));
        filePath = path.join(electron.app.getPath("userData"), "imagens_memoria", filename);
      } else {
        filePath = rawPath.split("/").map(decodeURIComponent).join("/");
        if (!filePath.startsWith("/") && !filePath.match(/^[A-Za-z]:/)) {
          filePath = "/" + filePath;
        }
      }
      const fileUrl = url.pathToFileURL(filePath).toString();
      const headers = Object.fromEntries(request.headers.entries());
      return electron.net.fetch(fileUrl, { headers }).catch((err) => {
        console.error("[totem-media] erro:", fileUrl, err.message);
        return new Response("Not found", { status: 404 });
      });
    });
    utils.electronApp.setAppUserModelId("com.totem");
    electron.app.on("browser-window-created", (_, window) => utils.optimizer.watchWindowShortcuts(window));
    electron.ipcMain.handle("pick-logo-file", async () => {
      const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
        title: "Selecionar Logo do Evento",
        filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }],
        properties: ["openFile"]
      });
      if (canceled || !filePaths.length) return null;
      const src = filePaths[0];
      const mediaDir = path.join(electron.app.getPath("userData"), "media");
      if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
      const ext = path.extname(path.basename(src));
      const dest = path.join(mediaDir, `logo_${Date.now()}${ext}`);
      fs.copyFileSync(src, dest);
      return { name: path.basename(src), path: dest };
    });
    electron.ipcMain.handle("upload-media", async (_e, { type }) => {
      const isImage = type === "image";
      const filters = isImage ? [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"] }] : [{ name: "Vídeos", extensions: ["mp4", "webm", "mkv", "avi", "mov", "ogg"] }];
      const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
        title: isImage ? "Selecionar Imagem" : "Selecionar Vídeo",
        filters,
        properties: ["openFile"]
      });
      if (canceled || !filePaths.length) return null;
      const src = filePaths[0];
      const mediaDir = path.join(electron.app.getPath("userData"), "media");
      if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
      const ext = path.extname(path.basename(src));
      const prefix = isImage ? "img" : "vid";
      const filename = `${prefix}_${Date.now()}${ext}`;
      fs.copyFileSync(src, path.join(mediaDir, filename));
      return { name: path.basename(src), filename };
    });
    electron.ipcMain.handle("upload-imagens-memoria", async (_e, { jogoId }) => {
      const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
        title: "Selecionar Imagens para o Jogo da Memória",
        filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp"] }],
        properties: ["openFile", "multiSelections"]
      });
      if (canceled || !filePaths.length) return [];
      const imgDir = path.join(electron.app.getPath("userData"), "imagens_memoria");
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
      const saved = [];
      for (const src of filePaths) {
        const filename = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
        const dest = path.join(imgDir, filename);
        await sharp(src).resize(400, 400, { fit: "cover" }).webp({ quality: 80 }).toFile(dest);
        const id = db.prepare(
          "INSERT INTO imagens_memoria (jogo_id, caminho_arquivo) VALUES (?, ?)"
        ).run(jogoId, filename).lastInsertRowid;
        saved.push({ id: Number(id), caminho_arquivo: filename });
      }
      return saved;
    });
    electron.ipcMain.handle("exit-kiosk", () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.setKiosk(false);
      mainWindow.setFullScreen(false);
      mainWindow.setAlwaysOnTop(false);
    });
    electron.ipcMain.handle("enter-kiosk", () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setFullScreen(true);
      mainWindow.setKiosk(true);
    });
    electron.ipcMain.handle("get-kiosk-state", () => {
      if (!mainWindow || mainWindow.isDestroyed()) return false;
      return mainWindow.isKiosk();
    });
    electron.ipcMain.handle("open-external", (_e, url2) => {
      const { shell: shell2 } = require("electron");
      shell2.openExternal(url2);
    });
    electron.ipcMain.handle("display-sleep", async () => {
      try {
        if (process.platform === "darwin") {
          await execFileAsync("pmset", ["displaysleepnow"]);
        } else if (process.platform === "linux") {
          await execFileAsync("xset", ["dpms", "force", "off"]);
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    });
    electron.ipcMain.handle("get-api-info", () => ({ ip: getLocalIP(), port: REST_PORT }));
    electron.ipcMain.handle("pick-video-file", async () => {
      const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
        title: "Selecionar Arquivo de Vídeo",
        filters: [{ name: "Vídeos", extensions: ["mp4", "webm", "mkv", "avi", "mov", "ogg"] }],
        properties: ["openFile"]
      });
      if (canceled || !filePaths.length) return null;
      const src = filePaths[0];
      const mediaDir = path.join(electron.app.getPath("userData"), "media");
      if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
      const ext = path.extname(path.basename(src));
      const name = path.basename(src, ext);
      const dest = path.join(mediaDir, `${name}_${Date.now()}${ext}`);
      fs.copyFileSync(src, dest);
      return { name: path.basename(src), path: dest };
    });
    electron.ipcMain.handle("process-social", (_e, url2) => {
      const platform = detectSocialPlatform(url2);
      if (!platform) return { type: "invalid" };
      return { type: platform, platform };
    });
    electron.ipcMain.handle("start-ytdlp-download", async (_e, { id, url: url2 }) => {
      const ytdlpCandidates = [
        "/usr/local/bin/yt-dlp",
        "/opt/homebrew/bin/yt-dlp",
        "/usr/bin/yt-dlp",
        path.join(electron.app.getPath("userData"), "yt-dlp")
      ];
      const ytdlpBin = ytdlpCandidates.find((p) => fs.existsSync(p));
      if (!ytdlpBin) {
        db.prepare("UPDATE media SET download_status='error' WHERE id=?").run(id);
        mainWindow?.webContents.send("download:progress", { id, status: "error", error: "yt-dlp não encontrado" });
        return { ok: false, error: "yt-dlp não encontrado. Instale com: brew install yt-dlp" };
      }
      const mediaDir = path.join(electron.app.getPath("userData"), "media");
      if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
      const filename = `ytdlp_${id}_${Date.now()}.mp4`;
      const outPath = path.join(mediaDir, filename);
      db.prepare("UPDATE media SET download_status='downloading' WHERE id=?").run(id);
      mainWindow?.webContents.send("download:progress", { id, status: "downloading" });
      const baseArgs = [
        "-f",
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format",
        "mp4",
        "--no-playlist",
        "-o",
        outPath
      ];
      const cookieStrategies = [null, "chrome", "edge", "brave", "safari", "firefox"];
      let lastError = null;
      for (const browser of cookieStrategies) {
        try {
          const args = browser ? [...baseArgs, "--cookies-from-browser", browser, url2] : [...baseArgs, url2];
          await spawnWithTimeout(ytdlpBin, args, 6e4);
          db.prepare("UPDATE media SET download_status='done', local_file=?, active=1 WHERE id=?").run(filename, id);
          mainWindow?.webContents.send("download:progress", { id, status: "done", filename });
          return { ok: true, filename };
        } catch (err) {
          lastError = err;
          if (err.message.includes("timeout")) break;
          try {
            if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
          } catch {
          }
        }
      }
      db.prepare("UPDATE media SET download_status='error' WHERE id=?").run(id);
      mainWindow?.webContents.send("download:progress", { id, status: "error", error: lastError?.message });
      return { ok: false, error: lastError?.message };
    });
    electron.ipcMain.handle("process-youtube", async (_e, url2) => {
      if (url2 && url2.includes("/shorts/")) return { type: "short" };
      const videoId = extractYouTubeVideoId(url2);
      if (!videoId) return { type: "invalid" };
      try {
        const res = await electron.net.fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        if (!res.ok) return { type: "restricted", videoId };
      } catch {
        return { type: "embed", videoId, offline: true };
      }
      return { type: "embed", videoId };
    });
    electron.ipcMain.handle("debug-media", () => {
      const userData = electron.app.getPath("userData");
      const mediaDir = path.join(userData, "media");
      let files = [];
      try {
        files = fs.readdirSync(mediaDir);
      } catch {
      }
      return { userData, mediaDir, files };
    });
    electron.ipcMain.handle("check-file-exists", (_e, filename) => {
      if (!filename) return false;
      const mediaDir = path.join(electron.app.getPath("userData"), "media");
      const filePath = filename.includes("/") || filename.includes("\\") ? filename : path.join(mediaDir, filename);
      return fs.existsSync(filePath);
    });
    electron.ipcMain.handle("wifi-scan", async () => {
      try {
        if (process.platform === "linux") {
          const { stdout } = await execFileAsync("nmcli", [
            "-t",
            "-f",
            "SSID,SIGNAL,SECURITY",
            "dev",
            "wifi",
            "list"
          ]);
          return { networks: parseLinuxWifi(stdout) };
        }
        if (process.platform === "darwin") {
          const airportPaths = [
            "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport",
            "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/A/Resources/airport"
          ];
          let lastErr = null;
          for (const airport of airportPaths) {
            if (!fs.existsSync(airport)) continue;
            try {
              const { stdout } = await execFileAsync(airport, ["-s"]);
              const networks = parseMacWifi(stdout);
              if (networks.length > 0) return { networks };
            } catch (e) {
              lastErr = e;
            }
          }
          try {
            const { stdout } = await execFileAsync("system_profiler", ["SPAirPortDataType"]);
            const networks = [];
            const blocks = stdout.split(/Other Local Wi-Fi Networks:|Current Network Information:|/g);
            const lineRe = /^\s{10,}(.+):$/;
            const rssiRe = /Signal \/ Noise:\s*(-\d+)\s*dBm/;
            const secRe = /Security:\s*(.+)/;
            let current = null;
            for (const line of stdout.split("\n")) {
              const nm = line.match(lineRe);
              if (nm && nm[1] !== "Other Local Wi-Fi Networks" && nm[1] !== "Current Network Information") {
                current = { ssid: nm[1].trim(), signal: 50, secured: false };
                networks.push(current);
              }
              if (current) {
                const r = line.match(rssiRe);
                if (r) current.signal = Math.max(0, Math.min(100, 2 * (parseInt(r[1]) + 100)));
                const s = line.match(secRe);
                if (s) current.secured = !s[1].includes("None") && !s[1].includes("Open");
              }
            }
            if (networks.length > 0) return { networks };
          } catch {
          }
          return { networks: [], error: lastErr?.message || "Nenhuma rede encontrada. Verifique se o Wi-Fi está ativo." };
        }
        if (process.platform === "win32") {
          const { stdout } = await execFileAsync(netshExe, ["wlan", "show", "networks", "mode=bssid"]);
          return { networks: parseWindowsWifi(stdout) };
        }
        return { networks: [], error: "Plataforma não suportada para gestão de Wi-Fi." };
      } catch (err) {
        return { networks: [], error: err.message };
      }
    });
    electron.ipcMain.handle("wifi-connect", async (_e, { ssid, password }) => {
      try {
        if (process.platform === "linux") {
          await execFileAsync("nmcli", ["dev", "wifi", "connect", ssid, "password", password]);
        } else if (process.platform === "darwin") {
          const iface = await getMacWifiInterface();
          await execFileAsync("/usr/sbin/networksetup", [
            "-setairportnetwork",
            iface,
            ssid,
            password
          ]);
        } else if (process.platform === "win32") {
          await windowsWifiConnect(ssid, password);
        } else {
          return { success: false, error: "Plataforma não suportada." };
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });
    electron.ipcMain.handle("wifi-status", async () => {
      try {
        if (process.platform === "linux") {
          const { stdout } = await execFileAsync("nmcli", [
            "-t",
            "-f",
            "NAME,DEVICE,STATE",
            "connection",
            "show",
            "--active"
          ]);
          const wifi = stdout.trim().split("\n").find((l) => l.includes("wlan") || l.includes("wifi"));
          const ssid = wifi?.split(":")?.[0] || null;
          return { connected: !!ssid, ssid };
        }
        if (process.platform === "darwin") {
          const iface = await getMacWifiInterface();
          const { stdout } = await execFileAsync("/usr/sbin/networksetup", [
            "-getairportnetwork",
            iface
          ]);
          const match = stdout.match(/Current Wi-Fi Network:\s*(.+)/);
          return match ? { connected: true, ssid: match[1].trim() } : { connected: false, ssid: null };
        }
        if (process.platform === "win32") {
          const { stdout } = await execFileAsync(netshExe, ["wlan", "show", "interfaces"]);
          const ssidMatch = stdout.match(/^\s+SSID\s+:\s+(.+)$/m);
          const stateMatch = stdout.match(/^\s+State\s+:\s+(.+)$/im) || stdout.match(/^\s+Estado\s+:\s+(.+)$/im);
          const connected = stateMatch?.[1]?.trim().toLowerCase().startsWith("connect") ?? false;
          return { connected, ssid: connected ? ssidMatch?.[1]?.trim() ?? null : null };
        }
        return { connected: false, ssid: null };
      } catch {
        return { connected: false, ssid: null };
      }
    });
    createWindow();
    if (!utils.is.dev) {
      electron.globalShortcut.register("CommandOrControl+W", () => {
      });
      electron.globalShortcut.register("CommandOrControl+Q", () => {
      });
      electron.globalShortcut.register("Alt+F4", () => {
      });
      electron.globalShortcut.register("CommandOrControl+R", () => {
      });
      electron.globalShortcut.register("F5", () => {
      });
    }
    electron.app.on("activate", () => {
      if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}
electron.app.on("will-quit", () => {
  electron.globalShortcut.unregisterAll();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
