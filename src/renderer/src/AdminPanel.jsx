import React, { useState, useEffect } from 'react'

export default function AdminPanel({ onLogout }) {
  const [tab, setTab] = useState('quizzes')
  const [quizzes, setQuizzes] = useState([])
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const [questions, setQuestions] = useState([])

  const [quizTitle, setQuizTitle] = useState('')
  const [qText, setQText] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [correct, setCorrect] = useState(0)

  useEffect(() => {
    refreshData()
  }, [tab, selectedQuiz])

  const refreshData = async () => {
    try {
      if (tab === 'quizzes') setQuizzes((await window.api.getQuizzes()) || [])
      if (selectedQuiz) setQuestions((await window.api.getQuestions(selectedQuiz.id)) || [])
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveQuestion = async () => {
    await window.api.saveQuestion({
      quizId: selectedQuiz.id,
      text: qText,
      options: options.filter((o) => o !== ''),
      correctIndex: correct
    })
    setQText('')
    setOptions(['', ''])
    setCorrect(0)
    refreshData()
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#f1f5f9' }}>
      <aside style={{ width: '250px', background: '#0f172a', color: 'white', padding: '20px' }}>
        <h2>PAINEL</h2>
        <button
          onClick={() => {
            setTab('quizzes')
            setSelectedQuiz(null)
          }}
          style={{ width: '100%', margin: '10px 0', padding: '10px', cursor: 'pointer' }}
        >
          Quizzes
        </button>
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            marginTop: '50px',
            background: 'red',
            color: 'white',
            border: 'none',
            padding: '10px',
            cursor: 'pointer'
          }}
        >
          SAIR
        </button>
      </aside>

      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        {tab === 'quizzes' && !selectedQuiz && (
          <div>
            <h1>Quizzes</h1>
            <input
              autoFocus
              placeholder="Digite o nome do Quiz..."
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              style={{ padding: '10px', width: '300px', border: '2px solid #2563eb' }}
            />
            <button
              onClick={async () => {
                await window.api.createQuiz(quizTitle)
                setQuizTitle('')
                refreshData()
              }}
              style={{ padding: '10px', marginLeft: '5px', cursor: 'pointer' }}
            >
              Criar
            </button>
            <div style={{ marginTop: '20px' }}>
              {quizzes.map((q) => (
                <div
                  key={q.id}
                  style={{
                    background: '#fff',
                    padding: '10px',
                    marginBottom: '5px',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>{q.title}</span>
                  <button onClick={() => setSelectedQuiz(q)} style={{ cursor: 'pointer' }}>
                    Editar Perguntas
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedQuiz && (
          <div>
            <button onClick={() => setSelectedQuiz(null)} style={{ cursor: 'pointer' }}>
              ← Voltar
            </button>
            <h1>{selectedQuiz.title}</h1>
            <p>
              <strong>DICA:</strong> Marque a bolinha da resposta CORRETA.
            </p>
            <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
              <input
                autoFocus
                placeholder="Pergunta..."
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '20px',
                  border: '2px solid #2563eb'
                }}
              />
              {options.map((opt, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '10px',
                    alignItems: 'center'
                  }}
                >
                  <input
                    type="radio"
                    checked={correct === i}
                    onChange={() => setCorrect(i)}
                    name="correct"
                  />
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                    {correct === i ? 'CERTA' : 'ERRADA'}
                  </span>
                  <input
                    value={opt}
                    onChange={(e) => {
                      const n = [...options]
                      n[i] = e.target.value
                      setOptions(n)
                    }}
                    style={{ flex: 1, padding: '8px' }}
                  />
                </div>
              ))}
              <button onClick={() => setOptions([...options, ''])}>+ Opção</button>
              <button
                onClick={handleSaveQuestion}
                style={{
                  display: 'block',
                  marginTop: '20px',
                  padding: '10px 30px',
                  background: 'green',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                SALVAR PERGUNTA
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
