import React, { useState, useEffect } from 'react'
import VirtualKeyboard from './VirtualKeyboard.jsx'

const FONT = "'Roboto', sans-serif"

export default function LeadForm({ onConfirm, onCancel }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [activeField, setActiveField] = useState('nome')
  const [error, setError] = useState('')

  const updateField = (key) => {
    setError('')
    const apply = (prev) => {
      if (key === 'BACKSPACE') return prev.slice(0, -1)
      if (key.length > 1) return prev
      return prev + key
    }
    if (activeField === 'nome') setNome(apply)
    else setEmail(apply)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Backspace') updateField('BACKSPACE')
      else if (e.key === 'Enter') handleSubmit()
      else if (e.key === 'Tab') setActiveField(activeField === 'nome' ? 'email' : 'nome')
      else updateField(e.key)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeField, nome, email])

  const handleSubmit = () => {
    if (nome.trim().length < 3) {
      setError('Por favor, insira seu nome completo.')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Insira um e-mail válido (exemplo@dominio.com).')
      return
    }
    onConfirm({ nome: nome.trim(), email: email.trim() })
  }

  const canSubmit = nome.length > 2 && email.includes('@')

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 3vw, 32px)',
        paddingBottom: 'clamp(220px, 28vw, 360px)',
        fontFamily: FONT
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: 'clamp(24px, 3.5vw, 44px)',
          borderRadius: 'clamp(16px, 2vw, 24px)',
          width: '100%',
          maxWidth: 'min(480px, 90vw)',
          marginBottom: 'clamp(16px, 2vw, 24px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'clamp(20px, 3vw, 32px)' }}>
          <div style={{ fontSize: 'clamp(32px, 5vw, 52px)', marginBottom: '10px' }}>🎯</div>
          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(18px, 2.8vw, 28px)',
              fontWeight: 700,
              color: '#1f2937',
              lineHeight: 1.2
            }}
          >
            Identifique-se para Jogar
          </h2>
          <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 'clamp(12px, 1.5vw, 15px)' }}>
            Suas informações ficam guardadas com segurança
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 1.5vw, 18px)' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'clamp(10px, 1.2vw, 12px)',
                color: '#6b7280',
                fontWeight: 700,
                marginBottom: '6px',
                letterSpacing: '0.06em'
              }}
            >
              NOME COMPLETO
            </label>
            <input
              type="text"
              placeholder="Digite seu nome..."
              value={nome}
              onFocus={() => setActiveField('nome')}
              readOnly
              style={{
                width: '100%',
                padding: 'clamp(12px, 1.5vw, 16px)',
                border: `2px solid ${activeField === 'nome' ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 'clamp(8px, 1vw, 12px)',
                outline: 'none',
                boxSizing: 'border-box',
                fontSize: 'clamp(14px, 1.8vw, 18px)',
                fontFamily: FONT,
                transition: 'border-color 0.2s',
                boxShadow: activeField === 'nome' ? '0 0 0 4px rgba(59,130,246,0.1)' : 'none'
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'clamp(10px, 1.2vw, 12px)',
                color: '#6b7280',
                fontWeight: 700,
                marginBottom: '6px',
                letterSpacing: '0.06em'
              }}
            >
              E-MAIL
            </label>
            <input
              type="text"
              placeholder="seu@email.com"
              value={email}
              onFocus={() => setActiveField('email')}
              readOnly
              style={{
                width: '100%',
                padding: 'clamp(12px, 1.5vw, 16px)',
                border: `2px solid ${activeField === 'email' ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 'clamp(8px, 1vw, 12px)',
                outline: 'none',
                boxSizing: 'border-box',
                fontSize: 'clamp(14px, 1.8vw, 18px)',
                fontFamily: FONT,
                transition: 'border-color 0.2s',
                boxShadow: activeField === 'email' ? '0 0 0 4px rgba(59,130,246,0.1)' : 'none'
              }}
            />
          </div>

          {error && (
            <div
              style={{
                color: '#dc2626',
                textAlign: 'center',
                fontWeight: 500,
                fontSize: 'clamp(12px, 1.4vw, 14px)',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                padding: 'clamp(8px, 1vw, 12px)',
                borderRadius: '10px'
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            style={{
              backgroundColor: canSubmit ? '#10b981' : '#d1d5db',
              color: 'white',
              padding: 'clamp(14px, 1.8vw, 20px)',
              borderRadius: 'clamp(8px, 1vw, 12px)',
              fontWeight: 700,
              border: 'none',
              fontSize: 'clamp(14px, 1.8vw, 20px)',
              cursor: canSubmit ? 'pointer' : 'default',
              fontFamily: FONT,
              letterSpacing: '0.02em',
              boxShadow: canSubmit ? '0 4px 14px rgba(16,185,129,0.4)' : 'none',
              transition: 'all 0.25s'
            }}
          >
            Começar Quiz! 🚀
          </button>

          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontFamily: FONT,
              fontSize: 'clamp(12px, 1.4vw, 15px)',
              padding: '4px'
            }}
          >
            Cancelar e Voltar
          </button>
        </div>
      </div>

      <VirtualKeyboard onKeyPress={updateField} />
    </div>
  )

}
