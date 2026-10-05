<#  Called by CakeStudio-Setup.exe after the files are copied. The database was
    restored BY HAND; this connects the app to it. Safe to run again: on an
    update it keeps the settings, backs up first, and upgrades the tables.

    First install:
      setup.ps1 -DbHost localhost -DbPort 5432 -DbName cake_studio -DbUser cake
                -DbPasswordFile x.txt -Port 8000 -TimeZone Asia/Karachi [-PgBin "...\bin"]
    Update:  setup.ps1                                                           #>
param(
  [string]$DbHost = "localhost",
  [int]$DbPort = 5432,
  [string]$DbName = "",
  [string]$DbUser = "",
  [string]$DbPasswordFile = "",
  [string]$PgBin = "",
  [int]$Port = 8000,
  [string]$TimeZone = "Asia/Karachi",
  [string]$AppDir = "",
  [string]$DataDir = ""
)
. (Join-Path $PSScriptRoot "common.ps1")
$P = Get-CakePaths -AppDir $AppDir -DataDir $DataDir
foreach ($d in @($P.Data, $P.Config, $P.Static, $P.Uploads, $P.Backups, $P.Logs)) { New-Item -ItemType Directory $d -Force | Out-Null }
$log = Join-Path $P.Logs ("install-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
Start-Transcript -Path $log | Out-Null
function Step($t) { Write-Host "`n== $t" }

try {
  if ($script:OnWindows) {
    Step "Protecting the settings folder (it holds the database password)"
    & icacls $P.Config /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null   # SYSTEM, Administrators
  }

  # Database details given = (re)connect, replacing any earlier connection
  # (e.g. after a failed first attempt). None given = update an existing install.
  $isUpgrade = (Test-Path $P.EnvFile) -and -not $DbName
  if (-not $isUpgrade) {
    Step "Saving the database connection ($DbUser@${DbHost}:$DbPort/$DbName)"
    if (-not $DbName -or -not $DbUser -or -not $DbPasswordFile) { throw "The database name, user and password are needed on first install." }
    $dbPw = Read-SecretFile $DbPasswordFile
    # Keep the existing sign-in key if there is one, so nobody is signed out.
    $secret = Read-EnvValue $P "SECRET_KEY"
    if (-not $secret -or $secret.Length -lt 32) { $secret = New-Secret 64 }
    $enc = { param($v) [Uri]::EscapeDataString($v) }
    Write-TextFile $P.EnvFile (@(
      "DATABASE_URL=postgresql+psycopg://$(& $enc $DbUser):$(& $enc $dbPw)@${DbHost}:$DbPort/$DbName",
      "SECRET_KEY=$secret",
      "TIMEZONE=$TimeZone",
      "ENVIRONMENT=production",
      "STATIC_DIR=$($P.Static)",
      "CORS_ORIGINS="
    ) -join "`n")
    $dbPw = $null
    # PostgreSQL's tools are used for nightly backups (pg_dump) and start-up checks.
    if (-not $PgBin) { $PgBin = Find-PostgresBin }
    if ($PgBin) { Write-TextFile $P.PgBinFile $PgBin }
    $P = Get-CakePaths -AppDir $AppDir -DataDir $DataDir
  } else {
    Step "Update: backing up before changing anything"
    $pre = Join-Path $P.Backups ("before-update-{0:yyyyMMdd-HHmm}.zip" -f (Get-Date))
    try { New-CakeBackup $P $pre | Out-Null; Write-Host "    Saved $pre" } catch { Write-Host "    (No backup made: $($_.Exception.Message))" }
  }
  Write-TextFile $P.PortFile "$Port"
  Wait-Database $P

  # Logo / favicon shipped with the installer (logo files aren't in the database)
  $shipped = Join-Path $P.App "app\initial-uploads"
  if (Test-Path $shipped) {
    Step "Adding the logo files"
    Get-ChildItem $shipped -Recurse -File | ForEach-Object {
      $dest = Join-Path $P.Uploads ($_.FullName.Substring($shipped.Length).TrimStart('\', '/'))
      if (-not (Test-Path $dest)) { New-Item -ItemType Directory (Split-Path $dest) -Force | Out-Null; Copy-Item $_.FullName $dest }
    }
  }

  Step "Bringing the database tables up to date"
  $c = Get-DbConnection $P
  if (Test-Path $P.Psql) {
    $foreign = Invoke-Psql $P $c.User $c.Password $c.Database @("-tAc", "SELECT 'owner:' || tableowner FROM pg_tables WHERE schemaname='public' AND tableowner <> current_user LIMIT 1")
    $other = @($foreign -split "`r?`n" | Where-Object { $_ -like "owner:*" }) | Select-Object -First 1
    if ($other) {
      throw ("The tables in '$($c.Database)' belong to the PostgreSQL user '$($other.Substring(6))', but Cake Studio connects as '$($c.User)'. " +
             "Run the installer again and enter '$($other.Substring(6))' as the database user.")
    }
  }
  $before = if (Test-Path $P.Psql) { Invoke-Psql $P $c.User $c.Password $c.Database @("-tAc", "SELECT to_regclass('public.staff') IS NOT NULL") } else { "t" }
  $wasEmpty = -not (Test-PsqlAnswer $before "t")
  Invoke-Backend $P @("-m", "alembic", "upgrade", "head")
  # Restored database: its own accounts are used. Empty database: a starter admin is created.
  if ($wasEmpty) { Invoke-Backend $P @("-m", "scripts.seed") } else { Invoke-Backend $P @("-m", "scripts.seed") @{ CAKESTUDIO_SKIP_DEFAULT_ADMIN = "1" } }

  if ($script:OnWindows) {
    Step "Firewall: allowing tablets and phones on the shop Wi-Fi (port $Port)"
    Get-NetFirewallRule -DisplayName "Cake Studio" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName "Cake Studio" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null

    Step "Starting Cake Studio with Windows, and a nightly backup"
    $ps = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 `
      -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
    $run = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSScriptRoot\start-server.ps1`""
    Register-ScheduledTask -TaskName $script:ServerTask -Action $run -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $settings -User "SYSTEM" -RunLevel Highest -Force | Out-Null
    if ($P.PgDump -and (Test-Path $P.PgDump)) {
      $bk = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSScriptRoot\backup.ps1`" -Scheduled"
      Register-ScheduledTask -TaskName $script:BackupTask -Action $bk -Trigger (New-ScheduledTaskTrigger -Daily -At 11pm) -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable) -User "SYSTEM" -RunLevel Highest -Force | Out-Null
    } else { Write-Host "    PostgreSQL's tools weren't found - nightly backup NOT scheduled." }

    Step "Starting Cake Studio"
    Stop-CakeServer
    Start-CakeServer
    $ok = $false
    foreach ($i in 1..60) { Start-Sleep 2; try { if ((Invoke-WebRequest "http://localhost:$Port/health" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { $ok = $true; break } } catch {} }
    if (-not $ok) { throw "Cake Studio didn't start. See $($P.Logs)\server.log" }
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress
  } else { $ip = "127.0.0.1" }

  $tablet = if ($ip) { "http://${ip}:$Port" } else { "(connect this PC to the shop network)" }
  $note = if ($wasEmpty) { "EMPTY" } else { "" }
  Write-TextFile $P.Result "OK`nhttp://localhost:$Port`n$tablet`n$note"
  Write-Host "`nDone. On this PC: http://localhost:$Port   Tablets and phones: $tablet"
  exit 0
} catch {
  $msg = Hide-Secrets $_.Exception.Message
  Write-Host "`nFAILED: $msg"
  Write-TextFile $P.Result "FAILED`n$msg`n$log"
  exit 1
} finally {
  Stop-Transcript | Out-Null
}
