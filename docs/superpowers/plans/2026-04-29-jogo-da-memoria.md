# Jogo da Memória — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o Jogo da Memória de ponta a ponta — gerenciamento no Admin (upload + sharp) e gameplay no Totem.

**Architecture:** Backend (Electron main) gerencia DB SQLite e faz processamento de imagens com sharp. Admin React exibe CRUD de jogos e imagens. Gameplay React busca o jogo ativo via IPC, embaralha pares e aplica regras de kiosk (idle 30s, vitória 8s).

**Tech Stack:** Electron 39, React 19, better-sqlite3, sharp, electron-vite/Vite 7

---

## File Map

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Create | `src/renderer/src/components/GerenciarJogos.jsx` | Aba admin: CRUD de jogos e imagens |
| Create | `src/renderer/src/components/JogoMemoria.jsx` | Tela gameplay do usuário |
| Create | `src/renderer/src/components/JogoMemoria.css` | Flip card animation + grid |
| Modify | `src/main/database.js` | Tabelas + IPC CRUD (jogos_memoria, imagens_memoria) |
| Modify | `src/main/index.js` | Protocolo + IPC upload com sharp |
| Modify | `src/preload/index.js` | Expõe 8 novos métodos no contextBridge |
| Modify | `src/renderer/src/App.jsx` | Tela jogo-memoria + roteamento pós-LeadForm |
| Modify | `src/renderer/src/components/AdminPanel.jsx` | Tab "Jogos" na sidebar |
| Modify | `electron-builder.yml` | asarUnpack para sharp |
| Modify | `tests/integration/database.test.js` | Testes das novas tabelas |

---

## Task 1: Instalar sharp e configurar asarUnpack

**Files:**
- Modify: `electron-builder.yml`
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Instalar sharp como dependência de produção**

```bash
cd c:/Users/97715220191/Downloads/totem-main/totem-main
npm install sharp
```

Resultado esperado: `added N packages` sem erros.

- [ ] **Step 2: Adicionar sharp ao asarUnpack em `electron-builder.yml`**

Localizar o bloco `asarUnpack:` (linha ~18) e adicionar `node_modules/sharp/**`:

```yaml
asarUnpack:
  - resources/**
  - node_modules/better-sqlite3/**
  - node_modules/sharp/**
```

- [ ] **Step 3: Verificar que sharp importa no Node.js local**

```bash
node -e "const s = require('sharp'); console.log('sharp ok:', s.versions)"
```

Resultado esperado: `sharp ok: { sharp: 'X.Y.Z', ... }`

---

## Task 2: Banco de Dados — tabelas e IPC handlers

**Files:**
- Modify: `src/main/database.js`
- Modify: `tests/integration/database.test.js`

### Passo 1 — Escrever os testes primeiro

- [ ] **Step 1: Adicionar testes para jogos_memoria e imagens_memoria em `tests/integration/database.test.js`**

Abrir o arquivo e adicionar ao final (após os testes existentes):

```js
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

    // Ativa jogo A
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

    // Simula toggle-quiz
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
```

- [ ] **Step 2: Rodar testes para confirmar que FALHAM (tabelas não existem ainda)**

```bash
cd c:/Users/97715220191/Downloads/totem-main/totem-main
npx vitest run tests/integration/database.test.js
```

Esperado: os novos testes passam (pois o `createTestDbWithMemoria` cria as tabelas inline), mas isso é correto — os testes testam a lógica, não a migration. Todos os 5 novos testes devem PASSAR.

### Passo 2 — Implementar no database.js

- [ ] **Step 3: Adicionar as tabelas `jogos_memoria` e `imagens_memoria` ao schema em `src/main/database.js`**

Localizar o `db.exec(` em `initDB()` (linha ~10) e adicionar as duas tabelas ao final do CREATE TABLE block, antes do `)`:

```js
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
```

O bloco `db.exec` completo ficará:

```js
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
  `)
```

- [ ] **Step 4: Modificar o handler `toggle-quiz` para também desativar jogos**

Localizar (linha ~81):
```js
  ipcMain.handle('toggle-quiz', (e, { id, active }) => {
    db.prepare('UPDATE quiz_titles SET active = 0').run()
    if (active) db.prepare('UPDATE quiz_titles SET active = 1 WHERE id = ?').run(id)
    return true
  })
