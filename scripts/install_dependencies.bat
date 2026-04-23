@echo off
:: =============================================================================
:: TOTEM — Script de instalação de dependências externas (Windows)
:: Execute UMA VEZ como Administrador na máquina hospedeira.
::
:: Dependências instaladas via winget:
::   • yt-dlp  — download de vídeos do YouTube, Instagram e TikTok como MP4 local
::   • ffmpeg  — mescla streams de áudio+vídeo (exigido pelo yt-dlp)
::
:: Plataformas suportadas pelo yt-dlp:
::   YouTube, Instagram (posts/Reels/IGTV publicos), TikTok (videos publicos)
::
:: NOTA Instagram: videos privados ou de contas fechadas exigem cookies.
::   Para exportar cookies: yt-dlp --cookies-from-browser chrome -o video.mp4 <URL>
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
    echo [AVISO] winget nao encontrado.
    echo         Baixe o App Installer em:
    echo         https://aka.ms/getwinget
    echo.
    echo         Apos instalar o winget, execute este script novamente.
    pause
    exit /b 1
)

:: ── Instala yt-dlp ────────────────────────────────────────────────────────────
echo [TOTEM] Verificando yt-dlp...

:: Verifica se já está no PATH (pode estar atualizado mesmo com winget falhando)
where yt-dlp >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] yt-dlp ja esta instalado. Verificando atualizacao...
    winget upgrade --id yt-dlp.yt-dlp --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
    echo [OK] yt-dlp esta na versao mais recente.
    goto :ffmpeg
)

:: Não está no PATH — instala via winget
echo [TOTEM] Instalando yt-dlp via winget...
winget install --id yt-dlp.yt-dlp --silent --accept-package-agreements --accept-source-agreements >nul 2>&1

:: Verifica se instalou (o exit code do winget não é confiável para "já instalado")
call :RefreshPath
where yt-dlp >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] yt-dlp instalado com sucesso.
    goto :ffmpeg
)

:: winget falhou — tenta download direto como fallback
echo [AVISO] winget nao instalou. Baixando yt-dlp diretamente...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'C:\Windows\yt-dlp.exe' -UseBasicParsing; Write-Host 'OK' } catch { Write-Host 'FALHOU'; exit 1 }"
if %errorLevel% NEQ 0 (
    echo [ERRO] Nao foi possivel instalar yt-dlp automaticamente.
    echo        Instale manualmente em: https://github.com/yt-dlp/yt-dlp/releases
    echo        Baixe "yt-dlp.exe" e copie para C:\Windows\
) else (
    echo [OK] yt-dlp baixado para C:\Windows\yt-dlp.exe
)

:ffmpeg
:: ── Instala ffmpeg ────────────────────────────────────────────────────────────
echo.
echo [TOTEM] Verificando ffmpeg...

:: Verifica se já está no PATH
where ffmpeg >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] ffmpeg ja esta instalado. Verificando atualizacao...
    winget upgrade --id Gyan.FFmpeg --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
    echo [OK] ffmpeg esta na versao mais recente.
    goto :validacao
)

:: Não está no PATH — instala via winget
echo [TOTEM] Instalando ffmpeg via winget...
winget install --id Gyan.FFmpeg --silent --accept-package-agreements --accept-source-agreements >nul 2>&1

:: Verifica se instalou
call :RefreshPath
where ffmpeg >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] ffmpeg instalado com sucesso.
    goto :validacao
)

echo [AVISO] ffmpeg nao encontrado apos instalacao via winget.
echo         Instale manualmente em: https://ffmpeg.org/download.html
echo         Adicione a pasta bin/ do ffmpeg ao PATH do sistema.

:validacao
:: ── Atualiza PATH da sessão e valida ──────────────────────────────────────────
echo.
echo [TOTEM] Atualizando PATH do sistema...
call :RefreshPath

echo.
echo [TOTEM] Verificando instalacoes...

set TUDO_OK=1

where yt-dlp >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] yt-dlp encontrado no PATH.
) else (
    echo [AVISO] yt-dlp nao esta no PATH. Reinicie o computador e tente novamente.
    set TUDO_OK=0
)

where ffmpeg >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] ffmpeg encontrado no PATH.
) else (
    echo [AVISO] ffmpeg nao esta no PATH. Adicione manualmente ou reinicie o computador.
    set TUDO_OK=0
)

echo.
if %TUDO_OK% EQU 1 (
    echo ============================================
    echo  Instalacao concluida! Tudo pronto.
    echo  Reinicie o computador para garantir que
    echo  o PATH seja atualizado em todas as janelas.
    echo ============================================
) else (
    echo ============================================
    echo  Instalacao concluida com avisos.
    echo  Consulte as mensagens acima e instale
    echo  manualmente os pacotes com [AVISO].
    echo  Reinicie o computador apos instalar.
    echo ============================================
)
echo.
pause
endlocal
goto :eof

:: ── Sub-rotina: recarrega PATH da sessão sem reiniciar ────────────────────────
:RefreshPath
for /f "skip=2 tokens=3*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SysPATH=%%A %%B"
for /f "skip=2 tokens=3*" %%A in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "UserPATH=%%A %%B"
set "PATH=%SystemRoot%\system32;%SystemRoot%;%SysPATH%;%UserPATH%"
goto :eof
