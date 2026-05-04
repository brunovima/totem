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
    } catch {
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
            Use <strong>exatamente 8, 10 ou 12 imagens</strong> para manter a simetria do jogo (grade 4 colunas).
          </p>

          {/* Status do contador */}
          {imagens.length === 0 && (
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Nenhuma imagem cadastrada.
            </p>
          )}
          {imagens.length > 0 && ![8, 10, 12].includes(imagens.length) && (
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#f59e0b', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '8px 12px' }}>
              ⚠️ Total atual: <strong>{imagens.length}</strong> imagem(ns). Selecione exatamente 8, 10 ou 12 imagens para manter a simetria do jogo.
            </p>
          )}
          {[8, 10, 12].includes(imagens.length) && (
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#16a34a', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '8px 12px' }}>
              ✓ <strong>{imagens.length} imagens</strong> cadastradas — grade {imagens.length === 8 ? '4×4' : imagens.length === 10 ? '4×5' : '4×6'} ativada.
            </p>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={{ ...S.btn('#2563eb'), opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? 'Processando...' : '+ Adicionar Imagens'}
            </button>
            {imagens.length > 0 && (
              <span style={{ fontSize: '12px', color: '#94a3b8', alignSelf: 'center' }}>
                Permitido: 8 · 10 · 12 imagens
              </span>
            )}
          </div>
        </div>

        {imagens.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '32px' }}>
            Nenhuma imagem cadastrada. Clique em "Adicionar Imagens" para começar.
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', /* Reduzido para melhor ajuste */
            gap: '24px', /* AUMENTADO O ESPAÇO DE RESPIRO AQUI */
            padding: '16px 0' /* Respiro nas bordas do grid */
          }}>
            {imagens.map((img) => (
              <div key={img.id} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <img
                  src={buildImagemUrl(img.caminho_arquivo)}
                  alt=""
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { e.target.style.background = '#e2e8f0' }}
                />
                <button
                  onClick={() => handleDeleteImagem(img)}
                  style={{
                    position: 'absolute', top: '6px', right: '6px',
                    background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none',
                    borderRadius: '50%', width: '28px', height: '28px',
                    cursor: 'pointer', fontSize: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
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
                <span style={{ marginLeft: '8px', fontSize: '11px', color: [8, 10, 12].includes(jogo.total_imagens) ? '#16a34a' : '#f59e0b' }}>
                  ({jogo.total_imagens || 0} img)
                </span>
              </div>
              <button
                onClick={() => handleToggle(jogo)}
                disabled={!jogo.ativo && ![8, 10, 12].includes(jogo.total_imagens)}
                title={!jogo.ativo && ![8, 10, 12].includes(jogo.total_imagens) ? 'Adicione exatamente 8, 10 ou 12 imagens para ativar' : ''}
                style={{ ...S.btn(jogo.ativo ? '#f59e0b' : '#22c55e'), opacity: (!jogo.ativo && ![8, 10, 12].includes(jogo.total_imagens)) ? 0.4 : 1, cursor: (!jogo.ativo && ![8, 10, 12].includes(jogo.total_imagens)) ? 'not-allowed' : 'pointer' }}
              >
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