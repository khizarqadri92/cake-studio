<#
  Run on YOUR computer. Builds the web app and creates one zip to take to the
  client:  cake-studio-deploy.zip  (next to the project folder)

      cd E:\Projects\cake-studio\deploy
      .\make-package.ps1

  Left out: node_modules, venv, .env (secrets), backups, logs, test design photos.
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path (Split-Path -Parent $root) "cake-studio-deploy.zip"

Write-Host "1/3 Building the web app..." -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
if (-not (Test-Path node_modules)) { npm install }
npm run build
if ($LASTEXITCODE -ne 0) { throw "The web app didn't build - fix the errors above first." }
Pop-Location

Write-Host "2/3 Collecting files..." -ForegroundColor Cyan
$stage = Join-Path $env:TEMP "cake-studio-package"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null
robocopy (Join-Path $root "backend") (Join-Path $stage "cake-studio\backend") /E /NFL /NDL /NJH /NJS /NP `
  /XD venv __pycache__ backups logs order-references .pytest_cache /XF .env *.pyc | Out-Null
robocopy (Join-Path $root "frontend\dist") (Join-Path $stage "cake-studio\frontend\dist") /E /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy (Join-Path $root "deploy") (Join-Path $stage "cake-studio\deploy") /E /NFL /NDL /NJH /NJS /NP | Out-Null
New-Item -ItemType Directory (Join-Path $stage "cake-studio\backend\static\uploads\order-references") -Force | Out-Null

Write-Host "3/3 Zipping..." -ForegroundColor Cyan
if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path (Join-Path $stage "cake-studio") -DestinationPath $out
Remove-Item $stage -Recurse -Force
Write-Host "`nReady: $out" -ForegroundColor Green
Write-Host "Copy it to the client's PC, unzip to C:\CakeStudio, and run deploy\install.ps1 as Administrator."