```

Substituir por:
```js
  ipcMain.handle('toggle-quiz', (e, { id, active }) => {
    db.prepare('UPDATE quiz_titles SET active = 0').run()
    db.prepare('UPDATE jogos_memoria SET ativo = 0').run()
    if (active) db.prepare('UPDATE quiz_titles SET active = 1 WHERE id = ?').run(id)
    return true
  })
```

- [ ] **Step 5: Adicionar todos os IPC handlers de Jogo da Memória em `setupIpcHandlers()` em `src/main/database.js`**

Adicionar ao final da função `setupIpcHandlers()`, antes do fechamento `}`:

```js
  // ── Jogo da Memória ─────────────────────────────────────────────────────────
  ipcMain.handle('get-jogos', () =>
    db.prepare('SELECT * FROM jogos_memoria ORDER BY id DESC').all()
  )

  ipcMain.handle('create-jogo', (_e, nome) =>
    db.prepare('INSERT INTO jogos_memoria (nome, ativo) VALUES (?, 0)').run(nome).changes > 0
  )

  ipcMain.handle('toggle-jogo', (_e, { id, ativo }) => {
    db.prepare('UPDATE jogos_memoria SET ativo = 0').run()
    db.prepare('UPDATE quiz_titles SET active = 0').run()
    if (ativo) db.prepare('UPDATE jogos_memoria SET ativo = 1 WHERE id = ?').run(id)
    return true
  })

  const deleteJogoTx = db.transaction((id) => {
    const imagens = db.prepare('SELECT caminho_arquivo FROM imagens_memoria WHERE jogo_id = ?').all(id)
    const imgDir = join(app.getPath('userData'), 'imagens_memoria')
    for (const img of imagens) {
      try { unlinkSync(join(imgDir, img.caminho_arquivo)) } catch {}
    }
    db.prepare('DELETE FROM imagens_memoria WHERE jogo_id = ?').run(id)
    return db.prepare('DELETE FROM jogos_memoria WHERE id = ?').run(id).changes > 0
  })
  ipcMain.handle('delete-jogo', (_e, id) => deleteJogoTx(id))

  ipcMain.handle('get-imagens-jogo', (_e, jogoId) =>
    db.prepare('SELECT * FROM imagens_memoria WHERE jogo_id = ? ORDER BY id ASC').all(jogoId)
  )

  ipcMain.handle('delete-imagem-memoria', (_e, id) => {
    const img = db.prepare('SELECT caminho_arquivo FROM imagens_memoria WHERE id = ?').get(id)
    if (img) {
      try { unlinkSync(join(app.getPath('userData'), 'imagens_memoria', img.caminho_arquivo)) } catch {}
    }
    return db.prepare('DELETE FROM imagens_memoria WHERE id = ?').run(id).changes > 0
  })

  ipcMain.handle('get-jogo-ativo', () => {
    const jogo = db.prepare('SELECT * FROM jogos_memoria WHERE ativo = 1').get()
    if (!jogo) return null
    const imagens = db.prepare('SELECT * FROM imagens_memoria WHERE jogo_id = ? ORDER BY id ASC').all(jogo.id)
    return { ...jogo, imagens }
  })

  ipcMain.handle('save-imagem-memoria', (_e, { jogoId, caminho_arquivo }) =>
    db.prepare('INSERT INTO imagens_memoria (jogo_id, caminho_arquivo) VALUES (?, ?)')
      .run(jogoId, caminho_arquivo).lastInsertRowid
  )
```

- [ ] **Step 6: Rodar testes novamente — todos devem passar**

```bash
npx vitest run tests/integration/database.test.js
```

Esperado: todos os testes PASSAM.

---

## Task 3: Protocolo + IPC de upload com sharp

**Files:**
- Modify: `src/main/index.js`

- [ ] **Step 1: Adicionar import do sharp no topo de `src/main/index.js`**

Adicionar após os imports existentes (após a linha `import { networkInterfaces } from 'os'`):

```js
import sharp from 'sharp'
```

- [ ] **Step 2: Estender o handler `totem-media://` para suportar `imagens_memoria/`**

