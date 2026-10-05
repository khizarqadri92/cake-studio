<#  Backs up Cake Studio (database + logo/design photos) to one .zip in
    C:\ProgramData\CakeStudio\backups and keeps 30 days.
    Nightly via the "Cake Studio Backup" task, or Start menu > Back up now. #>
param([switch]$Scheduled, [string]$DataDir = "", [string]$AppDir = "")
. (Join-Path $PSScriptRoot "common.ps1")
if (-not $Scheduled -and (Restart-Elevated $PSCommandPath)) { exit }
$P = Get-CakePaths -AppDir $AppDir -DataDir $DataDir
try {
  New-Item -ItemType Directory $P.Backups -Force | Out-Null
  $file = Join-Path $P.Backups ("cake-studio-{0:yyyyMMdd-HHmm}.zip" -f (Get-Date))
  New-CakeBackup $P $file | Out-Null
  # Only after a good backup: drop ones older than 30 days (never the before-update/restore safety copies' newest)
  Get-ChildItem $P.Backups -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
  if (-not $Scheduled) {
    Show-Message "Backup saved:`n$file`n`nCopy it to a USB drive or cloud folder now and then - a backup on the same PC won't survive a failed disk."
    if ($script:OnWindows) { Start-Process explorer.exe "/select,`"$file`"" }
  }
  Write-Host "Backup saved: $file"
} catch {
  if (-not $Scheduled) { Show-Message "Backup failed:`n$($_.Exception.Message)" -Icon "Error" }
  Write-Host "Backup failed: $($_.Exception.Message)"; exit 1
}
