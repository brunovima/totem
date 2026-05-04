/**
 * Testes de Integração — Banco de Dados SQLite (better-sqlite3)
 *
 * Cobre:
 *  - Reset de senha (Botão de Pânico)
 *  - Integridade das migrations
 *  - Consistência das operações CRUD de leads, quizzes e settings
 *  - Resiliência a dados corrompidos/inválidos
 *
 * Executar: npx vitest run tests/integration/database.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'

// ── Factory: cria um DB temporário isolado por teste ────────────────────────

function createTestDb() {
  const dbPath = join(tmpdir(), `totem-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
  const db = new Database(dbPath)

  // Replica o schema exato do database.js
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      playlist_order INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 60,
      schedule_start_date TEXT DEFAULT '',
      schedule_end_date TEXT DEFAULT '',
      schedule_start_time TEXT DEFAULT '',
      schedule_end_time TEXT DEFAULT '',
      local_file TEXT DEFAULT '',
      download_status TEXT DEFAULT ''
    );
  `)

  // Credenciais padrão
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_username', 'admin')").run()
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password', '1234')").run()

  return { db, dbPath }
}

function destroyTestDb(db, dbPath) {
  try { db.close() } catch {}
  try { if (existsSync(dbPath)) unlinkSync(dbPath) } catch {}
}

// ════ SUITE: Reset de Senha (Botão de Pânico) ════════════════════════════════

describe('Reset de Senha — Botão de Pânico', () => {
  let db, dbPath

  beforeEach(() => ({ db, dbPath } = createTestDb()))
  afterEach(() => destroyTestDb(db, dbPath))

  it('reseta senha customizada para 1234', () => {
    db.prepare("UPDATE settings SET value = 'minhasenhasupersecreta' WHERE key = 'admin_password'").run()
    expect(db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get().value)
      .toBe('minhasenhasupersecreta')

    // Executa a mesma lógica do panic handler em main/index.js
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', '1234')").run()

    expect(db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get().value)
      .toBe('1234')
  })

  it('INSERT OR REPLACE funciona em banco sem senha prévia', () => {
    db.prepare("DELETE FROM settings WHERE key = 'admin_password'").run()
    expect(db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get())
      .toBeUndefined()

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', '1234')").run()

    expect(db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get().value)
      .toBe('1234')
  })

  it('reset não afeta outras configurações', () => {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('border_color', '#ff0000')").run()
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('logo_size', '120')").run()

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', '1234')").run()

    expect(db.prepare("SELECT value FROM settings WHERE key = 'border_color'").get().value).toBe('#ff0000')
    expect(db.prepare("SELECT value FROM settings WHERE key = 'logo_size'").get().value).toBe('120')
  })

  it('reset é idempotente — executar duas vezes não causa erro', () => {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', '1234')").run()
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', '1234')").run()

    const rows = db.prepare("SELECT * FROM settings WHERE key = 'admin_password'").all()
    expect(rows).toHaveLength(1)
    expect(rows[0].value).toBe('1234')
  })
})

// ════ SUITE: Leads ═══════════════════════════════════════════════════════════

describe('Leads — CRUD e Edge Cases', () => {
  let db, dbPath

  beforeEach(() => ({ db, dbPath } = createTestDb()))
  afterEach(() => destroyTestDb(db, dbPath))

  it('salva lead com dados válidos', () => {
    const r = db.prepare('INSERT INTO leads (nome, email, score) VALUES (?, ?, ?)')
      .run('João Silva', 'joao@email.com', 3)
    expect(r.changes).toBe(1)
  })

  it('salva lead com score 0 (nenhuma resposta certa)', () => {
    const r = db.prepare('INSERT INTO leads (nome, email, score) VALUES (?, ?, ?)')
      .run('Maria', 'maria@test.com', 0)
    expect(r.changes).toBe(1)
    const lead = db.prepare('SELECT * FROM leads WHERE email = ?').get('maria@test.com')
    expect(lead.score).toBe(0)
  })

  it('salva lead com caracteres especiais no nome', () => {
    const nome = "João D'Arc & Cia <test>"
    db.prepare('INSERT INTO leads (nome, email, score) VALUES (?, ?, ?)').run(nome, 'test@test.com', 2)
    const lead = db.prepare("SELECT * FROM leads WHERE email = 'test@test.com'").get()
    expect(lead.nome).toBe(nome)
  })

  it('ordena leads por data_hora DESC (timestamps explícitos para evitar race de segundo)', () => {
    // CURRENT_TIMESTAMP tem precisão de 1s no SQLite — usa valores explícitos
    db.prepare('INSERT INTO leads (nome, email, score, data_hora) VALUES (?, ?, ?, ?)').run('A', 'a@a.com', 1, '2024-01-01 10:00:00')
    db.prepare('INSERT INTO leads (nome, email, score, data_hora) VALUES (?, ?, ?, ?)').run('B', 'b@b.com', 2, '2024-01-01 10:00:01')
    const leads = db.prepare('SELECT * FROM leads ORDER BY data_hora DESC').all()
    expect(leads[0].nome).toBe('B')
  })

  it('exclui múltiplos leads por IDs', () => {
    const ids = [1, 2, 3].map((score) => {
      const r = db.prepare('INSERT INTO leads (nome, email, score) VALUES (?, ?, ?)')
        .run(`Lead ${score}`, `lead${score}@test.com`, score)
      return r.lastInsertRowid
    })

    const stmt = db.prepare('DELETE FROM leads WHERE id = ?')
    const tx = db.transaction((list) => { for (const id of list) stmt.run(id) })
    tx([ids[0], ids[1]])

    const remaining = db.prepare('SELECT * FROM leads').all()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].nome).toBe('Lead 3')
  })
})

// ════ SUITE: Quizzes ══════════════════════════════════════════════════════════

describe('Quizzes — Atomicidade e Integridade', () => {
  let db, dbPath

  beforeEach(() => ({ db, dbPath } = createTestDb()))
  afterEach(() => destroyTestDb(db, dbPath))

  it('delete de quiz é atômico (perguntas + quiz em transaction)', () => {
    const quizId = db.prepare('INSERT INTO quiz_titles (title, active) VALUES (?, 0)')
      .run('Quiz de Teste').lastInsertRowid

    db.prepare('INSERT INTO questions (quiz_id, text, options, correctIndex) VALUES (?, ?, ?, ?)')
      .run(quizId, 'Pergunta 1', JSON.stringify(['A', 'B']), 0)
    db.prepare('INSERT INTO questions (quiz_id, text, options, correctIndex) VALUES (?, ?, ?, ?)')
      .run(quizId, 'Pergunta 2', JSON.stringify(['C', 'D']), 1)

    // Simula o deleteQuizTx do database.js
    const deleteQuizTx = db.transaction((id) => {
      db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(id)
      return db.prepare('DELETE FROM quiz_titles WHERE id = ?').run(id).changes > 0
    })
    const result = deleteQuizTx(quizId)

    expect(result).toBe(true)
    expect(db.prepare('SELECT * FROM quiz_titles WHERE id = ?').get(quizId)).toBeUndefined()
    expect(db.prepare('SELECT * FROM questions WHERE quiz_id = ?').all(quizId)).toHaveLength(0)
  })

  it('options JSON inválido não crasha a leitura (try/catch defensivo)', () => {
    const quizId = db.prepare('INSERT INTO quiz_titles (title, active) VALUES (?, 1)')
      .run('Quiz').lastInsertRowid

    // Insere JSON corrompido propositalmente
    db.prepare('INSERT INTO questions (quiz_id, text, options, correctIndex) VALUES (?, ?, ?, ?)')
      .run(quizId, 'Pergunta corrompida', 'JSON_INVALIDO{{{', 0)

    const rows = db.prepare('SELECT * FROM questions WHERE quiz_id = ?').all(quizId)
    const parsed = rows.map((r) => {
      let options = []
      try { options = JSON.parse(r.options) } catch {}
      return { ...r, options }
    })

    // Não deve lançar exceção — retorna array vazio como fallback
    expect(parsed[0].options).toEqual([])
  })

  it('apenas um quiz pode estar ativo por vez', () => {
    const id1 = db.prepare('INSERT INTO quiz_titles (title, active) VALUES (?, 1)').run('Q1').lastInsertRowid
    const id2 = db.prepare('INSERT INTO quiz_titles (title, active) VALUES (?, 0)').run('Q2').lastInsertRowid

    // Simula toggleQuiz
    db.prepare('UPDATE quiz_titles SET active = 0').run()
    db.prepare('UPDATE quiz_titles SET active = 1 WHERE id = ?').run(id2)

    const ativos = db.prepare('SELECT * FROM quiz_titles WHERE active = 1').all()
    expect(ativos).toHaveLength(1)
    expect(ativos[0].id).toBe(id2)
  })
})

// ════ SUITE: Playlist e Mídia ═════════════════════════════════════════════════

describe('Playlist — Ordenação e Filtros de Agendamento', () => {
  let db, dbPath

  beforeEach(() => ({ db, dbPath } = createTestDb()))
  afterEach(() => destroyTestDb(db, dbPath))

  it('retorna apenas mídias ativas ordenadas por playlist_order', () => {
    db.prepare('INSERT INTO media (name, type, source, active, playlist_order) VALUES (?, ?, ?, ?, ?)')
      .run('Video B', 'file', 'b.mp4', 1, 2)
    db.prepare('INSERT INTO media (name, type, source, active, playlist_order) VALUES (?, ?, ?, ?, ?)')
      .run('Video A', 'file', 'a.mp4', 1, 1)
    db.prepare('INSERT INTO media (name, type, source, active, playlist_order) VALUES (?, ?, ?, ?, ?)')
      .run('Video Inativo', 'file', 'c.mp4', 0, 3)

    const playlist = db.prepare('SELECT * FROM media WHERE active = 1 ORDER BY playlist_order ASC').all()
    expect(playlist).toHaveLength(2)
    expect(playlist[0].name).toBe('Video A')
    expect(playlist[1].name).toBe('Video B')
  })

  it('swap de playlist_order em transaction', () => {
    const idA = db.prepare('INSERT INTO media (name, type, source, active, playlist_order) VALUES (?,?,?,1,1)')
      .run('A', 'file', 'a.mp4').lastInsertRowid
    const idB = db.prepare('INSERT INTO media (name, type, source, active, playlist_order) VALUES (?,?,?,1,2)')
      .run('B', 'file', 'b.mp4').lastInsertRowid

    const swap = db.transaction(() => {
      db.prepare('UPDATE media SET playlist_order = ? WHERE id = ?').run(2, idA)
      db.prepare('UPDATE media SET playlist_order = ? WHERE id = ?').run(1, idB)
    })
    swap()

    expect(db.prepare('SELECT playlist_order FROM media WHERE id = ?').get(idA).playlist_order).toBe(2)
    expect(db.prepare('SELECT playlist_order FROM media WHERE id = ?').get(idB).playlist_order).toBe(1)
  })

  it('filtro de agendamento exclui mídia fora do período', () => {
    db.prepare(`INSERT INTO media (name, type, source, active, playlist_order, schedule_end_date)
      VALUES (?,?,?,1,1,?)`).run('Expirada', 'file', 'x.mp4', '2020-01-01')
    db.prepare(`INSERT INTO media (name, type, source, active, playlist_order, schedule_end_date)
      VALUES (?,?,?,1,2,?)`).run('Sempre Ativa', 'file', 'y.mp4', '')

    const playlist = db.prepare(`
      SELECT * FROM media WHERE active = 1
        AND (COALESCE(schedule_end_date,'') = '' OR date('now','localtime') <= schedule_end_date)
      ORDER BY playlist_order ASC
    `).all()

    expect(playlist).toHaveLength(1)
    expect(playlist[0].name).toBe('Sempre Ativa')
  })

  it('social media só entra na playlist com download_status=done e local_file preenchido', () => {
    // Instagram sem arquivo local (download pendente) — NÃO deve aparecer
    db.prepare(`INSERT INTO media (name, type, source, active, playlist_order, local_file, download_status)
      VALUES (?,?,?,1,1,?,?)`).run('Insta Pendente', 'instagram', 'https://instagram.com/p/abc', '', 'downloading')

    // Instagram com erro de download — NÃO deve aparecer
    db.prepare(`INSERT INTO media (name, type, source, active, playlist_order, local_file, download_status)
      VALUES (?,?,?,1,2,?,?)`).run('Insta Erro', 'instagram', 'https://instagram.com/p/xyz', '', 'error')

    // Instagram com download concluído — DEVE aparecer
    db.prepare(`INSERT INTO media (name, type, source, active, playlist_order, local_file, download_status)
      VALUES (?,?,?,1,3,?,?)`).run('Insta OK', 'instagram', 'https://instagram.com/p/ok', 'ytdlp_1.mp4', 'done')

    // TikTok com download concluído — DEVE aparecer
    db.prepare(`INSERT INTO media (name, type, source, active, playlist_order, local_file, download_status)
      VALUES (?,?,?,1,4,?,?)`).run('TikTok OK', 'tiktok', 'https://tiktok.com/@a/video/1', 'ytdlp_2.mp4', 'done')

    // Vídeo local comum (type=file) — DEVE aparecer independente de download_status
    db.prepare(`INSERT INTO media (name, type, source, active, playlist_order, local_file, download_status)
      VALUES (?,?,?,1,5,?,?)`).run('Video Local', 'file', 'video.mp4', '', '')

    const playlist = db.prepare(`
      SELECT * FROM media WHERE active = 1
        AND (type NOT IN ('instagram','tiktok')
             OR (COALESCE(local_file,'') != '' AND download_status = 'done'))
      ORDER BY playlist_order ASC
    `).all()

    expect(playlist).toHaveLength(3)
    expect(playlist.map((r) => r.name)).toEqual(['Insta OK', 'TikTok OK', 'Video Local'])
  })

  it('social media com download concluído torna-se ativo automaticamente', () => {
    // Simula o UPDATE que o start-ytdlp-download faz ao concluir com sucesso
    const id = db.prepare(`INSERT INTO media (name, type, source, active, playlist_order, local_file, download_status)
      VALUES (?,?,?,0,1,?,?)`).run('Insta Novo', 'instagram', 'https://instagram.com/p/new', '', 'downloading').lastInsertRowid

    // Simula conclusão do download (como faz o ipcMain handler)
    db.prepare("UPDATE media SET download_status='done', local_file=?, active=1 WHERE id=?")
      .run('ytdlp_99.mp4', id)

    const item = db.prepare('SELECT * FROM media WHERE id = ?').get(id)
    expect(item.active).toBe(1)
    expect(item.download_status).toBe('done')
    expect(item.local_file).toBe('ytdlp_99.mp4')
  })
})

// ── Jogo da Memória ─────────────────────────────────────────────────────────

function createTestDbWithMemoria() {
  const dbPath = join(tmpdir(), `totem-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, active INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS jogos_memoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, ativo INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS imagens_memoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jogo_id INTEGER NOT NULL,
      caminho_arquivo TEXT NOT NULL
    );
  `)
  return { db, dbPath }
}

describe('Jogo da Memória — DB', () => {
  let db, dbPath

  beforeEach(() => {
    const result = createTestDbWithMemoria()
    db = result.db
    dbPath = result.dbPath
  })

  afterEach(() => {
    db.close()
    if (existsSync(dbPath)) unlinkSync(dbPath)
  })

  it('cria jogo com ativo=0 por padrão', () => {
    db.prepare('INSERT INTO jogos_memoria (nome) VALUES (?)').run('Jogo Teste')
    const jogo = db.prepare('SELECT * FROM jogos_memoria WHERE nome = ?').get('Jogo Teste')
    expect(jogo).toBeDefined()
    expect(jogo.ativo).toBe(0)
  })

  it('toggle-jogo ativa apenas um jogo e desativa quizzes', () => {
    db.prepare('INSERT INTO quiz_titles (title, active) VALUES (?, 1)').run('Quiz Ativo')
    db.prepare('INSERT INTO jogos_memoria (nome) VALUES (?)').run('Jogo A')
    db.prepare('INSERT INTO jogos_memoria (nome) VALUES (?)').run('Jogo B')
    const jogoA = db.prepare('SELECT id FROM jogos_memoria WHERE nome = ?').get('Jogo A')
    const jogoB = db.prepare('SELECT id FROM jogos_memoria WHERE nome = ?').get('Jogo B')

    db.prepare('UPDATE jogos_memoria SET ativo = 0').run()
    db.prepare('UPDATE quiz_titles SET active = 0').run()
    db.prepare('UPDATE jogos_memoria SET ativo = 1 WHERE id = ?').run(jogoA.id)

    expect(db.prepare('SELECT ativo FROM jogos_memoria WHERE id = ?').get(jogoA.id).ativo).toBe(1)
    expect(db.prepare('SELECT ativo FROM jogos_memoria WHERE id = ?').get(jogoB.id).ativo).toBe(0)
    expect(db.prepare('SELECT active FROM quiz_titles').get().active).toBe(0)
  })

  it('toggle-quiz desativa jogos', () => {
    db.prepare('INSERT INTO jogos_memoria (nome, ativo) VALUES (?, 1)').run('Jogo Ativo')
    db.prepare('INSERT INTO quiz_titles (title) VALUES (?)').run('Quiz Novo')
    const quiz = db.prepare('SELECT id FROM quiz_titles').get()

    db.prepare('UPDATE quiz_titles SET active = 0').run()
    db.prepare('UPDATE jogos_memoria SET ativo = 0').run()
    db.prepare('UPDATE quiz_titles SET active = 1 WHERE id = ?').run(quiz.id)

    expect(db.prepare('SELECT active FROM quiz_titles WHERE id = ?').get(quiz.id).active).toBe(1)
    expect(db.prepare('SELECT ativo FROM jogos_memoria').get().ativo).toBe(0)
  })

  it('exclui jogo e suas imagens em transação', () => {
    db.prepare('INSERT INTO jogos_memoria (nome) VALUES (?)').run('Jogo Excluível')
    const jogo = db.prepare('SELECT id FROM jogos_memoria').get()
    db.prepare('INSERT INTO imagens_memoria (jogo_id, caminho_arquivo) VALUES (?, ?)').run(jogo.id, 'img1.webp')
    db.prepare('INSERT INTO imagens_memoria (jogo_id, caminho_arquivo) VALUES (?, ?)').run(jogo.id, 'img2.webp')

    const deleteTx = db.transaction((id) => {
      db.prepare('DELETE FROM imagens_memoria WHERE jogo_id = ?').run(id)
      return db.prepare('DELETE FROM jogos_memoria WHERE id = ?').run(id).changes > 0
    })
    const result = deleteTx(jogo.id)

    expect(result).toBe(true)
    expect(db.prepare('SELECT COUNT(*) as c FROM imagens_memoria WHERE jogo_id = ?').get(jogo.id).c).toBe(0)
    expect(db.prepare('SELECT COUNT(*) as c FROM jogos_memoria').get().c).toBe(0)
  })

  it('get-imagens retorna apenas imagens do jogo solicitado', () => {
    db.prepare('INSERT INTO jogos_memoria (nome) VALUES (?)').run('Jogo 1')
    db.prepare('INSERT INTO jogos_memoria (nome) VALUES (?)').run('Jogo 2')
    const j1 = db.prepare('SELECT id FROM jogos_memoria WHERE nome = ?').get('Jogo 1')
    const j2 = db.prepare('SELECT id FROM jogos_memoria WHERE nome = ?').get('Jogo 2')
    db.prepare('INSERT INTO imagens_memoria (jogo_id, caminho_arquivo) VALUES (?, ?)').run(j1.id, 'a.webp')
    db.prepare('INSERT INTO imagens_memoria (jogo_id, caminho_arquivo) VALUES (?, ?)').run(j2.id, 'b.webp')

    const imgs = db.prepare('SELECT * FROM imagens_memoria WHERE jogo_id = ?').all(j1.id)
    expect(imgs.length).toBe(1)
    expect(imgs[0].caminho_arquivo).toBe('a.webp')
  })
})