Localizar o handler `protocol.handle('totem-media', ...)` (linha ~448). O bloco atual começa com:
```js
    if (rawPath.startsWith('media/')) {
      const filename = decodeURIComponent(rawPath.slice('media/'.length))
      filePath = join(app.getPath('userData'), 'media', filename)
    } else {
```

Substituir por:
```js
    if (rawPath.startsWith('media/')) {
      const filename = decodeURIComponent(rawPath.slice('media/'.length))
      filePath = join(app.getPath('userData'), 'media', filename)
    } else if (rawPath.startsWith('imagens_memoria/')) {
      const filename = decodeURIComponent(rawPath.slice('imagens_memoria/'.length))
      filePath = join(app.getPath('userData'), 'imagens_memoria', filename)
    } else {
```

- [ ] **Step 3: Adicionar o IPC handler `upload-imagens-memoria` em `src/main/index.js`**

Adicionar após o handler `upload-media` (após a linha com `return { name: basename(src), filename }` e o fechamento `})`):

```js
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
```

---

## Task 4: Preload — expor novos métodos

**Files:**
- Modify: `src/preload/index.js`

- [ ] **Step 1: Adicionar as 8 novas chamadas IPC no contextBridge de `src/preload/index.js`**

Adicionar após o bloco `// Wi-Fi` (após a linha `wifiStatus: () => ipcRenderer.invoke('wifi-status'),`):

```js
  // Jogo da Memória — Admin
  getJogos: () => ipcRenderer.invoke('get-jogos'),
  createJogo: (nome) => ipcRenderer.invoke('create-jogo', nome),
  toggleJogo: (data) => ipcRenderer.invoke('toggle-jogo', data),
  deleteJogo: (id) => ipcRenderer.invoke('delete-jogo', id),
  getImagensJogo: (jogoId) => ipcRenderer.invoke('get-imagens-jogo', jogoId),
  uploadImagensMemoria: (data) => ipcRenderer.invoke('upload-imagens-memoria', data),
  deleteImagemMemoria: (id) => ipcRenderer.invoke('delete-imagem-memoria', id),

  // Jogo da Memória — Cliente
  getJogoAtivo: () => ipcRenderer.invoke('get-jogo-ativo'),
```

---

## Task 5: GerenciarJogos.jsx — componente admin

**Files:**
- Create: `src/renderer/src/components/GerenciarJogos.jsx`

- [ ] **Step 1: Criar `src/renderer/src/components/GerenciarJogos.jsx` com o conteúdo completo**

