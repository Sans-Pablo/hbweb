@echo off
rem Abre el informe que escriben los habitantes-probadores (bugs, incomodidades, balance e ideas).
if exist "%~dp0server\data\Informe de bots.md" ( start "" notepad "%~dp0server\data\Informe de bots.md" ) else ( echo Aun no hay informe: arranca el servidor y deja jugar a los habitantes unos minutos. & pause )
