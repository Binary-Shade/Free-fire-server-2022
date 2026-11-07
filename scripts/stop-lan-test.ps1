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
    $sameStart = $false
    if ($entry.StartTimeUtc) {
      try {
        $started = $process.StartTime
        if ($null -ne $started) {
          $sameStart = $started.ToUniversalTime().ToString('o') -eq $entry.StartTimeUtc
        }
      } catch {
        Write-Warning "Could not verify start time for PID $($entry.Id): $($_.Exception.Message)"
      }
    }
    if ($sameName -and $sameStart) {
      Stop-Process -Id $process.Id
      Write-Host "Stopped $($entry.Name) (PID $($process.Id))"
    } else {
      Write-Warning "Skipped stale PID $($entry.Id) for $($entry.Name); it now belongs to another process."
    }
  }
}
