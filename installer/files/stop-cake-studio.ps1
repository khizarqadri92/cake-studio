<#  Used by the installer before replacing files on an update: stops the
    running Cake Studio server so its files aren't locked. (PostgreSQL is the
    client's own program and keeps running.)                                 #>
Stop-ScheduledTask -TaskName "Cake Studio Server" -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*uvicorn*app.main*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
exit 0