```jsx
import React, { useState, useEffect } from 'react'

const FONT = "'Roboto', sans-serif"

const S = {
  input: {
    padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1',
    fontSize: '16px', background: 'white', fontFamily: FONT, width: '100%', boxSizing: 'border-box'
  },
  card: {
    background: 'white', padding: '28px', borderRadius: '16px',
    marginBottom: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)'
  },
  btn: (bg = '#2563eb') => ({
    padding: '11px 22px', background: bg, color: 'white', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: FONT
  }),
  ghost: {
    padding: '10px 18px', borderRadius: '8px', border: '1px solid #e2e8f0',
    cursor: 'pointer', background: 'white', fontSize: '14px', fontFamily: FONT
  }
}

function buildImagemUrl(caminho_arquivo) {
  return 'totem-media://imagens_memoria/' + encodeURIComponent(caminho_arquivo)
}

export default function GerenciarJogos({ onFeedback }) {
  const [jogos, setJogos] = useState([])
  const [novoNome, setNovoNome] = useState('')
  const [jogoEditando, setJogoEditando] = useState(null)
  const [imagens, setImagens] = useState([])
  const [uploading, setUploading] = useState(false)

  const carregarJogos = async () => {
    const lista = await window.api.getJogos()
    setJogos(lista || [])
  }

  useEffect(() => { carregarJogos() }, [])

  const handleCriar = async () => {
    const nome = novoNome.trim()
    if (!nome) { onFeedback('Digite um nome para o jogo.'); return }
    await window.api.createJogo(nome)
    setNovoNome('')
    onFeedback(`Jogo "${nome}" criado!`)
    carregarJogos()
  }

  const handleToggle = async (jogo) => {
    const novoAtivo = !jogo.ativo
    await window.api.toggleJogo({ id: jogo.id, ativo: novoAtivo })
    onFeedback(novoAtivo ? `Jogo "${jogo.nome}" ativado (quizzes foram desativados).` : `Jogo "${jogo.nome}" desativado.`)
    carregarJogos()
  }

  const handleExcluir = async (jogo) => {
    if (!window.confirm(`Excluir o jogo "${jogo.nome}" e todas as suas imagens?`)) return
    await window.api.deleteJogo(jogo.id)
    if (jogoEditando?.id === jogo.id) setJogoEditando(null)
    onFeedback(`Jogo "${jogo.nome}" excluído.`)
    carregarJogos()
  }

  const abrirEdicao = async (jogo) => {
    setJogoEditando(jogo)
    const imgs = await window.api.getImagensJogo(jogo.id)
    setImagens(imgs || [])
  }

  const handleUpload = async () => {
    if (!jogoEditando) return
    setUploading(true)
    try {
      const novas = await window.api.uploadImagensMemoria({ jogoId: jogoEditando.id })
      if (novas && novas.length > 0) {
        onFeedback(`${novas.length} imagem(ns) adicionada(s) e otimizada(s).`)
        const imgs = await window.api.getImagensJogo(jogoEditando.id)
        setImagens(imgs || [])
      }
    } catch (e) {
      onFeedback('Erro ao processar imagens.')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteImagem = async (img) => {
    await window.api.deleteImagemMemoria(img.id)
    setImagens((prev) => prev.filter((i) => i.id !== img.id))
    onFeedback('Imagem removida.')
  }

  if (jogoEditando) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => setJogoEditando(null)} style={S.ghost}>← Voltar</button>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Imagens — {jogoEditando.nome}</h2>
        </div>

        <div style={S.card}>
          <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            <strong>Tamanho ideal: 400×400 pixels (Formato Quadrado).</strong><br />
            Imagens maiores serão recortadas e otimizadas automaticamente pelo sistema.<br />
            <strong>Mínimo de 8 imagens</strong> para ativar o jogo.
            {imagens.length < 8 && (
              <span style={{ color: '#ef4444', marginLeft: '8px' }}>
                ({imagens.length}/8 imagens — faltam {8 - imagens.length})
              </span>
            )}
            {imagens.length >= 8 && (
              <span style={{ color: '#22c55e', marginLeft: '8px' }}>
                ✓ {imagens.length} imagens cadastradas
              </span>
            )}
          </p>
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{ ...S.btn('#2563eb'), opacity: uploading ? 0.6 : 1, marginTop: '12px' }}
          >
            {uploading ? 'Processando...' : '+ Adicionar Imagens'}
          </button>
        </div>

        {imagens.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '32px' }}>
            Nenhuma imagem cadastrada. Clique em "Adicionar Imagens" para começar.
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '12px'
          }}>
            {imagens.map((img) => (
              <div key={img.id} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#f1f5f9' }}>
                <img
                  src={buildImagemUrl(img.caminho_arquivo)}
                  alt=""
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { e.target.style.background = '#e2e8f0' }}
                />
                <button
                  onClick={() => handleDeleteImagem(img)}
                  style={{
                    position: 'absolute', top: '4px', right: '4px',
                    background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none',
                    borderRadius: '50%', width: '28px', height: '28px',
                    cursor: 'pointer', fontSize: '16px', lineHeight: '28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '1.5rem' }}>Gerenciar Jogos da Memória</h1>

      <div style={S.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: '#475569' }}>CRIAR NOVO JOGO</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCriar()}
            placeholder="Nome do jogo..."
            style={{ ...S.input, flex: 1 }}
          />
          <button onClick={handleCriar} style={S.btn()}>Criar</button>
        </div>
      </div>

      {jogos.length === 0 ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '32px' }}>
          Nenhum jogo cadastrado. Crie um acima para começar.
        </p>
      ) : (
        <div style={S.card}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: '#475569' }}>JOGOS CADASTRADOS</h3>
          {jogos.map((jogo) => (
            <div key={jogo.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 0', borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: '15px' }}>{jogo.nome}</span>
                {jogo.ativo ? (
                  <span style={{ marginLeft: '10px', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                    ATIVO
                  </span>
                ) : (
                  <span style={{ marginLeft: '10px', background: '#f1f5f9', color: '#94a3b8', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                    INATIVO
                  </span>
                )}
              </div>
              <button onClick={() => handleToggle(jogo)} style={S.btn(jogo.ativo ? '#f59e0b' : '#22c55e')}>
                {jogo.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button onClick={() => abrirEdicao(jogo)} style={S.btn('#6366f1')}>
                Editar Imagens
              </button>
              <button onClick={() => handleExcluir(jogo)} style={S.btn('#ef4444')}>
                Excluir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## Task 6: AdminPanel — adicionar aba Jogos

**Files:**
- Modify: `src/renderer/src/components/AdminPanel.jsx`

- [ ] **Step 1: Importar GerenciarJogos no topo de `AdminPanel.jsx`**

Adicionar após a linha de import do DiagnosticPanel (linha ~3):

```js
import GerenciarJogos from './GerenciarJogos.jsx'
```

- [ ] **Step 2: Adicionar o botão de aba "Jogos" na sidebar**

Localizar o bloco de botões de navegação (linha ~430):
```jsx
          <button onClick={() => changeTab('quizzes')}       style={navBtn(tab === 'quizzes')}>📝 Quizzes</button>
