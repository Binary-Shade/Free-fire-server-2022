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
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
      $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
      if ($pending.AsyncWaitHandle.WaitOne(250) -and $client.Connected) {
        $client.EndConnect($pending)
        Write-Host "Ready: $Name (TCP $Port)"
        return
      }
    } catch {
      # The service may still be starting; retry until the deadline below.
    } finally {
      $client.Dispose()
    }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $until)
  throw "$Name did not open TCP port $Port within $TimeoutSeconds seconds. Check data\lan-test\*.err.log"
}

# A fresh start prevents duplicate Node/UDP/proxy instances, stale Redis leader
# leases, and an older matchmaker consuming queues with obsolete settings.
# KeepRunning controls supervision after startup; it must not skip cleanup.
if (Test-Path -LiteralPath $stateFile) {
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

# Some automation hosts place child processes in a job object and terminate
# them as soon as the launcher exits.  KeepRunning makes this script the
# supervisor so the complete stack survives for the duration of a test run.
if ($KeepRunning) {
  Write-Host 'Supervisor active. Press Ctrl+C to stop monitoring the local stack.' -ForegroundColor Cyan
  while ($true) {
    Start-Sleep -Seconds 5
    if (-not (Test-Path -LiteralPath $stateFile)) {
      throw 'The local stack state file disappeared while supervision was active.'
    }
    $dead = @(Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json | Where-Object {
      -not (Get-Process -Id $_.Id -ErrorAction SilentlyContinue)
    })
    if ($dead.Count -gt 0) {
      throw "Local service exited: $($dead.Name -join ', '). Check data\lan-test\*.err.log"
    }
  }
}
