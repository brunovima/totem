# Remover Quiz, Jogo da Memória e Lead Form — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover completamente as features de Quiz, Jogo da Memória e LeadForm do projeto Totem, deixando o fluxo como VideoPlayer em loop contínuo com acesso ao AdminPanel.

**Architecture:** Remoção em camadas — arquivos completos primeiro, depois limpeza dos arquivos que sobrevivem (VideoPlayer, App, AdminPanel, database, preload, index.js do main).

**Tech Stack:** Electron, React, better-sqlite3, sharp (a ser removido)

---

## Mapa de arquivos

### Deletar completamente
- `src/renderer/src/components/JogoMemoria.jsx`
- `src/renderer/src/components/JogoMemoria.css`
- `src/renderer/src/components/GerenciarJogos.jsx`
- `src/renderer/src/components/SelecionarJogo.jsx`
- `src/renderer/src/components/QuizEngine.jsx`
- `src/renderer/src/components/ThankYou.jsx`
- `src/renderer/src/components/LeadForm.jsx`
- `src/renderer/src/LeadForm.jsx` (duplicata na raiz)
- `src/renderer/src/AdminPanel.jsx` (duplicata na raiz)
- `docs/superpowers/specs/2026-05-04-ativacao-facultativa-jogo-quiz-design.md`

### Modificar
- `src/renderer/src/components/VideoPlayer.jsx` — remover prop `onStartQuiz` e overlay de toque
- `src/renderer/src/App.jsx` — simplificar para video + login + admin
- `src/renderer/src/components/AdminPanel.jsx` — remover abas Quizzes, Jogos, Leads
- `src/main/database.js` — remover tabelas e handlers de quiz/leads/jogo
- `src/preload/index.js` — remover API de quiz/leads/jogo
- `src/main/index.js` — remover import sharp, handler upload-imagens-memoria, branch imagens_memoria no protocol

---

### Task 1: Deletar arquivos de componentes removidos

**Files:**
- Delete: `src/renderer/src/components/JogoMemoria.jsx`
- Delete: `src/renderer/src/components/JogoMemoria.css`
- Delete: `src/renderer/src/components/GerenciarJogos.jsx`
- Delete: `src/renderer/src/components/SelecionarJogo.jsx`
- Delete: `src/renderer/src/components/QuizEngine.jsx`
- Delete: `src/renderer/src/components/ThankYou.jsx`
- Delete: `src/renderer/src/components/LeadForm.jsx`
- Delete: `src/renderer/src/LeadForm.jsx`
- Delete: `src/renderer/src/AdminPanel.jsx`
- Delete: `docs/superpowers/specs/2026-05-04-ativacao-facultativa-jogo-quiz-design.md`

- [ ] **Step 1: Deletar todos os arquivos de uma vez**

```bash
cd "C:/Users/97715220191/Downloads/totem-main/totem-main"
rm src/renderer/src/components/JogoMemoria.jsx
rm src/renderer/src/components/JogoMemoria.css
rm src/renderer/src/components/GerenciarJogos.jsx
rm src/renderer/src/components/SelecionarJogo.jsx
rm src/renderer/src/components/QuizEngine.jsx
rm src/renderer/src/components/ThankYou.jsx
rm src/renderer/src/components/LeadForm.jsx
rm src/renderer/src/LeadForm.jsx
rm src/renderer/src/AdminPanel.jsx
rm "docs/superpowers/specs/2026-05-04-ativacao-facultativa-jogo-quiz-design.md"
```

- [ ] **Step 2: Confirmar deleções**

```bash
ls src/renderer/src/components/
```

Esperado: JogoMemoria.jsx, GerenciarJogos.jsx, SelecionarJogo.jsx, QuizEngine.jsx, ThankYou.jsx, LeadForm.jsx **ausentes** na listagem.

---

### Task 2: Simplificar VideoPlayer.jsx

**Files:**
- Modify: `src/renderer/src/components/VideoPlayer.jsx`

A linha 104 tem `export default function VideoPlayer({ onStartQuiz, onAdminLogin })`.
As linhas 363–366 têm o overlay de toque que chama `onStartQuiz`.

- [ ] **Step 1: Remover prop onStartQuiz da assinatura**

