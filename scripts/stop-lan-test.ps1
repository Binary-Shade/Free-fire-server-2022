param([string]$OutputDirectory = '')

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoRoot 'data\lan-test' }
$stateFile = Join-Path $OutputDirectory 'processes.json'
if (-not (Test-Path -LiteralPath $stateFile)) { throw "LAN process state is missing: $stateFile" }

$entries = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
foreach ($entry in $entries) {
  $process = Get-Process -Id ([int]$entry.Id) -ErrorAction SilentlyContinue
  if ($process) {
    $sameName = $entry.ProcessName -and $process.ProcessName -eq $entry.ProcessName
    $sameStart = $entry.StartTimeUtc -and
      $process.StartTime.ToUniversalTime().ToString('o') -eq $entry.StartTimeUtc
    if ($sameName -and $sameStart) {
      Stop-Process -Id $process.Id
      Write-Host "Stopped $($entry.Name) (PID $($process.Id))"
    } else {
      Write-Warning "Skipped stale PID $($entry.Id) for $($entry.Name); it now belongs to another process."
    }
  }
}