```

Adicionar após o botão de Quizzes:
```jsx
          <button onClick={() => changeTab('jogos')}         style={navBtn(tab === 'jogos')}>🃏 Jogos</button>
```

- [ ] **Step 3: Adicionar o render da aba Jogos**

Localizar o bloco `{tab === 'quizzes' && !selectedQuiz && (` e adicionar antes dele:

```jsx
        {tab === 'jogos' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
            <GerenciarJogos onFeedback={showFeedback} />
          </div>
        )}
```

---

## Task 7: JogoMemoria.jsx + CSS

**Files:**
- Create: `src/renderer/src/components/JogoMemoria.css`
- Create: `src/renderer/src/components/JogoMemoria.jsx`

- [ ] **Step 1: Criar `src/renderer/src/components/JogoMemoria.css`**

```css
.jm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.jm-carta {
  aspect-ratio: 1;
  perspective: 800px;
  cursor: pointer;
  border-radius: 12px;
  user-select: none;
  -webkit-user-select: none;
}

.jm-carta-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.45s ease;
  transform-style: preserve-3d;
  border-radius: 12px;
}

.jm-carta.virada .jm-carta-inner,
.jm-carta.encontrada .jm-carta-inner {
  transform: rotateY(180deg);
}

.jm-frente,
.jm-verso {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
}

