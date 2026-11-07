param([string]$Serial = '127.0.0.1:5555')
$ErrorActionPreference = 'Stop'
$adb = (Get-Command adb -ErrorAction Stop).Source
& $adb connect $Serial | Out-Host
& $adb -s $Serial shell settings delete global global_http_proxy_pac
& $adb -s $Serial shell settings put global http_proxy ':0'
& $adb -s $Serial shell settings delete global global_http_proxy_host
& $adb -s $Serial shell settings delete global global_http_proxy_port
Write-Host 'Emulator proxy disabled; all apps use direct networking.' -ForegroundColor Green
