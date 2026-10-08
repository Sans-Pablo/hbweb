# Arranca el servidor multijugador y un túnel público (Cloudflare) para que otros entren desde internet.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$port = 8088
$tools = Join-Path $root "tools"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Titulo($t) { Write-Host ""; Write-Host "  $t" -ForegroundColor Yellow }

# 0) Detener instancias anteriores (servidor en 8080/8088 y túneles) para que nada choque
foreach ($pt in 8080, 8088) {
  Get-NetTCPConnection -LocalPort $pt -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

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

# 2) cloudflared: crea un enlace https público temporal hacia este PC, sin abrir puertos
$cf = Join-Path $tools "cloudflared.exe"
if (-not (Test-Path $cf)) {
  Titulo "Descargando cloudflared (solo la primera vez, unos 50 MB)..."
  Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cf -UseBasicParsing
}

# 3) servidor del juego
Titulo "Arrancando el servidor del juego..."
$srv = Start-Process -FilePath $node -ArgumentList "server\server.mjs", $port -WorkingDirectory $root -WindowStyle Minimized -PassThru
Start-Sleep -Seconds 2
if ($srv.HasExited) { Write-Host "  El servidor no arrancó. ¿Está el puerto $port ocupado por otra ventana del juego?" -ForegroundColor Red; Read-Host "Pulsa Intro para salir"; exit 1 }

# 4) túnel
Titulo "Creando el enlace para tu hermano..."
$log = Join-Path $tools "tunnel.log"
if (Test-Path $log) { Remove-Item $log -Force }
$tun = Start-Process -FilePath $cf -ArgumentList "tunnel", "--url", "http://localhost:$port", "--no-autoupdate", "--logfile", "`"$log`"" -WindowStyle Minimized -PassThru
$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern "https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value }
  }
}

Clear-Host
Write-Host ""
Write-Host "  HELBREATH WEB - SERVIDOR MULTIJUGADOR ENCENDIDO" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Tú (en este PC):        http://localhost:$port/"
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
  ForEach-Object { Write-Host ("  En tu misma Wi-Fi:      http://" + $_.IPAddress + ":$port/") }
Write-Host ""
if ($url) {
  Write-Host "  ENLACE PARA TU HERMANO (desde cualquier sitio):" -ForegroundColor Green
  Write-Host ""
  Write-Host "      $url" -ForegroundColor Green
  Write-Host ""
  try { Set-Clipboard -Value $url; Write-Host "  (Ya está copiado: pégalo en WhatsApp, Discord...)" } catch {}
} else {
  Write-Host "  No se pudo crear el enlace de internet (mira tools\tunnel.log)." -ForegroundColor Red
  Write-Host "  En la misma Wi-Fi sí podéis jugar con la dirección de arriba."
}
Write-Host ""
Write-Host "  El enlace cambia cada vez que abres este programa. Quien lo tenga puede entrar."
Write-Host "  El progreso de cada personaje se guarda por nombre en server\saves.json."
Write-Host ""
Start-Process "http://localhost:$port/"
Read-Host "  Pulsa Intro aquí para APAGAR el servidor y el enlace"
foreach ($p in @($tun, $srv)) { if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force } }
