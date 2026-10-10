@echo off
rem Hace que el servidor (y con el los habitantes) se arranque solo al iniciar sesion en Windows. Para quitarlo: schtasks /delete /tn HelbreathWeb /f
schtasks /create /tn "HelbreathWeb" /tr "\"%~dp0Iniciar servidor.bat\"" /sc onlogon /rl limited /f
if errorlevel 1 ( echo No se pudo crear la tarea. ) else ( echo Listo: el servidor se abrira solo cada vez que inicies sesion. )
pause
