<#  Shared helpers for the Cake Studio installer scripts (Windows PowerShell 5.1+).
    PostgreSQL and the Cake Studio database are set up BY HAND (restored from a
    backup); the installer is given the connection details and stores them in
    the settings file. Everything here reads them from there.                   #>
$ErrorActionPreference = "Stop"

# $IsWindows only exists in PowerShell 6+; Windows PowerShell 5.1 is always Windows.
$script:OnWindows = if (Test-Path variable:IsWindows) { $IsWindows } else { $true }

# Never let a database connection attempt hang: give up after 10 seconds.
$env:PGCONNECT_TIMEOUT = "10"

$script:ServerTask = "Cake Studio Server"
$script:BackupTask = "Cake Studio Backup"

function Find-PostgresBin {
  <# The newest PostgreSQL installed with the official (EnterpriseDB) installer. #>
  $found = @()
  foreach ($key in (Get-ChildItem "HKLM:\SOFTWARE\PostgreSQL\Installations" -ErrorAction SilentlyContinue)) {
    $base = (Get-ItemProperty $key.PSPath -ErrorAction SilentlyContinue)."Base Directory"
    if ($base -and (Test-Path (Join-Path $base "bin\psql.exe"))) { $found += (Join-Path $base "bin") }
  }
  $found += Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | ForEach-Object { $_.DirectoryName }
  $found | Sort-Object { [int]((Split-Path (Split-Path $_ -Parent) -Leaf) -replace "\D", "") } -Descending | Select-Object -First 1
}

function Get-CakePaths {
  param([string]$AppDir, [string]$DataDir)
  if (-not $AppDir)  { $AppDir  = Split-Path -Parent $PSScriptRoot }
  if (-not $DataDir) { $DataDir = if ($env:CAKESTUDIO_DATA) { $env:CAKESTUDIO_DATA } else { Join-Path $env:ProgramData "CakeStudio" } }
  $exe = if ($script:OnWindows) { ".exe" } else { "" }
  $pgBinFile  = Join-Path $DataDir "config\pgbin.txt"

  $pgBin = if ($env:CAKESTUDIO_PGBIN) { $env:CAKESTUDIO_PGBIN }
           elseif (Test-Path $pgBinFile) { (Get-Content $pgBinFile -Raw).Trim() }
           else { Find-PostgresBin }
  $py = if ($env:CAKESTUDIO_PYTHON) { $env:CAKESTUDIO_PYTHON } else { Join-Path $AppDir "python\python.exe" }
  [pscustomobject]@{
    App        = $AppDir
    Backend    = Join-Path $AppDir "app\backend"
    Python     = $py
    PgBin      = $pgBin
    Psql       = if ($pgBin) { Join-Path $pgBin "psql$exe" } else { "" }
    PgDump     = if ($pgBin) { Join-Path $pgBin "pg_dump$exe" } else { "" }
    PgReady    = if ($pgBin) { Join-Path $pgBin "pg_isready$exe" } else { "" }
    Data       = $DataDir
    Config     = Join-Path $DataDir "config"
    EnvFile    = Join-Path $DataDir "config\cakestudio.env"
    PortFile   = Join-Path $DataDir "config\port.txt"
    PgBinFile  = $pgBinFile
    Result     = Join-Path $DataDir "config\install-result.txt"
    Static     = Join-Path $DataDir "static"
    Uploads    = Join-Path $DataDir "static\uploads"
    Backups    = Join-Path $DataDir "backups"
    Logs       = Join-Path $DataDir "logs"
  }
}

function Hide-Secrets([string]$Text) {
  # Never show database passwords in messages or logs: ://user:password@ -> ://user:***@
  return ($Text -replace '(://[^:/@\s]+:)[^@\s]*@', '$1***@')
}

