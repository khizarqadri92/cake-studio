<# Starts the Cake Studio server (used by the "Cake Studio Server" startup task). #>
param([int]$Port = 8000)
$backend = Join-Path (Split-Path -Parent $PSScriptRoot) "backend"
Set-Location $backend
New-Item -ItemType Directory "logs" -Force | Out-Null
$log = Join-Path $backend "logs\server.log"
if ((Test-Path $log) -and ((Get-Item $log).Length -gt 10MB)) { Move-Item $log "$log.old" -Force }   # keep the log small
& .\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port $Port *>> $log
