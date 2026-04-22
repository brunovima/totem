import React, { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import DiagnosticPanel from './DiagnosticPanel.jsx'

function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(
    /(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  )
  return match?.[1] || null
}

function SignalBars({ signal }) {
  const bars = signal > 75 ? 4 : signal > 50 ? 3 : signal > 25 ? 2 : 1
  return (
    <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'flex-end', height: '14px' }}>
      {[1, 2, 3, 4].map((b) => (
        <span key={b} style={{ width: '4px', height: `${b * 3 + 2}px`, borderRadius: '2px', background: b <= bars ? '#22c55e' : '#cbd5e1' }} />
      ))}
    </span>
  )
}

const FONT = "'Roboto', sans-serif"

const S = {
  input: { padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '16px', outline: 'none', background: 'white', fontFamily: FONT },
  card:  { background: 'white', padding: '28px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' },
  btn:   (bg = '#2563eb') => ({ padding: '11px 22px', background: bg, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: FONT }),
  ghost: { padding: '10px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', background: 'white', fontSize: '14px', fontFamily: FONT },
  badge: (bg, color) => ({ background: bg, color, padding: '2px 8px', borderRadius: '20px', fontWeight: 700, fontSize: '11px' })
}

function ScheduleForm({ initial, onSave, onCancel }) {
  const [form, setForm] = React.useState(initial)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div style={{ marginTop: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
      <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>📅 AGENDAMENTO — deixe em branco para sempre ativo</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>DATA INÍCIO</label>
          <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>DATA FIM</label>
          <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>HORA INÍCIO</label>
          <input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>HORA FIM</label>
          <input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => onSave(form)} style={S.btn('#22c55e')}>✓ Salvar</button>
        <button onClick={() => onSave({ startDate:'', endDate:'', startTime:'', endTime:'' })} style={S.btn('#64748b')}>Limpar</button>
        <button onClick={onCancel} style={S.ghost}>Cancelar</button>
      </div>
    </div>
  )
}

