@echo off
rem Instala lo necesario (Git, Node.js, ngrok), descarga el juego y arranca el servidor online. Se puede repetir sin problema.
title Helbreath Web - instalador del servidor online
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\instalar-online.ps1"
if errorlevel 1 pause
