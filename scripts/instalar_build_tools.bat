@echo off
:: =============================================================================
:: TOTEM - Instalador de Pre-requisitos de Desenvolvimento (Windows)
::
:: QUANDO USAR: Primeira vez configurando a maquina para BUILDAR o TOTEM.
::              Nao e necessario na maquina do operador/evento.
::
:: O QUE INSTALA:
::   * Node.js 20 LTS          - runtime JavaScript / npm
::   * Python 3.11             - necessario para o node-gyp compilar modulos nativos
::   * Visual Studio Build     - compilador C++ para better-sqlite3
::     Tools 2022 (C++ Tools)
::   * Git for Windows         - controle de versao
::
:: TEMPO ESTIMADO: 15-30 minutos (depende da conexao)
:: ESPACO EM DISCO: ~5 GB
::
:: IMPORTANTE: Execute como Administrador.
::             Reinicie o computador ao final.
:: =============================================================================
setlocal EnableExtensions EnableDelayedExpansion

echo.
echo ================================================================
echo  TOTEM - Instalador de Pre-requisitos de Build (Windows)
echo ================================================================
echo.
echo  Este script instala tudo necessario para compilar o TOTEM.
echo  Nao e necessario nas maquinas dos operadores de evento.
echo.
echo  Pre-requisito: conexao com a internet.
echo  Tempo estimado: 15 a 30 minutos.
echo.
pause

:: -- Verifica se esta rodando como Administrador --------------------------------
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo.
    echo [ERRO] Este script precisa ser executado como Administrador.
    echo        Clique com botao direito no arquivo .bat
    echo        e escolha "Executar como administrador".
    echo.
    pause
    exit /b 1
)

:: -- Verifica winget -----------------------------------------------------------
where winget >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [ERRO] winget nao encontrado.
    echo.
    echo  Instale o "App Installer" pela Microsoft Store ou acesse:
    echo  https://aka.ms/getwinget
    echo.
    pause
    exit /b 1
)

set "ERROS=0"

:: ==============================================================================
:: 1. NODE.JS 20 LTS
:: ==============================================================================
echo.
echo [1/4] Verificando Node.js...
where node >nul 2>&1
if %errorLevel% EQU 0 (
    for /f "delims=" %%V in ('node --version 2^>nul') do set "NODE_VER=%%V"
    echo [OK] Node.js ja instalado: !NODE_VER!
    goto :python
)

echo [TOTEM] Instalando Node.js 20 LTS...
winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
if %errorLevel% NEQ 0 (
    echo [AVISO] winget falhou para Node.js. Baixando instalador direto...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.19.2/node-v20.19.2-x64.msi' -OutFile '%TEMP%\node-installer.msi' -UseBasicParsing"
    msiexec /i "%TEMP%\node-installer.msi" /quiet /norestart
)

call :RefreshPath
where node >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [AVISO] Node.js nao apareceu no PATH ainda.
    echo         Reinicie o computador e continue a partir do Passo 2.
    set "ERROS=1"
) else (
    for /f "delims=" %%V in ('node --version') do echo [OK] Node.js instalado: %%V
)

:python
:: ==============================================================================
:: 2. PYTHON 3.11 (node-gyp)
:: ==============================================================================
echo.
echo [2/4] Verificando Python 3.11...
where python >nul 2>&1
if %errorLevel% EQU 0 (
    for /f "delims=" %%V in ('python --version 2^>nul') do set "PY_VER=%%V"
    echo [OK] Python ja instalado: !PY_VER!
    goto :buildtools
)

echo [TOTEM] Instalando Python 3.11...
winget install --id Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
if %errorLevel% NEQ 0 (
    echo [AVISO] winget falhou para Python. Baixando instalador direto...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe' -OutFile '%TEMP%\python-installer.exe' -UseBasicParsing"
    "%TEMP%\python-installer.exe" /quiet InstallAllUsers=1 PrependPath=1
)

call :RefreshPath
where python >nul 2>&1
if %errorLevel% EQU 0 (
    for /f "delims=" %%V in ('python --version') do echo [OK] Python instalado: %%V
) else (
    echo [AVISO] Python nao apareceu no PATH. Reinicie e verifique.
    set "ERROS=1"
)

:buildtools
:: ==============================================================================
:: 3. VISUAL STUDIO BUILD TOOLS 2022 (compilador C++)
:: ==============================================================================
echo.
echo [3/4] Verificando Visual Studio Build Tools...

:: Verifica via vswhere
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "!VSWHERE!" (
    for /f "delims=" %%P in ('"!VSWHERE!" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul') do (
        if not "%%P"=="" (
            echo [OK] Visual Studio Build Tools ja instalado em: %%P
            goto :git
        )
    )
)

echo [TOTEM] Instalando Visual Studio Build Tools 2022 (C++ workload)...
echo         Isso pode demorar 10 a 20 minutos...
winget install --id Microsoft.VisualStudio.2022.BuildTools ^
    --silent --accept-package-agreements --accept-source-agreements ^
    --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet --wait"

if %errorLevel% NEQ 0 (
    echo [AVISO] winget pode ter tido um problema. Verificando instalacao...
)

if exist "!VSWHERE!" (
    for /f "delims=" %%P in ('"!VSWHERE!" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul') do (
        if not "%%P"=="" (
            echo [OK] Visual Studio Build Tools instalado com sucesso.
            goto :git
        )
    )
)
echo [AVISO] Build Tools pode precisar de reinicializacao para ser detectado.

:git
:: ==============================================================================
:: 4. GIT FOR WINDOWS
:: ==============================================================================
echo.
echo [4/4] Verificando Git...
where git >nul 2>&1
if %errorLevel% EQU 0 (
    for /f "delims=" %%V in ('git --version 2^>nul') do echo [OK] Git ja instalado: %%V
    goto :final
)

echo [TOTEM] Instalando Git for Windows...
winget install --id Git.Git --silent --accept-package-agreements --accept-source-agreements

call :RefreshPath
where git >nul 2>&1
if %errorLevel% EQU 0 (
    for /f "delims=" %%V in ('git --version') do echo [OK] Git instalado: %%V
) else (
    echo [AVISO] Git nao apareceu no PATH ainda. Reinicie e verifique.
)

:final
:: ==============================================================================
:: RESULTADO FINAL
:: ==============================================================================
echo.
echo ================================================================
if !ERROS! EQU 0 (
    echo  Instalacao concluida!
) else (
    echo  Instalacao concluida com avisos - veja mensagens acima.
)
echo ================================================================
echo.
echo  PROXIMOS PASSOS:
echo.
echo  1. REINICIE O COMPUTADOR (obrigatorio para PATH e compilador)
echo.
echo  2. Apos reiniciar, abra o CMD na pasta do projeto e execute:
echo       npm install
echo.
echo  3. Para gerar o Kit do Operador, execute:
echo       scripts\gerar_kit_operador.bat
echo.
echo  Versoes instaladas:
call :RefreshPath
where node >nul 2>&1 && node --version || echo     Node.js: nao encontrado no PATH desta sessao
where python >nul 2>&1 && python --version || echo     Python: nao encontrado no PATH desta sessao
where git >nul 2>&1 && git --version || echo     Git: nao encontrado no PATH desta sessao
echo.
pause
endlocal
goto :eof

:RefreshPath
for /f "skip=2 tokens=3*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SysPATH=%%A %%B"
for /f "skip=2 tokens=3*" %%A in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "UserPATH=%%A %%B"
set "PATH=%SystemRoot%\system32;%SystemRoot%;%SysPATH%;%UserPATH%"
goto :eof
