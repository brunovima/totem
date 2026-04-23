@echo off
:: =============================================================================
:: TOTEM — Botão de Pânico: Resetar Senha do Administrador (Windows)
::
:: QUANDO USAR: O operador esqueceu a senha do painel admin.
:: O QUE FAZ:   Redefine a senha para o padrão: 1234
::
:: IMPORTANTE: Feche o aplicativo TOTEM antes de executar este script.
:: =============================================================================
setlocal EnableExtensions

echo.
echo ============================================
echo  TOTEM - Reset de Senha do Administrador
echo ============================================
echo.
echo  ATENCAO: Feche o TOTEM antes de continuar.
echo  A senha sera redefinida para: 1234
echo.
pause

:: ── Localiza o executável do TOTEM ───────────────────────────────────────────
set "TOTEM_EXE="

:: Tenta os caminhos mais comuns de instalação NSIS
if exist "%LOCALAPPDATA%\Programs\totem\totem.exe" (
    set "TOTEM_EXE=%LOCALAPPDATA%\Programs\totem\totem.exe"
    goto :found
)
if exist "%PROGRAMFILES%\TOTEM\totem.exe" (
    set "TOTEM_EXE=%PROGRAMFILES%\TOTEM\totem.exe"
    goto :found
)
if exist "%PROGRAMFILES(X86)%\TOTEM\totem.exe" (
    set "TOTEM_EXE=%PROGRAMFILES(X86)%\TOTEM\totem.exe"
    goto :found
)
:: Tenta via registro (instalação NSIS padrão)
for /f "tokens=2*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\totem" /v "InstallLocation" 2^>nul') do (
    if exist "%%B\totem.exe" (
        set "TOTEM_EXE=%%B\totem.exe"
        goto :found
    )
)

:: Não encontrado
echo [ERRO] Executavel do TOTEM nao encontrado.
echo.
echo  Caminhos verificados:
echo  - %LOCALAPPDATA%\Programs\totem\totem.exe
echo  - %PROGRAMFILES%\TOTEM\totem.exe
echo.
echo  Solucao: Edite este arquivo .bat e defina o caminho manualmente:
echo  set "TOTEM_EXE=C:\caminho\para\totem.exe"
echo.
pause
exit /b 1

:found
echo [OK] TOTEM encontrado em: %TOTEM_EXE%
echo.
echo  Executando reset de senha...
echo.

:: Executa o TOTEM com a flag de reset e aguarda encerramento
start "" /wait "%TOTEM_EXE%" --reset-password

echo.
echo  Processo concluido.
echo  Se a caixa de dialogo confirmou o sucesso, a senha e agora: 1234
echo.
pause
endlocal
