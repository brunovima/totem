import React, { useState, useEffect } from 'react'
import VirtualKeyboard from './VirtualKeyboard.jsx'

const FONT = "'Roboto', sans-serif"

<<<<<<< HEAD
const COUNTRY_CODES = [
  { code: '+55',  label: '🇧🇷 +55  Brasil' },
  { code: '+1',   label: '🇺🇸 +1   EUA/Canadá' },
  { code: '+351', label: '🇵🇹 +351 Portugal' },
  { code: '+54',  label: '🇦🇷 +54  Argentina' },
  { code: '+56',  label: '🇨🇱 +56  Chile' },
  { code: '+57',  label: '🇨🇴 +57  Colômbia' },
  { code: '+598', label: '🇺🇾 +598 Uruguai' },
  { code: '+595', label: '🇵🇾 +595 Paraguai' },
  { code: '+34',  label: '🇪🇸 +34  Espanha' },
  { code: '+44',  label: '🇬🇧 +44  Reino Unido' },
  { code: '+49',  label: '🇩🇪 +49  Alemanha' },
  { code: '+33',  label: '🇫🇷 +33  França' },
  { code: '+39',  label: '🇮🇹 +39  Itália' },
  { code: '+81',  label: '🇯🇵 +81  Japão' },
  { code: '+86',  label: '🇨🇳 +86  China' },
  { code: 'outro', label: '✏️  Outro código...' },
]

function applyPhoneMask(digits, countryCode) {
  const d = digits.slice(0, 11)
  if (d.length === 0) return ''
  if (countryCode === '+55') {
    if (d.length <= 2)  return `(${d}`
    if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
  }
  return (d.match(/.{1,4}/g) || []).join(' ')
}

export default function LeadForm({ onConfirm, onCancel }) {
  const [nome,           setNome]           = useState('')
  const [telefoneDigits, setTelefoneDigits] = useState('')
  const [countryCode,    setCountryCode]    = useState('+55')
  const [customCode,     setCustomCode]     = useState('+')
  const [email,          setEmail]          = useState('')
  const [activeField,    setActiveField]    = useState('nome')
  const [error,          setError]          = useState('')
  const [consentChecked, setConsentChecked] = useState(true)

  const effectiveCode    = countryCode === 'outro' ? customCode : countryCode
  const telefoneFormatado = applyPhoneMask(telefoneDigits, effectiveCode)

  const updateField = (key) => {
    setError('')
    if (activeField === 'nome') {
      setNome((p) => key === 'BACKSPACE' ? p.slice(0, -1) : key.length > 1 ? p : p + key)
    } else if (activeField === 'telefone') {
      if (key === 'BACKSPACE') setTelefoneDigits((p) => p.slice(0, -1))
      else if (/^\d$/.test(key)) setTelefoneDigits((p) => p.length < 11 ? p + key : p)
    } else if (activeField === 'customCode') {
      if (key === 'BACKSPACE') setCustomCode((p) => p.length > 1 ? p.slice(0, -1) : '+')
      else if (/^\d$/.test(key)) setCustomCode((p) => p.length < 5 ? p + key : p)
    } else if (activeField === 'email') {
      setEmail((p) => key === 'BACKSPACE' ? p.slice(0, -1) : key.length > 1 ? p : p + key)
    }
  }

  const FIELDS = countryCode === 'outro'
    ? ['nome', 'telefone', 'customCode', 'email']
    : ['nome', 'telefone', 'email']

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Backspace')    { e.preventDefault(); updateField('BACKSPACE') }
      else if (e.key === 'Enter')   handleSubmit()
      else if (e.key === 'Tab')     {
        e.preventDefault()
        const idx = FIELDS.indexOf(activeField)
        setActiveField(FIELDS[(idx + 1) % FIELDS.length])
      }
      else if (e.key.length === 1)  updateField(e.key)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeField, nome, telefoneDigits, customCode, email, countryCode])

  const handleSubmit = () => {
    if (nome.trim().length < 3) { setError('Insira seu nome completo (mínimo 3 letras).'); return }
    if (countryCode === 'outro' && customCode.length < 2) { setError('Informe o código do país (ex: +351).'); return }
    if (telefoneDigits.length < 10) { setError('Informe um telefone válido com DDD (mínimo 10 dígitos).'); return }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('E-mail inválido. Corrija ou deixe em branco.'); return }
    onConfirm({
      nome:       nome.trim(),
      telefone:   `${effectiveCode} ${telefoneFormatado}`,
      email:      email.trim(),
      autorizado: consentChecked
    })
  }

  const codeValid    = countryCode !== 'outro' || customCode.length >= 2
  const canSubmit    = nome.trim().length >= 3 && telefoneDigits.length >= 10 && codeValid

  const isNumericKb  = activeField === 'telefone' || activeField === 'customCode'

  const fieldStyle = (field) => ({
    width: '100%',
    padding: 'clamp(12px, 1.5vw, 16px)',
    border: `2px solid ${activeField === field ? '#3b82f6' : '#e5e7eb'}`,
    borderRadius: 'clamp(8px, 1vw, 12px)',
    boxSizing: 'border-box',
    fontSize: 'clamp(14px, 1.8vw, 18px)',
    fontFamily: FONT,
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: activeField === field ? '0 0 0 4px rgba(59,130,246,0.1)' : 'none',
    background: 'white',
    caretColor: '#3b82f6'
  })

  const labelStyle = {
    display: 'block',
    fontSize: 'clamp(10px, 1.2vw, 12px)',
    color: '#6b7280',
    fontWeight: 700,
    marginBottom: '6px',
    letterSpacing: '0.06em'
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(16px, 3vw, 32px)',
      paddingBottom: 'clamp(220px, 28vw, 360px)',
      fontFamily: FONT
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: 'clamp(24px, 3.5vw, 44px)',
        borderRadius: 'clamp(16px, 2vw, 24px)',
        width: '100%', maxWidth: 'min(480px, 90vw)',
        marginBottom: 'clamp(16px, 2vw, 24px)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.55)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(20px, 3vw, 32px)' }}>
          <div style={{ fontSize: 'clamp(32px, 5vw, 52px)', marginBottom: '10px' }}>🎯</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(18px, 2.8vw, 28px)', fontWeight: 700, color: '#1f2937', lineHeight: 1.2 }}>
