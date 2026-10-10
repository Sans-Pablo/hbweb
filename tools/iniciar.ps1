# Lanzador único del servidor de Helbreath Web (Windows). Doble clic en «Iniciar servidor.bat» (o en los .bat antiguos: hacen lo mismo).
#   -Modo online   (por defecto) servidor con cuentas + túnel de dirección fija (ngrok / Tailscale) según server\config.json
#   -Modo rapido   servidor + enlace público temporal (Cloudflare) para jugar con alguien sin configurar nada
# Todo es automático: actualiza el juego (git, si lo hay), usa Node del sistema o descarga uno portátil, pregunta lo imprescindible solo la
# primera vez, espera a que el servidor responda, abre el navegador, copia el enlace público y reinicia el servidor solo si se cae.
param([ValidateSet("online", "rapido")][string]$Modo = "online", [switch]$SinNavegador)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$tools = Join-Path $root "tools"
$cfgFile = Join-Path $root "server\config.json"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function Titulo($t) { Write-Host ""; Write-Host "  $t" -ForegroundColor Yellow }
function Ok($t) { Write-Host "  $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "  $t" -ForegroundColor Red }
function Tiene($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Bajar($url, $dest) { $old = $ProgressPreference; $ProgressPreference = "SilentlyContinue"; try { Invoke-WebRequest $url -OutFile $dest -UseBasicParsing } finally { $ProgressPreference = $old } }
function LiberarPuerto($p) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }

# 1) actualización automática (si el juego se bajó con git y hay red; nunca pisa cambios locales)
if ((Tiene "git") -and (Test-Path (Join-Path $root ".git"))) {
  Titulo "Buscando actualizaciones..."
  try {
    $antes = (git rev-parse HEAD) 2>$null
    git pull --ff-only --quiet origin main 2>$null | Out-Null
    $despues = (git rev-parse HEAD) 2>$null
    if ($antes -and $despues -and $antes -ne $despues) { Ok "Juego actualizado ($(git log -1 --format=%s))" } else { Ok "Ya tienes la última versión" }
  } catch { Write-Host "  (sin conexión: se usa la versión instalada)" -ForegroundColor DarkGray }
}

# 2) Node.js 22 o superior: el del sistema o uno portátil dentro de tools\node (la primera vez se descarga solo, ~30 MB)
function NodeValido($exe) { try { return ([int]((& $exe --version) -replace "^v(\d+)\..*", '$1')) -ge 22 } catch { return $false } }
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not ($node -and (NodeValido $node))) {
  $node = Join-Path $tools "node\node.exe"
  if (-not (Test-Path $node)) {
    Titulo "Descargando Node.js portátil (solo la primera vez)..."
    $v = "v22.11.0"
    $zip = Join-Path $env:TEMP "node-$v.zip"
    Bajar "https://nodejs.org/dist/$v/node-$v-win-x64.zip" $zip
    Expand-Archive $zip -DestinationPath $tools -Force
    if (Test-Path (Join-Path $tools "node")) { Remove-Item (Join-Path $tools "node") -Recurse -Force }
    Rename-Item (Join-Path $tools "node-$v-win-x64") "node"
    Remove-Item $zip
  }
}

# 3) configuración: solo la primera vez (online). En modo rápido no hace falta ninguna.
if ($Modo -eq "online" -and -not (Test-Path $cfgFile)) {
  Clear-Host
  Titulo "PRIMERA VEZ: configuración del servidor (se guarda en server\config.json)"
  Write-Host ""
  $admin = (Read-Host "  Tu nombre de usuario en el juego (será administrador)").Trim().ToLower()
  $tunnel = "none"; $public = ""; $domain = ""
  if (Tiene "ngrok") { $tunnel = "ngrok" } elseif (Test-Path (Join-Path $tools "ngrok.exe")) { $tunnel = "ngrok" } elseif (Tiene "tailscale") { $tunnel = "tailscale" }
  if ($tunnel -eq "none") {
    Write-Host ""
    Write-Host "  No encuentro ngrok ni Tailscale. Sin ellos solo se puede jugar en tu Wi-Fi."
    Write-Host "  (Para jugar desde internet con dirección fija ejecuta «Instalar servidor online.bat», o usa -Modo rapido.)"
  } elseif ($tunnel -eq "ngrok") {
    Write-Host ""
    $domain = (Read-Host "  Tu dominio estático de ngrok (sin https://, p. ej. mi-juego.ngrok-free.app; Intro = ninguno)").Trim() -replace "^https?://", "" -replace "/.*$", ""
    if ($domain) { $public = "https://$domain" } else { $tunnel = "none" }
  } else {
    $public = (Read-Host "  Tu dirección de Tailscale (https://nombre.tailnet.ts.net; Intro = ninguna)").Trim().TrimEnd("/")
    if (-not $public) { $tunnel = "none" }
  }
  $cfg = [ordered]@{ port = 8088; maxPlayers = 40; origins = @("https://sans-pablo.github.io"); admins = @($admin); publicUrl = $public; tunnel = $tunnel; ngrokDomain = $domain }
  $cfg | ConvertTo-Json | Set-Content -Path $cfgFile -Encoding UTF8
  Ok "Guardado."
}
$cfg = if (Test-Path $cfgFile) { Get-Content $cfgFile -Raw | ConvertFrom-Json } else { [pscustomobject]@{ port = 8088; tunnel = "none"; publicUrl = "" } }
$port = [int]$(if ($cfg.port) { $cfg.port } else { 8088 })

