# Servidor online de Helbreath Web en este PC + túnel con dirección fija (ngrok o Tailscale Funnel).
# Primera vez: te pregunta lo necesario y lo guarda en server\config.json. Guía paso a paso: docs\ONLINE.md
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$tools = Join-Path $root "tools"
$cfgFile = Join-Path $root "server\config.json"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function Titulo($t) { Write-Host ""; Write-Host "  $t" -ForegroundColor Yellow }

# 1) Node.js: el del sistema o uno portátil dentro de tools\node
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = Join-Path $tools "node\node.exe" }
if (-not (Test-Path $node)) {
  Titulo "Descargando Node.js portátil (solo la primera vez, unos 30 MB)..."
  $v = "v22.11.0"
  $zip = Join-Path $env:TEMP "node-$v.zip"
  Invoke-WebRequest "https://nodejs.org/dist/$v/node-$v-win-x64.zip" -OutFile $zip -UseBasicParsing
  Expand-Archive $zip -DestinationPath $tools -Force
  if (Test-Path (Join-Path $tools "node")) { Remove-Item (Join-Path $tools "node") -Recurse -Force }
  Rename-Item (Join-Path $tools "node-$v-win-x64") "node"
  Remove-Item $zip
  $node = Join-Path $tools "node\node.exe"
}

# 2) configuración (primera vez)
if (-not (Test-Path $cfgFile)) {
  Clear-Host
  Titulo "PRIMERA VEZ: configuración del servidor (se guarda en server\config.json)"
  Write-Host ""
  $admin = Read-Host "  Tu nombre de usuario en el juego (será administrador)"
  Write-Host ""
  Write-Host "  ¿Cómo llegan los jugadores a tu PC?"
  Write-Host "    1) ngrok       (dirección fija gratis: https://TU-DOMINIO.ngrok-free.app)"
  Write-Host "    2) Tailscale   (dirección fija gratis: https://TU-PC.TU-RED.ts.net)"
  Write-Host "    3) Ninguno     (solo tu Wi-Fi / pruebas)"
  $op = Read-Host "  Elige 1, 2 o 3"
  $tunnel = @{ "1" = "ngrok"; "2" = "tailscale"; "3" = "none" }[$op]
  if (-not $tunnel) { $tunnel = "none" }
  $public = ""; $domain = ""
  if ($tunnel -eq "ngrok") {
    $domain = (Read-Host "  Tu dominio estático de ngrok (sin https://, p. ej. mi-juego.ngrok-free.app)").Trim() -replace "^https?://", "" -replace "/.*$", ""
    $public = "https://$domain"
  } elseif ($tunnel -eq "tailscale") {
    $public = (Read-Host "  Tu dirección de Tailscale (https://nombre.tailnet.ts.net)").Trim().TrimEnd("/")
  }
  $cfg = [ordered]@{ port = 8088; maxPlayers = 40; origins = @("https://sans-pablo.github.io"); admins = @($admin.Trim().ToLower()); publicUrl = $public; tunnel = $tunnel; ngrokDomain = $domain }
  $cfg | ConvertTo-Json | Set-Content -Path $cfgFile -Encoding UTF8
  Write-Host "  Guardado." -ForegroundColor Green
}
$cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json
$port = [int]$cfg.port

# 3) servidor del juego (si se cierra con código 42 —comando «restart»— se vuelve a arrancar solo)
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Titulo "Arrancando el servidor del juego..."
$srv = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", "& { Set-Location '$root'; do { & '$node' 'server\server.mjs' $port; `$c = `$LASTEXITCODE; if (`$c -eq 42) { Start-Sleep 2 } } while (`$c -eq 42) }" -WorkingDirectory $root -PassThru
Start-Sleep -Seconds 3
if ($srv.HasExited) { Write-Host "  El servidor no arrancó." -ForegroundColor Red; Read-Host "Pulsa Intro para salir"; exit 1 }

# 4) túnel con dirección fija
$tun = $null
if ($cfg.tunnel -eq "ngrok") {
  $ng = (Get-Command ngrok -ErrorAction SilentlyContinue).Source
  if (-not $ng -and (Test-Path (Join-Path $tools "ngrok.exe"))) { $ng = Join-Path $tools "ngrok.exe" }
  if (-not $ng) { Write-Host "  No encuentro ngrok. Instálalo (winget install ngrok.ngrok) y ejecuta: ngrok config add-authtoken TU_TOKEN. Mira docs\ONLINE.md" -ForegroundColor Red }
  else { Titulo "Abriendo el túnel de ngrok..."; $tun = Start-Process -FilePath $ng -ArgumentList "http", "--url=$($cfg.ngrokDomain)", "$port" -PassThru }
} elseif ($cfg.tunnel -eq "tailscale") {
  $ts = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
  if (-not $ts) { Write-Host "  No encuentro Tailscale. Instálalo desde tailscale.com y entra con tu cuenta. Mira docs\ONLINE.md" -ForegroundColor Red }
  else { Titulo "Activando Tailscale Funnel..."; & $ts funnel --bg $port }
}

Clear-Host
Write-Host ""
Write-Host "  HELBREATH WEB - SERVIDOR ONLINE ENCENDIDO" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Jugar tú (en este PC):   http://localhost:$port/"
Write-Host "  Administrar (solo aquí): mira el enlace «Panel de administración» en la ventana del servidor"
if ($cfg.publicUrl) {
  Write-Host ""
  Write-Host "  Dirección pública del servidor:" -ForegroundColor Green
  Write-Host "      $($cfg.publicUrl)" -ForegroundColor Green
  Write-Host "  Los jugadores entran por la web de GitHub: https://sans-pablo.github.io/hbweb/"
  Write-Host "  (esa web debe llevar esta dirección en web\data\server.json: mira docs\ONLINE.md, paso «Publicar la dirección»)"
}
Write-Host ""
Write-Host "  Mientras esta ventana esté abierta, el servidor y el túnel funcionan. Los datos están en server\data\."
Write-Host ""
Read-Host "  Pulsa Intro aquí para APAGAR el servidor y el túnel"
if ($tun -and -not $tun.HasExited) { Stop-Process -Id $tun.Id -Force }
if ($cfg.tunnel -eq "tailscale" -and $ts) { & $ts funnel reset }
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
if ($srv -and -not $srv.HasExited) { Stop-Process -Id $srv.Id -Force }
