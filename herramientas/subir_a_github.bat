@echo off
chcp 65001 >nul
title Subir cambios de MKA a GitHub
cd /d "%~dp0.."

rem Sube el trabajo a una rama (no a main) para revisarlo con un pull request.
set "RAMA=lector-nfc"
set "LOG=%~dp0subir_github.log"

call :subir > "%LOG%" 2>&1
type "%LOG%"
echo.
pause
exit /b

:subir
echo === %date% %time%
git --version || exit /b 1

set "GN="
set "GM="
for /f "delims=" %%n in ('git config user.name') do set "GN=%%n"
for /f "delims=" %%m in ('git config user.email') do set "GM=%%m"
if not defined GN git config user.name "thomas alzate"
if not defined GM git config user.email "234611324+thomasalzate-boop@users.noreply.github.com"

git checkout -B %RAMA% || exit /b 1
git add -- backend docker-compose.yml .gitignore README.md iniciar_mka.bat apagar_mka.bat crear_acceso_directo.bat iniciar_docker.bat herramientas/subir_a_github.bat frontend/app.js frontend/index.html frontend/nfc.js frontend/compartir.js frontend/basedatos.html frontend/output.css frontend/image hardware herramientas/compartir_internet.py || exit /b 1
echo --- Archivos en el commit:
git diff --cached --stat
git commit -F "%~dp0mensaje_commit.txt" || exit /b 1
git push -u origin %RAMA% || exit /b 1
echo === SUBIDO OK a la rama %RAMA%
exit /b 0
