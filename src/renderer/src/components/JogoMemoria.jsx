import React, { useState, useEffect, useRef, useCallback } from 'react'
import './JogoMemoria.css'

const IDLE_TIMEOUT_MS = 60_000
const WIN_REDIRECT_MS = 8_000

// ── Estilos estáticos (não dependem de estado) ────────────────────────────────

const telaPrincipalStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
  padding: '3vh 3vw',
  boxSizing: 'border-box',
  background: '#0f172a',
}

const cabecalhoRodapeStyle = {
  flexShrink: 0,
  textAlign: 'center',
}

const areaDoGridStyle = {
  flexGrow: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 0,
  padding: '20px',
}

// gridCartasStyle é uma função pois depende de cartas.length (estado do componente)
function gridCartasStyle() {
  return {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    width: '100%',
    maxWidth: '900px',
  }
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function fisherYates(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildImagemUrl(arquivo) {
  return 'totem-media://imagens_memoria/' + encodeURIComponent(arquivo)
}

function formatTempo(s) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

// ── Componente ────────────────────────────────────────────────────────────────

function buildLogoUrl(logoPath) {
  if (!logoPath) return null
  const normalized = logoPath.replace(/\\/g, '/')
  const withSlash = normalized.startsWith('/') ? normalized : '/' + normalized
  const encoded = withSlash.split('/').map(encodeURIComponent).join('/')
  return 'totem-media://' + encoded
}

export default function JogoMemoria({ onFinish, logoPath }) {
  const [cartas, setCartas] = useState([])
  const [cartasViradas, setCartasViradas] = useState([])
  const [paresEncontrados, setParesEncontrados] = useState(0)
  const [bloqueioTela, setBloqueioTela] = useState(false)
  const [venceu, setVenceu] = useState(false)
  const [contagemVitoria, setContagemVitoria] = useState(WIN_REDIRECT_MS / 1000)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [tempo, setTempo] = useState(0)
  const [tempoFinal, setTempoFinal] = useState(null)

  const totalPares = useRef(0)
  const idleRef = useRef(null)
  const tempoRef = useRef(null)

  const resetIdle = useCallback(() => {
    clearTimeout(idleRef.current)
    idleRef.current = setTimeout(() => onFinish(), IDLE_TIMEOUT_MS)
  }, [onFinish])

  useEffect(() => {
    window.api.getJogoAtivo().then((jogo) => {
      if (!jogo || !jogo.imagens || jogo.imagens.length < 8) {
        setErro('Nenhum jogo da memória ativo com imagens suficientes.')
        setCarregando(false)
        setTimeout(() => onFinish(), 3000)
        return
      }
      const pares = [...jogo.imagens, ...jogo.imagens]
      totalPares.current = jogo.imagens.length
      setCartas(fisherYates(pares).map((img, idx) => ({
        uid: idx,
        pairId: img.id,
        src: buildImagemUrl(img.caminho_arquivo),
        virada: false,
        encontrada: false,
      })))
      setCarregando(false)
    }).catch(() => {
      setErro('Erro ao carregar o jogo.')
      setCarregando(false)
      setTimeout(() => onFinish(), 3000)
    })
  }, [onFinish])

  useEffect(() => {
    resetIdle()
    return () => clearTimeout(idleRef.current)
  }, [resetIdle])

  useEffect(() => {
    if (carregando || venceu) return
    tempoRef.current = setInterval(() => setTempo((t) => t + 1), 1000)
    return () => clearInterval(tempoRef.current)
  }, [carregando, venceu])

  useEffect(() => {
    if (!venceu) return
    clearTimeout(idleRef.current)
    clearInterval(tempoRef.current)
    setTempoFinal(tempo)
    setContagemVitoria(WIN_REDIRECT_MS / 1000)
    const iv = setInterval(() => {
      setContagemVitoria((c) => {
        if (c <= 1) { clearInterval(iv); onFinish(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
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
        const novosTotal = paresEncontrados + 1
        setCartas((prev) => prev.map((c) =>
          c.pairId === a.pairId ? { ...c, encontrada: true, virada: true } : c
        ))
        setCartasViradas([])
        setParesEncontrados(novosTotal)
        setBloqueioTela(false)
        if (novosTotal >= totalPares.current) setVenceu(true)
      } else {
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
      <div style={{ ...telaPrincipalStyle, justifyContent: 'center', alignItems: 'center' }}>
        <span style={{ color: 'white', fontSize: '1.4rem' }}>Carregando jogo...</span>
      </div>
    )
  }

  if (erro) {
    return (
      <div style={{ ...telaPrincipalStyle, justifyContent: 'center', alignItems: 'center' }}>
        <span style={{ color: '#ef4444', fontSize: '1.4rem' }}>{erro}</span>
      </div>
    )
  }

  return (
    <div style={telaPrincipalStyle} onPointerDown={resetIdle}>

      {/* CABEÇALHO */}
      <div style={{ ...cabecalhoRodapeStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
          🧠 Jogo da Memória
        </span>
        <span style={{ color: '#64748b', fontSize: '0.85rem', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
          Pares: <strong style={{ color: '#22c55e' }}>{paresEncontrados}</strong> / {totalPares.current}
        </span>
      </div>

      {/* ÁREA DO GRID */}
      <div style={areaDoGridStyle}>
        <div style={gridCartasStyle()}>
          {cartas.map((carta) => (
            <div
              key={carta.uid}
              className={`jm-carta${carta.virada ? ' virada' : ''}${carta.encontrada ? ' encontrada' : ''}`}
              onClick={() => handleClickCarta(carta)}
            >
              <div className="jm-carta-inner">
                <div className="jm-frente">
                  {buildLogoUrl(logoPath) ? (
                    <img
                      src={buildLogoUrl(logoPath)}
                      alt="Logo"
                      style={{ maxWidth: '65%', maxHeight: '65%', objectFit: 'contain', filter: 'brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                      draggable={false}
                    />
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
                      NIT SECOM
                    </span>
                  )}
                </div>
                <div className="jm-verso">
                  <img src={carta.src} alt="" draggable={false} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CRONÔMETRO */}
      <div style={{ ...cabecalhoRodapeStyle, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', padding: '12px 0 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ color: '#334155', fontSize: '0.65rem', letterSpacing: '3px', textTransform: 'uppercase', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
          TEMPO
        </span>
        <span style={{ color: '#94a3b8', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '2px', fontVariantNumeric: 'tabular-nums', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
          {formatTempo(tempo)}
        </span>
      </div>

      {/* MODAL DE VITÓRIA */}
      {venceu && (
        <div className="jm-modal-overlay">
          <div className="jm-modal">
            <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🎉</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.8rem', color: '#1e3a8a', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>Parabéns!</h2>
            <p style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#475569', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
              Você tem uma memória incrível!
            </p>
            {tempoFinal !== null && (
              <div className="jm-modal-tempo">
                <span className="jm-modal-tempo-label">Seu tempo</span>
                <span className="jm-modal-tempo-valor">{formatTempo(tempoFinal)}</span>
              </div>
            )}
            <p style={{ margin: '16px 0 0', color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
              Voltando em {contagemVitoria}s...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
