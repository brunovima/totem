import React, { useState } from 'react'
import { Delete, ArrowUpCircle } from 'lucide-react'

const ROWS_MIN = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '´', '['],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç', '~', ']'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', ';', '/', '@']
]

const ROWS_MAX = [
  ['!', '@', '#', '$', '%', '¨', '&', '*', '(', ')', '_', '+'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '`', '{'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç', '^', '}'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', ':', '?', '@']
]

<<<<<<< HEAD
// Teclado numérico para campo de telefone
const NUMPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['',  '0', 'BACKSPACE']
]

function NumericKeyboard({ onKeyPress }) {
  return (
    <div className="kb-wrap">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', maxWidth: '340px', margin: '0 auto', padding: '0.25rem 0' }}>
        {NUMPAD.map((row, ri) =>
          row.map((key, ci) => {
            if (!key) return <div key={`empty-${ri}-${ci}`} />
            if (key === 'BACKSPACE') {
              return (
                <button
                  key="backspace"
                  className="kb-key kb-key-backspace"
                  style={{ padding: '1.1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.5rem' }}
                  onMouseDown={(e) => { e.preventDefault(); onKeyPress('BACKSPACE') }}
                  onTouchStart={(e) => { e.preventDefault(); onKeyPress('BACKSPACE') }}
                >
                  <Delete size="1.4em" />
                </button>
              )
            }
            return (
              <button
                key={key}
                className="kb-key"
                style={{ padding: '1.1rem 0', fontSize: 'clamp(1.1rem, 2.5vw, 1.6rem)', fontWeight: 700, borderRadius: '0.5rem' }}
                onMouseDown={(e) => { e.preventDefault(); onKeyPress(key) }}
                onTouchStart={(e) => { e.preventDefault(); onKeyPress(key) }}
              >
                {key}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function VirtualKeyboard({ onKeyPress, numericMode = false }) {
  const [shift, setShift] = useState(false)
  const rows = shift ? ROWS_MAX : ROWS_MIN

  if (numericMode) {
    return (
      <>
        <style>{`
          @keyframes kbSlideUp {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
          .kb-wrap {
            position: fixed; bottom: 0; left: 0; width: 100%;
            background: #0f172a;
            border-top: 1px solid #1e293b;
            padding: 0.7rem 0.75rem 1rem;
            animation: kbSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 200;
            box-shadow: 0 -8px 32px rgba(0,0,0,0.6);
            box-sizing: border-box;
          }
          .kb-key {
            background: #1e293b; color: #e2e8f0;
            border: 1px solid #334155; border-radius: 0.4rem;
            padding: 0.7rem 0;
            font-size: clamp(0.75rem, 1.5vw, 1.05rem);
            font-family: 'Roboto', sans-serif; font-weight: 500;
            cursor: pointer; user-select: none;
            transition: background 0.08s, transform 0.08s;
            line-height: 1; text-align: center;
            -webkit-tap-highlight-color: transparent;
          }
          .kb-key:active { background: #334155; transform: scale(0.93); }
          .kb-key-backspace { background: #450a0a; border-color: #7f1d1d; display: flex; align-items: center; justify-content: center; }
          .kb-key-backspace:active { background: #7f1d1d; }
        `}</style>
        <NumericKeyboard onKeyPress={onKeyPress} />
      </>
    )
  }

=======
export default function VirtualKeyboard({ onKeyPress }) {
  const [shift, setShift] = useState(false)
  const rows = shift ? ROWS_MAX : ROWS_MIN

>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
  return (
    <>
      <style>{`
        @keyframes kbSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .kb-wrap {
<<<<<<< HEAD
          position: fixed; bottom: 0; left: 0; width: 100%;
=======
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
          background: #0f172a;
          border-top: 1px solid #1e293b;
          padding: 0.5rem 0.75rem 0.9rem;
          animation: kbSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 200;
          box-shadow: 0 -8px 32px rgba(0,0,0,0.6);
          box-sizing: border-box;
        }
<<<<<<< HEAD
        .kb-rows { display: flex; flex-direction: column; gap: 0.35rem; }
        .kb-row { display: grid; gap: 0.3rem; }
        .kb-row-alpha { grid-template-columns: repeat(12, 1fr); }
        .kb-row-special { grid-template-columns: 1.6fr repeat(12, 1fr) 1.6fr; }
        .kb-row-space { display: flex; justify-content: center; gap: 0.3rem; margin-top: 0.1rem; }
        .kb-key {
          background: #1e293b; color: #e2e8f0;
          border: 1px solid #334155; border-radius: 0.4rem;
          padding: 0.7rem 0;
          font-size: clamp(0.75rem, 1.5vw, 1.05rem);
          font-family: 'Roboto', sans-serif; font-weight: 500;
          cursor: pointer; user-select: none;
          transition: background 0.08s, transform 0.08s, box-shadow 0.08s;
          line-height: 1; text-align: center;
          -webkit-tap-highlight-color: transparent;
        }
        .kb-key:active { background: #334155; transform: scale(0.93); box-shadow: none; }
        .kb-key-shift { background: #1e3a5f; display: flex; align-items: center; justify-content: center; }
        .kb-key-shift.active { background: #2563eb; border-color: #3b82f6; }
        .kb-key-backspace { background: #450a0a; border-color: #7f1d1d; display: flex; align-items: center; justify-content: center; }
        .kb-key-backspace:active { background: #7f1d1d; }
        .kb-key-space { width: 55%; padding: 0.7rem 0; letter-spacing: 0.08em; font-size: clamp(0.7rem, 1.3vw, 0.95rem); }
=======
        .kb-rows {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .kb-row {
          display: grid;
          gap: 0.3rem;
        }
        .kb-row-alpha {
          grid-template-columns: repeat(12, 1fr);
        }
        .kb-row-special {
          grid-template-columns: 1.6fr repeat(12, 1fr) 1.6fr;
        }
        .kb-row-space {
          display: flex;
          justify-content: center;
          gap: 0.3rem;
          margin-top: 0.1rem;
        }
        .kb-key {
          background: #1e293b;
          color: #e2e8f0;
          border: 1px solid #334155;
          border-radius: 0.4rem;
          padding: 0.7rem 0;
          font-size: clamp(0.75rem, 1.5vw, 1.05rem);
          font-family: 'Roboto', sans-serif;
          font-weight: 500;
          cursor: pointer;
          user-select: none;
          transition: background 0.08s, transform 0.08s, box-shadow 0.08s;
          line-height: 1;
          text-align: center;
          -webkit-tap-highlight-color: transparent;
        }
        .kb-key:active {
          background: #334155;
          transform: scale(0.93);
          box-shadow: none;
        }
        .kb-key-shift {
          background: #1e3a5f;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .kb-key-shift.active {
          background: #2563eb;
          border-color: #3b82f6;
        }
        .kb-key-backspace {
          background: #450a0a;
          border-color: #7f1d1d;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .kb-key-backspace:active {
          background: #7f1d1d;
        }
        .kb-key-space {
          width: 55%;
          padding: 0.7rem 0;
          letter-spacing: 0.08em;
          font-size: clamp(0.7rem, 1.3vw, 0.95rem);
        }
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
      `}</style>

      <div className="kb-wrap">
        <div className="kb-rows">
          {rows.map((row, ri) => (
            ri < 3 ? (
<<<<<<< HEAD
              <div key={ri} className="kb-row kb-row-alpha">
                {row.map((key) => (
                  <button key={key} className="kb-key"
                    onMouseDown={(e) => { e.preventDefault(); onKeyPress(key) }}
                    onTouchStart={(e) => { e.preventDefault(); onKeyPress(key) }}
                  >{key}</button>
                ))}
              </div>
            ) : (
=======
              // Linhas 0-2: 12 teclas regulares
              <div key={ri} className="kb-row kb-row-alpha">
                {row.map((key) => (
                  <button
                    key={key}
                    className="kb-key"
                    onMouseDown={(e) => { e.preventDefault(); onKeyPress(key) }}
                    onTouchStart={(e) => { e.preventDefault(); onKeyPress(key) }}
                  >
                    {key}
                  </button>
                ))}
              </div>
            ) : (
              // Linha 3: Shift + 12 teclas + Backspace
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
              <div key={ri} className="kb-row kb-row-special">
                <button
                  className={`kb-key kb-key-shift${shift ? ' active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); setShift((s) => !s) }}
                  onTouchStart={(e) => { e.preventDefault(); setShift((s) => !s) }}
                >
                  <ArrowUpCircle size="1.25em" />
                </button>
<<<<<<< HEAD
                {row.map((key) => (
                  <button key={key} className="kb-key"
                    onMouseDown={(e) => { e.preventDefault(); onKeyPress(key) }}
                    onTouchStart={(e) => { e.preventDefault(); onKeyPress(key) }}
                  >{key}</button>
                ))}
                <button className="kb-key kb-key-backspace"
=======

                {row.map((key) => (
                  <button
                    key={key}
                    className="kb-key"
                    onMouseDown={(e) => { e.preventDefault(); onKeyPress(key) }}
                    onTouchStart={(e) => { e.preventDefault(); onKeyPress(key) }}
                  >
                    {key}
                  </button>
                ))}

                <button
                  className="kb-key kb-key-backspace"
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
                  onMouseDown={(e) => { e.preventDefault(); onKeyPress('BACKSPACE') }}
                  onTouchStart={(e) => { e.preventDefault(); onKeyPress('BACKSPACE') }}
                >
                  <Delete size="1.25em" />
                </button>
              </div>
            )
          ))}
<<<<<<< HEAD
          <div className="kb-row-space">
            <button className="kb-key kb-key-space"
              onMouseDown={(e) => { e.preventDefault(); onKeyPress(' ') }}
              onTouchStart={(e) => { e.preventDefault(); onKeyPress(' ') }}
            >Espaço</button>
=======

          {/* Barra de espaço */}
          <div className="kb-row-space">
            <button
              className="kb-key kb-key-space"
              onMouseDown={(e) => { e.preventDefault(); onKeyPress(' ') }}
              onTouchStart={(e) => { e.preventDefault(); onKeyPress(' ') }}
            >
              Espaço
            </button>
>>>>>>> 70b3ade9e3306c6ba50e2067d5b996b9ebceb618
          </div>
        </div>
      </div>
    </>
  )
}
