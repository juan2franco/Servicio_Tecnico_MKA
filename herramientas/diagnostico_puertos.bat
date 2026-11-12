@echo off
chcp 65001 >nul
title Puertos de MKA
cd /d "%~dp0"
rem Muestra que programa usa cada puerto que necesita MKA (80, 3306, 3307, 3316, 8000, 8080).
powershell -NoProfile -Command "foreach ($p in 80,3306,3307,3316,8000,8080) { $c = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $pr = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; '{0,-6} ocupado por {1} (PID {2})' -f $p, $pr.ProcessName, $c.OwningProcess } else { '{0,-6} libre' -f $p } }" > "%~dp0diagnostico_puertos.txt"
where docker >nul 2>nul && (echo. & echo Contenedores de Docker: & docker ps -a --format "{{.Names}} | {{.Status}} | {{.Ports}}") >> "%~dp0diagnostico_puertos.txt" 2>&1
type "%~dp0diagnostico_puertos.txt"
timeout /t 8 >nul
