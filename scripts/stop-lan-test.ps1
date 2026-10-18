param([string]$OutputDirectory = '')

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoRoot 'data\lan-test' }
$stateFile = Join-Path $OutputDirectory 'processes.json'
if (-not (Test-Path -LiteralPath $stateFile)) { throw "LAN process state is missing: $stateFile" }

$entries = @(Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json)
foreach ($entry in $entries) {
  $process = Get-Process -Id ([int]$entry.Id) -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $process.Id
    Write-Host "Stopped $($entry.Name) (PID $($process.Id))"
  }
}

