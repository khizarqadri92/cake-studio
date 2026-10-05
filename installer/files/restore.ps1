<#  Start menu > Cake Studio > Restore a backup.
    Makes a safety backup of the current data first, then replaces it.     #>
param([string]$File = "", [string]$DataDir = "", [string]$AppDir = "")
. (Join-Path $PSScriptRoot "common.ps1")
if (Restart-Elevated $PSCommandPath) { exit }
$P = Get-CakePaths -AppDir $AppDir -DataDir $DataDir
try {
  if (-not $File) {
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Title = "Choose the Cake Studio backup to restore"
    $dlg.InitialDirectory = $P.Backups
    $dlg.Filter = "Cake Studio backups (*.zip;*.sql)|*.zip;*.sql"
    if ($dlg.ShowDialog() -ne "OK") { exit }
    $File = $dlg.FileName
    Add-Type -AssemblyName System.Windows.Forms
    $answer = [System.Windows.Forms.MessageBox]::Show(
      "Replace ALL current Cake Studio data with:`n$File`n`nA safety backup of the current data is made first.", "Restore a backup", "OKCancel", "Warning")
    if ($answer -ne "OK") { exit }
  }
  $safety = Join-Path $P.Backups ("before-restore-{0:yyyyMMdd-HHmmss}.zip" -f (Get-Date))
  New-CakeBackup $P $safety | Out-Null
  Write-Host "Safety backup: $safety"

  Stop-CakeServer
  Reset-CakeDatabase $P
  if (Test-Path $P.Uploads) { Remove-Item (Join-Path $P.Uploads "*") -Recurse -Force -ErrorAction SilentlyContinue }
  Import-CakeBackup $P $File
  Invoke-Backend $P @("-m", "alembic", "upgrade", "head")      # a backup from an older version gets current tables
  Start-CakeServer
  Show-Message "Restored from:`n$File`n`nIf this was the wrong file, restore the safety copy:`n$safety"
  Write-Host "Restored from $File"
} catch {
  Start-CakeServer
  Show-Message "Restore failed - nothing was lost; the safety copy is in the backups folder.`n`n$($_.Exception.Message)" -Icon "Error"
  Write-Host "Restore failed: $($_.Exception.Message)"; exit 1
}