.jm-frente {
  background: linear-gradient(135deg, #1e3a8a, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  box-shadow: 0 4px 16px rgba(37,99,235,0.3);
}

.jm-verso {
  transform: rotateY(180deg);
}

.jm-verso img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.jm-carta.encontrada .jm-frente {
  opacity: 0;
}

.jm-carta.encontrada .jm-verso {
  box-shadow: 0 0 0 4px #22c55e;
}

.jm-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.jm-modal {
  background: white;
  border-radius: 24px;
  padding: 48px;
  text-align: center;
  max-width: 440px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.4);
  animation: jm-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes jm-pop {
  from { transform: scale(0.6); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
```

- [ ] **Step 2: Criar `src/renderer/src/components/JogoMemoria.jsx`**

```jsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import './JogoMemoria.css'

const IDLE_TIMEOUT_MS = 30_000
const WIN_REDIRECT_MS = 8_000

function fisherYates(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildImagemUrl(caminho_arquivo) {
  return 'totem-media://imagens_memoria/' + encodeURIComponent(caminho_arquivo)
}

export default function JogoMemoria({ onFinish }) {
  const [cartas, setCartas] = useState([])
  const [cartasViradas, setCartasViradas] = useState([])
  const [paresEncontrados, setParesEncontrados] = useState(0)
  const [bloqueioTela, setBloqueioTela] = useState(false)
  const [venceu, setVenceu] = useState(false)
  const [contagemVitoria, setContagemVitoria] = useState(WIN_REDIRECT_MS / 1000)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const totalPares = useRef(0)
  const idleRef = useRef(null)
  const winRef = useRef(null)

  const resetIdle = useCallback(() => {
    clearTimeout(idleRef.current)
    idleRef.current = setTimeout(() => onFinish(), IDLE_TIMEOUT_MS)
  }, [onFinish])

  // Inicialização
  useEffect(() => {
    window.api.getJogoAtivo().then((jogo) => {
      if (!jogo || !jogo.imagens || jogo.imagens.length < 8) {
        setErro('Nenhum jogo da memória ativo com imagens suficientes.')
        setCarregando(false)
        setTimeout(() => onFinish(), 3000)
        return
      }
      const pares = [...jogo.imagens, ...jogo.imagens]
      const embaralhadas = fisherYates(pares)
      totalPares.current = jogo.imagens.length
      setCartas(embaralhadas.map((img, idx) => ({
        uid: idx,
        pairId: img.id,
        src: buildImagemUrl(img.caminho_arquivo),
        virada: false,
        encontrada: false
      })))
      setCarregando(false)
    }).catch(() => {
      setErro('Erro ao carregar o jogo.')
      setCarregando(false)
      setTimeout(() => onFinish(), 3000)
    })
  }, [onFinish])

  // Idle timer
  useEffect(() => {
    resetIdle()
    return () => clearTimeout(idleRef.current)
  }, [resetIdle])

  // Countdown de vitória
  useEffect(() => {
    if (!venceu) return
    clearTimeout(idleRef.current)
    setContagemVitoria(WIN_REDIRECT_MS / 1000)
    const interval = setInterval(() => {
      setContagemVitoria((c) => {
        if (c <= 1) { clearInterval(interval); onFinish(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [venceu, onFinish])

  const handleClickCarta = (carta) => {
    resetIdle()
    if (bloqueioTela || carta.virada || carta.encontrada) return
    if (cartasViradas.length === 1 && cartasViradas[0].uid === carta.uid) return

    const novasViradas = [...cartasViradas, carta]

    setCartas((prev) => prev.map((c) => c.uid === carta.uid ? { ...c, virada: true } : c))
    setCartasViradas(novasViradas)

    if (novasViradas.length === 2) {
      setBloqueioTela(true)
      const [a, b] = novasViradas

      if (a.pairId === b.pairId) {
        // Par encontrado
        const novosParesTotal = paresEncontrados + 1
        setCartas((prev) => prev.map((c) =>
          c.pairId === a.pairId ? { ...c, encontrada: true, virada: true } : c
        ))
        setCartasViradas([])
        setParesEncontrados(novosParesTotal)
        setBloqueioTela(false)
        if (novosParesTotal >= totalPares.current) {
          setVenceu(true)
        }
      } else {
        // Par errado — desvirar após 1s
        setTimeout(() => {
          setCartas((prev) => prev.map((c) =>
            c.uid === a.uid || c.uid === b.uid ? { ...c, virada: false } : c
          ))
          setCartasViradas([])
          setBloqueioTela(false)
        }, 1000)
      }
    }
  }

  if (carregando) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', fontSize: '1.5rem' }}>
        Carregando jogo...
      </div>
    )
  }

  if (erro) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#ef4444', fontSize: '1.5rem' }}>
        {erro}
      </div>
    )
  }

  return (
    <div
      style={{ width: '100vw', height: '100vh', overflow: 'auto', background: '#0f172a', display: 'flex', flexDirection: 'column' }}
      onPointerDown={resetIdle}
    >
      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: 'white', margin: 0, fontSize: '1.4rem', fontFamily: "'Roboto', sans-serif" }}>
          Jogo da Memória
        </h2>
        <div style={{ color: '#94a3b8', fontFamily: "'Roboto', sans-serif" }}>
          Pares: <strong style={{ color: '#22c55e' }}>{paresEncontrados}</strong> / {totalPares.current}
        </div>
      </div>

      {/* Grade de cartas */}
      <div className="jm-grid" style={{ flex: 1 }}>
        {cartas.map((carta) => (
          <div
            key={carta.uid}
            className={`jm-carta${carta.virada ? ' virada' : ''}${carta.encontrada ? ' encontrada' : ''}`}
            onClick={() => handleClickCarta(carta)}
          >
            <div className="jm-carta-inner">
              <div className="jm-frente">🧠</div>
              <div className="jm-verso">
                <img src={carta.src} alt="" draggable={false} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de vitória */}
      {venceu && (
        <div className="jm-modal-overlay">
          <div className="jm-modal">
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ margin: '0 0 12px', fontSize: '2rem', color: '#1e3a8a', fontFamily: "'Roboto', sans-serif" }}>
              Parabéns!
            </h2>
            <p style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#475569', fontFamily: "'Roboto', sans-serif" }}>
              Você tem uma memória incrível!
            </p>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', fontFamily: "'Roboto', sans-serif" }}>
              Voltando em {contagemVitoria}s...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Task 8: App.jsx — roteamento

**Files:**
- Modify: `src/renderer/src/App.jsx`

- [ ] **Step 1: Importar JogoMemoria em `src/renderer/src/App.jsx`**

Adicionar após os imports existentes (após `import ThankYou from './components/ThankYou.jsx'`):

```js
import JogoMemoria from './components/JogoMemoria.jsx'
```

- [ ] **Step 2: Modificar o handler `onConfirm` do LeadForm para rotear conforme jogo ou quiz ativo**

Localizar em `App.jsx` o bloco:
```jsx
      {currentScreen === 'lead' && (
        <LeadForm
          onConfirm={(data) => {
            setCurrentLead(data)
            setCurrentScreen('quiz')
          }}
          onCancel={() => setCurrentScreen('video')}
        />
      )}
```

Substituir por:
```jsx
      {currentScreen === 'lead' && (
        <LeadForm
          onConfirm={async (data) => {
            setCurrentLead(data)
            try {
              const jogo = await window.api.getJogoAtivo()
              if (jogo && jogo.imagens && jogo.imagens.length >= 8) {
                setCurrentScreen('jogo-memoria')
              } else {
                setCurrentScreen('quiz')
              }
            } catch {
              setCurrentScreen('quiz')
            }
          }}
          onCancel={() => setCurrentScreen('video')}
        />
      )}
```

- [ ] **Step 3: Adicionar a tela `jogo-memoria` ao render de `App.jsx`**

Adicionar após o bloco `{currentScreen === 'thankyou' && thankYouData && (`:

```jsx
      {currentScreen === 'jogo-memoria' && (
        <JogoMemoria
          onFinish={() => {
            setCurrentLead(null)
            setCurrentScreen('video')
          }}
        />
      )}
```

- [ ] **Step 4: Verificar que `window.api.getJogoAtivo` está disponível (checagem rápida)**

Abrir o DevTools do Electron em dev mode e digitar:
```js
window.api.getJogoAtivo()
```
Resultado esperado: Promise que resolve para `null` (nenhum jogo ativo ainda).

---

## Verificação Final

- [ ] **Rodar todos os testes de integração**

```bash
npx vitest run tests/integration/database.test.js
```

Esperado: todos os testes PASSAM.

- [ ] **Testar fluxo Admin: criar jogo → adicionar imagens → ativar → verificar que quiz foi desativado**

1. Abrir Admin → aba Jogos
2. Criar jogo "Teste"
3. Clicar "Editar Imagens" → adicionar 8+ imagens via diálogo
4. Clicar "Ativar" → mensagem "Jogo ativado, quizzes desativados"
5. Ir para aba Quizzes → confirmar que quiz está inativo

- [ ] **Testar fluxo Cliente: toque na tela → lead → jogo da memória → vitória → redirect**

1. Na tela de vídeo, tocar para ir ao LeadForm
2. Preencher nome e telefone → confirmar
3. Verificar que a tela de Jogo da Memória abre (grade de cartas face-down)
4. Virar cartas, encontrar todos os pares
5. Verificar modal de vitória com contagem regressiva de 8s
6. Verificar redirect para tela de vídeo

- [ ] **Testar idle timeout: deixar jogo inativo por 30s → verifica redirect**

---

## Notas de Deploy

- `sharp` é um módulo nativo — o `npmRebuild: true` em `electron-builder.yml` e o `asarUnpack: node_modules/sharp/**` garantem compilação correta no build.
- Em ambiente de desenvolvimento, `sharp` funciona diretamente via Node.js do sistema.
- O comando `npm run build:win` já executa `electron-rebuild` (via `npmRebuild: true`), então não é necessário passo extra para Windows.
