@echo off
rem Servidor multijugador: tu y quien tenga el enlace jugais en la misma granja.
title Helbreath Web - multijugador
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\multijugador.ps1"
if errorlevel 1 pause
