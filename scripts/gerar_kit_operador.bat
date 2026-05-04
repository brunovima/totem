@echo off
:: =============================================================================
:: TOTEM - Gerador do Kit do Operador para Windows
::
:: USO: scripts\gerar_kit_operador.bat [--skip-build]
::
::   --skip-build   Pula compilacao e usa o .exe ja existente em dist\
::
:: PRE-REQUISITOS (instale com scripts\instalar_build_tools.bat):
::   * Node.js 20 LTS
::   * Visual Studio Build Tools 2022 (workload C++)
::   * Python 3.11
::   * Reinicializacao do computador apos instalar os pre-requisitos
::
:: RESULTADO:
::   %USERPROFILE%\Desktop\Kit_Operador_TOTEM_v<versao>.zip
::     TOTEM-<versao>-setup.exe         instalador do aplicativo
::     install_dependencies.bat         instala VC++, yt-dlp, ffmpeg
::     resetar_senha_windows.bat        botao de panico (reset de senha)
::     LEIA-ME_Instrucoes.txt           manual completo do operador
:: =============================================================================
setlocal EnableExtensions EnableDelayedExpansion

echo.
echo ================================================================
echo  TOTEM - Gerador do Kit do Operador (Windows)
echo ================================================================
echo.

:: -- Navega para a raiz do projeto -------------------------------------------
cd /d "%~dp0.."
set "ROOT_DIR=%CD%"

:: -- Le versao do package.json via PowerShell (funciona sem Node instalado) ---
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content 'package.json' | ConvertFrom-Json).version" 2^>nul`) do set "VERSION=%%V"
if "!VERSION!"=="" set "VERSION=1.1.0"

set "SKIP_BUILD=false"
for %%A in (%*) do if /i "%%A"=="--skip-build" set "SKIP_BUILD=true"

set "KIT_NAME=Kit_Operador_TOTEM_v!VERSION!"
set "DESKTOP=%USERPROFILE%\Desktop"
set "KIT_DIR=%DESKTOP%\!KIT_NAME!"
set "ZIP_OUT=%DESKTOP%\!KIT_NAME!.zip"
set "DIST_DIR=%ROOT_DIR%\dist"
set "SCRIPTS_DIR=%ROOT_DIR%\scripts"

echo  Versao detectada : v!VERSION!
echo  Modo             : !SKIP_BUILD! (true = pular build)
echo  Destino          : !ZIP_OUT!
echo.

:: =============================================================================
:: ETAPA 1: PRE-REQUISITOS
:: =============================================================================
if "!SKIP_BUILD!"=="true" goto :criar_kit

echo [1/5] Verificando pre-requisitos de build...
echo.

:: -- Node.js ------------------------------------------------------------------
where node >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [TOTEM] Node.js nao encontrado. Instalando via winget...
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    call :RefreshPath
    where node >nul 2>&1
    if %errorLevel% NEQ 0 (
        echo.
        echo [ERRO] Node.js nao foi instalado ou nao esta no PATH.
        echo.
        echo  Solucao:
        echo    1. Execute: scripts\instalar_build_tools.bat  (como Administrador)
        echo    2. REINICIE o computador
        echo    3. Execute este script novamente
        echo.
        pause
        exit /b 1
    )
    echo [OK] Node.js instalado.
) else (
    for /f "delims=" %%V in ('node --version') do echo [OK] Node.js: %%V
)

:: -- Developer Mode (permite criar symlinks para winCodeSign) -----------------
for /f "tokens=3" %%V in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /v AllowDevelopmentWithoutDevLicense 2^>nul') do set "DEV_MODE=%%V"
if not "!DEV_MODE!"=="0x1" (
    echo [TOTEM] Habilitando Developer Mode (necessario para o build^)...
    powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command ""reg add HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock /v AllowDevelopmentWithoutDevLicense /t REG_DWORD /d 1 /f; Start-Sleep 1""' -Wait" 2>nul
    echo [OK] Developer Mode habilitado.
) else (
    echo [OK] Developer Mode: ativo
)

:: -- Verifica VS Build Tools via vswhere --------------------------------------
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "HAS_CPP=false"
if exist "!VSWHERE!" (
    for /f "delims=" %%P in ('"!VSWHERE!" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul') do (
        if not "%%P"=="" set "HAS_CPP=true"
    )
)
if "!HAS_CPP!"=="true" (
    echo [OK] Visual Studio Build Tools: encontrado
) else (
    echo [AVISO] Visual Studio Build Tools (C++) nao encontrado.
    echo         O better-sqlite3 pode nao compilar corretamente.
    echo         Execute scripts\instalar_build_tools.bat para instalar.
    echo         Continuando mesmo assim...
)

