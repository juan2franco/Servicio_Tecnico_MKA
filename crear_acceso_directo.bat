@echo off
chcp 65001 >nul
title Crear accesos directos de MKA
cd /d "%~dp0"

rem Crea en el escritorio "MKA Servicio Tecnico" (enciende todo), "Apagar MKA" y "MKA Base de datos".
powershell -NoProfile -Command "$e=[Environment]::GetFolderPath('Desktop'); $w=New-Object -ComObject WScript.Shell; $a=$w.CreateShortcut((Join-Path $e 'MKA Servicio Tecnico.lnk')); $a.TargetPath='%~dp0iniciar_mka.bat'; $a.WorkingDirectory='%~dp0'; $a.IconLocation='%~dp0frontend\image\mka.ico,0'; $a.Description='Enciende MKA, abre el panel y el enlace para compartir'; $a.Save(); $b=$w.CreateShortcut((Join-Path $e 'Apagar MKA.lnk')); $b.TargetPath='%~dp0apagar_mka.bat'; $b.WorkingDirectory='%~dp0'; $b.IconLocation='%SystemRoot%\System32\shell32.dll,27'; $b.Description='Apaga la API, el lector NFC y el enlace publico de MKA'; $b.Save(); $c=$w.CreateShortcut((Join-Path $e 'MKA Base de datos.url')); $c.TargetPath='http://localhost:8000/app/basedatos.html'; $c.Save()"

if errorlevel 1 (
    echo No se pudieron crear los accesos directos.
) else (
    echo Accesos directos creados en el escritorio: "MKA Servicio Tecnico", "Apagar MKA" y "MKA Base de datos".
)
timeout /t 4 >nul
