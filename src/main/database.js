import Database from 'better-sqlite3'
import { app, ipcMain } from 'electron'
import { join, basename } from 'path'
import { unlinkSync } from 'fs'

const dbPath = join(app.getPath('userData'), 'totem.db')
export const db = new Database(dbPath)

export function initDB() {
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
      nome TEXT, email TEXT, score INTEGER,
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
  `)

  // Migrações para instalações existentes
  try { db.exec('ALTER TABLE media ADD COLUMN playlist_order INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE media ADD COLUMN duration INTEGER DEFAULT 60') } catch {}
  try { db.exec("ALTER TABLE media ADD COLUMN schedule_start_date TEXT DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE media ADD COLUMN schedule_end_date TEXT DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE media ADD COLUMN schedule_start_time TEXT DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE media ADD COLUMN schedule_end_time TEXT DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE media ADD COLUMN local_file TEXT DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE media ADD COLUMN download_status TEXT DEFAULT ''") } catch {}
  // Limpa NULLs residuais nas colunas de agendamento (SQLite pode armazenar NULL em vez de DEFAULT para linhas pré-existentes)
  db.prepare("UPDATE media SET schedule_start_date='' WHERE schedule_start_date IS NULL").run()
  db.prepare("UPDATE media SET schedule_end_date=''   WHERE schedule_end_date   IS NULL").run()
  db.prepare("UPDATE media SET schedule_start_time='' WHERE schedule_start_time IS NULL").run()
  db.prepare("UPDATE media SET schedule_end_time=''   WHERE schedule_end_time   IS NULL").run()
  // Migra caminhos absolutos → só filename (elimina dependência de path do SO no banco)
  const absRows = db.prepare(
    "SELECT id, source FROM media WHERE type IN ('file','image') AND source LIKE '/%'"
  ).all()
  for (const row of absRows) {
    db.prepare('UPDATE media SET source = ? WHERE id = ?').run(basename(row.source), row.id)
  }

  // Garante que itens já ativos tenham uma ordem válida
  db.prepare('UPDATE media SET playlist_order = id WHERE active = 1 AND playlist_order = 0').run()

  // Credenciais padrão — INSERT OR IGNORE preserva valores já alterados pelo usuário
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_username', 'admin')").run()
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password', '1234')").run()

  setupIpcHandlers()
}

function setupIpcHandlers() {
  // ── Quizzes ─────────────────────────────────────────────────────────────────
  ipcMain.handle('get-quizzes', () => db.prepare('SELECT * FROM quiz_titles').all())
  ipcMain.handle('create-quiz', (e, title) =>
    db.prepare('INSERT INTO quiz_titles (title, active) VALUES (?, 0)').run(title).changes > 0
  )
  ipcMain.handle('toggle-quiz', (e, { id, active }) => {
    db.prepare('UPDATE quiz_titles SET active = 0').run()
    if (active) db.prepare('UPDATE quiz_titles SET active = 1 WHERE id = ?').run(id)
    return true
  })
  const deleteQuizTx = db.transaction((id) => {
    db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(id)
    return db.prepare('DELETE FROM quiz_titles WHERE id = ?').run(id).changes > 0
  })
  ipcMain.handle('delete-quiz', (e, id) => deleteQuizTx(id))

  // ── Perguntas ────────────────────────────────────────────────────────────────
  ipcMain.handle('get-questions', (e, quizId) => {
    const id = quizId || db.prepare('SELECT id FROM quiz_titles WHERE active = 1').get()?.id
    if (!id) return []
    const rows = db.prepare('SELECT * FROM questions WHERE quiz_id = ?').all(id)
    return rows.map((r) => {
      let options = []
      try { options = JSON.parse(r.options) } catch {}
      return { ...r, options }
    })
  })
  ipcMain.handle('save-question', (e, q) =>
    db.prepare('INSERT INTO questions (quiz_id, text, options, correctIndex) VALUES (?, ?, ?, ?)')
      .run(q.quizId, q.text, JSON.stringify(q.options), q.correctIndex).changes > 0
  )
  ipcMain.handle('delete-question', (e, id) =>
    db.prepare('DELETE FROM questions WHERE id = ?').run(id).changes > 0
  )

  // ── Leads ────────────────────────────────────────────────────────────────────
  ipcMain.handle('get-leads', () =>
    db.prepare('SELECT * FROM leads ORDER BY data_hora DESC').all()
  )
  ipcMain.handle('save-lead', (_e, lead) =>
    db.prepare('INSERT INTO leads (nome, email, score) VALUES (?, ?, ?)')
      .run(lead.nome, lead.email, lead.score).changes > 0
  )
  ipcMain.handle('delete-leads', (_e, ids) => {
    const stmt = db.prepare('DELETE FROM leads WHERE id = ?')
    const tx = db.transaction((list) => { for (const id of list) stmt.run(id) })
    tx(ids)
    return true
  })

  // ── Settings ─────────────────────────────────────────────────────────────────
  ipcMain.handle('get-setting', (_e, key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
    return row?.value ?? null
  })
  ipcMain.handle('set-setting', (_e, key, value) =>
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(key, value).changes > 0
  )

  // ── Mídia — biblioteca ────────────────────────────────────────────────────────
  ipcMain.handle('get-media', () =>
    db.prepare('SELECT * FROM media ORDER BY created_at DESC').all()
  )
  ipcMain.handle('save-media', (_e, { name, type, source }) =>
    db.prepare('INSERT INTO media (name, type, source) VALUES (?, ?, ?)')
      .run(name, type, source).lastInsertRowid
  )
  ipcMain.handle('delete-media', (_e, id) => {
    const item = db.prepare('SELECT * FROM media WHERE id = ?').get(id)
    if (item?.type === 'file' || item?.type === 'image') {
      const mediaDir = join(app.getPath('userData'), 'media')
      // Suporta tanto filename-only (novo) quanto caminho absoluto (legado)
      const filePath = item.source.includes('/') ? item.source : join(mediaDir, item.source)
      try { unlinkSync(filePath) } catch {}
    }
    return db.prepare('DELETE FROM media WHERE id = ?').run(id).changes > 0
  })

  // ── Mídia — playlist ──────────────────────────────────────────────────────────
  ipcMain.handle('get-playlist', () =>
    db.prepare(`
      SELECT * FROM media WHERE active = 1
        AND (COALESCE(schedule_start_date,'') = '' OR date('now','localtime') >= schedule_start_date)
        AND (COALESCE(schedule_end_date,'')   = '' OR date('now','localtime') <= schedule_end_date)
        AND (COALESCE(schedule_start_time,'') = '' OR time('now','localtime') >= schedule_start_time)
        AND (COALESCE(schedule_end_time,'')   = '' OR time('now','localtime') <= schedule_end_time)
        AND (type NOT IN ('instagram','tiktok')
             OR (COALESCE(local_file,'') != '' AND download_status = 'done'))
      ORDER BY playlist_order ASC
    `).all()
  )

  ipcMain.handle('toggle-playlist', (_e, id) => {
    const item = db.prepare('SELECT * FROM media WHERE id = ?').get(id)
    if (!item) return false
    if (item.active) {
      db.prepare('UPDATE media SET active = 0, playlist_order = 0 WHERE id = ?').run(id)
    } else {
      const max = db.prepare('SELECT MAX(playlist_order) as m FROM media WHERE active = 1').get()
      const nextOrder = (max?.m || 0) + 1
      db.prepare('UPDATE media SET active = 1, playlist_order = ? WHERE id = ?').run(nextOrder, id)
    }
    return true
  })

  ipcMain.handle('move-playlist-item', (_e, { id, direction }) => {
    const item = db.prepare('SELECT * FROM media WHERE id = ?').get(id)
    if (!item?.active) return false
    const sibling = direction === 'up'
      ? db.prepare('SELECT * FROM media WHERE active = 1 AND playlist_order < ? ORDER BY playlist_order DESC LIMIT 1').get(item.playlist_order)
      : db.prepare('SELECT * FROM media WHERE active = 1 AND playlist_order > ? ORDER BY playlist_order ASC LIMIT 1').get(item.playlist_order)
    if (!sibling) return false
    const swap = db.transaction(() => {
      db.prepare('UPDATE media SET playlist_order = ? WHERE id = ?').run(sibling.playlist_order, id)
      db.prepare('UPDATE media SET playlist_order = ? WHERE id = ?').run(item.playlist_order, sibling.id)
    })
    swap()
    return true
  })

  ipcMain.handle('set-media-duration', (_e, { id, duration }) =>
    db.prepare('UPDATE media SET duration = ? WHERE id = ?').run(duration, id).changes > 0
  )

  ipcMain.handle('set-media-schedule', (_e, { id, startDate, endDate, startTime, endTime }) =>
    db.prepare('UPDATE media SET schedule_start_date=?,schedule_end_date=?,schedule_start_time=?,schedule_end_time=? WHERE id=?')
      .run(startDate||'', endDate||'', startTime||'', endTime||'', id).changes > 0
  )
}
