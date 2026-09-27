<# Backs up the Cake Studio database to backend\backups and keeps the last 30 days.
   Runs nightly via the "Cake Studio Backup" task; you can also run it any time. #>
$backend = Join-Path (Split-Path -Parent $PSScriptRoot) "backend"
$line = Get-Content (Join-Path $backend ".env") | Where-Object { $_ -like "DATABASE_URL=*" } | Select-Object -First 1
if ($line -notmatch "://(?<user>[^:]+):(?<pass>[^@]+)@(?<host>[^:/]+):?(?<port>\d*)/(?<db>.+)$") { throw "Couldn't read DATABASE_URL from backend\.env" }
# Use the exact pg_dump that was found (on PATH, or the newest PostgreSQL install)
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $pgDump) { $pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName }
if (-not $pgDump) { throw "pg_dump wasn't found - is PostgreSQL installed?" }
$dir = Join-Path $backend "backups"; New-Item -ItemType Directory $dir -Force | Out-Null
$file = Join-Path $dir ("cake-studio-{0:yyyyMMdd-HHmm}.sql" -f (Get-Date))
$env:PGPASSWORD = [Uri]::UnescapeDataString($Matches.pass)
& $pgDump -h $Matches.host -p ($(if ($Matches.port) { $Matches.port } else { 5432 })) -U $Matches.user -d $Matches.db --no-owner -f $file
Remove-Item Env:PGPASSWORD
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $file)) { throw "Backup failed." }
Get-ChildItem $dir -Filter "cake-studio-*.sql" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item
Write-Host "Backup saved: $file"
