import React, { useState, useEffect } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import VideoPlayer from './components/VideoPlayer.jsx'
import QuizEngine from './components/QuizEngine.jsx'
import LeadForm from './components/LeadForm.jsx'
import AdminPanel from './components/AdminPanel.jsx'
import ThankYou from './components/ThankYou.jsx'
import JogoMemoria from './components/JogoMemoria.jsx'
import SelecionarJogo from './components/SelecionarJogo.jsx'
import Frame from './components/Frame.jsx'

function App() {
  const [currentScreen, setCurrentScreen] = useState('video')
  const [currentLead, setCurrentLead] = useState(null)
  const [thankYouData, setThankYouData] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [blackout, setBlackout] = useState(false)
  const [frameSettings, setFrameSettings] = useState({
    color: '#2563eb',
    width: 8,
    logoPath: null,
    logoPosition: 'top-right',
    logoSize: 80
  })

  const loadFrameSettings = async () => {
    try {
      const [color, width, logoPath, logoPosition, logoSize] = await Promise.all([
        window.api.getSetting('border_color'),
        window.api.getSetting('border_width'),
        window.api.getSetting('logo_path'),
        window.api.getSetting('logo_position'),
        window.api.getSetting('logo_size')
      ])
      setFrameSettings({
        color: color || '#2563eb',
        width: parseInt(width) || 8,
        logoPath: logoPath || null,
        logoPosition: logoPosition || 'top-right',
        logoSize: parseInt(logoSize) || 80
      })
    } catch {}
  }

  useEffect(() => { loadFrameSettings() }, [])

  useEffect(() => {
    const off = window.api.onScreenBlackout((state) => setBlackout(state))
    return off
  }, [])

  if (isAdmin) {
    return (
      <AdminPanel
        onLogout={() => {
          setIsAdmin(false)
          setCurrentScreen('video')
          window.location.reload()
        }}
      />
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Moldura e logo sobrepostos em todas as telas públicas */}
      <Frame {...frameSettings} />

      {/* Blackout de energia: overlay preto full-screen com toque para acordar */}
      {blackout && !isAdmin && (
        <div
          onClick={() => setBlackout(false)}
          style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, cursor: 'pointer' }}
        />
      )}

      {currentScreen === 'video' && (
        <VideoPlayer
          onStartQuiz={() => setCurrentScreen('lead')}
          onAdminLogin={() => setCurrentScreen('login')}
        />
      )}

      {currentScreen === 'lead' && (
        <LeadForm
          onConfirm={async (data) => {
            setCurrentLead(data)
            try {
              const [quizzes, jogo] = await Promise.all([
                window.api.getQuizzes(),
                window.api.getJogoAtivo()
              ])
              const quizAtivo = quizzes?.some((q) => q.active)
              const jogoAtivo = jogo && jogo.imagens && jogo.imagens.length >= 8
              if (quizAtivo && jogoAtivo) {
                setCurrentScreen('selecionar-jogo')
              } else if (jogoAtivo) {
                setCurrentScreen('jogo-memoria')
              } else {
                setCurrentScreen('quiz')
              }
            } catch {
              setCurrentScreen('quiz')
            }
          }}
          onCancel={() => setCurrentScreen('video')}
        />
      )}

      {currentScreen === 'selecionar-jogo' && (
        <SelecionarJogo
          onSelectQuiz={() => setCurrentScreen('quiz')}
          onSelectMemoria={() => setCurrentScreen('jogo-memoria')}
          onCancel={() => { setCurrentLead(null); setCurrentScreen('video') }}
        />
      )}

      {currentScreen === 'quiz' && (
        <QuizEngine
          onComplete={async ({ score, total, quizTitle }) => {
            if (currentLead) await window.api.saveLead({ ...currentLead, score })
            setThankYouData({ nome: currentLead?.nome || '', quizTitle, score, total })
            setCurrentLead(null)
            setCurrentScreen('thankyou')
          }}
        />
      )}

      {currentScreen === 'jogo-memoria' && (
        <JogoMemoria
          logoPath={frameSettings.logoPath}
          onFinish={() => {
            setCurrentLead(null)
            setCurrentScreen('video')
          }}
        />
      )}

      {currentScreen === 'thankyou' && thankYouData && (
        <ThankYou
          {...thankYouData}
          onFinish={() => {
            setThankYouData(null)
            setCurrentScreen('video')
          }}
        />
      )}

      {currentScreen === 'login' && (
        <LoginScreen
          onBack={() => setCurrentScreen('video')}
          onLoginSuccess={() => setIsAdmin(true)}
        />
      )}
    </div>
  )
}

export default App
