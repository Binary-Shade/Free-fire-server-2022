param(
    [Parameter(Mandatory = $true)]
    [string]$MetadataPath,

    [string]$BootstrapUrl = 'https://live.binaryshade.fun/live/'
)

$ErrorActionPreference = 'Stop'

$resolvedPath = (Resolve-Path -LiteralPath $MetadataPath).Path
$bytes = [IO.File]::ReadAllBytes($resolvedPath)
$literalTableOffset = [BitConverter]::ToUInt32($bytes, 8)
$literalTableSize = [BitConverter]::ToUInt32($bytes, 12)
$literalDataOffset = [BitConverter]::ToUInt32($bytes, 16)
$needle = [Text.Encoding]::UTF8.GetBytes('https://live.binaryshade.fun')
$replacement = [Text.Encoding]::UTF8.GetBytes($BootstrapUrl)

$matches = [Collections.Generic.List[int]]::new()
for ($offset = $literalDataOffset; $offset -le $bytes.Length - $needle.Length; $offset++) {
    $matched = $true
    for ($index = 0; $index -lt $needle.Length; $index++) {
        if ($bytes[$offset + $index] -ne $needle[$index]) {
            $matched = $false
            break
        }
    }
    if ($matched) {
        $matches.Add($offset)
    }
}

if ($matches.Count -ne 1) {
    throw "Expected exactly one bootstrap URL occurrence, found $($matches.Count)."
}

$matchOffset = $matches[0]
$relativeOffset = $matchOffset - $literalDataOffset
$entryOffset = -1
$entryLength = 0
$entryDataIndex = 0

for ($offset = $literalTableOffset; $offset -lt $literalTableOffset + $literalTableSize; $offset += 8) {
    $length = [BitConverter]::ToUInt32($bytes, $offset)
    $dataIndex = [BitConverter]::ToUInt32($bytes, $offset + 4)
    if ($dataIndex -le $relativeOffset -and $dataIndex + $length -ge $relativeOffset + $needle.Length) {
        $entryOffset = $offset
        $entryLength = $length
        $entryDataIndex = $dataIndex
        break
    }
}

if ($entryOffset -lt 0) {
    throw 'Could not locate the IL2CPP string-literal table entry for the bootstrap URL.'
}
if ($replacement.Length -gt $entryLength) {
    throw "Replacement URL is $($replacement.Length) bytes; the available literal slot is $entryLength bytes."
}

$literalOffset = $literalDataOffset + $entryDataIndex
[Array]::Clear($bytes, $literalOffset, $entryLength)
[Array]::Copy($replacement, 0, $bytes, $literalOffset, $replacement.Length)
[Array]::Copy([BitConverter]::GetBytes([uint32]$replacement.Length), 0, $bytes, $entryOffset, 4)
[IO.File]::WriteAllBytes($resolvedPath, $bytes)

$verify = [IO.File]::ReadAllBytes($resolvedPath)
$storedLength = [BitConverter]::ToUInt32($verify, $entryOffset)
$storedValue = [Text.Encoding]::UTF8.GetString($verify, $literalOffset, $storedLength)
if ($storedValue -ne $BootstrapUrl) {
    throw "Verification failed. Stored value is '$storedValue'."
}

Write-Output "Patched IL2CPP bootstrap literal at 0x$($literalOffset.ToString('X'))"
Write-Output "Updated literal length at 0x$($entryOffset.ToString('X')) from $entryLength to $storedLength"
Write-Output "Bootstrap URL: $storedValue"
