import React, { useState, useEffect, useCallback, useRef } from 'react'

function extractYouTubeId(url) {
  if (!url) return null
  const m =
    url.match(/[?&]v=([^&#]+)/) ||
    url.match(/youtu\.be\/([^?&#]+)/) ||
    url.match(/youtube\.com\/embed\/([^?&#]+)/) ||
    url.match(/youtube\.com\/shorts\/([^?&#]+)/)
  return m ? m[1] : null
}

function buildMediaUrl(source) {
  if (!source) return null
  if (!source.includes('/') && !source.includes('\\')) {
    return 'totem-media://media/' + encodeURIComponent(source)
  }
  const normalized = source.replace(/\\/g, '/')
  const withSlash  = normalized.startsWith('/') ? normalized : '/' + normalized
  const encoded    = withSlash.split('/').map(encodeURIComponent).join('/')
  return 'totem-media://' + encoded
}

// Reproduz YouTube via iframe com detecção de erro e timeout anti-tela-preta
function YouTubePlayer({ videoId, onFallback }) {
  const [iframeKey, setIframeKey] = useState(0)
  const retriesRef     = useRef(0)
  const loadTimeoutRef = useRef(null)
  const onFallbackRef  = useRef(onFallback)
  onFallbackRef.current = onFallback

  const MAX_RETRIES = 2

  const handleFailure = useCallback((fatal) => {
    clearTimeout(loadTimeoutRef.current)
    if (fatal || retriesRef.current >= MAX_RETRIES) {
      onFallbackRef.current?.()
    } else {
      retriesRef.current += 1
      setIframeKey((k) => k + 1)
    }
  }, [])

  useEffect(() => {
    function onMessage(ev) {
      if (!ev.origin.includes('youtube.com')) return
      let data
      try { data = JSON.parse(ev.data) } catch { return }
      if (data.event === 'onStateChange' && data.info === 1) clearTimeout(loadTimeoutRef.current)
      if (data.event === 'onError') {
        const fatal = data.info === 100 || data.info === 101 || data.info === 150
        handleFailure(fatal)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [handleFailure])

  useEffect(() => {
    loadTimeoutRef.current = setTimeout(() => handleFailure(false), 10_000)
    return () => clearTimeout(loadTimeoutRef.current)
  }, [iframeKey, handleFailure])

  if (!videoId) return null

  const src =
    `https://www.youtube.com/embed/${videoId}` +
    `?autoplay=1&mute=0&loop=1&playlist=${videoId}` +
    `&controls=0&rel=0&playsinline=1&enablejsapi=1`

  return (
    <iframe
      key={iframeKey}
      src={src}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
      allow="autoplay; fullscreen"
    />
  )
}

// Exibido quando não há mídia configurada ou tudo falhou
function NoMediaPlaceholder() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
      color: 'rgba(255,255,255,0.5)',
      fontFamily: "'Roboto', sans-serif",
      gap: '16px'
    }}>
      <div style={{ fontSize: 'clamp(48px, 8vw, 96px)' }}>📺</div>
      <p style={{ margin: 0, fontSize: 'clamp(14px, 2vw, 22px)', fontWeight: 500 }}>
        Nenhuma mídia na playlist
      </p>
      <p style={{ margin: 0, fontSize: 'clamp(11px, 1.4vw, 15px)', opacity: 0.6 }}>
        Adicione conteúdo no Painel Admin
      </p>
    </div>
  )
}

export default function VideoPlayer({ onStartQuiz, onAdminLogin }) {
  const [playlist, setPlaylist]           = useState([])
  const [idx, setIdx]                     = useState(0)
  const [loading, setLoading]             = useState(true)
  // ytValidation: null | 'checking' | {type:'embed'|'short'|'restricted'|'invalid', videoId?}
  const [ytValidation, setYtValidation]   = useState(null)
  // ytFallbackActive: YouTube runtime falhou → usar local_file como fallback
  const [ytFallbackActive, setYtFallback] = useState(false)
  // localFileStatus: { [mediaId]: true (existe) | false (não existe) | null (verificando) }
  const [localFileStatus, setLocalFileStatus] = useState({})
  // readyIdx: índice do item cujo primeiro frame já foi decodificado pelo GPU.
  // Derivar videoReady = (readyIdx === idx) garante reset SÍNCRONO no mesmo render
  // em que idx muda — sem esperar useEffect, eliminando o flash de tela preta.
  const [readyIdx, setReadyIdx]           = useState(-1)
  const videoReady = readyIdx === idx

  const loadPlaylist = useCallback(() => {
    window.api
      .getPlaylist()
      .then((items) => { setPlaylist(items || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadPlaylist()
    const t = setInterval(loadPlaylist, 60_000)
    return () => clearInterval(t)
  }, [loadPlaylist])

  useEffect(() => {
    if (playlist.length > 0 && idx >= playlist.length) setIdx(0)
  }, [playlist.length, idx])

  // Reseta estados derivados ao trocar de item
  // videoReady NÃO precisa de reset aqui — é derivado como (readyIdx === idx)
  useEffect(() => {
    setYtValidation(null)
    setYtFallback(false)
  }, [idx])

  const current = playlist.length > 0 ? playlist[idx] : null

  const handleNext = useCallback(() => {
    setIdx((i) => (playlist.length > 1 ? (i + 1) % playlist.length : i))
  }, [playlist.length])

  // Verifica se o arquivo local existe no disco antes de usar
  useEffect(() => {
    if (!current?.local_file) return
    if (localFileStatus[current.id] !== undefined) return
    // Marca como "verificando"
    setLocalFileStatus((prev) => ({ ...prev, [current.id]: null }))
    window.api.checkFileExists(current.local_file)
      .then((exists) => setLocalFileStatus((prev) => ({ ...prev, [current.id]: exists })))
      .catch(() => setLocalFileStatus((prev) => ({ ...prev, [current.id]: false })))
  }, [current?.id, current?.local_file])

  // localStatus: undefined=sem local_file | null=verificando | true=existe | false=ausente
  const localStatus = current?.local_file ? localFileStatus[current.id] : undefined

  // Instagram / TikTok — a playlist já só contém itens com download_status='done'
  // (filtrado no get-playlist). local_file sempre presente quando isSocial.
  const isSocial = current?.type === 'instagram' || current?.type === 'tiktok'

  // Cache local confirmado: YouTube com local_file ou social (sempre tem local_file)
  const hasLocalCache = ((current?.type === 'youtube') || isSocial) && localStatus === true

  // Refresca playlist quando download de social mídia conclui
  useEffect(() => {
    const unsub = window.api.onDownloadProgress?.((data) => {
      if (data.status === 'done') {
        // Força re-verificação do arquivo para o item atual
        setLocalFileStatus((prev) => {
          const next = { ...prev }
          delete next[data.id]
          return next
        })
        loadPlaylist()
      }
    })
    return () => unsub?.()
  }, [loadPlaylist])

  // Pipeline de validação YouTube — só corre para tipo youtube sem cache local
  useEffect(() => {
    if (!current || current.type !== 'youtube') return
    if (localStatus === true) return
    if (localStatus === null) return
    if (ytFallbackActive) return

    setYtValidation('checking')

    window.api.processYouTube(current.source)
      .then((result) => {
        if (result.type === 'short' || result.type === 'invalid' || result.type === 'restricted') {
          handleNext()
        } else {
          setYtValidation(result)
          if (!current.download_status) {
            window.api.startYoutubeDownload({ id: current.id, url: current.source }).catch(() => {})
          }
        }
      })
      .catch(() => {
        setYtValidation({ type: 'embed', videoId: extractYouTubeId(current.source) })
      })
  }, [idx, current?.id, current?.type, localStatus, ytFallbackActive])

  // Ao falhar no YouTube runtime: usa cache local se disponível; senão avança
  const handleYtFallback = useCallback(() => {
    if (current?.local_file && localStatus === true) {
      setYtFallback(true)
    } else {
      handleNext()
    }
  }, [current?.local_file, localStatus, handleNext])

  // Avanço automático para YouTube (iframe), imagens e páginas web
  useEffect(() => {
    if (!current) return
    if (current.type !== 'youtube' && current.type !== 'image' && current.type !== 'webpage') return
    if (current.type === 'youtube' && (hasLocalCache || ytFallbackActive)) return
    if (current.type === 'youtube' && ytValidation?.type !== 'embed') return
    const ms = (current.duration || 60) * 1000
    const t  = setTimeout(handleNext, ms)
    return () => clearTimeout(t)
  }, [idx, current?.id, current?.type, hasLocalCache, ytFallbackActive, ytValidation, handleNext])


  // ── Derivar estado de renderização ───────────────────────────────────────────
  const isCheckingLocal = (current?.type === 'youtube' || isSocial) &&
    current?.local_file && (localStatus === undefined || localStatus === null)
  const isYouTube = current?.type === 'youtube' && !hasLocalCache && !ytFallbackActive && ytValidation?.type === 'embed'
  const isVideo   = current?.type === 'file' ||
    (current?.type === 'youtube' && (hasLocalCache || ytFallbackActive)) ||
    (isSocial && localStatus === true)
  const isImage   = current?.type === 'image'
  const isWebpage = current?.type === 'webpage'

  const videoSource = isVideo
    ? (hasLocalCache || ytFallbackActive || isSocial ? current.local_file : current.source)
    : null
  const localSrc       = buildMediaUrl(videoSource)
  const imageSrc       = isImage ? buildMediaUrl(current.source) : null
  const youtubeVideoId = isYouTube ? (ytValidation?.videoId || extractYouTubeId(current.source)) : null

  // Gradient: sem mídia, carregando, verificando arquivo local, aguardando validação YT,
  // ou vídeo local não pronto no GPU
  const showGradient = !current || loading || isCheckingLocal ||
    (isVideo && !videoReady) ||
    (current?.type === 'youtube' && !hasLocalCache && !ytFallbackActive && ytValidation?.type !== 'embed')

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#000', overflow: 'hidden' }}>

      {/* Gradient animado: visível sem mídia ou durante validação */}
      {showGradient && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(270deg, #111827, #1e3a8a, #111827)',
          backgroundSize: '400% 400%',
          animation: 'gradientBG 10s ease infinite'
        }}>
          <style>{`
            @keyframes gradientBG {
              0%   { background-position: 0% 50%; }
              50%  { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>
        </div>
      )}

      {/* Placeholder quando playlist está vazia e não está carregando */}
      {!loading && !current && <NoMediaPlaceholder />}

      {/* YouTube via iframe oficial */}
      {isYouTube && youtubeVideoId && (
        <YouTubePlayer
          key={current.id}
          videoId={youtubeVideoId}
          onFallback={handleYtFallback}
        />
      )}

      {/* Vídeo local via totem-media:// */}
      {isVideo && localSrc && (
        <video
          key={current.id + (ytFallbackActive ? '_fb' : '')}
          src={localSrc}
          autoPlay
          loop={playlist.length === 1}
          muted={false}
          playsInline
          onCanPlay={() => setReadyIdx(idx)}
          onEnded={playlist.length > 1 ? handleNext : undefined}
          onError={handleNext}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', pointerEvents: 'none',
            // Camada de compositing dedicada no GPU — previne tela preta ao trocar mídia
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            willChange: 'transform',
            opacity: videoReady ? 1 : 0,
            transition: 'opacity 80ms linear'
          }}
        />
      )}

      {/* Imagem local via totem-media:// */}
      {isImage && imageSrc && (
        <img
          key={current.id}
          src={imageSrc}
          alt=""
          onError={handleNext}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
        />
      )}

      {/* Página web via webview */}
      {isWebpage && (
        <webview
          key={current.id}
          src={current.source}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      )}

      {/* Indicador de playlist */}
      {playlist.length > 1 && (
        <div style={{
          position: 'absolute', top: '20px', left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', gap: '6px',
          pointerEvents: 'none', zIndex: 10
        }}>
          {playlist.map((_, i) => (
            <div key={i} style={{
              width: i === idx ? '20px' : '8px', height: '8px',
              borderRadius: '4px',
              background: i === idx ? 'white' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.3s'
            }} />
          ))}
        </div>
      )}

      {/* Overlay de toque: captura eventos sem interferir na mídia */}
      <div
        onClick={onStartQuiz}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }}
      />

      {/* Zona invisível do botão admin (canto inferior direito) */}
      <div
        data-testid="admin-trigger"
        onClick={(e) => { e.stopPropagation(); onAdminLogin() }}
        style={{ position: 'absolute', bottom: 0, right: 0, width: '80px', height: '80px', zIndex: 20, cursor: 'pointer', opacity: 0 }}
      />
    </div>
  )
}