# 4) limpiar restos de ejecuciones anteriores (servidor en el puerto, túneles huérfanos)
LiberarPuerto $port
Get-Process cloudflared, ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 5) túnel
$tun = $null; $ts = $null; $url = $cfg.publicUrl
if ($Modo -eq "rapido") {
  $cf = Join-Path $tools "cloudflared.exe"
  if (-not (Test-Path $cf)) { Titulo "Descargando cloudflared (solo la primera vez, ~50 MB)..."; Bajar "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" $cf }
  $log = Join-Path $tools "tunnel.log"
  if (Test-Path $log) { Remove-Item $log -Force }
  $tun = Start-Process -FilePath $cf -ArgumentList "tunnel", "--url", "http://localhost:$port", "--no-autoupdate", "--logfile", "`"$log`"" -WindowStyle Hidden -PassThru
  $url = $null
} elseif ($cfg.tunnel -eq "ngrok") {
  $ng = (Get-Command ngrok -ErrorAction SilentlyContinue).Source
  if (-not $ng -and (Test-Path (Join-Path $tools "ngrok.exe"))) { $ng = Join-Path $tools "ngrok.exe" }
  if (-not $ng) { Aviso "No encuentro ngrok: se juega solo en tu Wi-Fi. Ejecuta «Instalar servidor online.bat» para instalarlo." }
  else { $tun = Start-Process -FilePath $ng -ArgumentList "http", "--url=$($cfg.ngrokDomain)", "$port" -WindowStyle Hidden -PassThru }
} elseif ($cfg.tunnel -eq "tailscale") {
  $ts = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
  if (-not $ts) { Aviso "No encuentro Tailscale: se juega solo en tu Wi-Fi." } else { & $ts funnel --bg $port | Out-Null }
}

# 6) cuando el servidor responde: mostrar direcciones, copiar el enlace y abrir el navegador
function Anunciar {
  for ($i = 0; $i -lt 40; $i++) { try { $null = Invoke-WebRequest "http://localhost:$port/" -UseBasicParsing -TimeoutSec 2; break } catch { Start-Sleep -Milliseconds 500 } }
  $url = $cfg.publicUrl
  if ($Modo -eq "rapido") {
    $url = $null
    for ($i = 0; $i -lt 60 -and -not $url; $i++) {
      Start-Sleep -Seconds 1
      $log = Join-Path $tools "tunnel.log"
      if (Test-Path $log) { $m = Select-String -Path $log -Pattern "https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1; if ($m) { $url = $m.Matches[0].Value } }
    }
  }
  Write-Host ""
  Write-Host "  ================================================================" -ForegroundColor Yellow
  Write-Host "   HELBREATH WEB - SERVIDOR ENCENDIDO" -ForegroundColor Yellow
  Write-Host "  ================================================================" -ForegroundColor Yellow
  Write-Host "   Jugar tú (este PC):   http://localhost:$port/"
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | ForEach-Object { Write-Host ("   En tu Wi-Fi:          http://" + $_.IPAddress + ":$port/") }
  if ($url) {
    Write-Host "   ENLACE PARA JUGAR DESDE INTERNET:" -ForegroundColor Green
    Write-Host "       $url" -ForegroundColor Green
    if ($Modo -eq "rapido") { try { Set-Clipboard -Value $url; Write-Host "   (copiado al portapapeles; cambia cada vez que abres el programa)" } catch {} }
    else { Write-Host "   Los jugadores entran por https://sans-pablo.github.io/hbweb/ (con esta dirección en web\data\server.json; mira docs\ONLINE.md)" }
  } elseif ($Modo -eq "rapido") { Write-Host "   No se pudo crear el enlace de internet (mira tools\tunnel.log). En tu Wi-Fi sí funciona." -ForegroundColor Red }
  Write-Host "   Para apagar: cierra esta ventana (o Ctrl+C). Los datos están en server\data\."
  Write-Host "  ================================================================" -ForegroundColor Yellow
  if (-not $SinNavegador) { Start-Process "http://localhost:$port/" }
}

# 7) servidor del juego con reinicio automático: código 42 (comando «restart») al instante; caída inesperada con espera,
#    y si cae 5 veces en menos de un minuto se para y lo cuenta (probablemente un error que reiniciar no arregla).
$caidas = New-Object System.Collections.Generic.List[datetime]
$primera = $true
try {
  while ($true) {
    $srv = Start-Process -FilePath $node -ArgumentList "`"$(Join-Path $root 'server\server.mjs')`"", $port -NoNewWindow -PassThru
    $null = $srv.Handle                                                   # necesario para que ExitCode esté disponible
    if ($primera) { $primera = $false; Anunciar }
    $srv.WaitForExit()
    $c = $srv.ExitCode
    if ($c -eq 0) { break }
    if ($c -eq 42) { Write-Host "  Reiniciando el servidor..." -ForegroundColor Yellow; Start-Sleep 1; continue }
    $caidas.Add([datetime]::Now)
    $ahora = [datetime]::Now; $recientes = @($caidas | Where-Object { ($ahora - $_).TotalSeconds -le 60 })
    Aviso "El servidor se cerró (código $c)."
    if ($recientes.Count -ge 5) { Aviso "Se ha caído 5 veces en un minuto: no lo reinicio más. Mira el error de arriba (docs\ONLINE.md)."; Read-Host "  Pulsa Intro para salir"; break }
    Write-Host "  Reiniciando en 3 s (los personajes se guardan cada pocos segundos)..." -ForegroundColor Yellow
    Start-Sleep 3
  }
} finally {
  if ($srv -and -not $srv.HasExited) { Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue }
  if ($tun -and -not $tun.HasExited) { Stop-Process -Id $tun.Id -Force -ErrorAction SilentlyContinue }
  if ($ts) { & $ts funnel reset | Out-Null }
  LiberarPuerto $port
}
