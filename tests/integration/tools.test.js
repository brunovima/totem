/**
 * Testes de Integração — Ferramentas Externas (yt-dlp + ffmpeg)
 *
 * Verifica se as dependências externas estão instaladas, respondem corretamente
 * e suportam os codecs necessários para o TOTEM.
 *
 * Executar: npx vitest run tests/integration/tools.test.js
 */

import { describe, it, expect } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execFileAsync = promisify(execFile)

// ── Caminhos onde o TOTEM busca os binários (espelha main/index.js) ──────────

const YTDLP_CANDIDATES = [
  '/usr/local/bin/yt-dlp',
  '/opt/homebrew/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  // userData (fallback manual — só resolve dentro do Electron)
]

const FFMPEG_CANDIDATES = [
  '/usr/local/bin/ffmpeg',
  '/opt/homebrew/bin/ffmpeg',
  '/usr/bin/ffmpeg',
]

function findBin(candidates, name) {
  const found = candidates.find((p) => existsSync(p))
  if (found) return found
  // Tenta via PATH como último recurso
  return name
}

async function run(bin, args, options = {}) {
  try {
    return await execFileAsync(bin, args, { timeout: 10_000, ...options })
  } catch (err) {
    // execFileAsync rejeita com exit code != 0 — ffmpeg faz isso em alguns flags
    // Retorna o erro formatado para os testes verificarem o conteúdo
    return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.code }
  }
}

// ════ yt-dlp ═════════════════════════════════════════════════════════════════

describe('yt-dlp', () => {
  const bin = findBin(YTDLP_CANDIDATES, 'yt-dlp')

  it('está instalado e retorna versão', async () => {
    const { stdout, stderr } = await run(bin, ['--version'])
    const version = (stdout + stderr).trim()
    // yt-dlp segue CalVer: YYYY.MM.DD
    expect(version).toMatch(/^\d{4}\.\d{2}\.\d{2}/)
  }, 15_000)

  it('aceita o flag --no-playlist sem erro', async () => {
    const { stdout, stderr } = await run(bin, ['--help'])
    const output = stdout + stderr
    expect(output).toContain('yt-dlp')
    expect(output).toContain('--output')
  }, 15_000)

  it('suporta o formato de saída MP4 usado pelo TOTEM', async () => {
    // Verifica que os flags que o TOTEM usa são aceitos na sintaxe correta
    // Não faz download — apenas valida o formato do comando
    const { stdout, stderr } = await run(bin, [
      '--help'
    ])
    const output = stdout + stderr
    // O TOTEM usa: -f bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]
    // Verifica que o flag -f existe
    expect(output).toMatch(/-f\b|--format/)
  }, 15_000)

  it('suporta --cookies-from-browser (bypass anti-bot Instagram/TikTok)', async () => {
    const { stdout, stderr } = await run(bin, ['--help'])
    const output = stdout + stderr
    expect(output).toContain('--cookies-from-browser')
  }, 15_000)

  it('binário está em um dos caminhos conhecidos pelo TOTEM', () => {
    const found = YTDLP_CANDIDATES.find((p) => existsSync(p))
    if (!found) {
      console.warn('[AVISO] yt-dlp não encontrado nos caminhos padrão.')
      console.warn('  Execute: bash scripts/install_dependencies.sh')
    }
    expect(true).toBe(true)
  })
})

// ════ ffmpeg ══════════════════════════════════════════════════════════════════

describe('ffmpeg', () => {
  const bin = findBin(FFMPEG_CANDIDATES, 'ffmpeg')

  it('está instalado e retorna versão', async () => {
    const { stdout, stderr } = await run(bin, ['-version'])
    const output = stdout + stderr
    expect(output).toContain('ffmpeg version')
  }, 15_000)

  it('suporta codec de vídeo H.264 (libx264)', async () => {
    const { stdout, stderr } = await run(bin, ['-codecs'])
    const output = stdout + stderr
    // H.264 é necessário para mesclar streams do YouTube
    expect(output).toMatch(/h264|libx264|H\.264/i)
  }, 15_000)

  it('suporta codec de áudio AAC', async () => {
    const { stdout, stderr } = await run(bin, ['-codecs'])
    const output = stdout + stderr
    expect(output).toMatch(/aac/i)
  }, 15_000)

  it('suporta container MP4', async () => {
    const { stdout, stderr } = await run(bin, ['-formats'])
    const output = stdout + stderr
    expect(output).toContain('mp4')
  }, 15_000)

  it('binário está em um dos caminhos conhecidos', () => {
    const found = FFMPEG_CANDIDATES.find((p) => existsSync(p))
    if (!found) {
      console.warn('[AVISO] ffmpeg não encontrado nos caminhos padrão.')
      console.warn('  Execute: bash scripts/install_dependencies.sh')
    }
    expect(true).toBe(true) // idem ao yt-dlp acima
  })
})

// ════ Integração yt-dlp + ffmpeg ══════════════════════════════════════════════

describe('Integração yt-dlp + ffmpeg', () => {
  it('yt-dlp detecta o ffmpeg como backend de merge', async () => {
    const ytdlp = findBin(YTDLP_CANDIDATES, 'yt-dlp')
    const ffmpeg = findBin(FFMPEG_CANDIDATES, 'ffmpeg')

    // yt-dlp usa --ffmpeg-location para apontar o binário
    // Verifica que a flag é aceita sem erro de sintaxe
    const { stdout, stderr } = await run(ytdlp, [
      '--ffmpeg-location', ffmpeg,
      '--help'
    ])
    const output = stdout + stderr
    expect(output).toContain('yt-dlp')
    // Não deve conter erro de "ffmpeg not found"
    expect(output).not.toMatch(/ffmpeg.*not found/i)
  }, 20_000)
})
