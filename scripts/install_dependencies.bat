@echo off
:: =============================================================================
:: TOTEM - Instalacao de Dependencias de Runtime (Windows)
::
:: QUANDO USAR: Execute UMA VEZ como Administrador na maquina do evento,
::              ANTES de instalar o aplicativo TOTEM.
::
:: O QUE INSTALA:
::   * Visual C++ 2022 Redistributable x64
::       - biblioteca de runtime C++ necessaria para o SQLite do TOTEM
::   * yt-dlp
::       - download de videos (YouTube, Instagram, TikTok)
::   * ffmpeg
::       - processamento de audio/video (exigido pelo yt-dlp)
::
:: PLATAFORMAS SUPORTADAS PELO YT-DLP:
::   YouTube, Instagram (posts/Reels publicos), TikTok (videos publicos)
::
:: NOTA: Videos privados ou contas fechadas exigem cookies.
::   Exportar cookies: yt-dlp --cookies-from-browser chrome -o video.mp4 <URL>
:: =============================================================================
setlocal EnableExtensions EnableDelayedExpansion

echo.
echo ================================================================
echo  TOTEM - Instalacao de Dependencias (Windows)
echo ================================================================
echo.

:: -- Verifica Administrador ---------------------------------------------------
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [ERRO] Execute como Administrador:
    echo        botao direito no arquivo .bat >> "Executar como administrador"
    echo.
    pause
    exit /b 1
)

:: -- Verifica winget ----------------------------------------------------------
where winget >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [AVISO] winget nao encontrado.
    echo         Baixe o App Installer em: https://aka.ms/getwinget
    echo         Apos instalar, execute este script novamente.
    echo.
    pause
    exit /b 1
)

set "TUDO_OK=1"

:: =============================================================================
:: 1. VISUAL C++ 2022 REDISTRIBUTABLE x64
::    Necessario para carregar better_sqlite3.node (banco de dados do TOTEM)
:: =============================================================================
echo.
echo [1/3] Verificando Visual C++ 2022 Redistributable...

reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Version >nul 2>&1
if %errorLevel% EQU 0 (
    for /f "tokens=3" %%V in ('reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Version 2^>nul') do (
        echo [OK] Visual C++ Redistributable ja instalado: %%V
        goto :ytdlp
    )
)

echo [TOTEM] Instalando Visual C++ 2022 Redistributable x64...
winget install --id Microsoft.VCRedist.2022.x64 --silent --accept-package-agreements --accept-source-agreements

if %errorLevel% EQU 0 (
    echo [OK] Visual C++ Redistributable instalado com sucesso.
) else (
    echo [AVISO] winget falhou. Baixando vc_redist.x64.exe diretamente...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "try { Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile '%TEMP%\vc_redist.x64.exe' -UseBasicParsing; Write-Host 'OK' } catch { Write-Host 'FALHOU'; exit 1 }"
    if %errorLevel% EQU 0 (
        "%TEMP%\vc_redist.x64.exe" /install /quiet /norestart
        echo [OK] Visual C++ Redistributable instalado via download direto.
    ) else (
        echo [ERRO] Nao foi possivel instalar o VC++ Redistributable.
        echo        Baixe manualmente: https://aka.ms/vs/17/release/vc_redist.x64.exe
        set "TUDO_OK=0"
    )
)

:ytdlp
:: =============================================================================
:: 2. YT-DLP
:: =============================================================================
echo.
echo [2/3] Verificando yt-dlp...

where yt-dlp >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] yt-dlp ja instalado. Verificando atualizacao...
    winget upgrade --id yt-dlp.yt-dlp --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
    echo [OK] yt-dlp atualizado.
    goto :ffmpeg
)

echo [TOTEM] Instalando yt-dlp via winget...
winget install --id yt-dlp.yt-dlp --silent --accept-package-agreements --accept-source-agreements

call :RefreshPath
where yt-dlp >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] yt-dlp instalado com sucesso.
    goto :ffmpeg
)

echo [AVISO] winget nao instalou yt-dlp. Baixando diretamente...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'C:\Windows\yt-dlp.exe' -UseBasicParsing; Write-Host 'OK' } catch { Write-Host 'FALHOU'; exit 1 }"
if %errorLevel% NEQ 0 (
    echo [ERRO] Nao foi possivel instalar yt-dlp automaticamente.
    echo        Instale manualmente: https://github.com/yt-dlp/yt-dlp/releases
    echo        Baixe "yt-dlp.exe" e copie para C:\Windows\
    set "TUDO_OK=0"
) else (
    echo [OK] yt-dlp baixado para C:\Windows\yt-dlp.exe
)

:ffmpeg
:: =============================================================================
:: 3. FFMPEG
:: =============================================================================
echo.
echo [3/3] Verificando ffmpeg...

where ffmpeg >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] ffmpeg ja instalado. Verificando atualizacao...
    winget upgrade --id Gyan.FFmpeg --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
    echo [OK] ffmpeg atualizado.
    goto :validacao
)

echo [TOTEM] Instalando ffmpeg via winget...
winget install --id Gyan.FFmpeg --silent --accept-package-agreements --accept-source-agreements

call :RefreshPath
where ffmpeg >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] ffmpeg instalado com sucesso.
    goto :validacao
)

echo [AVISO] ffmpeg nao encontrado apos instalacao.
echo         Instale manualmente: https://ffmpeg.org/download.html
echo         Adicione a pasta bin/ do ffmpeg ao PATH do sistema.
set "TUDO_OK=0"

:validacao
:: =============================================================================
:: VALIDACAO FINAL
:: =============================================================================
echo.
echo ================================================================
echo  Resultado:
echo ================================================================
echo.
call :RefreshPath

reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Version >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] Visual C++ Redistributable: instalado
) else (
    echo [AVISO] Visual C++ Redistributable: nao confirmado
    set "TUDO_OK=0"
)

where yt-dlp >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] yt-dlp: instalado
) else (
    echo [AVISO] yt-dlp: nao encontrado - Instagram/TikTok nao vao funcionar
    set "TUDO_OK=0"
)

where ffmpeg >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] ffmpeg: instalado
) else (
    echo [AVISO] ffmpeg: nao encontrado - download de videos pode falhar
    set "TUDO_OK=0"
)

echo.
if %TUDO_OK% EQU 1 (
    echo ================================================================
    echo  Tudo instalado com sucesso!
    echo  REINICIE O COMPUTADOR antes de abrir o TOTEM.
    echo ================================================================
) else (
    echo ================================================================
    echo  Instalacao concluida com avisos.
    echo  Veja os itens [AVISO] acima e instale manualmente se necessario.
    echo  REINICIE o computador e tente novamente.
    echo ================================================================
)
echo.
pause
endlocal
goto :eof

:RefreshPath
for /f "skip=2 tokens=3*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SysPATH=%%A %%B"
for /f "skip=2 tokens=3*" %%A in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "UserPATH=%%A %%B"
set "PATH=%SystemRoot%\system32;%SystemRoot%;%SysPATH%;%UserPATH%"
goto :eof