:: =============================================================================
:: ETAPA 2: INSTALAR DEPENDENCIAS NPM
:: =============================================================================
echo.
echo [2/5] Instalando dependencias npm...
call npm ci
if %errorLevel% NEQ 0 (
    echo.
    echo [ERRO] npm ci falhou. Verifique os erros acima.
    echo        Possiveis causas:
    echo          - Sem conexao com a internet
    echo          - package-lock.json desatualizado (tente: npm install)
    echo          - Visual Studio Build Tools ausente
    echo.
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas.

:: =============================================================================
:: ETAPA 3: RECOMPILAR BETTER-SQLITE3 PARA ELECTRON
:: =============================================================================
echo.
echo [3/5] Recompilando better-sqlite3 para Electron (Windows x64)...
echo       (esta etapa garante que o .node seja valido no Windows)

call npx electron-rebuild -f -w better-sqlite3 2>nul
if %errorLevel% NEQ 0 (
    echo [AVISO] electron-rebuild retornou erro. Tentando electron-builder install-app-deps...
    call npx electron-builder install-app-deps
    if %errorLevel% NEQ 0 (
        echo [AVISO] Recompilacao com aviso - o postinstall ja pode ter compilado corretamente.
    )
)
echo [OK] Modulo nativo compilado para Windows.

:: =============================================================================
:: ETAPA 4: BUILD DO INSTALADOR WINDOWS
:: =============================================================================
echo.
echo [4/5] Compilando codigo React/Electron...
call npm run build
if %errorLevel% NEQ 0 (
    echo.
    echo [ERRO] Build do codigo fonte falhou.
    echo        Execute: npm run build
    echo        E verifique os erros acima.
    echo.
    pause
    exit /b 1
)

echo.
echo [4/5] Empacotando instalador Windows (.exe)...
call npx electron-builder --win --x64
if %errorLevel% NEQ 0 (
    echo.
    echo [ERRO] Empacotamento falhou.
    echo        Verifique os erros do electron-builder acima.
    echo.
    pause
    exit /b 1
)
echo [OK] Instalador gerado em dist\

:criar_kit
:: =============================================================================
:: ETAPA 5: MONTAR O KIT DO OPERADOR
:: =============================================================================
echo.
echo [5/5] Montando Kit do Operador...

:: Localiza o .exe gerado
set "INSTALLER="
for /f "delims=" %%F in ('dir /b "!DIST_DIR!\*-setup.exe" 2^>nul') do set "INSTALLER=%%F"
if "!INSTALLER!"=="" (
    echo.
    echo [ERRO] Nenhum *-setup.exe encontrado em dist\
    echo.
    if "!SKIP_BUILD!"=="true" (
        echo  Dica: o --skip-build foi ativado mas nao ha .exe em dist\
        echo        Execute sem --skip-build para gerar o instalador.
    ) else (
        echo  O build pode ter falhado silenciosamente.
        echo  Verifique o conteudo de dist\
    )
    echo.
    pause
    exit /b 1
)

:: Cria pasta do kit
if exist "!KIT_DIR!" rmdir /s /q "!KIT_DIR!"
mkdir "!KIT_DIR!"

:: Copia instalador do TOTEM
copy "!DIST_DIR!\!INSTALLER!" "!KIT_DIR!\" >nul
echo [OK] !INSTALLER!

:: Copia scripts do operador
copy "!SCRIPTS_DIR!\install_dependencies.bat"  "!KIT_DIR!\" >nul
echo [OK] install_dependencies.bat

copy "!SCRIPTS_DIR!\resetar_senha_windows.bat" "!KIT_DIR!\" >nul
echo [OK] resetar_senha_windows.bat

:: Gera o LEIA-ME
call :GerarLEIAME "!KIT_DIR!\LEIA-ME_Instrucoes.txt"
echo [OK] LEIA-ME_Instrucoes.txt

:: Lista conteudo
echo.
echo  Conteudo do Kit:
dir /b "!KIT_DIR!"
echo.

:: Compacta com PowerShell
if exist "!ZIP_OUT!" del /f /q "!ZIP_OUT!"
powershell -NoProfile -Command ^
    "Compress-Archive -Path '!KIT_DIR!\*' -DestinationPath '!ZIP_OUT!' -Force"
if %errorLevel% NEQ 0 (
    echo [AVISO] Nao foi possivel criar o .zip automaticamente.
    echo         A pasta do kit esta disponivel em:
    echo         !KIT_DIR!
    goto :fim
)

rmdir /s /q "!KIT_DIR!"

for %%F in ("!ZIP_OUT!") do set "ZIP_SIZE=%%~zF"
set /a ZIP_MB=!ZIP_SIZE! / 1048576

echo.
echo ================================================================
echo  Kit gerado com sucesso!
echo ================================================================
echo.
echo  Arquivo: !KIT_NAME!.zip
echo  Tamanho: ~!ZIP_MB! MB
echo  Local  : !ZIP_OUT!
echo.
echo  Conteudo do kit:
echo    TOTEM-!VERSION!-setup.exe     instalador do aplicativo
echo    install_dependencies.bat      VC++, yt-dlp, ffmpeg
echo    resetar_senha_windows.bat     reset de senha do admin
echo    LEIA-ME_Instrucoes.txt        manual do operador

:fim
echo.
pause
endlocal
goto :eof


:: =============================================================================
:: Sub-rotina: gera o arquivo LEIA-ME_Instrucoes.txt
:: Uso: call :GerarLEIAME "caminho\para\arquivo.txt"
:: =============================================================================
:GerarLEIAME
set "LEIA_ME_PATH=%~1"
(
echo ================================================================
echo  TOTEM INTERATIVO v!VERSION!
echo  Manual de Instalacao e Operacao - Windows
echo  Gerado em: %DATE% %TIME%
echo ================================================================
echo.
echo ================================================================
echo  CONTEUDO DESTE PACOTE
echo ================================================================
echo.
echo  TOTEM-!VERSION!-setup.exe
echo    Instalador principal do aplicativo TOTEM.
echo    Execute este arquivo para instalar o TOTEM no computador.
echo.
echo  install_dependencies.bat  [EXECUTAR PRIMEIRO como Administrador]
echo    Instala as dependencias de runtime necessarias:
echo      - Visual C++ 2022 Redistributable (necessario para o banco de dados)
echo      - yt-dlp  (download de videos do YouTube, Instagram e TikTok^)
echo      - ffmpeg  (processamento de audio/video^)
echo.
echo  resetar_senha_windows.bat  [Botao de Panico]
echo    Redefine a senha do painel admin de volta para: 1234
echo    Use se o operador esquecer a senha.
echo.
echo ================================================================
echo  PARTE 1 - INSTALACAO (fazer UMA VEZ por maquina^)
echo ================================================================
echo.
echo  PASSO 1 - INSTALAR DEPENDENCIAS
echo  --------------------------------
echo  1. Clique com botao direito em "install_dependencies.bat"
echo  2. Escolha "Executar como administrador"
echo  3. Aguarde a conclusao (2-5 minutos^)
echo  4. REINICIE O COMPUTADOR antes de prosseguir
echo.
echo  Por que e necessario?
echo    O TOTEM usa um banco de dados SQLite compilado em C++.
echo    O Visual C++ Redistributable fornece as bibliotecas necessarias
echo    para este modulo funcionar no Windows.
echo    Sem ele: erro "nao e um aplicativo Win32 valido" ao abrir.
echo.
echo  PASSO 2 - INSTALAR O TOTEM
echo  ---------------------------
echo  1. Execute "TOTEM-!VERSION!-setup.exe"
echo  2. Se aparecer aviso de "aplicativo nao verificado":
echo     - Clique em "Mais informacoes"
echo     - Clique em "Executar mesmo assim"
echo  3. Siga o assistente de instalacao
echo  4. O TOTEM sera instalado e um atalho criado na Area de Trabalho
echo.
echo  PASSO 3 - PRIMEIRA EXECUCAO
echo  ----------------------------
echo  1. Abra o TOTEM pelo atalho na Area de Trabalho
echo  2. Na primeira abertura, o banco de dados sera criado automaticamente
echo  3. A tela de video devera aparecer (loop automatico^)
echo  4. Acesse o painel admin: toque no canto inferior direito
echo     Senha padrao: 1234
echo.
echo ================================================================
echo  PARTE 2 - CONFIGURACAO DO EVENTO
echo ================================================================
echo.
echo  ACESSO AO PAINEL ADMIN
echo  ----------------------
echo  - Toque no canto inferior direito da tela (zona invisivel 80x80px^)
echo  - OU pressione a tecla F12 (somente em modo desenvolvimento^)
echo  - Senha padrao: 1234
echo.
echo  ABAS DO PAINEL ADMIN
echo  --------------------
echo.
echo  [Quizzes]
echo    Criar e editar quizzes com perguntas de multipla escolha.
echo    So um quiz pode estar ativo por vez.
echo    Cada pergunta pode ter ate 4 opcoes.
echo.
echo  [Leads]
echo    Ver todos os participantes com nome, email e pontuacao.
echo    Botao "Exportar CSV" para baixar a lista completa.
echo.
echo  [Midia]
echo    Gerenciar a playlist de videos exibida no totem:
echo      - Adicionar video local: botao "Carregar Arquivo" (.mp4^)
echo      - Adicionar YouTube: colar o link do video
echo      - Adicionar Instagram/TikTok: colar o link publico
echo        (o download ocorre em background, pode levar ate 60s^)
echo      - Reordenar: botoes com setas para cima/baixo
echo      - Definir duracao: tempo de exibicao para cada item
echo.
echo  [Wi-Fi]
echo    Conectar o totem a redes sem fio.
echo    Necessario para YouTube e redes sociais.
echo.
echo  [Personalizacao]
echo    - Logo do evento: fazer upload de imagem
echo    - Posicao do logo: canto superior/inferior esquerdo/direito
echo    - Moldura: cor e espessura da borda colorida
echo.
echo  [Configuracoes]
echo    Alterar senha do painel admin.
echo.
echo ================================================================
echo  PARTE 3 - FLUXO DO TOTEM NO EVENTO
echo ================================================================
echo.
echo  O TOTEM funciona assim:
echo.
echo    [Tela de Video] -- visitante toca na tela --^> [Formulario]
echo         ^                                              |
echo         |                                             v
echo    (10 segundos^)                               [Quiz Interativo]
echo         |                                             |
echo         ^<-- [Tela de Agradecimento com Placar] ------^<
echo.
echo  - A tela de video fica em loop automatico
echo  - Ao tocar na tela, o visitante preenche nome e email
echo  - Em seguida responde o quiz configurado
echo  - A pontuacao aparece na tela final
echo  - Apos 10 segundos, volta automaticamente para o video
echo.
echo ================================================================
echo  PARTE 4 - BOTAO DE PANICO (RESET DE SENHA^)
echo ================================================================
echo.
echo  USE QUANDO: O operador esqueceu a senha do painel admin.
echo.
echo  COMO USAR:
echo  1. Feche o TOTEM completamente
echo  2. Clique duas vezes em "resetar_senha_windows.bat"
echo  3. A nova senha sera: 1234
echo.
echo ================================================================
echo  PARTE 5 - SOLUCAO DE PROBLEMAS COMUNS
echo ================================================================
echo.
echo  PROBLEMA: "nao e um aplicativo Win32 valido" ao abrir
echo  SOLUCAO:  Execute install_dependencies.bat como Administrador
echo            e reinicie o computador.
echo.
echo  PROBLEMA: Tela preta ao abrir o TOTEM
echo  SOLUCAO:  Reinicie o computador. Se persistir, reinstale o TOTEM.
echo.
echo  PROBLEMA: App nao verificado / SmartScreen bloqueou
echo  SOLUCAO:  Clique em "Mais informacoes" >> "Executar mesmo assim".
echo            O TOTEM nao possui assinatura digital (certificado^)
echo            mas e seguro para uso interno.
echo.
echo  PROBLEMA: Videos do Instagram/TikTok nao carregam
echo  SOLUCAO:  Verifique se yt-dlp e ffmpeg estao instalados
echo            (execute install_dependencies.bat^).
echo            Confirme que o link e de um conteudo publico.
echo            Aguarde: o download pode levar ate 60 segundos.
echo.
echo  PROBLEMA: Video do YouTube nao aparece / tela preta
echo  SOLUCAO:  Verifique a conexao com a internet (aba Wi-Fi^).
echo            Confirme que o link e valido: youtube.com/watch?v=...
echo.
echo  PROBLEMA: Esqueci a senha do admin
echo  SOLUCAO:  Execute "resetar_senha_windows.bat"
echo            A senha volta para: 1234
echo.
echo  PROBLEMA: TOTEM abre mas fecha imediatamente
echo  SOLUCAO:  Reinstale o TOTEM.
echo            Se persistir, desinstale pelo Painel de Controle,
echo            reinstale as dependencias e reinstale o TOTEM.
echo.
echo ================================================================
echo  INFORMACOES TECNICAS
echo ================================================================
echo.
echo  Versao do TOTEM  : !VERSION!
echo  Plataforma       : Windows x64 (64-bit^)
echo  Framework        : Electron 39 + React 19 + SQLite
echo  Banco de dados   : totem.db em %%APPDATA%%\totem-app\
echo  Midia local      : %%APPDATA%%\totem-app\media\
echo.
echo  Para suporte tecnico, contate o desenvolvedor.
echo.
echo ================================================================
) > "%LEIA_ME_PATH%"
goto :eof


:RefreshPath
for /f "skip=2 tokens=3*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SysPATH=%%A %%B"
for /f "skip=2 tokens=3*" %%A in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "UserPATH=%%A %%B"
set "PATH=%SystemRoot%\system32;%SystemRoot%;%SysPATH%;%UserPATH%"
goto :eof
