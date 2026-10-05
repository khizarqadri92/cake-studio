<#
  Run on YOUR computer: saves your Cake Studio database to one file you
  restore by hand on the client's PC (see DEPLOYMENT.md).

      cd E:\Projects\cake-studio\installer
      .\export-database.ps1                 ->  E:\Projects\cake_studio.sql

  Clear test orders first if needed:
      cd ..\backend; .\venv\Scripts\Activate.ps1
      python -m scripts.reset_for_deployment --keep-staff YOUR-ADMIN-EMAIL
#>
param([string]$Out = "")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $Out) { $Out = Join-Path (Split-Path -Parent $root) "cake_studio.sql" }
$line = Get-Content (Join-Path $root "backend\.env") | Where-Object { $_ -like "DATABASE_URL=*" } | Select-Object -First 1
if ($line -notmatch "://(?<user>[^:]+):(?<pass>[^@]+)@(?<host>[^:/]+):?(?<port>\d*)/(?<db>.+)$") { throw "Couldn't read DATABASE_URL from backend\.env" }
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $pgDump) { $pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName }
if (-not $pgDump) { throw "pg_dump wasn't found - is PostgreSQL installed?" }
$env:PGPASSWORD = [Uri]::UnescapeDataString($Matches.pass)
$port = if ($Matches.port) { $Matches.port } else { "5432" }
$ErrorActionPreference = "Continue"   # pg_dump notices on stderr aren't errors
# --no-owner/--no-privileges: on the client, the tables belong to whoever restores them
& $pgDump -h $Matches.host -p $port -U $Matches.user -d $Matches.db --no-owner --no-privileges -f $Out
$code = $LASTEXITCODE
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
if ($code -ne 0) { throw "pg_dump failed (see above)." }
Write-Host ("Saved: $Out  ({0:N1} MB)" -f ((Get-Item $Out).Length / 1MB)) -ForegroundColor Green
Write-Host "Copy it to the client's PC with the installer, then restore it as described in DEPLOYMENT.md."
