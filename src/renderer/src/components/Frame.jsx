import React from 'react'

function buildMediaUrl(filePath) {
  if (!filePath) return null
  const normalized = filePath.replace(/\\/g, '/')
  const withSlash = normalized.startsWith('/') ? normalized : '/' + normalized
  const encoded = withSlash.split('/').map(encodeURIComponent).join('/')
  return 'totem-media://' + encoded
}

const POSITIONS = {
  'top-right':    { top: 0, right: 0 },
  'top-left':     { top: 0, left: 0 },
  'bottom-right': { bottom: 0, right: 0 },
  'bottom-left':  { bottom: 0, left: 0 }
}

export default function Frame({ color = '#2563eb', width = 8, logoPath, logoPosition = 'top-right', logoSize = 80 }) {
  const pos = POSITIONS[logoPosition] || POSITIONS['top-right']

  // Padding do logo para não sobrepor a moldura
  const logoPadding = {
    top: pos.top !== undefined ? width + 12 : undefined,
    bottom: pos.bottom !== undefined ? width + 12 : undefined,
    left: pos.left !== undefined ? width + 12 : undefined,
    right: pos.right !== undefined ? width + 12 : undefined,
  }

  return (
    <>
      {/* Moldura via box-shadow inset — não afeta layout e passa clicks */}
      {width > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            boxShadow: `inset 0 0 0 ${width}px ${color}`,
            pointerEvents: 'none',
            zIndex: 9998
          }}
        />
      )}

      {/* Logo do evento */}
      {logoPath && buildMediaUrl(logoPath) && (
        <img
          src={buildMediaUrl(logoPath)}
          alt="Logo"
          style={{
            position: 'fixed',
            ...logoPadding,
            maxHeight: `${logoSize}px`,
            maxWidth: `${logoSize * 3}px`,
            objectFit: 'contain',
            pointerEvents: 'none',
            zIndex: 9999,
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))'
          }}
        />
      )}
    </>
  )
}
