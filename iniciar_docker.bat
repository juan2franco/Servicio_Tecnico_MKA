@echo off
chcp 65001 >nul
title MKA en Docker
cd /d "%~dp0"

echo.
echo   MKA en Docker: MySQL + API + pagina web + Adminer
echo   -------------------------------------------------
echo.

where docker >nul 2>nul
if errorlevel 1 (
    echo Docker no esta instalado. Instala Docker Desktop y vuelve a abrir este archivo.
    pause
    exit /b 1
)
docker info >nul 2>nul
if errorlevel 1 (
    echo Docker Desktop no esta encendido. Abrelo, espera a que diga "Engine running"
    echo y vuelve a abrir este archivo.
    pause
    exit /b 1
)

rem ---- Python para el lector NFC y el enlace publico, que corren en Windows ----
set "PY=python"
where python >nul 2>nul || set "PY=py"
if exist "%~dp0backend\.venv\Scripts\python.exe" set "PY="%~dp0backend\.venv\Scripts\python.exe""

echo Apagando MKA si estaba encendido sin Docker, para liberar el puerto 8000...
call "%~dp0apagar_mka.bat" >nul

echo Construyendo y encendiendo los contenedores. La primera vez tarda varios minutos...
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo Docker no pudo encender MKA. Revisa el mensaje de arriba.
    pause
    exit /b 1
)

if not exist "%~dp0herramientas" mkdir "%~dp0herramientas"
type nul > "%~dp0herramientas\enlace_publico.txt"
start "MKA - Lector NFC (USB)" /min cmd /k "cd /d "%~dp0hardware\puente_usb" && %PY% puente_nfc.py"
start "MKA - Enlace publico" /min cmd /k "cd /d "%~dp0herramientas" && %PY% compartir_internet.py"

echo Esperando a que MySQL y la API esten listos...
for /l %%i in (1,1,90) do (
    curl -s -o nul --max-time 1 http://localhost:8000/salud && goto :lista
    timeout /t 2 /nobreak >nul
)
echo La API no respondio. Revisa con:  docker compose logs backend
pause
exit /b 1

:lista
start "" "http://localhost:8000/app/"

set "ENLACE="
for /l %%i in (1,1,60) do (
    if not defined ENLACE (
        set /p ENLACE=<"%~dp0herramientas\enlace_publico.txt"
        if not defined ENLACE timeout /t 1 /nobreak >nul
    )
)
if defined ENLACE set "ENLACE=%ENLACE%/app/"
if defined ENLACE echo %ENLACE%| clip

echo.
echo ================================================================
echo   Panel:            http://localhost:8000/app/   (o http://localhost)
echo   Base de datos:    http://localhost:8081   (Adminer)
echo                     Servidor: db   Usuario: root   Base: mka_db
echo                     Clave: la de MYSQL_ROOT_PASSWORD en docker-compose.yml
if defined ENLACE echo   Para compartir:   %ENLACE%   - ya esta copiado
echo ================================================================
echo.
echo Para apagar usa el icono "Apagar MKA" del escritorio.
echo.
pause