Localizar linha:
```js
export default function VideoPlayer({ onStartQuiz, onAdminLogin }) {
```
Substituir por:
```js
export default function VideoPlayer({ onAdminLogin }) {
```

- [ ] **Step 2: Remover overlay de toque**

Localizar e remover o bloco completo (linhas ~363–366):
```jsx
      {/* Overlay de toque: captura eventos sem interferir na mídia */}
      <div
        onClick={onStartQuiz}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }}
      />
```

---

### Task 3: Simplificar App.jsx

**Files:**
- Modify: `src/renderer/src/App.jsx`

- [ ] **Step 1: Substituir o conteúdo completo do App.jsx**

```jsx
import React, { useState, useEffect } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import VideoPlayer from './components/VideoPlayer.jsx'
import AdminPanel from './components/AdminPanel.jsx'
import Frame from './components/Frame.jsx'

function App() {
  const [currentScreen, setCurrentScreen] = useState('video')
  const [isAdmin, setIsAdmin] = useState(false)
  const [blackout, setBlackout] = useState(false)
  const [frameSettings, setFrameSettings] = useState({
    color: '#2563eb',
    width: 8,
    logoPath: null,
    logoPosition: 'top-right',
    logoSize: 80
  })

  const loadFrameSettings = async () => {
    try {
      const [color, width, logoPath, logoPosition, logoSize] = await Promise.all([
        window.api.getSetting('border_color'),
        window.api.getSetting('border_width'),
        window.api.getSetting('logo_path'),
        window.api.getSetting('logo_position'),
        window.api.getSetting('logo_size')
      ])
      setFrameSettings({
        color: color || '#2563eb',
        width: parseInt(width) || 8,
        logoPath: logoPath || null,
        logoPosition: logoPosition || 'top-right',
        logoSize: parseInt(logoSize) || 80
      })
    } catch {}
  }

  useEffect(() => { loadFrameSettings() }, [])

  useEffect(() => {
    const off = window.api.onScreenBlackout((state) => setBlackout(state))
    return off
  }, [])

  if (isAdmin) {
    return (
      <AdminPanel
        onLogout={() => {
          setIsAdmin(false)
          setCurrentScreen('video')
          window.location.reload()
        }}
      />
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <Frame {...frameSettings} />

      {blackout && !isAdmin && (
        <div
          onClick={() => setBlackout(false)}
          style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, cursor: 'pointer' }}
        />
      )}

      {currentScreen === 'video' && (
        <VideoPlayer
          onAdminLogin={() => setCurrentScreen('login')}
        />
      )}

      {currentScreen === 'login' && (
        <LoginScreen
          onBack={() => setCurrentScreen('video')}
          onLoginSuccess={() => setIsAdmin(true)}
        />
      )}
    </div>
  )
}

export default App
```

---

### Task 4: Limpar AdminPanel.jsx

**Files:**
- Modify: `src/renderer/src/components/AdminPanel.jsx`

Remover: import GerenciarJogos, estado e handlers de quiz/leads/jogos, abas Quizzes/Jogos/Leads, conteúdo dessas abas. Trocar tab padrão de `'quizzes'` para `'midia'`.

- [ ] **Step 1: Remover import de GerenciarJogos**

Localizar e remover a linha:
```js
import GerenciarJogos from './GerenciarJogos.jsx'
```

- [ ] **Step 2: Trocar tab padrão**

Localizar:
```js
const [tab, setTab] = useState('quizzes')
```
Substituir por:
```js
const [tab, setTab] = useState('midia')
```

- [ ] **Step 3: Remover estado de quiz**

Localizar e remover o bloco inteiro:
```js
  // ── Quizzes ──
  const [quizzes, setQuizzes]           = useState([])
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const [questions, setQuestions]       = useState([])
  const [quizTitle, setQuizTitle]       = useState('')
  const [qText, setQText]               = useState('')
  const [options, setOptions]           = useState(['', ''])
  const [correct, setCorrect]           = useState(0)
```

- [ ] **Step 4: Remover estado de leads**

Localizar e remover:
```js
  // ── Leads ──
  const [leads, setLeads]               = useState([])
  const [selectedLeads, setSelectedLeads] = useState(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
```

