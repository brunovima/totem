import React, { useState, useEffect } from 'react'
import VirtualKeyboard from './VirtualKeyboard.jsx'

const FONT = "'Roboto', sans-serif"

export default function LoginScreen({ onBack, onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [activeField, setActiveField] = useState('username')
  const [error, setError] = useState('')

  const updateField = (key) => {
    setError('')
    const apply = (prev) => (key === 'BACKSPACE' ? prev.slice(0, -1) : prev + key)
    if (activeField === 'username') setUsername(apply)
    else if (activeField === 'password') setPassword(apply)
  }

  const handleLogin = async () => {
    const [storedUser, storedPass] = await Promise.all([
      window.api.getSetting('admin_username'),
      window.api.getSetting('admin_password')
    ])
    const validUser = storedUser || 'admin'
    const validPass = storedPass || '1234'

    if (username !== validUser || password !== validPass) {
      setError('Usuário ou senha incorretos.')
      return
    }
    onLoginSuccess()
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Backspace') updateField('BACKSPACE')
      else if (e.key === 'Enter') handleLogin()
      else if (e.key === 'Tab') {
        e.preventDefault()
        setActiveField((f) => (f === 'username' ? 'password' : 'username'))
      } else if (e.key.length === 1) updateField(e.key)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeField, username, password])

  const fieldStyle = (field) => ({
    width: '100%',
    padding: 'clamp(12px, 1.5vw, 16px)',
    marginBottom: '14px',
    boxSizing: 'border-box',
    border: `2px solid ${activeField === field ? '#2563eb' : '#e5e7eb'}`,
    borderRadius: 'clamp(8px, 1vw, 12px)',
    outline: 'none',
    fontSize: 'clamp(14px, 1.6vw, 17px)',
    fontFamily: FONT,
    boxShadow: activeField === field ? '0 0 0 4px rgba(37,99,235,0.1)' : 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 'clamp(220px, 28vw, 360px)',
        fontFamily: FONT
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: 'clamp(28px, 4vw, 48px)',
          borderRadius: 'clamp(16px, 2vw, 24px)',
          width: 'min(400px, 90vw)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'clamp(20px, 3vw, 32px)' }}>
          <div style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: '10px' }}>🔐</div>
          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(18px, 2.5vw, 26px)',
              fontWeight: 700,
              color: '#1f2937'
            }}
          >
            Painel Gestor
          </h2>
          <p style={{ margin: '6px 0 0', color: '#9ca3af', fontSize: 'clamp(12px, 1.3vw, 14px)' }}>
            Acesso restrito a administradores
          </p>
        </div>

        <label style={{ display: 'block', fontSize: 'clamp(10px, 1.1vw, 12px)', fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', marginBottom: '6px' }}>
          USUÁRIO
        </label>
        <input
          type="text"
          value={username}
          onFocus={() => setActiveField('username')}
          inputMode="none"
          autoComplete="off"
          onChange={() => {}}
          placeholder="USUÁRIO"
          style={{ ...fieldStyle('username'), caretColor: '#2563eb' }}
        />

        <label style={{ display: 'block', fontSize: 'clamp(10px, 1.1vw, 12px)', fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', marginBottom: '6px' }}>
          SENHA
        </label>
        <input
          type="password"
          value={password}
          onFocus={() => setActiveField('password')}
          inputMode="none"
          autoComplete="off"
          onChange={() => {}}
          placeholder="Senha"
          style={{ ...fieldStyle('password'), marginBottom: error ? '14px' : '20px', caretColor: '#2563eb' }}
        />

        {error && (
          <div
            style={{
              color: '#dc2626',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              padding: 'clamp(8px, 1vw, 12px)',
              borderRadius: '10px',
              textAlign: 'center',
              fontSize: 'clamp(12px, 1.3vw, 14px)',
              marginBottom: '16px',
              fontWeight: 500
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            padding: 'clamp(12px, 1.5vw, 16px)',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 'clamp(8px, 1vw, 12px)',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 'clamp(14px, 1.6vw, 17px)',
            fontFamily: FONT,
            boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
            marginBottom: '10px'
          }}
        >
          Entrar
        </button>
        <button
          onClick={onBack}
          style={{
            width: '100%',
            padding: 'clamp(8px, 1vw, 12px)',
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            fontFamily: FONT,
            fontSize: 'clamp(12px, 1.3vw, 15px)',
            textDecoration: 'underline'
          }}
        >
          Voltar
        </button>
      </div>

      <VirtualKeyboard onKeyPress={updateField} />
    </div>
  )
}
