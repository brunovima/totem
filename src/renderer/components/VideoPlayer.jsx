import React from 'react'

export default function VideoPlayer({ onTouch }) {
  return (
    <div
      onClick={onTouch}
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'black',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative'
      }}
    >
      {/* Usando um vídeo online temporário apenas para validar o player. 
          Na próxima fase, conectaremos isso ao SQLite e vídeos locais. */}
      <video
        src="https://www.w3schools.com/html/mov_bbb.mp4"
        autoPlay
        loop
        muted // Obrigatório para o autoplay funcionar sem bloqueios do navegador
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Call to Action na tela */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          width: '100%',
          textAlign: 'center',
          color: 'white',
          fontFamily: 'sans-serif',
          fontSize: '32px',
          fontWeight: 'bold',
          textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
          animation: 'pulse 2s infinite'
        }}
      >
        Toque na tela para acessar
      </div>
    </div>
  )
}
