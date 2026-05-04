@echo off
:: =============================================================================
:: TOTEM — Gera pacote de distribuição para operadores de evento (Windows)
::
:: Uso: scripts\package_release.bat
::
:: Resultado:
::   release\TOTEM-v<versao>-windows.zip
::     TOTEM-<versao>-setup.exe
::     install_dependencies.bat
::     README.md
:: =============================================================================
setlocal EnableExtensions EnableDelayedExpansion

echo.
echo ============================================
echo  TOTEM - Gerador de Pacote de Release
echo ============================================
echo.

:: ── Vai para a raiz do projeto ────────────────────────────────────────────────
cd /d "%~dp0.."
set "ROOT_DIR=%CD%"

:: ── Lê versão do package.json via node ───────────────────────────────────────
for /f "delims=" %%V in ('node -p "require('./package.json').version"') do set "VERSION=%%V"
if "%VERSION%"=="" (
    echo [ERRO] Nao foi possivel ler a versao do package.json.
    pause & exit /b 1
)

set "PKG_NAME=TOTEM-v%VERSION%-windows"
set "PKG_DIR=%ROOT_DIR%\release\%PKG_NAME%"
set "ZIP_PATH=%ROOT_DIR%\release\%PKG_NAME%.zip"

echo [RELEASE] Versao detectada: %VERSION%
echo [RELEASE] Pacote: %PKG_NAME%.zip
echo.

:: ── Recompila better-sqlite3 para Electron (garante binario Windows valido) ───
echo [RELEASE] Recompilando better-sqlite3 para Electron Windows...
call npx electron-rebuild -f -w better-sqlite3 2>nul
if %errorLevel% NEQ 0 call npx electron-builder install-app-deps 2>nul
echo [RELEASE] Modulo nativo compilado.
echo.

:: ── Compila o codigo ──────────────────────────────────────────────────────────
echo [RELEASE] Compilando codigo React/Electron...
call npm run build
if %errorLevel% NEQ 0 (
    echo [ERRO] Falha na compilacao. Verifique os erros acima.
    pause & exit /b 1
)

:: ── Empacota para Windows ─────────────────────────────────────────────────────
echo.
echo [RELEASE] Empacotando para Windows...
call npm run build:win
if %errorLevel% NEQ 0 (
    echo [ERRO] Falha no empacotamento. Verifique os erros acima.
    pause & exit /b 1
)

:: ── Monta pasta de distribuição ───────────────────────────────────────────────
echo.
echo [RELEASE] Montando pasta de distribuicao...
if exist "%PKG_DIR%" rmdir /s /q "%PKG_DIR%"
mkdir "%PKG_DIR%"

:: Encontra o instalador .exe gerado
set "INSTALLER="
for /f "delims=" %%F in ('dir /b "%ROOT_DIR%\dist\*-setup.exe" 2^>nul') do set "INSTALLER=%%F"
if "%INSTALLER%"=="" (
    echo [ERRO] Nenhum *-setup.exe encontrado em dist\. O build falhou?
    pause & exit /b 1
)

copy "%ROOT_DIR%\dist\%INSTALLER%" "%PKG_DIR%\" >nul
echo [OK] Copiado: %INSTALLER%

copy "%ROOT_DIR%\scripts\install_dependencies.bat" "%PKG_DIR%\" >nul
echo [OK] Copiado: install_dependencies.bat

copy "%ROOT_DIR%\README.md" "%PKG_DIR%\" >nul
echo [OK] Copiado: README.md

:: ── Compacta com PowerShell (nativo no Windows 10+) ──────────────────────────
echo.
echo [RELEASE] Compactando para %PKG_NAME%.zip ...

if exist "%ZIP_PATH%" del /f /q "%ZIP_PATH%"

powershell -NoProfile -Command ^
  "Compress-Archive -Path '%PKG_DIR%\*' -DestinationPath '%ZIP_PATH%' -Force"

if %errorLevel% NEQ 0 (
    echo [ERRO] Falha ao criar o ZIP. Verifique se o PowerShell esta disponivel.
    pause & exit /b 1
)

:: Remove pasta temporária
rmdir /s /q "%PKG_DIR%"

:: Exibe tamanho do arquivo
for %%F in ("%ZIP_PATH%") do set "SIZE=%%~zF"
set /a SIZE_MB=%SIZE% / 1048576

echo.
echo ============================================
echo  Pacote gerado com sucesso!
echo  %ZIP_PATH%
echo  Tamanho: ~%SIZE_MB% MB
echo ============================================
echo.
pause
endlocal