function Invoke-Native([string]$Exe, [string[]]$Arguments) {
  <# Runs a program and returns its exit code and output lines.
     Windows PowerShell 5.1 turns ANY line a program writes to stderr (notices,
     warnings, alembic's INFO logs) into a fatal error when ErrorActionPreference
     is "Stop" - so it's relaxed just while the program runs, and the exit code
     decides success instead. #>
  $saved = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    # "$null |" gives the program an empty, closed input, so it can never sit
    # waiting for someone to type (e.g. psql asking for a password).
    $lines = @($null | & $Exe @Arguments 2>&1 | ForEach-Object { "$_" })
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $saved }
  # psql on Windows warns about the console code page; it's harmless noise.
  $lines = @($lines | Where-Object { $_ -notmatch "Console code page|8-bit characters might not work|See psql reference|Notes for Windows users" } | ForEach-Object { Hide-Secrets $_ })
  [pscustomobject]@{ Code = $code; Output = $lines }
}

function Test-PsqlAnswer([string]$Output, [string]$Expected) {
  # True if one of psql's output lines is exactly the expected answer
  # (ignores any other lines, e.g. warnings).
  return @($Output -split "`r?`n" | ForEach-Object { $_.Trim() }) -contains $Expected
}

function New-Secret([int]$Length = 32) {
  # Letters and digits only: safe inside URLs and config files without escaping.
  $chars = [char[]]"abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  $bytes = New-Object byte[] $Length
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Write-TextFile([string]$Path, [string]$Text) {
  # No BOM - a BOM breaks the first setting in the file.
  [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding($false)))
}

function Read-SecretFile([string]$Path) {
  # Passwords handed over by the installer; the file is deleted straight after reading.
  $text = (Get-Content $Path -Raw -Encoding UTF8).TrimStart([char]0xFEFF).TrimEnd("`r", "`n")
  Remove-Item $Path -Force -ErrorAction SilentlyContinue
  return $text
}

function Read-EnvValue($Paths, [string]$Name) {
  if (-not (Test-Path $Paths.EnvFile)) { return $null }
  $line = Get-Content $Paths.EnvFile | Where-Object { $_ -like "$Name=*" } | Select-Object -First 1
  if ($line) { return $line.Substring($Name.Length + 1) } else { return $null }
}

function Get-DbConnection($Paths) {
  # DATABASE_URL=postgresql+psycopg://user:password@host:port/database
  $url = Read-EnvValue $Paths "DATABASE_URL"
  if (-not ($url -and $url -match "://(?<user>[^:]+):(?<pw>[^@]*)@(?<host>[^:/]+):?(?<port>\d*)/(?<db>[^?]+)")) {
    throw "Couldn't read the database connection from $($Paths.EnvFile)"
  }
  [pscustomobject]@{
    User = [Uri]::UnescapeDataString($Matches.user); Password = [Uri]::UnescapeDataString($Matches.pw)
    Host = $Matches.host; Port = $(if ($Matches.port) { [int]$Matches.port } else { 5432 }); Database = $Matches.db
  }
}

function Get-DbPassword($Paths) { (Get-DbConnection $Paths).Password }

function Invoke-Psql($Paths, [string]$User, [string]$Password, [string]$Database, [string[]]$Arguments) {
  $env:PGPASSWORD = $Password
  try {
    # -w: never stop and wait for a password prompt
    $c = Get-DbConnection $Paths
    $r = Invoke-Native $Paths.Psql (@("-w", "-X", "-h", $c.Host, "-p", "$($c.Port)", "-U", $User, "-d", $Database, "-v", "ON_ERROR_STOP=1") + $Arguments)
    if ($r.Code -ne 0) { throw "psql failed: $($r.Output -join ' ')" }
    return ($r.Output -join "`n")
  } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
}

function Wait-Database($Paths, [int]$Seconds = 90) {
  # Waits for PostgreSQL to accept connections (e.g. right after the PC starts).
  $c = Get-DbConnection $Paths
  if (-not $Paths.PgReady -or -not (Test-Path $Paths.PgReady)) { Start-Sleep -Seconds 5; return }   # no tools to check with: short pause
  for ($i = 0; $i -lt $Seconds; $i++) {
    if ((Invoke-Native $Paths.PgReady @("-h", $c.Host, "-p", "$($c.Port)", "-q")).Code -eq 0) { return }
    Start-Sleep -Seconds 1
  }
  throw "PostgreSQL isn't answering on $($c.Host):$($c.Port). Check its Windows service is running (Services > postgresql-x64-...)."
}

