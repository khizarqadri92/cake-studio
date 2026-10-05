<#  Used by the installer's database page: can Cake Studio sign in to the
    database you restored, and is it a Cake Studio database? Writes a one-line
    answer to -Out. Exit 0 = OK, 5 = connected but empty. Never waits more than
    ~30 seconds; a timing log is kept in %TEMP%\cakestudio-db-check.log.        #>
param([string]$PgBin, [string]$DbHost = "localhost", [int]$Port = 5432, [string]$Database, [string]$User, [string]$PasswordFile, [string]$Out)
$ErrorActionPreference = "Continue"   # (5.1 would treat psql's stderr warnings as fatal)
$logFile = Join-Path ([IO.Path]::GetTempPath()) "cakestudio-db-check.log"
$clock = [Diagnostics.Stopwatch]::StartNew()
function Log([string]$Text) { Add-Content -Path $logFile -Value ("{0,6:N1}s  {1}" -f $clock.Elapsed.TotalSeconds, $Text) }
function Answer([string]$Text, [int]$Code) { Log "answer ($Code): $Text"; [IO.File]::WriteAllText($Out, $Text); exit $Code }
Set-Content -Path $logFile -Value "Cake Studio database check $(Get-Date -Format s)  $User@${DbHost}:$Port/$Database  tools=$PgBin"

$psql = Join-Path $PgBin "psql.exe"
if (-not (Test-Path $psql)) { $psql = Join-Path $PgBin "psql" }
if (-not $PgBin -or -not (Test-Path $psql)) { Answer "PostgreSQL's tools weren't found on this PC, so the connection can't be tested here." 6 }
$password = (Get-Content $PasswordFile -Raw -Encoding UTF8).TrimStart([char]0xFEFF).TrimEnd("`r", "`n")
Remove-Item $PasswordFile -Force -ErrorAction SilentlyContinue

# Also: how many Cake Studio tables belong to a DIFFERENT user? Updates need to
# own the tables, so that must be caught here, before installing.
$sql = "SELECT 'ok|' || (to_regclass('public.alembic_version') IS NOT NULL)::text || '|' || (to_regclass('public.staff') IS NOT NULL)::text || '|' || " +
       "(SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tableowner <> current_user)::text || '|' || " +
       "coalesce((SELECT tableowner FROM pg_tables WHERE schemaname='public' AND tableowner <> current_user LIMIT 1), '')"
$psi = New-Object Diagnostics.ProcessStartInfo
$psi.FileName = $psql
$psi.Arguments = "-w -X -h ""$DbHost"" -p $Port -U ""$User"" -d ""$Database"" -tAc ""$sql"""
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true; $psi.RedirectStandardInput = $true
$psi.CreateNoWindow = $true
$psi.EnvironmentVariables["PGPASSWORD"] = $password
$psi.EnvironmentVariables["PGCONNECT_TIMEOUT"] = "10"
Log "starting psql"
$proc = [Diagnostics.Process]::Start($psi)
$proc.StandardInput.Close()
$outTask = $proc.StandardOutput.ReadToEndAsync(); $errTask = $proc.StandardError.ReadToEndAsync()
if (-not $proc.WaitForExit(30000)) {
  try { $proc.Kill() } catch {}
  Answer "PostgreSQL didn't answer within 30 seconds. Check its service is running (Services > postgresql-x64-...) and that security software isn't blocking psql.exe." 2
}
$stdout = $outTask.Result; $code = $proc.ExitCode
Log "psql finished, exit $code"
$text = (($errTask.Result + "`n" + $stdout) -split "`r?`n" | Where-Object { $_ -notmatch "Console code page|8-bit characters might not work|See psql reference|Notes for Windows users" -and $_.Trim() }) -join " "
if ($code -ne 0) {
  if ($text -match "password authentication failed") { Answer "Wrong user name or password for the database." 1 }
  if ($text -match "database .* does not exist") { Answer "There's no database called '$Database'. Check the name (restore your backup into it first)." 1 }
  if ($text -match "Connection refused|could not connect|No such file|timeout expired|could not translate host") { Answer "PostgreSQL isn't reachable at ${DbHost}:$Port. Check its service is running and the port." 2 }
  Answer "Couldn't connect: $($text.Trim())" 2
}
$line = $stdout -split "`r?`n" | Where-Object { $_ -like "ok|*" } | Select-Object -Last 1
if (-not $line) { Answer "Connected, but got an unexpected reply: $($text.Trim())" 2 }
$p = $line.Trim().Split("|")
if ([int]$p[3] -gt 0) {
  Answer ("Connected, but $($p[3]) table(s) in '$Database' belong to the user '$($p[4])', not '$User'. " +
          "Enter '$($p[4])' as the user on this page (the user that restored the backup).") 7
}
if ($p[1] -eq "true" -or $p[2] -eq "true") { Answer "Connected - this database contains Cake Studio data." 0 }
Answer "Connected, but the database '$Database' is empty (no Cake Studio data in it). Restore your backup into it first, or continue to start with a fresh, empty system." 5
