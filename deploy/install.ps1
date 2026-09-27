<#
  Run ONCE on the CLIENT's computer, in PowerShell opened "As Administrator":

      cd C:\CakeStudio\cake-studio\deploy
      Set-ExecutionPolicy -Scope Process Bypass
      .\install.ps1

  Needs installed first: Python 3.12+ (tick "Add to PATH") and PostgreSQL 16+.

  Options:
      -Port 8000                       web address port (default 8000)
      -RestoreFrom C:\path\setup.sql   start from a database you prepared on your PC
                                       (otherwise a fresh database with the default roles is created)

  What it does: creates the database and its user, installs the Python
  packages, writes backend\.env with a random security key, sets up the tables,
  opens the port in Windows Firewall, makes the server start automatically at
  boot, schedules a nightly backup, and starts the server.
#>
param(
  [int]$Port = 8000,
  [string]$RestoreFrom = "",
  [string]$DbName = "cake_studio",
  [string]$DbUser = "cake"
)
$ErrorActionPreference = "Stop"
function Step($t) { Write-Host "`n== $t" -ForegroundColor Cyan }

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Please run PowerShell as Administrator (right-click > Run as administrator)."
}
$root    = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
if (-not (Test-Path (Join-Path $root "frontend\dist\index.html"))) { throw "frontend\dist is missing. Build the package with deploy\make-package.ps1 on your PC." }

Step "Checking Python and PostgreSQL"
# (no ?: shortcuts here - Windows' built-in PowerShell 5.1 doesn't support them)
$python = $null
if (Get-Command py -ErrorAction SilentlyContinue) { $python = "py" }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $python = "python" }
if (-not $python) { throw "Python isn't installed (or not on PATH). Install Python 3.12+ from python.org and tick 'Add python.exe to PATH'." }
$pgBin = (Get-Command psql -ErrorAction SilentlyContinue | ForEach-Object { Split-Path $_.Source })
if (-not $pgBin) { $pgBin = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 | ForEach-Object { Split-Path $_.FullName } }
if (-not $pgBin) { throw "PostgreSQL isn't installed. Install it from postgresql.org, then run this again." }
$psql = Get-ChildItem $pgBin -Filter "psql*" | Where-Object { $_.BaseName -eq "psql" } | Select-Object -First 1 -ExpandProperty FullName
Write-Host "Python: $python   PostgreSQL: $pgBin"

Step "Creating the database"
$pgAdminPass = Read-Host "Password of the PostgreSQL 'postgres' user (set when PostgreSQL was installed)" -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgAdminPass))
$dbPass = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
$exists = & $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'"
if ($LASTEXITCODE -ne 0) { throw "Couldn't connect to PostgreSQL - check the 'postgres' password." }
if ($exists -eq "1") { & $psql -U postgres -h localhost -c "ALTER USER $DbUser WITH PASSWORD '$dbPass';" | Out-Null }
else { & $psql -U postgres -h localhost -c "CREATE USER $DbUser WITH PASSWORD '$dbPass';" | Out-Null }
$dbExists = & $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'"
if ($dbExists -ne "1") { & $psql -U postgres -h localhost -c "CREATE DATABASE $DbName OWNER $DbUser;" | Out-Null; Write-Host "Database $DbName created." }
else { Write-Host "Database $DbName already exists - keeping its data." }
Remove-Item Env:PGPASSWORD

Step "Writing backend\.env (with a new random security key)"
$envFile = Join-Path $backend ".env"
$secret  = [Convert]::ToBase64String((1..48 | ForEach-Object { [byte](Get-Random -Maximum 256) }))
if (Test-Path $envFile) { Copy-Item $envFile "$envFile.bak" -Force; Write-Host "Existing .env saved as .env.bak" }
$tz = Read-Host "Time zone (press Enter for Asia/Karachi)"; if (-not $tz) { $tz = "Asia/Karachi" }
# ASCII without BOM - a BOM breaks the first setting (the problem hit during development)
[IO.File]::WriteAllText($envFile, @"
DATABASE_URL=postgresql+psycopg://${DbUser}:${dbPass}@localhost:5432/$DbName
SECRET_KEY=$secret
TIMEZONE=$tz
ENVIRONMENT=production
CORS_ORIGINS=
"@, [Text.Encoding]::ASCII)

Step "Installing Python packages (a few minutes)"
Push-Location $backend
if (-not (Test-Path "venv\Scripts\python.exe")) { & $python -m venv venv }
& .\venv\Scripts\python.exe -m pip install --upgrade pip --quiet
& .\venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
if ($LASTEXITCODE -ne 0) { throw "Installing packages failed - check the internet connection and run again." }

Step "Setting up the tables"
if ($RestoreFrom) {
  if (-not (Test-Path $RestoreFrom)) { throw "Can't find $RestoreFrom" }
  $env:PGPASSWORD = $dbPass
  & $psql -U $DbUser -h localhost -d $DbName -q -f $RestoreFrom | Out-Null
  Remove-Item Env:PGPASSWORD
  Write-Host "Restored your prepared database from $RestoreFrom"
}
& .\venv\Scripts\python.exe -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw "Setting up the tables failed (see above)." }
& .\venv\Scripts\python.exe -m scripts.seed
Pop-Location

Step "Opening port $Port in Windows Firewall (for tablets and phones on the shop Wi-Fi)"
Get-NetFirewallRule -DisplayName "Cake Studio" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
# All profiles: Windows often labels shop Wi-Fi "Public", which would silently block the tablets.
New-NetFirewallRule -DisplayName "Cake Studio" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null

Step "Starting automatically at boot, and a nightly backup"
$pwsh = (Get-Command powershell.exe).Source
$start = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\start-server.ps1`" -Port $Port"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "Cake Studio Server" -Action $start -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $settings -User "SYSTEM" -RunLevel Highest -Force | Out-Null
$backup = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\backup.ps1`""
Register-ScheduledTask -TaskName "Cake Studio Backup" -Action $backup -Trigger (New-ScheduledTaskTrigger -Daily -At 11pm) -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable) -User "SYSTEM" -RunLevel Highest -Force | Out-Null
# Stop any copy already running (e.g. re-running the installer), then start fresh
Stop-ScheduledTask -TaskName "Cake Studio Server" -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like "*uvicorn*app.main*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-ScheduledTask -TaskName "Cake Studio Server"

Step "Checking it's running"
$ok = $false
foreach ($i in 1..30) { Start-Sleep 2; try { if ((Invoke-WebRequest "http://localhost:$Port/health" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { $ok = $true; break } } catch {} }
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress
if (-not $ok) { Write-Host "`nThe server didn't answer. See backend\logs\server.log" -ForegroundColor Red; exit 1 }
Write-Host "`nCake Studio is running." -ForegroundColor Green
Write-Host "  On this PC:              http://localhost:$Port"
Write-Host "  Tablets / phones (Wi-Fi): http://${ip}:$Port"
if (-not $RestoreFrom) { Write-Host "  Sign in: owner@cakestudio.local / change-me   <- CHANGE THIS PASSWORD NOW" -ForegroundColor Yellow }
Write-Host "  Backups: $backend\backups (nightly at 11 pm, 30 days kept)"
Write-Host "  Tip: give this PC a fixed IP in the Wi-Fi router so the tablet address never changes."
