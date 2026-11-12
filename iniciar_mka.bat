@echo off
chcp 65001 >nul
title MKA - Servicio Tecnico
cd /d "%~dp0"

rem ---- Python: primero el entorno del proyecto (backend\.venv), si no el del sistema ----
set "PY=python"
where python >nul 2>nul || set "PY=py"
if exist "%~dp0backend\.venv\Scripts\python.exe" set "PY="%~dp0backend\.venv\Scripts\python.exe""

rem ---- Base de datos ----
rem Usa tu MySQL (clave en backend\database.py). Si MySQL no responde o rechaza la clave,
rem la API sigue con SQLite (backend\mka_local.db) y lo avisa en la ventana "MKA - API".
rem Para usar siempre SQLite, quita el "rem" de la linea siguiente:
rem set "DATABASE_URL=sqlite:///./mka_local.db"

echo.
echo   MKA - Servicio Tecnico
echo   ----------------------
echo.

echo Revisando dependencias...
%PY% -c "import fastapi, uvicorn, sqlalchemy, pymysql, email_validator, serial" >nul 2>nul
if errorlevel 1 (
    echo Instalando dependencias, solo la primera vez...
    %PY% -m pip install -q --disable-pip-version-check fastapi uvicorn sqlalchemy pymysql pydantic email-validator pyserial
)
if not exist "%~dp0herramientas" mkdir "%~dp0herramientas"

rem ---- Cada parte se enciende solo si no esta corriendo ya (sirve tambien con Docker) ----
call :corriendo "puente_nfc.py" || start "MKA - Lector NFC (USB)" /min cmd /k "cd /d "%~dp0hardware\puente_usb" && %PY% puente_nfc.py"
call :corriendo "compartir_internet.py"
if errorlevel 1 (
    type nul > "%~dp0herramientas\enlace_publico.txt"
    start "MKA - Enlace publico" /min cmd /k "cd /d "%~dp0herramientas" && %PY% compartir_internet.py"
)

curl -s -o nul --max-time 2 http://localhost:8000/salud
if not errorlevel 1 (
    echo MKA ya estaba encendido. Abriendo el panel...
    start "" "http://localhost:8000/app/"
    goto :enlace
)

start "MKA - API" /min cmd /k "cd /d "%~dp0backend" && %PY% -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

echo Encendiendo la API...
for /l %%i in (1,1,40) do (
    curl -s -o nul --max-time 1 http://localhost:8000/salud && goto :api_lista
    timeout /t 1 /nobreak >nul
)
echo.
echo La API no respondio. Revisa la ventana "MKA - API" en la barra de tareas.
pause
exit /b 1

:api_lista
echo API lista. Abriendo el panel...
start "" "http://localhost:8000/app/"

:enlace
echo Preparando el enlace para compartir por internet...
set "ENLACE="
for /l %%i in (1,1,60) do (
    if not defined ENLACE (
        if exist "%~dp0herramientas\enlace_publico.txt" set /p ENLACE=<"%~dp0herramientas\enlace_publico.txt"
        if not defined ENLACE timeout /t 1 /nobreak >nul
    )
)
if defined ENLACE set "ENLACE=%ENLACE%/app/"

echo.
if defined ENLACE (
    echo ================================================================
    echo   ENLACE PARA COMPARTIR:
    echo   %ENLACE%
    echo.
    echo   Ya esta copiado: pegalo en WhatsApp, correo, etc.
    echo   Tambien lo ves en el boton "Compartir" de la pagina.
    echo ================================================================
) else (
    echo No se pudo abrir el enlace por internet. Revisa la ventana "MKA - Enlace publico".
    echo En tu PC el panel sigue funcionando en http://localhost:8000/app/
)
if defined ENLACE echo %ENLACE%| clip

echo.
echo MKA queda funcionando con las ventanas minimizadas en la barra de tareas.
echo Para apagarlo usa el icono "Apagar MKA" del escritorio.
echo.
pause
exit /b 0

rem Devuelve 0 si hay un proceso de Python corriendo ese script.
:corriendo
powershell -NoProfile -Command "if (Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'python*' -and $_.CommandLine -like '*%~1*' }) { exit 0 } else { exit 1 }"
exit /b %errorlevel%
