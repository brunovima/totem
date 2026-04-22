import React, { useState } from 'react'
import VirtualKeyboard from './VirtualKeyboard.jsx'

export default function LeadForm({ onConfirm, onCancel }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [activeField, setActiveField] = useState('nome')

  const handleKeyPress = (key) => {
    const update = (prev) => (key === 'BACKSPACE' ? prev.slice(0, -1) : prev + key)
    if (activeField === 'nome') setNome(update)
    else setEmail(update)
  }

  const handleSubmit = () => {
    if (nome.length > 2 && email.includes('@')) {
      onConfirm({ nome, email })
    } else {
      alert('Por favor, preencha nome e e-mail corretamente.')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#111827',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'sans-serif'
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '450px',
          marginBottom: '20px'
        }}
      >
        <h2 style={{ textAlign: 'center', color: '#1f2937', marginBottom: '24px' }}>
          Identifique-se para Jogar
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            type="text"
            placeholder="Seu Nome"
            value={nome}
            onFocus={() => setActiveField('nome')}
            readOnly
            style={{
              width: '100%',
              padding: '15px',
              border: activeField === 'nome' ? '2px solid #3b82f6' : '1px solid #ddd',
              borderRadius: '8px'
            }}
          />
          <input
            type="text"
            placeholder="Seu E-mail"
            value={email}
            onFocus={() => setActiveField('email')}
            readOnly
            style={{
              width: '100%',
              padding: '15px',
              border: activeField === 'email' ? '2px solid #3b82f6' : '1px solid #ddd',
              borderRadius: '8px'
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '15px',
              borderRadius: '8px',
              fontWeight: 'bold',
              border: 'none',
              fontSize: '18px'
            }}
          >
            Começar Quiz!
          </button>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              textDecoration: 'underline'
            }}
          >
            Voltar
          </button>
        </div>
      </div>
      <VirtualKeyboard onKeyPress={handleKeyPress} />
    </div>
  )
}
