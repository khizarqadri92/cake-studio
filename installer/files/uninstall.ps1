<#  Called by the uninstaller. The database belongs to you (restored by hand)
    and is NEVER deleted. -DeleteData removes only Cake Studio's own files in
    C:\ProgramData\CakeStudio (settings, logo files, logs, backups), after
    saving a final backup to Documents.                                     #>
param([switch]$DeleteData, [string]$AppDir = "", [string]$DataDir = "")
. (Join-Path $PSScriptRoot "common.ps1")
$P = Get-CakePaths -AppDir $AppDir -DataDir $DataDir
Stop-CakeServer
Unregister-ScheduledTask -TaskName $script:ServerTask -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $script:BackupTask -Confirm:$false -ErrorAction SilentlyContinue
Get-NetFirewallRule -DisplayName "Cake Studio" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
if ($DeleteData) {
  $docs = [Environment]::GetFolderPath("MyDocuments")
  try { New-CakeBackup $P (Join-Path $docs ("Cake Studio final backup {0:yyyy-MM-dd HHmm}.zip" -f (Get-Date))) | Out-Null } catch {}
  Remove-Item $P.Data -Recurse -Force -ErrorAction SilentlyContinue
}