export default function AdminPanel({ onLogout }) {
  const [tab, setTab] = useState('quizzes')

  // ── Quizzes ──
  const [quizzes, setQuizzes]           = useState([])
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const [questions, setQuestions]       = useState([])
  const [quizTitle, setQuizTitle]       = useState('')
  const [qText, setQText]               = useState('')
  const [options, setOptions]           = useState(['', ''])
  const [correct, setCorrect]           = useState(0)

  // ── Leads ──
  const [leads, setLeads]               = useState([])
  const [selectedLeads, setSelectedLeads] = useState(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // ── Mídia ──
  const [allMedia, setAllMedia]       = useState([])
  const [playlist, setPlaylist]       = useState([])
  const [youtubeUrl, setYoutubeUrl]   = useState('')
  const [webpageUrl, setWebpageUrl]   = useState('')
  const [webpageName, setWebpageName] = useState('')
  const [pendingFile, setPendingFile]   = useState(null) // { name, filename }
  const [pendingImage, setPendingImage] = useState(null) // { name, filename }
  const [editDuration, setEditDuration]     = useState({})
  const [editSchedule, setEditSchedule]     = useState(null)
  const [downloadStatus, setDownloadStatus] = useState({}) // { [id]: 'downloading'|'done'|'error' }

  // ── Energia ──
  const [energyEnabled,   setEnergyEnabled]   = useState(false)
  const [energySleepTime, setEnergySleepTime] = useState('23:00')
  const [energyWakeTime,  setEnergyWakeTime]  = useState('07:00')
  const [apiInfo, setApiInfo] = useState(null)

  // ── WiFi ──
  const [wifiStatus, setWifiStatus]         = useState(null)
  const [wifiNetworks, setWifiNetworks]     = useState([])
  const [wifiScanning, setWifiScanning]     = useState(false)
  const [connectingSSID, setConnectingSSID] = useState(null)
  const [wifiPassword, setWifiPassword]     = useState('')
  const [wifiMsg, setWifiMsg]               = useState('')

  // ── Configurações ──
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // ── Global ──
  const [feedback, setFeedback] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    refreshData()
    setSelectedLeads(new Set())
    const t = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [tab, selectedQuiz])

  useEffect(() => {
    const unsub = window.api.onDownloadProgress?.((data) => {
      setDownloadStatus((prev) => ({ ...prev, [data.id]: data.status }))
      if (data.status === 'done') refreshData()
    })
    return () => unsub?.()
  }, [])

  const showFeedback = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 3500)
  }

  const refreshData = async () => {
    try {
      if (tab === 'quizzes') setQuizzes((await window.api.getQuizzes()) || [])
      if (tab === 'leads')   setLeads((await window.api.getLeads()) || [])
      if (tab === 'midia') {
        const [all, pl] = await Promise.all([window.api.getMedia(), window.api.getPlaylist()])
        setAllMedia(all || [])
        setPlaylist(pl || [])
      }
      if (tab === 'wifi') {
        const s = await window.api.wifiStatus()
        setWifiStatus(s)
      }
      if (tab === 'configuracoes') {
        const [en, st, wt] = await Promise.all([
          window.api.getSetting('energy_sleep_enabled'),
          window.api.getSetting('energy_sleep_time'),
          window.api.getSetting('energy_wake_time')
        ])
        setEnergyEnabled(en === 'true')
        setEnergySleepTime(st || '23:00')
        setEnergyWakeTime(wt || '07:00')
        const info = await window.api.getApiInfo()
        setApiInfo(info)
      }
      if (selectedQuiz) setQuestions((await window.api.getQuestions(selectedQuiz.id)) || [])
    } catch (e) { console.error(e) }
  }

  const changeTab = (t) => { setTab(t); setSelectedQuiz(null) }

  // ════ Quizzes ════════════════════════════════════════════════════════════════
  const handleCreateQuiz = async () => {
    if (!quizTitle.trim()) return
    await window.api.createQuiz(quizTitle.trim())
    setQuizTitle('')
    refreshData()
  }

  const handleSaveQuestion = async () => {
    if (!qText) return
    await window.api.saveQuestion({
      quizId: selectedQuiz.id,
      text: qText,
      options: options.filter((o) => o !== ''),
      correctIndex: parseInt(correct)
    })
    setQText(''); setOptions(['', '']); setCorrect(0)
    refreshData()
  }

  // ════ Leads ══════════════════════════════════════════════════════════════════
  const toggleSelectLead = (id) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedLeads((prev) => prev.size === leads.length ? new Set() : new Set(leads.map((l) => l.id)))
  }

  const handleDeleteSelected = async () => {
    await window.api.deleteLeads([...selectedLeads])
    setSelectedLeads(new Set())
    setShowDeleteModal(false)
    refreshData()
  }

  const handleExportCSV = () => {
    const header = 'Nome,Email,Score,Data'
    const rows = leads.map((l) => `"${l.nome}","${l.email}",${l.score},"${l.data_hora}"`)
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ════ Mídia ═══════════════════════════════════════════════════════════════════
  const handleUploadVideo = async () => {
    const result = await window.api.uploadMedia({ type: 'video' })
    if (result) setPendingFile(result)
  }

  const handleSaveVideo = async () => {
    if (!pendingFile) return
    await window.api.saveMedia({ name: pendingFile.name, type: 'file', source: pendingFile.filename })
    setPendingFile(null)
    showFeedback(`Vídeo "${pendingFile.name}" salvo!`)
    refreshData()
  }

  const handleUploadImage = async () => {
    const result = await window.api.uploadMedia({ type: 'image' })
    if (result) setPendingImage(result)
  }

  const handleSaveImage = async () => {
    if (!pendingImage) return
    await window.api.saveMedia({ name: pendingImage.name, type: 'image', source: pendingImage.filename })
    setPendingImage(null)
    showFeedback(`Imagem "${pendingImage.name}" salva!`)
    refreshData()
  }

  const handleAddYoutube = async () => {
    if (!getYoutubeId(youtubeUrl)) { showFeedback('URL inválida. Use: youtube.com/watch?v=...'); return }
    await window.api.saveMedia({ name: youtubeUrl, type: 'youtube', source: youtubeUrl })
    setYoutubeUrl('')
    showFeedback('Link do YouTube adicionado!')
    refreshData()
  }

  const handleDownloadYoutube = async (m) => {
    setDownloadStatus((prev) => ({ ...prev, [m.id]: 'downloading' }))
    const result = await window.api.startYoutubeDownload({ id: m.id, url: m.source })
    if (!result.ok) {
      setDownloadStatus((prev) => ({ ...prev, [m.id]: 'error' }))
      showFeedback(`Erro: ${result.error}`)
    }
  }

  const handleAddWebpage = async () => {
    if (!webpageUrl.startsWith('http')) { showFeedback('URL inválida. Use: https://...'); return }
    const name = webpageName.trim() || webpageUrl
    await window.api.saveMedia({ name, type: 'webpage', source: webpageUrl })
    setWebpageUrl(''); setWebpageName('')
    showFeedback('Página web adicionada!')
    refreshData()
  }

  const handleTogglePlaylist = async (id) => {
    await window.api.togglePlaylist(id)
    refreshData()
  }

  const handleMove = async (id, direction) => {
    await window.api.movePlaylistItem({ id, direction })
    refreshData()
  }

  const handleSaveDuration = async (id) => {
    const val = parseInt(editDuration[id])
    if (!val || val < 5) return
    await window.api.setMediaDuration({ id, duration: val })
    setEditDuration((d) => { const n = { ...d }; delete n[id]; return n })
    refreshData()
    showFeedback('Duração atualizada!')
  }

  const handleSaveSchedule = async (m, form) => {
    await window.api.setMediaSchedule({
      id: m.id,
      startDate: form.startDate, endDate: form.endDate,
      startTime: form.startTime, endTime: form.endTime
    })
    setEditSchedule(null)
    showFeedback('Agendamento salvo!')
    refreshData()
  }

  const handleDeleteMedia = async (id) => {
    if (!window.confirm('Excluir esta mídia?')) return
    await window.api.deleteMedia(id)
    refreshData()
  }

  // ════ WiFi ════════════════════════════════════════════════════════════════════
  const handleWifiScan = async () => {
    setWifiScanning(true); setWifiMsg('')
    const result = await window.api.wifiScan()
    setWifiNetworks(result.networks || [])
    if (result.error) setWifiMsg(result.error)
    setWifiScanning(false)
  }

  const handleWifiConnect = async (ssid) => {
    setWifiMsg('')
    const result = await window.api.wifiConnect({ ssid, password: wifiPassword })
    if (result.success) {
      showFeedback(`Conectado a "${ssid}"!`)
      setConnectingSSID(null); setWifiPassword('')
      setWifiStatus(await window.api.wifiStatus())
    } else {
      setWifiMsg(`Falha: ${result.error}`)
    }
  }

  // ════ Configurações ═══════════════════════════════════════════════════════════
  const handleChangePassword = async () => {
    if (newPassword.length < 4) { showFeedback('A senha deve ter pelo menos 4 caracteres.'); return }
    if (newPassword !== confirmPassword) { showFeedback('As senhas não coincidem.'); return }
    await window.api.setSetting('admin_password', newPassword)
    setNewPassword(''); setConfirmPassword('')
    showFeedback('Senha alterada com sucesso!')
  }

  const handleSaveEnergySettings = async () => {
    await Promise.all([
      window.api.setSetting('energy_sleep_enabled', String(energyEnabled)),
      window.api.setSetting('energy_sleep_time', energySleepTime),
      window.api.setSetting('energy_wake_time', energyWakeTime)
    ])
    showFeedback('Configurações de energia salvas!')
  }

  // ── helpers ──────────────────────────────────────────────────────────────────
  const navBtn = (active) => ({
    padding: '12px 14px', textAlign: 'left',
    background: active ? '#334155' : 'transparent',
    color: 'white', border: 'none', borderRadius: '8px',
    cursor: 'pointer', transition: '0.2s', fontSize: '14px'
  })

  const inPlaylist = (id) => playlist.some((p) => p.id === id)

  const typeStyle = (type) => ({
    icon:  type === 'youtube' ? '▶' : type === 'image' ? '🖼' : type === 'webpage' ? '🌐' : '🎬',
    label: type === 'youtube' ? 'YOUTUBE' : type === 'image' ? 'IMAGEM' : type === 'webpage' ? 'WEBPAGE' : 'LOCAL',
    bg:    type === 'youtube' ? '#fee2e2' : type === 'image' ? '#f3e8ff' : type === 'webpage' ? '#e0f2fe' : '#dbeafe',
    color: type === 'youtube' ? '#b91c1c' : type === 'image' ? '#7e22ce' : type === 'webpage' ? '#0369a1' : '#1d4ed8'
  })

  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#f1f5f9', color: '#0f172a', fontFamily: "'Roboto', sans-serif" }}>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside style={{ width: '220px', background: '#0f172a', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '10px', marginTop: 0, letterSpacing: '0.05em' }}>
          TOTEM ADMIN
        </h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <button onClick={() => changeTab('quizzes')}       style={navBtn(tab === 'quizzes')}>📝 Quizzes</button>
          <button onClick={() => changeTab('leads')}         style={navBtn(tab === 'leads')}>👥 Leads</button>
          <button onClick={() => changeTab('midia')}         style={navBtn(tab === 'midia')}>🎬 Mídia</button>
          <button onClick={() => changeTab('wifi')}          style={navBtn(tab === 'wifi')}>📶 Wi-Fi</button>
          <button onClick={() => changeTab('configuracoes')} style={navBtn(tab === 'configuracoes')}>⚙️ Configurações</button>
          <button onClick={() => changeTab('diagnostico')}   style={navBtn(tab === 'diagnostico')}>🔬 Diagnóstico</button>
        </nav>
        <button onClick={onLogout} style={{ padding: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: FONT }}>
          SAIR DO PAINEL
        </button>
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #1e293b', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '10px', color: '#475569', letterSpacing: '0.04em', lineHeight: 1.5 }}>
            DESENVOLVIDO POR<br />
            <span style={{ color: '#64748b', fontWeight: 700, fontSize: '11px' }}>NIT SECOM</span>
          </p>
        </div>
      </aside>

      {/* ══ CONTEÚDO ══════════════════════════════════════════════════════════ */}
      <main style={{ flex: 1, padding: '36px', overflowY: 'auto' }}>

        {feedback && (
          <div style={{ position: 'fixed', top: '20px', right: '20px', background: '#22c55e', color: 'white', padding: '14px 24px', borderRadius: '10px', fontWeight: 'bold', zIndex: 9000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            {feedback}
          </div>
        )}

        {/* ══════════════════ ABA: LEADS ══════════════════════════════════════ */}
        {tab === 'leads' && (
          <div>
            {showDeleteModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: 'white', borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                  <h2 style={{ marginTop: 0, color: '#ef4444' }}>Confirmar Exclusão</h2>
                  <p style={{ color: '#64748b' }}>Você está prestes a excluir <strong>{selectedLeads.size}</strong> lead{selectedLeads.size !== 1 ? 's' : ''}. Esta ação não pode ser desfeita.</p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowDeleteModal(false)} style={S.ghost}>Cancelar</button>
                    <button onClick={handleDeleteSelected} style={S.btn('#ef4444')}>Excluir</button>
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={{ margin: 0 }}>Leads Capturados ({leads.length})</h1>
              <div style={{ display: 'flex', gap: '10px' }}>
                {selectedLeads.size > 0 && (
                  <button onClick={() => setShowDeleteModal(true)} style={S.btn('#ef4444')}>
                    🗑 Excluir Selecionados ({selectedLeads.size})
                  </button>
                )}
                {leads.length > 0 && <button onClick={handleExportCSV} style={S.btn()}>⬇ Exportar CSV</button>}
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '14px', width: '44px', borderBottom: '1px solid #e2e8f0' }}>
                      {leads.length > 0 && (
                        <input type="checkbox" checked={selectedLeads.size === leads.length && leads.length > 0} onChange={toggleSelectAll} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                      )}
                    </th>
                    {['Nome', 'E-mail', 'Acertos', 'Data/Hora'].map((h) => (
                      <th key={h} style={{ padding: '14px', textAlign: h === 'Acertos' ? 'center' : 'left', borderBottom: '1px solid #e2e8f0', fontSize: '13px', color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} onClick={() => toggleSelectLead(l.id)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedLeads.has(l.id) ? '#eff6ff' : 'white' }}>
                      <td style={{ padding: '14px' }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedLeads.has(l.id)} onChange={() => toggleSelectLead(l.id)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '14px' }}>{l.nome}</td>
                      <td style={{ padding: '14px' }}>{l.email}</td>
                      <td style={{ padding: '14px', textAlign: 'center', fontWeight: 'bold' }}>{l.score}</td>
                      <td style={{ padding: '14px', color: '#6b7280', fontSize: '13px' }}>{l.data_hora}</td>
                    </tr>
                  ))}
                  {!leads.length && (
                    <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Nenhum lead capturado ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════ ABA: QUIZZES — lista ════════════════════════════ */}
        {tab === 'quizzes' && !selectedQuiz && (
          <div>
            <h1 style={{ marginTop: 0, marginBottom: '24px' }}>Gerenciar Quizzes</h1>
            <div style={S.card}>
              <h3 style={{ marginTop: 0 }}>Criar Novo Quiz</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input ref={inputRef} placeholder="Ex: Treinamento de Segurança" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateQuiz()} style={{ ...S.input, flex: 1 }} />
                <button onClick={handleCreateQuiz} style={S.btn()}>CRIAR</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {quizzes.map((q) => (
                <div key={q.id} style={{ background: 'white', padding: '18px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: q.active ? '5px solid #22c55e' : '5px solid #e2e8f0' }}>
                  <span style={{ fontWeight: '600' }}>{q.title} {q.active ? '✅' : ''}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => window.api.toggleQuiz({ id: q.id, active: !q.active }).then(refreshData)} style={S.ghost}>{q.active ? 'Desativar' : 'Ativar'}</button>
                    <button onClick={() => setSelectedQuiz(q)} style={S.btn()}>Editar Perguntas</button>
                    <button onClick={() => { if (window.confirm('Excluir este quiz?')) window.api.deleteQuiz(q.id).then(refreshData) }} style={S.btn('#ef4444')}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════ ABA: QUIZZES — editar ═══════════════════════════ */}
        {selectedQuiz && (
          <div>
            <button onClick={() => setSelectedQuiz(null)} style={{ ...S.ghost, marginBottom: '20px' }}>← Voltar</button>
            <h1 style={{ marginTop: 0 }}>Quiz: {selectedQuiz.title}</h1>
            <div style={S.card}>
              <h3 style={{ marginTop: 0 }}>Nova Pergunta</h3>
              <input ref={inputRef} placeholder="Digite a pergunta..." value={qText} onChange={(e) => setQText(e.target.value)} style={{ width: '100%', padding: '14px', marginBottom: '18px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '17px', boxSizing: 'border-box' }} />
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                  <input type="radio" checked={correct === i} onChange={() => setCorrect(i)} name="correct_opt" style={{ width: '18px', height: '18px' }} />
                  <input placeholder={`Alternativa ${i + 1}`} value={opt} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n) }} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                  <button onClick={() => setOptions(options.filter((_, idx) => idx !== i))} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={() => setOptions([...options, ''])} style={S.btn('#64748b')}>+ Alternativa</button>
                <button onClick={handleSaveQuestion} style={S.btn('#22c55e')}>SALVAR PERGUNTA</button>
              </div>
            </div>
            {questions.length > 0 && (
              <div>
                <h3 style={{ marginBottom: '12px' }}>Perguntas Cadastradas ({questions.length})</h3>
                {questions.map((q, i) => (
                  <div key={q.id} style={{ background: 'white', padding: '16px', borderRadius: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: '600' }}>{i + 1}. {q.text}</span>
                      <div style={{ marginTop: '6px', fontSize: '13px', color: '#64748b' }}>
                        {q.options.map((o, oi) => (
                          <span key={oi} style={{ marginRight: '12px', color: oi === q.correctIndex ? '#22c55e' : undefined, fontWeight: oi === q.correctIndex ? 'bold' : undefined }}>
                            {oi === q.correctIndex ? '✓ ' : ''}{o}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => window.api.deleteQuestion(q.id).then(refreshData)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', marginLeft: '10px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ ABA: MÍDIA ══════════════════════════════════════ */}
        {tab === 'midia' && (
          <div>
            <h1 style={{ marginTop: 0, marginBottom: '24px' }}>Gerenciar Mídia</h1>

            {/* ── Playlist ativa ── */}
            <div style={S.card}>
              <h3 style={{ marginTop: 0 }}>
                🎬 Playlist Ativa
                <span style={{ marginLeft: '10px', ...S.badge('#dbeafe', '#1d4ed8') }}>{playlist.length} item{playlist.length !== 1 ? 's' : ''}</span>
              </h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginTop: 0 }}>
                Mídias exibidas em loop na ordem abaixo.
              </p>
              {playlist.length === 0 && (
                <div style={{ background: '#f8fafc', border: '2px dashed #e2e8f0', borderRadius: '10px', padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                  Nenhuma mídia na playlist. Adicione a partir da biblioteca abaixo.
                </div>
              )}
              {playlist.map((m, i) => {
                const ts = typeStyle(m.type)
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#f8fafc', borderRadius: '10px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: '28px', height: '28px', background: '#2563eb', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>{ts.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px' }}>{m.name}</div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                        <span style={S.badge(ts.bg, ts.color)}>{ts.label}</span>
                        {(m.schedule_start_date || m.schedule_start_time) && <span style={S.badge('#fef9c3', '#854d0e')}>📅 AGENDADO</span>}
                      </div>
                    </div>

                    {/* Duração editável para YouTube/Imagem/Webpage */}
                    {(m.type === 'youtube' || m.type === 'image' || m.type === 'webpage') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>⏱</span>
                        {editDuration[m.id] !== undefined ? (
                          <>
                            <input type="number" min="5" value={editDuration[m.id]}
                              onChange={(e) => setEditDuration((d) => ({ ...d, [m.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveDuration(m.id)}
                              style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            />
                            <span style={{ fontSize: '12px', color: '#64748b' }}>s</span>
                            <button onClick={() => handleSaveDuration(m.id)} style={S.btn('#22c55e')}>✓</button>
                          </>
                        ) : (
                          <button onClick={() => setEditDuration((d) => ({ ...d, [m.id]: m.duration || 60 }))} style={{ ...S.ghost, fontSize: '13px', padding: '4px 10px' }}>
                            {m.duration || 60}s
                          </button>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={() => handleMove(m.id, 'up')} disabled={i === 0} style={{ ...S.ghost, padding: '6px 10px', opacity: i === 0 ? 0.3 : 1 }}>▲</button>
                      <button onClick={() => handleMove(m.id, 'down')} disabled={i === playlist.length - 1} style={{ ...S.ghost, padding: '6px 10px', opacity: i === playlist.length - 1 ? 0.3 : 1 }}>▼</button>
                    </div>
                    <button onClick={() => handleTogglePlaylist(m.id)} style={S.btn('#ef4444')} title="Remover da playlist">✕</button>
                  </div>
                )
              })}
            </div>

            {/* ── Biblioteca de mídias ── */}
            <div style={S.card}>
              <h3 style={{ marginTop: 0 }}>📁 Biblioteca de Mídias ({allMedia.length})</h3>
              {allMedia.length === 0 && (
                <p style={{ color: '#94a3b8' }}>Nenhuma mídia cadastrada. Use os formulários abaixo para adicionar.</p>
              )}
              {allMedia.map((m) => {
                const active = inPlaylist(m.id)
                const ts = typeStyle(m.type)
                const dlStatus = downloadStatus[m.id] || m.download_status || ''
                const hasCache = !!(m.local_file || dlStatus === 'done')
                return (
                  <div key={m.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>{ts.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px' }}>{m.name}</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span style={S.badge(ts.bg, ts.color)}>{ts.label}</span>
                          {active && <span style={S.badge('#dcfce7', '#166534')}>NA PLAYLIST</span>}
                          {(m.schedule_start_date || m.schedule_start_time) && <span style={S.badge('#fef9c3', '#854d0e')}>📅 AGENDADO</span>}
                          {hasCache && <span style={S.badge('#d1fae5', '#065f46')}>📥 OFFLINE</span>}
                          {dlStatus === 'downloading' && <span style={S.badge('#fef3c7', '#92400e')}>⏳ BAIXANDO...</span>}
                          {dlStatus === 'error' && <span style={S.badge('#fee2e2', '#991b1b')}>❌ ERRO</span>}
                        </div>
                      </div>
                      {m.type === 'youtube' && !hasCache && dlStatus !== 'downloading' && (
                        <button onClick={() => handleDownloadYoutube(m)} style={{ ...S.ghost, fontSize: '13px', color: '#2563eb' }} title="Baixar para reprodução offline">
                          📥 Offline
                        </button>
                      )}
                      <button onClick={() => setEditSchedule(editSchedule === m.id ? null : m.id)} style={{ ...S.ghost, fontSize: '13px' }} title="Agendamento">📅</button>
                      <button onClick={() => handleTogglePlaylist(m.id)} style={S.btn(active ? '#64748b' : '#22c55e')}>
                        {active ? '✓ Na Playlist' : '+ Playlist'}
                      </button>
                      <button onClick={() => handleDeleteMedia(m.id)} style={{ color: '#ef4444', border: '1px solid #fecaca', background: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        Excluir
                      </button>
                    </div>
                    {editSchedule === m.id && (
                      <ScheduleForm
                        initial={{ startDate: m.schedule_start_date||'', endDate: m.schedule_end_date||'', startTime: m.schedule_start_time||'', endTime: m.schedule_end_time||'' }}
                        onSave={(form) => handleSaveSchedule(m, form)}
                        onCancel={() => setEditSchedule(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Upload vídeo ── */}
            <div style={S.card}>
              <h3 style={{ marginTop: 0 }}>📂 Upload de Vídeo</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button ref={inputRef} onClick={handleUploadVideo} style={S.btn('#6366f1')}>📂 Selecionar Vídeo</button>
                {pendingFile && (
                  <>
                    <span style={{ color: '#334155', fontWeight: '500', fontSize: '14px' }}>✓ {pendingFile.name}</span>
                    <button onClick={handleSaveVideo} style={S.btn('#22c55e')}>SALVAR</button>
                    <button onClick={() => setPendingFile(null)} style={{ ...S.ghost, color: '#ef4444' }}>Cancelar</button>
                  </>
                )}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: 0, marginTop: '10px' }}>Formatos: MP4, WebM, MKV, AVI, MOV, OGG</p>
            </div>

            {/* ── Upload imagem ── */}
            <div style={S.card}>
              <h3 style={{ marginTop: 0 }}>🖼 Upload de Imagem</h3>

              {/* Helper text obrigatório */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 16px', marginBottom: '18px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>📐</span>
                <div>
                  <p style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '13px', color: '#1d4ed8' }}>Orientação para exibição perfeita no Totem</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#1e40af', lineHeight: '1.5' }}>
                    Para exibição perfeita no Totem, envie imagens no formato <strong>Vertical (Retrato)</strong>.
                    Formatos aceitos: <strong>PNG ou JPG</strong>.
                    Resolução recomendada: <strong>1080×1920 pixels</strong> (Proporção 9:16).
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={handleUploadImage} style={S.btn('#8b5cf6')}>🖼 Selecionar Imagem</button>
                {pendingImage && (
                  <>
                    <span style={{ color: '#334155', fontWeight: '500', fontSize: '14px' }}>✓ {pendingImage.name}</span>
                    <button onClick={handleSaveImage} style={S.btn('#22c55e')}>SALVAR</button>
                    <button onClick={() => setPendingImage(null)} style={{ ...S.ghost, color: '#ef4444' }}>Cancelar</button>
                  </>
                )}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: 0, marginTop: '10px' }}>Formatos: PNG, JPG, JPEG, WebP, GIF, SVG</p>
            </div>

            {/* ── Página Web ── */}
            <div style={S.card}>
              <h3 style={{ marginTop: 0 }}>🌐 Adicionar Página Web</h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginTop: 0, marginBottom: '16px' }}>
                Exibe um site em loop na playlist. Requer <strong>conexão Wi-Fi</strong>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Nome da página (ex: Painel de Vendas)" value={webpageName} onChange={(e) => setWebpageName(e.target.value)} style={S.input} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input placeholder="https://..." value={webpageUrl} onChange={(e) => setWebpageUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddWebpage()} style={{ ...S.input, flex: 1 }} />
                  <button onClick={handleAddWebpage} style={S.btn('#0284c7')}>ADICIONAR</button>
                </div>
              </div>
            </div>

            {/* ── YouTube URL ── */}
            <div style={S.card}>
              <h3 style={{ marginTop: 0 }}>▶ Adicionar URL do YouTube</h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginTop: 0, marginBottom: '16px' }}>
                Cole qualquer link do YouTube. Requer <strong>conexão Wi-Fi</strong> para reprodução.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddYoutube()} style={{ ...S.input, flex: 1 }} />
                <button onClick={handleAddYoutube} style={S.btn('#ef4444')}>ADICIONAR</button>
              </div>
              {youtubeUrl && getYoutubeId(youtubeUrl) && (
                <p style={{ color: '#22c55e', fontSize: '13px', marginBottom: 0, marginTop: '8px' }}>✓ ID detectado: {getYoutubeId(youtubeUrl)}</p>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ ABA: WIFI ═══════════════════════════════════════ */}
        {tab === 'wifi' && (
          <div>
            <h1 style={{ marginTop: 0, marginBottom: '24px' }}>Conexão Wi-Fi</h1>
            <div style={{ ...S.card, borderLeft: `5px solid ${wifiStatus?.connected ? '#22c55e' : '#e2e8f0'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                    {wifiStatus?.connected ? `✓ Conectado: ${wifiStatus.ssid}` : '✗ Sem conexão Wi-Fi'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                    {wifiStatus?.connected ? 'Online — YouTube disponível' : 'Offline — apenas vídeos locais'}
                  </div>
                </div>
                <button onClick={handleWifiScan} disabled={wifiScanning} style={S.btn(wifiScanning ? '#94a3b8' : '#2563eb')}>
                  {wifiScanning ? '⏳ Buscando...' : '🔍 Buscar Redes'}
                </button>
              </div>
            </div>
            {wifiMsg && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>{wifiMsg}</div>
            )}
            {wifiNetworks.length > 0 && (
              <div style={S.card}>
                <h3 style={{ marginTop: 0 }}>Redes Disponíveis ({wifiNetworks.length})</h3>
                {wifiNetworks.map((net, i) => (
                  <div key={i} style={{ borderBottom: i < wifiNetworks.length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: '14px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <SignalBars signal={net.signal} />
                      <span style={{ flex: 1, fontWeight: '600', fontSize: '15px' }}>{net.ssid}</span>
                      {net.secured && <span style={{ fontSize: '12px', color: '#94a3b8' }}>🔒 Protegida</span>}
                      <span style={{ fontSize: '12px', color: '#94a3b8', width: '36px', textAlign: 'right' }}>{net.signal}%</span>
                      <button onClick={() => { setConnectingSSID(connectingSSID === net.ssid ? null : net.ssid); setWifiPassword(''); setWifiMsg('') }} style={S.btn(connectingSSID === net.ssid ? '#64748b' : '#2563eb')}>
                        {connectingSSID === net.ssid ? 'Cancelar' : 'Conectar'}
                      </button>
                    </div>
                    {connectingSSID === net.ssid && (
                      <div style={{ marginTop: '12px', paddingLeft: '28px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="password" placeholder={net.secured ? 'Senha da rede Wi-Fi' : 'Sem senha (rede aberta)'} value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleWifiConnect(net.ssid)} autoFocus style={{ ...S.input, flex: 1 }} />
                        <button onClick={() => handleWifiConnect(net.ssid)} style={S.btn('#22c55e')}>Conectar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!wifiScanning && wifiNetworks.length === 0 && (
              <div style={{ ...S.card, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                Clique em <strong>"Buscar Redes"</strong> para listar as redes Wi-Fi disponíveis.
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ ABA: CONFIGURAÇÕES ══════════════════════════════ */}
        {tab === 'configuracoes' && (
          <div>
            <h1 style={{ marginTop: 0, marginBottom: '24px' }}>Configurações</h1>

            {/* ── Senha ── */}
            <div style={S.card}>
              <h3 style={{ marginTop: 0 }}>🔐 Alterar Senha do Painel</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '380px' }}>
                <input ref={inputRef} type="password" placeholder="Nova senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={S.input} />
                <input type="password" placeholder="Confirmar nova senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()} style={S.input} />
                <button onClick={handleChangePassword} style={S.btn()}>ALTERAR SENHA</button>
              </div>
            </div>

            {/* ── Energia ── */}
            <div style={S.card}>
              <h3 style={{ marginTop: 0 }}>⚡ Agendamento de Energia</h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginTop: 0 }}>Apaga a tela automaticamente fora do horário configurado.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500' }}>
                  <input type="checkbox" checked={energyEnabled} onChange={(e) => setEnergyEnabled(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  Ativar agendamento de energia
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '500px', opacity: energyEnabled ? 1 : 0.4 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#64748b', marginBottom: '8px' }}>HORA DE DORMIR</label>
                  <input type="time" value={energySleepTime} onChange={(e) => setEnergySleepTime(e.target.value)} style={{ ...S.input, width: '100%' }} disabled={!energyEnabled} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#64748b', marginBottom: '8px' }}>HORA DE ACORDAR</label>
                  <input type="time" value={energyWakeTime} onChange={(e) => setEnergyWakeTime(e.target.value)} style={{ ...S.input, width: '100%' }} disabled={!energyEnabled} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={handleSaveEnergySettings} style={S.btn()}>💾 SALVAR AGENDA</button>
                <button onClick={() => window.api.displaySleep().then((r) => showFeedback(r.ok ? 'Tela apagada!' : `Erro: ${r.error}`))} style={S.btn('#64748b')}>
                  🌙 Dormir Agora
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════ ABA: DIAGNÓSTICO ════════════════════════════════ */}
        {tab === 'diagnostico' && <DiagnosticPanel />}

      </main>
    </div>
  )
}
