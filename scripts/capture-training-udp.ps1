[CmdletBinding()]
param(
  [string]$DeviceIp = '192.168.1.51',
  [string]$OutputFile = ''
)

$ErrorActionPreference = 'Stop'
$tshark = 'C:\Program Files\Wireshark\tshark.exe'
if (-not (Test-Path -LiteralPath $tshark)) {
  throw "Wireshark/tshark was not found at $tshark"
}

$captureDir = Join-Path $PSScriptRoot '..\data\captures'
New-Item -ItemType Directory -Force -Path $captureDir | Out-Null
if (-not $OutputFile) {
  $OutputFile = Join-Path $captureDir ("training-{0}.pcapng" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
}

# Interface 8 is the host Ethernet adapter carrying 192.168.1.2 on this PC.
# If the phone/emulator is connected through Wi-Fi instead, change -i 8 to the
# Wi-Fi interface number shown by: tshark -D.
$captureFilter = "host $DeviceIp and udp and (port 10100 or port 10200)"
Write-Host "Capturing $captureFilter"
Write-Host "Output: $OutputFile"
Write-Host 'Start Training Grounds, open the weapon catalog, select one item, then press Ctrl+C here.'
& $tshark -i 8 -f $captureFilter -w $OutputFile
Write-Host "Saved capture: $OutputFile"