- [ ] **Step 5: Remover refreshData para quiz/leads/jogos**

Dentro de `refreshData`, localizar e remover:
```js
      if (tab === 'quizzes') setQuizzes((await window.api.getQuizzes()) || [])
      if (tab === 'leads')   setLeads((await window.api.getLeads()) || [])
```
e
```js
      if (selectedQuiz) setQuestions((await window.api.getQuestions(selectedQuiz.id)) || [])
```

- [ ] **Step 6: Remover a linha de changeTab com setSelectedQuiz**

Localizar:
```js
  const changeTab = (t) => { setTab(t); setSelectedQuiz(null) }
```
Substituir por:
```js
  const changeTab = (t) => { setTab(t) }
```

- [ ] **Step 7: Remover handlers de quiz**

Localizar e remover todo o bloco:
```js
  // ════ Quizzes ════════════════════════════════════════════════════════════════
  const handleCreateQuiz = async () => { ... }
  const handleSaveQuestion = async () => { ... }
```
(do comentário `// ════ Quizzes` até o fim de `handleSaveQuestion`)

- [ ] **Step 8: Remover handlers de leads**

Localizar e remover todo o bloco:
```js
  // ════ Leads ══════════════════════════════════════════════════════════════════
  const toggleSelectLead = ...
  const toggleSelectAll = ...
  const handleDeleteSelected = ...
  const handleExportCSV = ...
```

- [ ] **Step 9: Remover botões de nav Quizzes, Jogos, Leads**

Localizar e remover as três linhas:
```jsx
          <button onClick={() => changeTab('quizzes')}       style={navBtn(tab === 'quizzes')}>📝 Quizzes</button>
          <button onClick={() => changeTab('jogos')}         style={navBtn(tab === 'jogos')}>🃏 Jogos</button>
          <button onClick={() => changeTab('leads')}         style={navBtn(tab === 'leads')}>👥 Leads</button>
```

- [ ] **Step 10: Remover seções de conteúdo das abas removidas**

Localizar e remover o bloco completo de leads:
```jsx
        {/* ══════════════════ ABA: LEADS ══════════════════════════════════════ */}
        {tab === 'leads' && (
          ...
        )}
```

Localizar e remover o bloco completo de jogos:
```jsx
        {/* ══════════════════ ABA: JOGOS ══════════════════════════════════════ */}
        {tab === 'jogos' && (
          ...
        )}
```

Localizar e remover o bloco completo de quizzes (lista):
```jsx
        {/* ══════════════════ ABA: QUIZZES — lista ════════════════════════════ */}
        {tab === 'quizzes' && !selectedQuiz && (
          ...
        )}
```

Localizar e remover o bloco completo de quizzes (editar):
```jsx
        {/* ══════════════════ ABA: QUIZZES — editar ═══════════════════════════ */}
        {selectedQuiz && (
          ...
        )}
```

- [ ] **Step 11: Remover helper `inputRef` não utilizado**

Localizar e remover:
```js
  const inputRef = useRef(null)
```
E o import se `useRef` não for mais usado em nenhum outro lugar.

---

### Task 5: Limpar database.js

**Files:**
- Modify: `src/main/database.js`

- [ ] **Step 1: Remover CREATE TABLE de quiz_titles, questions, leads, jogos_memoria, imagens_memoria**

Dentro de `db.exec(...)` em `initDB`, remover:
```sql
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
```
e
```sql
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

- [ ] **Step 2: Remover migração de leads.telefone**

Localizar e remover:
```js
  try { db.exec("ALTER TABLE leads ADD COLUMN telefone TEXT DEFAULT ''") } catch {}
```

- [ ] **Step 3: Remover handlers de Quizzes (get-quizzes até delete-quiz)**

Localizar e remover o bloco:
```js
  // ── Quizzes ─────────────────────────────────────────────────────────────────
  ipcMain.handle('get-quizzes', ...)
  ipcMain.handle('create-quiz', ...)
  ipcMain.handle('toggle-quiz', ...)
  const deleteQuizTx = ...
  ipcMain.handle('delete-quiz', ...)
