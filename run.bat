@echo off
title TribalWars Server
cd /d "%~dp0"

echo =====================================
echo Verificando Node.js...
echo =====================================
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js nao encontrado.
    echo Instale em: https://nodejs.org/
    pause
    exit /b
)
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo NPM nao encontrado.
    echo Reinstale o Node.js.
    pause
    exit /b
)

echo.
echo =====================================
echo Verificando dependencias da raiz...
echo =====================================
if not exist node_modules\.bin\concurrently.cmd (
    echo Instalando dependencias da raiz...
    npm install
    if %errorlevel% neq 0 (
        echo ERRO ao instalar dependencias da raiz.
        pause
        exit /b
    )
    echo Raiz instalada com sucesso.
) else (
    echo Raiz OK.
)

echo.
echo =====================================
echo Verificando dependencias do Backend...
echo =====================================
if not exist backend\node_modules (
    echo Instalando dependencias do backend...
    npm install --prefix backend
    if %errorlevel% neq 0 (
        echo ERRO ao instalar dependencias do backend.
        pause
        exit /b
    )
    echo Backend instalado com sucesso.
) else (
    echo Backend OK.
)

echo.
echo =====================================
echo Verificando dependencias do Frontend...
echo =====================================
if not exist frontend\node_modules (
    echo Instalando dependencias do frontend...
    npm install --prefix frontend
    if %errorlevel% neq 0 (
        echo ERRO ao instalar dependencias do frontend.
        pause
        exit /b
    )
    echo Frontend instalado com sucesso.
) else (
    echo Frontend OK.
)

cls
echo =====================================
echo   TribalWars - Servidores iniciando
echo =====================================
echo.
echo  Frontend : http://localhost:5173
echo  Backend  : http://localhost:9999
echo.
echo  Feche esta janela para encerrar tudo.
echo =====================================
echo.

npm run dev

echo.
echo Servidores encerrados.
pause
