@echo off
rem Servidor online de Helbreath Web: cuentas, mundo compartido y panel de administracion. Guia: docs\ONLINE.md
title Helbreath Web - servidor online
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\servidor-online.ps1"
if errorlevel 1 pause
