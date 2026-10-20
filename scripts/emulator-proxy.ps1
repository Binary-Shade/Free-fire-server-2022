param(
    [ValidateSet('Enable', 'Disable', 'Status')]
    [string]$Action = 'Status',
    [string]$Serial = '127.0.0.1:5555',
    [string]$ProxyHost = '10.0.2.2',
    [int]$ProxyPort = 8080
)

$ErrorActionPreference = 'Stop'
$adb = 'D:\Games\tools\android-platform-tools\platform-tools\adb.exe'

if (-not (Test-Path -LiteralPath $adb)) {
    throw "ADB was not found at $adb"
}

& $adb connect $Serial | Out-Host
$state = (& $adb -s $Serial get-state 2>&1).Trim()
if ($state -ne 'device') {
    throw "ADB device $Serial is unavailable (state: $state)"
}

switch ($Action) {
    'Enable' {
        & $adb -s $Serial shell settings put global http_proxy "${ProxyHost}:${ProxyPort}"
        Write-Host "Emulator proxy enabled: ${ProxyHost}:${ProxyPort}"
    }
    'Disable' {
        & $adb -s $Serial shell settings put global http_proxy ':0'
        & $adb -s $Serial shell settings delete global global_http_proxy_host | Out-Null
        & $adb -s $Serial shell settings delete global global_http_proxy_port | Out-Null
        & $adb -s $Serial shell settings delete global global_http_proxy_exclusion_list | Out-Null
        Write-Host 'Emulator proxy disabled. Root settings and CA certificates were not changed.'
    }
}

$proxy = (& $adb -s $Serial shell settings get global http_proxy).Trim()
$identity = (& $adb -s $Serial shell id).Trim()
Write-Host "Device: $Serial ($state)"
Write-Host "HTTP proxy: $proxy"
Write-Host "ADB identity: $identity"
