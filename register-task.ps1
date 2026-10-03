$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) {
    Write-Host "[ERROR] node.exe was not found. Run install.bat first." -ForegroundColor Red
    exit 1
}

$taskName = "MinePortalVote"
$indexJs = Join-Path $scriptDir "index.js"

$action = New-ScheduledTaskAction -Execute $nodeExe -Argument "`"$indexJs`" --once" -WorkingDirectory $scriptDir
$trigger = New-ScheduledTaskTrigger -Daily -At 00:05
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "MinePortal auto vote (daily 00:05 JST)" `
    -Force | Out-Null

Write-Host ""
Write-Host "Registered task: $taskName (daily 00:05, run when available)" -ForegroundColor Green
Write-Host "  Node  : $nodeExe"
Write-Host "  Script: $indexJs"
