@echo off
chcp 65001 >nul
title Apagar MKA
cd /d "%~dp0"
echo Apagando MKA: API, lector NFC y enlace publico...

powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.Name -ne 'powershell.exe' -and (($_.CommandLine -like '*uvicorn app.main:app*') -or ($_.CommandLine -like '*puente_nfc.py*') -or ($_.CommandLine -like '*compartir_internet.py*') -or ($_.ExecutablePath -like '*Servicio_Tecnico_MKA*cloudflared.exe')) } | ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>$null | Out-Null }"

rem Si MKA esta corriendo en Docker, tambien se detienen los contenedores (los datos se conservan).
where docker >nul 2>nul && docker compose -f "%~dp0docker-compose.yml" ps -q 2>nul | findstr . >nul && docker compose -f "%~dp0docker-compose.yml" stop

if exist "%~dp0herramientas" type nul > "%~dp0herramientas\enlace_publico.txt"
echo Listo, MKA esta apagado.
timeout /t 3 >nul