=======
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
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
            Identifique-se para Jogar
          </h2>
          <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 'clamp(12px, 1.5vw, 15px)' }}>
            Suas informações ficam guardadas com segurança
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 1.5vw, 18px)' }}>
<<<<<<< HEAD

          {/* ── Nome ── */}
          <div>
            <label style={labelStyle}>
              NOME COMPLETO <span style={{ color: '#ef4444' }}>*</span>
=======
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
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
            </label>
            <input
              type="text"
              placeholder="Digite seu nome..."
              value={nome}
<<<<<<< HEAD
              inputMode="none"
              autoComplete="off"
              onChange={() => {}}
              onFocus={() => setActiveField('nome')}
              style={fieldStyle('nome')}
            />
          </div>

          {/* ── Telefone ── */}
          <div>
            <label style={labelStyle}>
              TELEFONE <span style={{ color: '#ef4444' }}>*</span>
              <span style={{ marginLeft: '6px', fontWeight: 400, color: '#9ca3af', textTransform: 'none', fontSize: 'clamp(9px, 1vw, 11px)' }}>
                (DDD) XXXX-XXXX
              </span>
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Seletor de código do país */}
              <select
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value)
                  if (e.target.value === 'outro') setActiveField('customCode')
                  else setActiveField('telefone')
                }}
                onFocus={() => setActiveField('telefone')}
                style={{
                  padding: 'clamp(10px, 1.3vw, 14px) 6px',
                  border: `2px solid ${activeField === 'telefone' || activeField === 'customCode' ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: 'clamp(8px, 1vw, 12px)',
                  fontSize: 'clamp(12px, 1.4vw, 14px)',
                  fontFamily: FONT,
                  background: 'white', cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: activeField === 'telefone' || activeField === 'customCode' ? '0 0 0 4px rgba(59,130,246,0.1)' : 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
              >
                {COUNTRY_CODES.map(({ code, label }) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>

              {/* Campo código personalizado */}
              {countryCode === 'outro' && (
                <input
                  type="text"
                  placeholder="+000"
                  value={customCode}
                  inputMode="none"
                  autoComplete="off"
                  onChange={() => {}}
                  onFocus={() => setActiveField('customCode')}
                  style={{
                    ...fieldStyle('customCode'),
                    width: '90px', flex: 'none',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontSize: 'clamp(14px, 1.6vw, 16px)'
                  }}
                />
              )}

              {/* Input do número */}
              <input
                type="text"
                placeholder={effectiveCode === '+55' ? '(DD) XXXXX-XXXX' : 'Número'}
                value={telefoneFormatado}
                inputMode="none"
                autoComplete="off"
                onChange={() => {}}
                onFocus={() => setActiveField('telefone')}
                style={{ ...fieldStyle('telefone'), flex: 1, minWidth: '120px' }}
              />
            </div>
          </div>

          {/* ── E-mail (opcional) ── */}
          <div>
            <label style={labelStyle}>
              E-MAIL
              <span style={{ marginLeft: '6px', fontWeight: 400, color: '#9ca3af', textTransform: 'none', fontSize: 'clamp(9px, 1vw, 11px)' }}>
                (opcional)
              </span>
=======
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
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
            </label>
            <input
              type="text"
              placeholder="seu@email.com"
              value={email}
<<<<<<< HEAD
              inputMode="none"
              autoComplete="off"
              onChange={() => {}}
              onFocus={() => setActiveField('email')}
              style={fieldStyle('email')}
            />
          </div>

          {/* ── Consentimento LGPD ── */}
          <label style={{
            display: 'flex', gap: '10px', alignItems: 'flex-start',
            cursor: 'pointer', userSelect: 'none',
            padding: 'clamp(10px, 1.2vw, 14px)',
            borderRadius: 'clamp(8px, 1vw, 10px)',
            border: `1.5px solid ${consentChecked ? '#10b981' : '#e5e7eb'}`,
            background: consentChecked ? '#f0fdf4' : '#f9fafb',
            transition: 'all 0.2s'
          }}>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0, accentColor: '#10b981', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 'clamp(11px, 1.3vw, 13px)', color: '#374151', lineHeight: 1.5 }}>
              Autorizo o uso dos meus dados para informativos e serviços do Governo do Tocantins, em conformidade com a IN ATI nº 01/2026 e a{' '}
              <span
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.api.openExternal('https://central.to.gov.br/download/468528') }}
                style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
              >
                Política de Privacidade
              </span>
              .
            </span>
          </label>

          {/* ── Erro ── */}
          {error && (
            <div style={{
              color: '#dc2626', textAlign: 'center', fontWeight: 500,
              fontSize: 'clamp(12px, 1.4vw, 14px)',
              backgroundColor: '#fef2f2', border: '1px solid #fecaca',
              padding: 'clamp(8px, 1vw, 12px)', borderRadius: '10px'
            }}>
=======
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
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
              {error}
            </div>
          )}

<<<<<<< HEAD
          {/* ── Submit ── */}
=======
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
          <button
            onClick={handleSubmit}
            style={{
              backgroundColor: canSubmit ? '#10b981' : '#d1d5db',
<<<<<<< HEAD
              color: 'white', padding: 'clamp(14px, 1.8vw, 20px)',
              borderRadius: 'clamp(8px, 1vw, 12px)', fontWeight: 700,
              border: 'none', fontSize: 'clamp(14px, 1.8vw, 20px)',
              cursor: canSubmit ? 'pointer' : 'default', fontFamily: FONT,
=======
              color: 'white',
              padding: 'clamp(14px, 1.8vw, 20px)',
              borderRadius: 'clamp(8px, 1vw, 12px)',
              fontWeight: 700,
              border: 'none',
              fontSize: 'clamp(14px, 1.8vw, 20px)',
              cursor: canSubmit ? 'pointer' : 'default',
              fontFamily: FONT,
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
              letterSpacing: '0.02em',
              boxShadow: canSubmit ? '0 4px 14px rgba(16,185,129,0.4)' : 'none',
              transition: 'all 0.25s'
            }}
          >
<<<<<<< HEAD
            Começar Jogo! 🚀
          </button>

          <button onClick={onCancel} style={{
            background: 'none', border: 'none', color: '#9ca3af',
            textDecoration: 'underline', cursor: 'pointer',
            fontFamily: FONT, fontSize: 'clamp(12px, 1.4vw, 15px)', padding: '4px'
          }}>
=======
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
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
            Cancelar e Voltar
          </button>
        </div>
      </div>

<<<<<<< HEAD
      <VirtualKeyboard onKeyPress={updateField} numericMode={isNumericKb} />
    </div>
  )
=======
      <VirtualKeyboard onKeyPress={updateField} />
    </div>
  )

>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
}