function Invoke-Backend($Paths, [string[]]$Arguments, [hashtable]$ExtraEnv = @{}) {
  # Runs "python -m ..." inside the backend with the installed settings file.
  $env:CAKESTUDIO_ENV_FILE = $Paths.EnvFile
  foreach ($k in $ExtraEnv.Keys) { Set-Item "env:$k" $ExtraEnv[$k] }
  Push-Location $Paths.Backend
  try {
    $r = Invoke-Native $Paths.Python (@("-W", "ignore") + $Arguments)
    $r.Output | ForEach-Object { Write-Host "    $_" }
    if ($r.Code -ne 0) {
      # The useful line is the database / Python error itself, e.g. "permission denied for table ..."
      $why = $r.Output | Where-Object { $_ -match "Error:|permission denied|does not exist|password authentication|could not connect|denied" } | Select-Object -Last 1
      if (-not $why) { $why = ($r.Output | Select-Object -Last 2) -join " " }
      throw "Step failed (python $($Arguments -join ' ')): $($why.Trim())"
    }
  } finally {
    Pop-Location
    foreach ($k in $ExtraEnv.Keys) { Remove-Item "env:$k" -ErrorAction SilentlyContinue }
  }
}

function Stop-CakeServer {
  if (-not $script:OnWindows) { return }
  Stop-ScheduledTask -TaskName $script:ServerTask -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*uvicorn*app.main*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Start-CakeServer {
  if (-not $script:OnWindows) { return }
  Start-ScheduledTask -TaskName $script:ServerTask
}

function Test-Admin {
  if (-not $script:OnWindows) { return $true }
  ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Restart-Elevated([string]$ScriptPath, [string]$Arguments = "") {
  # Start-menu shortcuts can't request admin rights themselves, so the script asks.
  if (Test-Admin) { return $false }
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" $Arguments"
  return $true
}

function Show-Message([string]$Text, [string]$Title = "Cake Studio", [string]$Icon = "Information") {
  if ($script:OnWindows -and -not $env:CAKESTUDIO_NONINTERACTIVE) {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show($Text, $Title, "OK", $Icon)
  } else { Write-Host "[$Title] $Text" }
}

function New-CakeBackup($Paths, [string]$Destination) {
  <# One .zip: database.sql + uploads (logo, design photos). The same format is
     accepted as a "prepared setup" by the installer and by restore. #>
  $c = Get-DbConnection $Paths
  if (-not $Paths.PgDump -or -not (Test-Path $Paths.PgDump)) { throw "pg_dump wasn't found - is PostgreSQL installed on this PC?" }
  $work = Join-Path ([IO.Path]::GetTempPath()) ("cakestudio-backup-" + [guid]::NewGuid())
  New-Item -ItemType Directory $work | Out-Null
  try {
    $env:PGPASSWORD = $c.Password
    $r = Invoke-Native $Paths.PgDump @("-w", "-h", $c.Host, "-p", "$($c.Port)", "-U", $c.User, "-d", $c.Database, "--no-owner", "--no-privileges", "-f", (Join-Path $work "database.sql"))
    if ($r.Code -ne 0) { throw "pg_dump failed: $($r.Output -join ' ')" }
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if (Test-Path $Paths.Uploads) { Copy-Item $Paths.Uploads (Join-Path $work "uploads") -Recurse }
    Write-TextFile (Join-Path $work "cake-studio-backup.txt") "Cake Studio backup made $(Get-Date -Format s). Restore it with Start menu > Cake Studio > Restore a backup."
    if (Test-Path $Destination) { Remove-Item $Destination -Force }
    Compress-Archive -Path (Join-Path $work "*") -DestinationPath $Destination
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
  }
  return $Destination
}
