import React, { useState, useEffect } from 'react'

const DURATION = 10 // segundos antes de voltar

function Stars({ score, total }) {
  const pct = total > 0 ? score / total : 0
  const filled = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : pct >= 0.3 ? 1 : 0
  return (
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px' }}>
      {[1, 2, 3].map((s) => (
        <span
          key={s}
          style={{
            fontSize: '52px',
            filter: s <= filled ? 'none' : 'grayscale(1) opacity(0.3)',
            transition: 'filter 0.4s',
            transitionDelay: `${(s - 1) * 0.2}s`
          }}
        >
          ⭐
        </span>
      ))}
    </div>
  )
}

export default function ThankYou({ nome, quizTitle, score, total, onFinish }) {
  const [seconds, setSeconds] = useState(DURATION)

  useEffect(() => {
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(t); onFinish(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const progress = (DURATION - seconds) / DURATION

  const message =
    pct === 100 ? 'Incrível! Pontuação perfeita!' :
    pct >= 80  ? 'Excelente desempenho!' :
    pct >= 60  ? 'Muito bom! Continue assim.' :
    pct >= 40  ? 'Bom esforço!' :
                 'Obrigado pela participação!'

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Roboto', sans-serif",
        color: 'white',
        padding: 'clamp(24px, 4vw, 60px)',
        boxSizing: 'border-box',
        textAlign: 'center'
      }}
    >
      {/* Ícone principal */}
      <div style={{ fontSize: '80px', marginBottom: '16px', lineHeight: 1 }}>🎉</div>

      {/* Cumprimento */}
      <h1
        style={{
          fontSize: 'clamp(28px, 5vw, 56px)',
          fontWeight: '800',
          margin: '0 0 8px',
          background: 'linear-gradient(90deg, #60a5fa, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}
      >
        Parabéns, {nome}!
      </h1>

      {/* Nome do quiz */}
      <p style={{ fontSize: 'clamp(14px, 2.5vw, 22px)', color: '#94a3b8', margin: '0 0 32px' }}>
        Você completou o quiz <strong style={{ color: '#e2e8f0' }}>{quizTitle}</strong>
      </p>

      {/* Estrelas */}
      <Stars score={score} total={total} />

      {/* Placar */}
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '20px',
          padding: '28px 48px',
          marginBottom: '24px',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: '900', lineHeight: 1 }}>
          {score}
          <span style={{ fontSize: '0.5em', color: '#64748b' }}>/{total}</span>
        </div>
        <div style={{ fontSize: 'clamp(14px, 2vw, 20px)', color: '#94a3b8', marginTop: '6px' }}>
          acertos — {pct}%
        </div>
      </div>

      {/* Mensagem motivacional */}
      <p style={{ fontSize: 'clamp(16px, 2.5vw, 24px)', color: '#60a5fa', fontWeight: '600', margin: '0 0 40px' }}>
        {message}
      </p>

      {/* Barra de progresso countdown */}
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              borderRadius: '100px',
              transition: 'width 1s linear'
            }}
          />
        </div>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '10px 0 0', textAlign: 'center' }}>
          Voltando em {seconds}s…
        </p>
      </div>
    </div>
  )
}
