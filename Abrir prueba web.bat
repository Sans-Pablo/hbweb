@echo off
rem Abre la prueba de Helbreath en el navegador y la deja accesible desde tu red local.
cd /d "%~dp0"
set PY=
where py >nul 2>nul && set PY=py -3
if not defined PY where python >nul 2>nul && set PY=python
if not defined PY (
  echo No encuentro Python. Instalalo desde https://www.python.org/downloads/ y vuelve a abrir este archivo.
  pause
  exit /b
)
rem Detiene instancias anteriores (8080 / 8088 / tunel) para que no choquen
powershell -NoProfile -Command "foreach($p in 8080,8088){Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | %%{Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue}}; Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force"
title Helbreath web - servidor
echo.
echo  Helbreath web - servidor encendido
echo.
echo  En este PC:
echo     http://localhost:8080/
echo.
echo  Desde el movil u otro PC conectado a tu misma red Wi-Fi:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { '    http://' + $_.IPAddress + ':8080/' }"
echo.
echo  Si Windows pregunta por el Firewall, marca "Redes privadas" y pulsa Permitir.
echo  Cierra esta ventana para apagar el servidor.
echo.
start "" http://localhost:8080/
%PY% tools\serve.py 8080
