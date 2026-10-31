param([switch]$ToolsOnly)
$ErrorActionPreference = 'Stop'
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolchain = Get-Content -LiteralPath (Join-Path $workspaceRoot 'platform\windows\toolchain.json') -Raw | ConvertFrom-Json
$package = Get-Content -LiteralPath (Join-Path $workspaceRoot 'package.json') -Raw | ConvertFrom-Json
$toolRoot = Join-Path $workspaceRoot 'tmp\toolchain'
$buildRoot = Join-Path $workspaceRoot 'tmp\windows-build'
$stage = Join-Path $buildRoot 'app'
$output = Join-Path $workspaceRoot 'releases'
New-Item -ItemType Directory -Force -Path $toolRoot, $output | Out-Null
function Fetch-Verified([string]$Url, [string]$Path, [string]$Hash) {
  if (!(Test-Path -LiteralPath $Path)) { Invoke-WebRequest -Uri $Url -OutFile $Path -UseBasicParsing }
  if ((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Hash) { throw "Checksum mismatch: $Path. Remove the cached file and retry." }
}
$runtimeZip = Join-Path $toolRoot "node-v$($toolchain.nodeVersion)-win-x64.zip"
Fetch-Verified $toolchain.nodeUrl $runtimeZip $toolchain.nodeSha256
$runtimeRoot = Join-Path $toolRoot "node-v$($toolchain.nodeVersion)-win-x64"
if (!(Test-Path -LiteralPath (Join-Path $runtimeRoot 'node.exe'))) { Expand-Archive -LiteralPath $runtimeZip -DestinationPath $toolRoot -Force }
$compilerRoot = Join-Path $toolRoot "inno-$($toolchain.innoVersion)"
$compiler = Join-Path $compilerRoot 'ISCC.exe'
if (!(Test-Path -LiteralPath $compiler)) {
  $compilerSetup = Join-Path $toolRoot "innosetup-$($toolchain.innoVersion)-x64.exe"
  Fetch-Verified $toolchain.innoUrl $compilerSetup $toolchain.innoSha256
  $setupProcess = Start-Process -FilePath $compilerSetup -ArgumentList @('/PORTABLE=1', '/CURRENTUSER', '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', '/NOICONS', "/DIR=`"$compilerRoot`"") -WindowStyle Hidden -Wait -PassThru
  if ($setupProcess.ExitCode -ne 0 -or !(Test-Path -LiteralPath $compiler)) { throw 'Portable Inno Setup extraction failed.' }
}
if ($ToolsOnly) { Write-Output "Verified toolchain ready in $toolRoot"; exit 0 }
if (!(Get-Content -LiteralPath (Join-Path $workspaceRoot 'public\sw.js') -Raw).Contains("spoolspace-static-$($package.version)")) { throw 'Update the service-worker cache version to match package.json before release.' }
if ($env:GITHUB_REF -like 'refs/tags/*' -and $env:GITHUB_REF -ne "refs/tags/v$($package.version)") { throw 'The release tag must match package.json.' }
# Recursive cleanup is restricted to this verified build directory, never data/.
$expectedBuild = [IO.Path]::GetFullPath((Join-Path $workspaceRoot 'tmp\windows-build'))
if ([IO.Path]::GetFullPath($buildRoot) -ne $expectedBuild -or !$expectedBuild.StartsWith($workspaceRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Unsafe build directory.' }
if (Test-Path -LiteralPath $buildRoot) { Remove-Item -LiteralPath $buildRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage, (Join-Path $stage 'runtime') | Out-Null
foreach ($name in @('server.mjs','lib','public','docs','LICENSE','README.md','package.json','package-lock.json','.env.example')) { Copy-Item -LiteralPath (Join-Path $workspaceRoot $name) -Destination $stage -Recurse }
Copy-Item -LiteralPath (Join-Path $runtimeRoot 'node.exe') -Destination (Join-Path $stage 'runtime\node.exe')
Copy-Item -LiteralPath (Join-Path $runtimeRoot 'LICENSE') -Destination (Join-Path $stage 'runtime\NODE-LICENSE.txt')
$previousDirectory = Get-Location
try {
  Set-Location -LiteralPath $stage
  & npm.cmd ci --omit=dev --ignore-scripts --no-audit --no-fund --cache (Join-Path $workspaceRoot '.npm-cache')
  if ($LASTEXITCODE -ne 0) { throw 'Production dependency installation failed.' }
} finally { Set-Location -LiteralPath $previousDirectory }
& node (Join-Path $workspaceRoot 'scripts\third-party-notices.mjs') $stage
if ($LASTEXITCODE -ne 0) { throw 'License collection failed.' }
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$assemblyInfo = Join-Path $buildRoot 'AssemblyInfo.cs'
if ($package.version -notmatch '^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$') { throw 'Invalid application version.' }
$fileVersion = ($package.version -split '[-+]')[0] + '.0'
[IO.File]::WriteAllText($assemblyInfo, ('using System.Reflection; [assembly: AssemblyTitle("Spoolspace")] [assembly: AssemblyProduct("Spoolspace")] [assembly: AssemblyVersion("' + $fileVersion + '")] [assembly: AssemblyFileVersion("' + $fileVersion + '")] [assembly: AssemblyInformationalVersion("' + $package.version + '")]'))
& $csc /nologo /target:winexe /platform:x64 /optimize+ "/out:$stage\Spoolspace.exe" "/win32icon:$workspaceRoot\platform\windows\Spoolspace.ico" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.ServiceProcess.dll /reference:System.Web.Extensions.dll (Join-Path $workspaceRoot 'platform\windows\Spoolspace.cs') (Join-Path $workspaceRoot 'platform\windows\WindowsStartup.cs') $assemblyInfo
if ($LASTEXITCODE -ne 0) { throw 'Windows launcher compilation failed.' }
Copy-Item -LiteralPath (Join-Path $workspaceRoot 'platform\windows\config.example.json') -Destination (Join-Path $stage 'config.example.json')
& (Join-Path $stage 'runtime\node.exe') (Join-Path $workspaceRoot 'scripts\verify-windows-package.mjs') $stage
if ($LASTEXITCODE -ne 0) { throw 'Packaged runtime verification failed.' }
& $compiler /Qp "/DAppVersion=$($package.version)" "/DStageDir=$stage" "/DReleaseDir=$output" (Join-Path $workspaceRoot 'platform\windows\installer.iss')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$portable = Join-Path $output "Spoolspace-$($package.version)-win-x64.zip"
if (Test-Path -LiteralPath $portable) { Remove-Item -LiteralPath $portable -Force }
[IO.Compression.ZipFile]::CreateFromDirectory($stage, $portable, [IO.Compression.CompressionLevel]::Optimal, $false)
$sourceRoot = Join-Path $buildRoot 'source'
New-Item -ItemType Directory -Path $sourceRoot | Out-Null
foreach ($name in @('.github','.gitignore','.env.example','scripts','platform','public','lib','test','docs','server.mjs','start.bat','package.json','package-lock.json','README.md','LICENSE','CONTRIBUTING.md','SECURITY.md')) { Copy-Item -LiteralPath (Join-Path $workspaceRoot $name) -Destination $sourceRoot -Recurse }
$sourceZip = Join-Path $output "spoolspace-$($package.version)-source.zip"
if (Test-Path -LiteralPath $sourceZip) { Remove-Item -LiteralPath $sourceZip -Force }
[IO.Compression.ZipFile]::CreateFromDirectory($sourceRoot, $sourceZip, [IO.Compression.CompressionLevel]::Optimal, $false)
$artifacts = @((Join-Path $output "Spoolspace-Setup-$($package.version)-win-x64.exe"), $portable, $sourceZip)
$checksums = $artifacts | ForEach-Object { "{0}  {1}" -f (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant(), [IO.Path]::GetFileName($_) }
[IO.File]::WriteAllLines((Join-Path $output 'SHA256SUMS.txt'), $checksums, [Text.UTF8Encoding]::new($false))
Write-Output ($artifacts -join "`n")
