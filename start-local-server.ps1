<#
Starts the complete local game-server stack for an emulator or phone on the LAN.

Examples:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\start-local-server.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File .\start-local-server.ps1 -LanAddress 192.168.1.2
  powershell -NoProfile -ExecutionPolicy Bypass -File .\start-local-server.ps1 -DirectClient
#>
[CmdletBinding()]
param(
  [string]$LanAddress = '',
  [switch]$DirectClient,
  [switch]$KeepRunning
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
$scriptRoot = Join-Path $repoRoot 'scripts'
$stateFile = Join-Path $repoRoot 'data\lan-test\processes.json'

function Wait-LocalPort {
  param([int]$Port, [string]$Name, [int]$TimeoutSeconds = 20)

  $until = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
      Write-Host "Ready: $Name (TCP $Port)"
      return
    }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $until)
  throw "$Name did not open TCP port $Port within $TimeoutSeconds seconds. Check data\lan-test\*.err.log"
}

# A fresh start prevents duplicate Node/UDP/proxy instances and stale route state.
if ((Test-Path -LiteralPath $stateFile) -and -not $KeepRunning) {
  Write-Host 'Stopping the previous local stack...'
  & (Join-Path $scriptRoot 'stop-lan-test.ps1')
}

$startArgs = @{ OutputDirectory = (Join-Path $repoRoot 'data\lan-test') }
if ($LanAddress) { $startArgs.LanAddress = $LanAddress }
if ($DirectClient) { $startArgs.DirectClient = $true }

Write-Host 'Starting local server services...'
& (Join-Path $scriptRoot 'start-lan-test.ps1') @startArgs

# All services are checked after start, so a successful command means the stack
# is actually listening rather than merely having spawned processes.
Wait-LocalPort 6379  'Valkey'
Wait-LocalPort 3000  'Live service'
Wait-LocalPort 3001  'Login service'
Wait-LocalPort 3002  'Main service'
Wait-LocalPort 10300 'Game gateway'
Wait-LocalPort 10200 'Chat service'
if ($DirectClient) {
  Write-Host ''
  Write-Host 'Local server is ready. Keep the phone Wi-Fi proxy disabled for DirectClient mode.' -ForegroundColor Green
} else {
  Wait-LocalPort 25565 'Authentication service'
  Wait-LocalPort 5000  'Connection service'
  Wait-LocalPort 8080  'Game proxy'
  $details = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
  $proxy = $details | Where-Object Name -eq 'proxy'
  Write-Host ''
  Write-Host 'Local server is ready.' -ForegroundColor Green
  Write-Host 'Set the phone or emulator Wi-Fi proxy to this PC LAN address on port 8080.' -ForegroundColor Green
  if ($proxy) { Write-Host "Proxy process: PID $($proxy.Id)" }
}

Write-Host "Logs: $(Join-Path $repoRoot 'data\lan-test')"
