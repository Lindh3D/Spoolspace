# Shared by Windows PowerShell 5.1 and PowerShell 7. Avoid optional/autoloaded
# hashing/archive cmdlets when npm or a parent shell changes PSModulePath.
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-FileSha256([string]$LiteralPath) {
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    $stream = [IO.File]::OpenRead($LiteralPath)
    try {
      return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
    } finally { $stream.Dispose() }
  } finally { $algorithm.Dispose() }
}

function Expand-BuildArchive([string]$LiteralPath, [string]$DestinationPath) {
  [IO.Compression.ZipFile]::ExtractToDirectory($LiteralPath, $DestinationPath)
}
