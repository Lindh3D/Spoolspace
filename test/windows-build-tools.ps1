param([string]$Helper, [string]$Scratch)
$ErrorActionPreference = 'Stop'
# Simulate the missing cmdlets on the hosted build without uninstalling modules.
function Get-FileHash { throw 'Get-FileHash must not be called.' }
function Expand-Archive { throw 'Expand-Archive must not be called.' }
. $Helper
$file = Join-Path $Scratch 'label [sample].txt'
[IO.File]::WriteAllText($file, 'abc', [Text.UTF8Encoding]::new($false))
$hash = Get-FileSha256 -LiteralPath $file
$empty = Join-Path $Scratch 'empty.txt'
[IO.File]::WriteAllBytes($empty, [byte[]]@())
$emptyHash = Get-FileSha256 -LiteralPath $empty
# The hashing stream must be closed even when the file is kept for packaging.
$exclusive = [IO.File]::Open($file, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
$exclusive.Dispose()
$source = Join-Path $Scratch 'zip-source'
[IO.Directory]::CreateDirectory($source) | Out-Null
[IO.File]::WriteAllText((Join-Path $source 'label.txt'), 'archive fixture')
$archive = Join-Path $Scratch 'fixture.zip'
[IO.Compression.ZipFile]::CreateFromDirectory($source, $archive)
$destination = Join-Path $Scratch 'extracted'
Expand-BuildArchive -LiteralPath $archive -DestinationPath $destination
$extracted = [IO.File]::ReadAllText((Join-Path $destination 'label.txt'))
$corrupt = Join-Path $Scratch 'corrupt.zip'
[IO.File]::WriteAllText($corrupt, 'not an archive')
$rejected = $false
try { Expand-BuildArchive -LiteralPath $corrupt -DestinationPath (Join-Path $Scratch 'bad') } catch { $rejected = $true }
if (!$rejected) { throw 'Corrupt archive was not rejected.' }
@{ hash = $hash; emptyHash = $emptyHash; extracted = $extracted; corruptRejected = $rejected } | ConvertTo-Json -Compress
