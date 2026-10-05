<#
  Run on YOUR computer to make CakeStudio-Setup-<version>.exe

      cd E:\Projects\cake-studio\installer
      Set-ExecutionPolicy -Scope Process Bypass
      .\build-installer.ps1 -Version 1.0.0

  Needs (one time): Inno Setup 6 (jrsoftware.org, free) and internet for the
  first build - Python is downloaded once from python.org and cached in
  installer\cache. PostgreSQL is NOT bundled: it's a prerequisite the client
  installs from postgresql.org.
  Output: installer\output\CakeStudio-Setup-<version>.exe
#>
param(
  [string]$Version = "1.0.0",
  [string]$PythonVersion = "3.12.10"
)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$here  = $PSScriptRoot
$root  = Split-Path -Parent $here
$cache = Join-Path $here "cache"
$build = Join-Path $here "build"
function Step($t) { Write-Host "`n== $t" -ForegroundColor Cyan }

Step "Checking tools"
$iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "Inno Setup 6 isn't installed. Get it free from https://jrsoftware.org/isdl.php and run this again." }
$devPython = Join-Path $root "backend\venv\Scripts\python.exe"
if (-not (Test-Path $devPython)) { $devPython = (Get-Command python -ErrorAction SilentlyContinue).Source }
if (-not $devPython) { throw "Python wasn't found (it's only used here to download the libraries)." }
Write-Host "Inno Setup: $iscc`nPython (for downloading libraries): $devPython"

Step "Building the web app"
Push-Location (Join-Path $root "frontend")
if (-not (Test-Path node_modules)) { npm install }
$env:VITE_APP_VERSION = $Version      # shown in the sidebar, so you can see what a PC has installed
npm run build
Remove-Item Env:VITE_APP_VERSION
if ($LASTEXITCODE -ne 0) { throw "The web app didn't build - fix the errors above." }
Pop-Location

Step "Downloading Python (cached after the first time)"
New-Item -ItemType Directory $cache -Force | Out-Null
$downloads = @{
  "python-$PythonVersion-embed-amd64.zip" = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
}
foreach ($name in $downloads.Keys) {
  $dest = Join-Path $cache $name
  if (Test-Path $dest) { Write-Host "  cached: $name"; continue }
  Write-Host "  downloading $name ..."
  try { Invoke-WebRequest $downloads[$name] -OutFile "$dest.part" -UseBasicParsing; Move-Item "$dest.part" $dest }
  catch {
    Remove-Item "$dest.part" -ErrorAction SilentlyContinue
    throw "Couldn't download $name from $($downloads[$name]). If that version no longer exists, pass another 3.12 release, e.g. -PythonVersion 3.12.9"
  }
}

Step "Assembling"
if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory $build | Out-Null
robocopy (Join-Path $root "backend") (Join-Path $build "app\backend") /E /NFL /NDL /NJH /NJS /NP `
  /XD venv __pycache__ backups logs uploads .pytest_cache /XF .env *.pyc | Out-Null
robocopy (Join-Path $root "frontend\dist") (Join-Path $build "app\frontend\dist") /E /NFL /NDL /NJH /NJS /NP | Out-Null
# Your logo and favicon (files, not in the database) - setup copies them to the client's PC.
foreach ($sub in @("logos", "favicons")) {
  $src = Join-Path $root "backend\static\uploads\$sub"
  if (Test-Path $src) { robocopy $src (Join-Path $build "app\initial-uploads\$sub") /E /NFL /NDL /NJH /NJS /NP | Out-Null }
}

# Private Python ("embeddable" build: no installer, lives in its own folder)
$py = Join-Path $build "python"
Expand-Archive (Join-Path $cache "python-$PythonVersion-embed-amd64.zip") -DestinationPath $py
$pth = Get-ChildItem $py -Filter "python3*._pth" | Select-Object -First 1
$zipName = (Get-ChildItem $py -Filter "python3*.zip" | Select-Object -First 1).Name
# Search order: the standard library, the bundled libraries, and the app itself
[IO.File]::WriteAllText($pth.FullName, "$zipName`r`n.`r`nLib\site-packages`r`n..\app\backend`r`nimport site`r`n")
$pyShort = ($PythonVersion -split "\.")[0..1] -join "."
Write-Host "  installing the libraries into the private Python (Windows $pyShort builds)..."
& $devPython -m pip install --quiet --no-cache-dir --target (Join-Path $py "Lib\site-packages") `
  --platform win_amd64 --python-version $pyShort --implementation cp --only-binary=:all: `
  -r (Join-Path $root "backend\requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "Downloading the Python libraries failed (see above)." }

Step "Checking the private Python can load Cake Studio"
$envFile = Join-Path $build "smoke.env"
[IO.File]::WriteAllText($envFile, "DATABASE_URL=postgresql+psycopg://x:x@localhost:1/x`nSECRET_KEY=smoke-test-only`n")
$env:CAKESTUDIO_ENV_FILE = $envFile
& (Join-Path $py "python.exe") -c "import fastapi, uvicorn, psycopg, bcrypt, reportlab, alembic, app.main; print('ok: all libraries and the app load')"
$ok = $LASTEXITCODE -eq 0
Remove-Item Env:CAKESTUDIO_ENV_FILE; Remove-Item $envFile
if (-not $ok) { throw "The private Python couldn't load Cake Studio (see above) - the installer would not work." }

Step "Compiling the installer"
Push-Location $here
& $iscc "/DAppVersion=$Version" "CakeStudio.iss"
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "Inno Setup couldn't compile the installer (see above)." }
$exe = Join-Path $here "output\CakeStudio-Setup-$Version.exe"
Write-Host ("`nReady: $exe  ({0:N0} MB)" -f ((Get-Item $exe).Length / 1MB)) -ForegroundColor Green
Write-Host "Before running it on a PC: install PostgreSQL there and restore your database (see DEPLOYMENT.md)."
