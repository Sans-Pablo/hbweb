@echo off
rem Un solo doble clic: instala lo que falte, actualiza el juego, arranca el servidor (con cuentas y direccion fija si esta configurado) y abre el navegador.
rem Para jugar con alguien sin configurar nada: "Iniciar servidor.bat rapido"
title Helbreath Web - servidor
if /i "%~1"=="rapido" (set MODO=rapido) else (set MODO=online)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\iniciar.ps1" -Modo %MODO%
if errorlevel 1 pause