```

- [ ] **Step 4: Remover handlers de Perguntas**

Localizar e remover o bloco:
```js
  // ── Perguntas ────────────────────────────────────────────────────────────────
  ipcMain.handle('get-questions', ...)
  ipcMain.handle('save-question', ...)
  ipcMain.handle('delete-question', ...)
```

- [ ] **Step 5: Remover handlers de Leads**

Localizar e remover o bloco:
```js
  // ── Leads ────────────────────────────────────────────────────────────────────
  ipcMain.handle('get-leads', ...)
  ipcMain.handle('save-lead', ...)
  ipcMain.handle('delete-leads', ...)
```

- [ ] **Step 6: Remover handlers de Jogo da Memória**

Localizar e remover o bloco inteiro:
```js
  // ── Jogo da Memória ─────────────────────────────────────────────────────────
  ipcMain.handle('get-jogos', ...)
  ipcMain.handle('create-jogo', ...)
  ipcMain.handle('toggle-jogo', ...)
  const deleteJogoTx = ...
  ipcMain.handle('delete-jogo', ...)
  ipcMain.handle('get-imagens-jogo', ...)
  ipcMain.handle('delete-imagem-memoria', ...)
  ipcMain.handle('get-jogo-ativo', ...)
  ipcMain.handle('save-imagem-memoria', ...)
```

---

### Task 6: Limpar preload/index.js

**Files:**
- Modify: `src/preload/index.js`

- [ ] **Step 1: Remover seções Quizzes, Perguntas, Leads, Jogo da Memória**

Localizar e remover as linhas:
```js
  // Quizzes
  getQuizzes: () => ipcRenderer.invoke('get-quizzes'),
  createQuiz: (title) => ipcRenderer.invoke('create-quiz', title),
  toggleQuiz: (data) => ipcRenderer.invoke('toggle-quiz', data),
  deleteQuiz: (id) => ipcRenderer.invoke('delete-quiz', id),

  // Perguntas
  getQuestions: (id) => ipcRenderer.invoke('get-questions', id),
  saveQuestion: (q) => ipcRenderer.invoke('save-question', q),
  deleteQuestion: (id) => ipcRenderer.invoke('delete-question', id),

  // Leads
  getLeads: () => ipcRenderer.invoke('get-leads'),
  saveLead: (lead) => ipcRenderer.invoke('save-lead', lead),
  deleteLeads: (ids) => ipcRenderer.invoke('delete-leads', ids),
```
e
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

### Task 7: Limpar src/main/index.js

**Files:**
- Modify: `src/main/index.js`

- [ ] **Step 1: Remover import de sharp**

Localizar e remover:
```js
import sharp from 'sharp'
```

- [ ] **Step 2: Remover handler upload-imagens-memoria**

Localizar e remover todo o bloco:
```js
  // ── Upload de imagens para Jogo da Memória: dialog multi + sharp resize ──
  ipcMain.handle('upload-imagens-memoria', async (_e, { jogoId }) => {
    ...
  })
```

- [ ] **Step 3: Remover branch imagens_memoria no protocol handler**

Localizar e remover o bloco:
```js
    } else if (rawPath.startsWith('imagens_memoria/')) {
      const filename = decodeURIComponent(rawPath.slice('imagens_memoria/'.length))
      filePath = join(app.getPath('userData'), 'imagens_memoria', filename)
```

---

### Task 8: Verificar e commitar

- [ ] **Step 1: Verificar que o app compila sem erros**

```bash
cd "C:/Users/97715220191/Downloads/totem-main/totem-main"
npm run build 2>&1 | tail -30
```

Esperado: build concluído sem erros de import ou referências indefinidas.

- [ ] **Step 2: Atualizar memória do projeto**

Atualizar o arquivo de memória `C:/Users/97715220191/.claude/projects/u--midia-indoor-backend/memory/project_totem_jogo_memoria.md` para refletir que quiz, jogo da memória e lead form foram removidos — o fluxo agora é apenas VideoPlayer em loop.

- [ ] **Step 3: Commitar**

```bash
cd "C:/Users/97715220191/Downloads/totem-main/totem-main"
git add -A
git commit -m "remove: quiz, jogo da memória e lead form — fluxo simplificado para VideoPlayer em loop"
```
