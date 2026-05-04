import React, { useState, useEffect, useCallback } from 'react'
import { useIdleTimer } from './useIdleTimer.js'

const FONT = "'Roboto', sans-serif"

export default function QuizEngine({ onComplete }) {
  const [questions, setQuestions] = useState([])
  const [quizTitle, setQuizTitle] = useState('Quiz')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [shuffledOptions, setShuffledOptions] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [data, quizzes] = await Promise.all([
          window.api.getQuestions(),
          window.api.getQuizzes()
        ])
        setQuestions(data || [])
        const active = (quizzes || []).find((q) => q.active)
        if (active) setQuizTitle(active.title)
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!questions.length || !questions[currentQuestion]) return
    setSelected(null)
    const q = questions[currentQuestion]
    const withStatus = q.options.map((opt, i) => ({ text: opt, isCorrect: i === q.correctIndex }))
    const arr = [...withStatus]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    setShuffledOptions(arr)
  }, [currentQuestion, questions])

  const finish = useCallback(
    (finalScore) => onComplete({ score: finalScore, total: questions.length, quizTitle }),
    [questions.length, quizTitle, onComplete]
  )

  useIdleTimer(() => finish(score), 30000)

  const handleAnswer = (opt) => {
    if (selected !== null) return
    setSelected(opt.text)
    setTimeout(() => {
      const next = opt.isCorrect ? score + 1 : score
      if (currentQuestion + 1 < questions.length) {
        setScore(next)
        setCurrentQuestion(currentQuestion + 1)
      } else {
        finish(next)
      }
    }, 400)
  }

  if (loading)
    return (
      <div style={{ color: 'white', textAlign: 'center', marginTop: '20%', fontSize: 'clamp(18px, 3vw, 28px)', fontFamily: FONT }}>
        Carregando Desafio...
      </div>
    )

  if (!questions.length)
    return (
      <div style={{ color: 'white', textAlign: 'center', marginTop: '20%', fontFamily: FONT, fontSize: 'clamp(14px, 2vw, 20px)' }}>
        Aguardando configuração de perguntas no Admin.
      </div>
    )

  const progress = ((currentQuestion) / questions.length) * 100

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 'clamp(16px, 3vw, 40px)',
        fontFamily: FONT
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 'clamp(16px, 2vw, 28px)',
          width: '100%',
          maxWidth: 'min(800px, 90vw)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          overflow: 'hidden'
        }}
      >
        {/* Header com progresso */}
        <div style={{ padding: 'clamp(16px, 2.5vw, 32px)', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: 'clamp(12px, 1.5vw, 15px)', color: '#6b7280', fontWeight: 500, letterSpacing: '0.05em' }}>
              {quizTitle.toUpperCase()}
            </span>
            <span style={{ fontSize: 'clamp(13px, 1.5vw, 16px)', color: '#9ca3af', fontWeight: 500 }}>
              {currentQuestion + 1} / {questions.length}
            </span>
          </div>
          <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '100px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                borderRadius: '100px',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
        </div>

        {/* Pergunta */}
        <div style={{ padding: 'clamp(16px, 2.5vw, 32px)' }}>
          <h2
            style={{
              fontSize: 'clamp(18px, 2.8vw, 30px)',
              color: '#1f2937',
              marginBottom: 'clamp(20px, 3vw, 36px)',
              lineHeight: 1.4,
              fontWeight: 700,
              margin: '0 0 clamp(20px, 3vw, 36px)'
            }}
          >
            {questions[currentQuestion].text}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.2vw, 14px)' }}>
            {shuffledOptions.map((opt, i) => {
              const isSelected = selected === opt.text
              const isAnswered = selected !== null
              let bg = '#f9fafb'
              let border = '#e5e7eb'
              let color = '#1f2937'
              if (isSelected) {
                bg = opt.isCorrect ? '#dcfce7' : '#fee2e2'
                border = opt.isCorrect ? '#22c55e' : '#ef4444'
                color = opt.isCorrect ? '#166534' : '#991b1b'
              } else if (isAnswered && opt.isCorrect) {
                bg = '#dcfce7'; border = '#22c55e'; color = '#166534'
              }
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt)}
                  disabled={isAnswered}
                  style={{
                    padding: 'clamp(14px, 2vw, 22px) clamp(16px, 2vw, 24px)',
                    fontSize: 'clamp(14px, 1.8vw, 20px)',
                    borderRadius: 'clamp(8px, 1vw, 14px)',
                    border: `2px solid ${border}`,
                    cursor: isAnswered ? 'default' : 'pointer',
                    textAlign: 'left',
                    background: bg,
                    color,
                    transition: 'all 0.25s',
                    fontFamily: FONT,
                    fontWeight: 500,
                    lineHeight: 1.4,
                    boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  <span style={{ opacity: 0.5, marginRight: '10px', fontWeight: 700 }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt.text}
                </button>
              )
            })}
          </div>
        </div>
        {/* Footer NIT SECOM */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <span style={{ fontSize: '10px', color: '#cbd5e1', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: FONT }}>
            Desenvolvido por NIT SECOM
          </span>
        </div>
      </div>
    </div>
  )
}
