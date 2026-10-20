param(
  [string]$LanAddress = '',
  [string]$OutputDirectory = '',
  [switch]$DirectClient
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoRoot 'data\lan-test' }

# Some launch environments contain both `Path` and `PATH`. Windows treats them
# as the same variable, while Start-Process rejects the duplicate dictionary.
$processPath = [Environment]::GetEnvironmentVariable('Path', 'Process')
[Environment]::SetEnvironmentVariable('PATH', $null, 'Process')
[Environment]::SetEnvironmentVariable('Path', $processPath, 'Process')

if (-not $LanAddress) {
  $defaultRoute = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop |
    Where-Object { $_.NextHop -ne '0.0.0.0' } |
    Sort-Object RouteMetric, InterfaceMetric |
    Select-Object -First 1
  $LanAddress = Get-NetIPAddress -InterfaceIndex $defaultRoute.InterfaceIndex -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress -First 1
}

if (-not [System.Net.IPAddress]::TryParse($LanAddress, [ref]([System.Net.IPAddress]$null))) {
  throw "Invalid LAN address: $LanAddress"
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$node = 'C:\Program Files\nodejs\node.exe'
$mitmdump = 'C:\Program Files\mitmproxy\bin\mitmdump.exe'
$valkey = 'D:\Games\tools\valkey-9.1.2\Valkey-9.1.2-Windows-x64-msys2\valkey-server.exe'
$trainingServer = Join-Path $repoRoot 'match-server\match-server-training.exe'
$matchServer = if (Test-Path -LiteralPath $trainingServer) {
  $trainingServer
} else {
  Join-Path $repoRoot 'match-server\match-server.exe'
}
$dbFile = Join-Path $repoRoot 'data\apk-local-test.db'

foreach ($required in @($node, $mitmdump, $valkey, $matchServer)) {
  if (-not (Test-Path -LiteralPath $required)) { throw "Required executable is missing: $required" }
}

function Start-LanProcess {
  param(
    [string]$Name,
    [string]$FilePath,
    [string[]]$ArgumentList,
    [hashtable]$Environment = @{}
  )

  $outLog = Join-Path $OutputDirectory "$Name.log"
  $errLog = Join-Path $OutputDirectory "$Name.err.log"
  $previous = @{}
  foreach ($entry in $Environment.GetEnumerator()) {
    $previous[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
    [Environment]::SetEnvironmentVariable($entry.Key, [string]$entry.Value, 'Process')
  }
  try {
    $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList `
      -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput $outLog -RedirectStandardError $errLog
  } finally {
    foreach ($entry in $Environment.GetEnumerator()) {
      [Environment]::SetEnvironmentVariable($entry.Key, $previous[$entry.Key], 'Process')
    }
  }
  [pscustomobject]@{ Name = $Name; Id = $process.Id; Log = $outLog }
}

$common = @{
  DB_FILE = $dbFile
  REDIS_URL = 'redis://127.0.0.1:6379'
  MATCH_JWT_SECRET = 'dev-match-secret-change-me'
  TCP_PUBLIC_HOST = $LanAddress
  MATCH_PUBLIC_HOST = $LanAddress
  GAME_SERVER_PORT = '10100'
}

$started = @()
$started += Start-LanProcess 'valkey' $valkey @('--bind', '127.0.0.1', '--port', '6379', '--save', '\"\"', '--appendonly', 'no')
Start-Sleep -Milliseconds 500
$started += Start-LanProcess 'live' $node @('src\servers\live.js') ($common + @{ LIVE_PORT = '3000'; GAME_VERSION = '1.70.4'; NODE_ID = 'lan-live' })
$mainUrl = if ($DirectClient) { "http://${LanAddress}:3002" } else { 'https://loginbp2.samosasmobiles.dpdns.org' }
if (-not $DirectClient) {
  $started += Start-LanProcess 'auth' $node @('scripts\apk-local-auth-server.js') ($common + @{ AUTH_LOGIN_PORT = '25565'; CONNECT_PORT = '5000'; NODE_ID = 'lan-auth' })
}
$started += Start-LanProcess 'login' $node @('src\servers\login.js') ($common + @{
  LOGIN_PORT = '3001'; NODE_ID = 'lan-login'
  SERVER_URL = $mainUrl
  LOGIN_DOMAIN = 'https://loginbp.samosasmobiles.dpdns.org'
  MAIN_DOMAIN = 'https://loginbp2.samosasmobiles.dpdns.org'
})
$started += Start-LanProcess 'main' $node @('src\servers\main.js') ($common + @{ MAIN_PORT = '3002'; NODE_ID = 'lan-main' })
$started += Start-LanProcess 'tcp' $node @('src\servers\tcp.js') ($common + @{ TCP_PORT = '10300'; NODE_ID = 'lan-gateway' })
$started += Start-LanProcess 'matchmaker' $node @('src\servers\matchmaker.js') ($common + @{
  NODE_ID = 'lan-matchmaker'; MM_MIN_PLAYERS = '1'; MM_TIMEOUT_MS = '3000'
})
$started += Start-LanProcess 'match-server' $matchServer @('-addr', ':10100') ($common + @{
  NODE_ID = 'lan-match'; MATCH_ADVERTISE = "${LanAddress}:10100"; MATCH_BOT = '1'; MATCH_NO_ZONE = '1'
})
if (-not $DirectClient) {
  # Intercept only known game hosts. Other phone traffic remains an opaque
  # tunnel, which avoids certificate failures in YouTube and unrelated apps.
  $gameHosts = '^(privatefreefirebackend\.vercel\.app|loginbp\.samosasmobiles\.dpdns\.org|loginbp2\.samosasmobiles\.dpdns\.org|auth\.samosasmobiles\.dpdns\.org|g\.samosasmobiles\.dpdns\.org|100067\.msdk\.garena\.com)(:[0-9]+)?$'
  $started += Start-LanProcess 'proxy' $mitmdump @('-s', 'scripts\apk-local-proxy.py', '--listen-host', '0.0.0.0', '-p', '8080', '--allow-hosts', $gameHosts, '-w', 'data\apk-lan-test.mitm') @{}
}

$started | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDirectory 'processes.json') -Encoding UTF8
Start-Sleep -Seconds 2

Write-Host "LAN Free Fire stack started for $LanAddress"
if ($DirectClient) {
  Write-Host 'Direct client mode: phone Wi-Fi proxy must be disabled'
} else {
  Write-Host "Phone Wi-Fi proxy: $LanAddress port 8080"
}
Write-Host "Logs: $OutputDirectory"
$started | Format-Table Name, Id, Log -AutoSize
