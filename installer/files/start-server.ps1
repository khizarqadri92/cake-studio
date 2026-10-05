<#  Runs Cake Studio (started at boot by the "Cake Studio Server" task).
    PostgreSQL runs as its own Windows service; we wait until it answers. #>
. (Join-Path $PSScriptRoot "common.ps1")
$P = Get-CakePaths
$port = if (Test-Path $P.PortFile) { (Get-Content $P.PortFile -Raw).Trim() } else { "8000" }
New-Item -ItemType Directory $P.Logs -Force | Out-Null
$log = Join-Path $P.Logs "server.log"
if ((Test-Path $log) -and ((Get-Item $log).Length -gt 10MB)) { Move-Item $log "$log.old" -Force }
Wait-Database $P 300
$env:CAKESTUDIO_ENV_FILE = $P.EnvFile
Set-Location $P.Backend
# uvicorn logs to stderr; under PowerShell 5.1 that must not count as an error.
$ErrorActionPreference = "Continue"
& $P.Python -m uvicorn app.main:app --host 0.0.0.0 --port $port *>> $log
