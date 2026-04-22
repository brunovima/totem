@echo off
:: =============================================================================
:: TOTEM — Script de instalação de dependências externas (Windows)
:: Execute UMA VEZ como Administrador na máquina hospedeira.
::
:: Dependências instaladas via winget:
::   • yt-dlp  — download de vídeos do YouTube como MP4 local
::   • ffmpeg  — mescla streams de áudio+vídeo (exigido pelo yt-dlp)
:: =============================================================================
setlocal EnableExtensions

echo.
echo ============================================
echo  TOTEM - Instalacao de Dependencias
echo ============================================
echo.

:: ── Verifica se está rodando como Administrador ───────────────────────────────
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [ERRO] Este script precisa ser executado como Administrador.
    echo        Clique com botao direito no arquivo .bat e escolha
    echo        "Executar como administrador".
    pause
    exit /b 1
)

:: ── Verifica winget ───────────────────────────────────────────────────────────
where winget >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [AVISO] winget nao encontrado. Instalando manualmente...
    echo         Baixe o App Installer em:
    echo         https://aka.ms/getwinget
    echo.
    echo         Apos instalar o winget, execute este script novamente.
    pause
    exit /b 1
)

:: ── Instala yt-dlp ────────────────────────────────────────────────────────────
echo [TOTEM] Instalando yt-dlp...
winget install --id yt-dlp.yt-dlp --silent --accept-package-agreements --accept-source-agreements
if %errorLevel% NEQ 0 (
    echo [AVISO] Falha ao instalar via winget. Tentando download direto...
    :: Fallback: download direto do binário
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'C:\Windows\yt-dlp.exe'"
    if %errorLevel% NEQ 0 (
        echo [ERRO] Nao foi possivel instalar yt-dlp. Instale manualmente:
        echo        https://github.com/yt-dlp/yt-dlp/releases
    ) else (
        echo [OK] yt-dlp instalado em C:\Windows\yt-dlp.exe
    )
) else (
    echo [OK] yt-dlp instalado com sucesso.
)

:: ── Instala ffmpeg ────────────────────────────────────────────────────────────
echo.
echo [TOTEM] Instalando ffmpeg...
winget install --id Gyan.FFmpeg --silent --accept-package-agreements --accept-source-agreements
if %errorLevel% NEQ 0 (
    echo [AVISO] Falha ao instalar ffmpeg via winget.
    echo         Instale manualmente em: https://ffmpeg.org/download.html
    echo         Adicione o bin/ do ffmpeg ao PATH do sistema.
) else (
    echo [OK] ffmpeg instalado com sucesso.
)

:: ── Atualiza PATH da sessão atual ─────────────────────────────────────────────
echo.
echo [TOTEM] Atualizando PATH do sistema...
:: Força o Windows a reler o PATH sem reiniciar
for /f "skip=2 tokens=3*" %%A in ('reg query HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment /v PATH 2^>nul') do (
    set "SysPATH=%%A %%B"
)
set "PATH=%PATH%;%SysPATH%"

:: ── Validação ─────────────────────────────────────────────────────────────────
echo.
echo [TOTEM] Verificando instalacoes...

where yt-dlp >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] yt-dlp encontrado no PATH.
) else (
    echo [AVISO] yt-dlp nao esta no PATH ainda. Reinicie o computador e tente novamente.
)

where ffmpeg >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] ffmpeg encontrado no PATH.
) else (
    echo [AVISO] ffmpeg nao esta no PATH. Adicione manualmente ou reinicie o computador.
)

echo.
echo ============================================
echo  Instalacao concluida!
echo  Reinicie o computador para garantir que
echo  o PATH seja atualizado corretamente.
echo ============================================
echo.
pause
endlocal
