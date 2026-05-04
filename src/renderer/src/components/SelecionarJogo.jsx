import React, { useEffect, useRef, useState } from 'react'

const IDLE_TIMEOUT_MS = 30_000

export default function SelecionarJogo({ onSelectQuiz, onSelectMemoria, onCancel }) {
  const idleRef = useRef(null)
  const [idleCountdown, setIdleCountdown] = useState(IDLE_TIMEOUT_MS / 1000)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  const resetIdle = () => {
    clearTimeout(idleRef.current)
    setIdleCountdown(IDLE_TIMEOUT_MS / 1000)
    idleRef.current = setTimeout(() => onCancel(), IDLE_TIMEOUT_MS)
  }

  useEffect(() => {
    resetIdle()
    const interval = setInterval(() => {
      setIdleCountdown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => {
      clearTimeout(idleRef.current)
      clearInterval(interval)
    }
  }, [])

  return (
    <div
      onPointerDown={resetIdle}
      style={{
        position: 'fixed', inset: 0,
        background: 'radial-gradient(ellipse at 30% 20%, #1e3a5f 0%, #0f172a 60%, #020617 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
    >
      {/* Grid de pontos decorativos */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Título */}
      <div style={{
        textAlign: 'center', marginBottom: '56px', zIndex: 1,
        transform: visible ? 'translateY(0)' : 'translateY(-20px)',
        transition: 'transform 0.5s ease 0.1s',
      }}>
        <p style={{
          margin: '0 0 12px', fontSize: '14px', fontWeight: 700, letterSpacing: '4px',
          textTransform: 'uppercase', color: '#64748b',
        }}>
          Escolha a atividade
        </p>
        <h1 style={{
          margin: 0, fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800,
          color: 'white', lineHeight: 1.1, letterSpacing: '-1px',
        }}>
          Como você quer jogar?
        </h1>
      </div>

      {/* Cards de opção */}
      <div style={{
        display: 'flex', gap: '24px', zIndex: 1, width: '100%',
        maxWidth: '780px', padding: '0 32px', boxSizing: 'border-box',
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'transform 0.5s ease 0.2s',
      }}>
        <OptionCard
          label="Quiz"
          desc="Responda perguntas e teste seus conhecimentos"
          color="#3b82f6"
          glow="rgba(59,130,246,0.35)"
          onClick={onSelectQuiz}
        />
        <OptionCard
          label="Jogo da Memória"
          desc="Encontre todos os pares de imagens"
          color="#a855f7"
          glow="rgba(168,85,247,0.35)"
          onClick={onSelectMemoria}
        />
      </div>

      {/* Voltar + idle */}
      <div style={{
        marginTop: '48px', zIndex: 1, textAlign: 'center',
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'transform 0.5s ease 0.3s',
      }}>
        <button
          onClick={onCancel}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.15)',
            color: '#64748b', padding: '10px 24px', borderRadius: '99px',
            cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.35)'; e.target.style.color = '#94a3b8' }}
          onMouseLeave={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.color = '#64748b' }}
        >
          ← Cancelar e Voltar
        </button>
        <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#334155' }}>
          Voltando automaticamente em {idleCountdown}s sem atividade
        </p>
      </div>
    </div>
  )
}

function OptionCard({ label, desc, color, glow, onClick }) {
  const [pressed, setPressed] = useState(false)

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        flex: 1, border: `2px solid ${color}40`,
        borderRadius: '24px', padding: '48px 32px',
        background: `linear-gradient(145deg, ${color}18, ${color}08)`,
        cursor: 'pointer', textAlign: 'center',
        boxShadow: pressed
          ? `0 0 0 4px ${color}60, inset 0 2px 8px rgba(0,0,0,0.3)`
          : `0 8px 40px ${glow}, 0 2px 8px rgba(0,0,0,0.4)`,
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'all 0.15s ease',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Brilho de canto */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: `linear-gradient(90deg, transparent, ${color}80, transparent)`,
      }} />

      <div style={{
        fontSize: '1.6rem', fontWeight: 800, color: 'white',
        marginBottom: '12px', letterSpacing: '-0.5px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.5,
        fontWeight: 400,
      }}>
        {desc}
      </div>

      {/* Botão visual */}
      <div style={{
        marginTop: '32px',
        display: 'inline-block',
        padding: '12px 28px',
        borderRadius: '99px',
        background: color,
        color: 'white',
        fontSize: '0.9rem',
        fontWeight: 700,
        letterSpacing: '0.5px',
        boxShadow: `0 4px 20px ${glow}`,
      }}>
        Jogar
      </div>
    </button>
  )
}
