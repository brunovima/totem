import React, { useState } from 'react'

function buildMediaUrl(filePath) {
  if (!filePath) return null
  const normalized = filePath.replace(/\\/g, '/')
  const withSlash = normalized.startsWith('/') ? normalized : '/' + normalized
  const encoded = withSlash.split('/').map(encodeURIComponent).join('/')
  return 'totem-media://' + encoded
}

export default function DiagnosticPanel() {
  const [info, setInfo] = useState(null)
  const [playlist, setPlaylist] = useState(null)
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState({})

  async function runDiagnostic() {
    setLoading(true)
    setTestResult({})
    try {
      const [dbg, pl] = await Promise.all([
        window.api.debugMedia(),
        window.api.getPlaylist()
      ])
      setInfo(dbg)
      setPlaylist(pl)
    } catch (e) {
      setInfo({ error: e.message })
    }
    setLoading(false)
  }

  async function testUrl(url, id) {
    setTestResult((p) => ({ ...p, [id]: 'testando…' }))
    try {
      const res = await fetch(url)
      setTestResult((p) => ({ ...p, [id]: `HTTP ${res.status} ${res.ok ? '✅ OK' : '❌ ERRO'}` }))
    } catch (e) {
      setTestResult((p) => ({ ...p, [id]: `❌ fetch falhou: ${e.message}` }))
    }
  }

  const cardStyle = {
    background: '#1e293b',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#e2e8f0'
  }

  const labelStyle = { color: '#94a3b8', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }
  const valueStyle = { wordBreak: 'break-all', color: '#f1f5f9' }
  const badgeOk = { background: '#166534', color: '#bbf7d0', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }
  const badgeErr = { background: '#7f1d1d', color: '#fca5a5', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }

  return (
    <div style={{ padding: '24px', color: '#f1f5f9', fontFamily: 'sans-serif', maxWidth: '900px' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Diagnóstico de Mídia</h2>
      <p style={{ color: '#94a3b8', margin: '0 0 20px', fontSize: '14px' }}>
        Verifica o protocolo <code>totem-media://</code>, caminhos no banco e arquivos em disco.
      </p>

      <button
        onClick={runDiagnostic}
        disabled={loading}
        style={{
          background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px',
          padding: '10px 24px', fontSize: '14px', cursor: 'pointer', marginBottom: '24px'
        }}
      >
        {loading ? 'Analisando…' : '🔍 Executar Diagnóstico'}
      </button>

      {info && (
        <>
          {/* userData path */}
          <div style={cardStyle}>
            <div style={labelStyle}>userData (pasta do banco e mídia)</div>
            <div style={valueStyle}>{info.userData || info.error}</div>
          </div>

          {/* Arquivos em disco */}
          <div style={cardStyle}>
            <div style={labelStyle}>Arquivos em disco ({info.files?.length ?? 0})</div>
            {info.files?.length === 0 && (
              <div style={{ color: '#f87171' }}>⚠️ Nenhum arquivo encontrado em {info.mediaDir}</div>
            )}
            {info.files?.map((f) => (
              <div key={f} style={{ ...valueStyle, padding: '3px 0', borderBottom: '1px solid #334155' }}>
                {f}
              </div>
            ))}
          </div>

          {/* Playlist no banco */}
          <div style={cardStyle}>
            <div style={labelStyle}>Playlist no banco ({playlist?.length ?? 0} itens)</div>
            {playlist?.length === 0 && (
              <div style={{ color: '#f87171' }}>⚠️ Nenhum item na playlist (active=1). Ative vídeos na aba Mídia.</div>
            )}
            {playlist?.map((item) => {
              const url = item.type === 'file' ? buildMediaUrl(item.source) : null
              const onDisk = item.type === 'file' ? info.files?.includes(item.source.split('/').pop()) : null
              return (
                <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={onDisk === false ? badgeErr : onDisk === true ? badgeOk : { ...badgeOk, background: '#1e3a5f', color: '#93c5fd' }}>
                      {item.type === 'file' ? (onDisk ? 'arquivo ✅' : 'arquivo ❌ ausente') : 'youtube'}
                    </span>
                    <strong>{item.name}</strong>
                  </div>

                  <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '6px' }}>
                    source: {item.source}
                  </div>

                  {url && (
                    <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '6px' }}>
                      url: {url}
                    </div>
                  )}

                  {url && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => testUrl(url, item.id)}
                        style={{
                          background: '#334155', color: '#e2e8f0', border: 'none',
                          borderRadius: '6px', padding: '4px 12px', fontSize: '12px', cursor: 'pointer'
                        }}
                      >
                        Testar fetch
                      </button>
                      {testResult[item.id] && (
                        <span style={{ fontSize: '12px', color: testResult[item.id].includes('✅') ? '#86efac' : '#f87171' }}>
                          {testResult[item.id]}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Instruções */}
          {info.files?.length === 0 && playlist?.length > 0 && (
            <div style={{ background: '#7c2d12', borderRadius: '8px', padding: '16px', fontSize: '14px' }}>
              <strong>⚠️ Causa provável do erro 404:</strong> os arquivos foram registrados no banco mas
              não existem em disco. Isso acontece quando o banco de dados é de uma instalação anterior
              ou quando os arquivos foram apagados manualmente. Solução: remova os itens da mídia e faça
              o upload novamente.
            </div>
          )}
        </>
      )}
    </div>
  )
}
