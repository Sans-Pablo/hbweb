# Instalador de un solo paso del servidor online (Windows). Instala lo que falte (Git, Node.js, ngrok con winget), descarga/actualiza el juego
# en Documents\hbweb-online, configura ngrok + administrador y arranca "Iniciar servidor.bat". Se puede ejecutar las veces que haga falta.
$ErrorActionPreference = "Stop"
function Titulo($t) { Write-Host ""; Write-Host "  == $t" -ForegroundColor Yellow }
function Refrescar { $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") }
function Tiene($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Instalar($cmd, $id, $nombre) {
  if (Tiene $cmd) { Write-Host "  ${nombre}: ya instalado" -ForegroundColor Green; return }
  Titulo "Instalando $nombre"
  winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements
  Refrescar
  if (-not (Tiene $cmd)) { Write-Host "  $nombre se instalo pero esta ventana no lo ve: cierra y vuelve a abrir este instalador." -ForegroundColor Red; Read-Host "Intro para salir"; exit 1 }
}
Refrescar
if (-not (Tiene "winget")) { Write-Host "  Falta winget (Instalador de aplicaciones de Microsoft Store). Actualizalo desde la Store y repite." -ForegroundColor Red; Read-Host "Intro"; exit 1 }
Instalar "git" "Git.Git" "Git"
Instalar "node" "OpenJS.NodeJS.LTS" "Node.js"
if (-not (Tiene "ngrok")) {
  Titulo "Instalando ngrok"
  # winget no siempre lo encuentra: descarga directa del zip oficial a %LOCALAPPDATA%\ngrok\bin y se anade al PATH del usuario.
  $nb = Join-Path $env:LOCALAPPDATA "ngrok\bin"
  New-Item -ItemType Directory -Force -Path $nb | Out-Null
  $zip = Join-Path $env:TEMP "ngrok.zip"
  Invoke-WebRequest "https://bin.ngrok.com/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" -OutFile $zip -UseBasicParsing
  Expand-Archive $zip -DestinationPath $nb -Force
  $up = [Environment]::GetEnvironmentVariable("Path", "User")
  if ($up -notlike "*$nb*") { [Environment]::SetEnvironmentVariable("Path", "$up;$nb", "User") }
  Refrescar
  if (-not (Tiene "ngrok")) { Write-Host "  No se pudo instalar ngrok." -ForegroundColor Red; Read-Host "Intro"; exit 1 }
}

Titulo "Descargando el juego"
$dir = Join-Path $env:USERPROFILE "Documents\hbweb-online"
if (Test-Path (Join-Path $dir ".git")) { git -C $dir pull --rebase origin main } else { git clone https://github.com/Sans-Pablo/hbweb.git $dir }
Set-Location $dir

Titulo "Cuenta de ngrok"
$cfgOk = $false
try { ngrok config check *> $null; $cfgOk = ($LASTEXITCODE -eq 0) } catch {}
$hasToken = $false
foreach ($f in @("$env:LOCALAPPDATA\ngrok\ngrok.yml", "$env:USERPROFILE\.config\ngrok\ngrok.yml", "$env:APPDATA\ngrok\ngrok.yml")) { if ((Test-Path $f) -and (Select-String -Path $f -Pattern "authtoken" -Quiet)) { $hasToken = $true } }
if (-not $hasToken) {
  Write-Host "  1) Entra en https://dashboard.ngrok.com/get-started/your-authtoken (crea la cuenta si no la tienes) y copia tu Authtoken."
  Start-Process "https://dashboard.ngrok.com/get-started/your-authtoken"
  $tok = (Read-Host "  Pega aqui tu Authtoken").Trim()
  ngrok config add-authtoken $tok
} else { Write-Host "  Authtoken de ngrok: ya configurado" -ForegroundColor Green }

$cfgFile = Join-Path $dir "server\config.json"
$domain = ""
if (Test-Path $cfgFile) { try { $domain = (Get-Content $cfgFile -Raw | ConvertFrom-Json).ngrokDomain } catch {} }
if (-not $domain) {
  Write-Host ""
  Write-Host "  2) En https://dashboard.ngrok.com/domains pulsa "Create Domain": te dan un dominio fijo gratis (algo.ngrok-free.app / .ngrok-free.dev)."
  Start-Process "https://dashboard.ngrok.com/domains"
  $domain = (Read-Host "  Pega aqui el dominio").Trim() -replace "^https?://", "" -replace "/.*$", ""
  $admin = (Read-Host "  Tu nombre de usuario en el juego (sera administrador)").Trim().ToLower()
  $cfg = [ordered]@{ port = 8088; maxPlayers = 40; origins = @("https://sans-pablo.github.io"); admins = @($admin); publicUrl = "https://$domain"; tunnel = "ngrok"; ngrokDomain = $domain }
  $cfg | ConvertTo-Json | Set-Content -Path $cfgFile -Encoding UTF8
}
Write-Host ""
Write-Host "  Listo. Tu direccion fija es: https://$domain" -ForegroundColor Green
Write-Host "  Dime ese dominio (o deja que lo lea de server\config.json) para publicarlo en la web de GitHub."
Titulo "Arrancando el servidor online"
Start-Process -FilePath (Join-Path $dir "Iniciar servidor.bat") -WorkingDirectory $dir
