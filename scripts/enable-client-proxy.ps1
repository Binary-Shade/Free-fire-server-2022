param([string]$Serial = '127.0.0.1:5555', [string]$ServerAddress = '192.168.1.2')
$ErrorActionPreference = 'Stop'
$adb = (Get-Command adb -ErrorAction Stop).Source
& $adb connect $Serial | Out-Host
$pac = "http://${ServerAddress}:3002/client-proxy.pac"
& $adb -s $Serial shell settings put global global_http_proxy_pac $pac
& $adb -s $Serial shell settings put global http_proxy ':0'
& $adb -s $Serial shell settings delete global global_http_proxy_host
& $adb -s $Serial shell settings delete global global_http_proxy_port
Write-Host "Selective client proxy enabled: $pac" -ForegroundColor Green
Write-Host 'Only this client protocol uses mitmproxy; unrelated games use DIRECT.'
& $adb -s $Serial shell settings get global global_http_proxy_pac
& $adb -s $Serial shell settings get global http_proxy
