param(
  [string]$PackageName = "AI-TASK-Portable",
  [int]$Port = 3210
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Dist = Join-Path $Root "dist"
$PackageDir = Join-Path $Dist $PackageName
$AppDir = Join-Path $PackageDir "app"
$ZipPath = Join-Path $Dist "$PackageName.zip"

$NodeCommand = Get-Command node -ErrorAction Stop
$NodeExe = $NodeCommand.Source

Push-Location $Root
try {
  npm.cmd run build

  if (Test-Path $PackageDir) {
    Remove-Item -LiteralPath $PackageDir -Recurse -Force
  }
  if (Test-Path $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }

  New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
  $DataDir = Join-Path $PackageDir "data"
  New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

  Copy-Item -Path (Join-Path $Root ".next\standalone\*") -Destination $AppDir -Recurse -Force
  $TracedDataDir = Join-Path $AppDir "data"
  if (Test-Path $TracedDataDir) {
    Remove-Item -LiteralPath $TracedDataDir -Recurse -Force
  }
  Copy-Item -Path (Join-Path $Root ".next\static") -Destination (Join-Path $AppDir ".next") -Recurse -Force
  if (Test-Path (Join-Path $Root "public")) {
    Copy-Item -Path (Join-Path $Root "public") -Destination $AppDir -Recurse -Force
  }

  Copy-Item -Path $NodeExe -Destination (Join-Path $PackageDir "node.exe") -Force

  $RunBat = @"
@echo off
setlocal
cd /d "%~dp0"
set PORT=$Port
set HOSTNAME=127.0.0.1

if not exist "data" mkdir "data"

echo Starting AI TASK...
echo.
echo The app will open at http://127.0.0.1:%PORT%
echo Keep this window open while using the app.
echo Close this window to stop AI TASK.
echo.

start "" "http://127.0.0.1:%PORT%"
"%~dp0node.exe" "%~dp0app\server.js"

echo.
echo AI TASK has stopped.
pause
"@
  Set-Content -Path (Join-Path $PackageDir "Run AI TASK.bat") -Value $RunBat -Encoding ASCII

  $Readme = @"
AI TASK Portable

How to use:
1. Extract this ZIP file.
2. Double-click "Run AI TASK.bat".
3. Keep the black window open while using the app.
4. Close that window to stop the app.

Data:
- Your tasks are saved in the "data" folder.
- To back up your tasks, copy the "data" folder.
- To move to another computer, copy the whole extracted folder.

Notes:
- This package is for Windows.
- No Node.js or npm installation is required.
- If Windows Firewall asks for permission, allow access for private networks.
"@
  Set-Content -Path (Join-Path $PackageDir "README.txt") -Value $Readme -Encoding ASCII
  Set-Content -Path (Join-Path $DataDir "README-DATA.txt") -Value "AI TASK stores its local database in this folder after first run. Back up this folder to keep your tasks." -Encoding ASCII

  Compress-Archive -Path (Join-Path $PackageDir "*") -DestinationPath $ZipPath -Force

  Write-Host "Portable package created:"
  Write-Host $PackageDir
  Write-Host $ZipPath
}
finally {
  Pop-Location
}
