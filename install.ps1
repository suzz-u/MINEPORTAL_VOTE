# MINEPORTAL_AUTO_VOTE - Windows installer (no Mark-of-the-Web, no SmartScreen)
#
# Usage (recommended, no download of this script needed):
#   irm https://raw.githubusercontent.com/suzz-u/MINEPORTAL_VOTE/main/install.ps1 | iex
#
# Usage (from a local zip):
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 -ZipPath .\MINEPORTAL_AUTO_VOTE-windows-x64.zip
#
# Optional:
#   -Url <url>          zip URL (default: latest GitHub release)
#   -Sha256 <hash>      verify the downloaded zip
#   -InstallDir <path>  install location (default: %LOCALAPPDATA%\MINEPORTAL_AUTO_VOTE)
#   -NoLaunch           do not run the exe once after install

[CmdletBinding()]
param(
    [string]$Url = "https://github.com/suzz-u/MINEPORTAL_VOTE/releases/latest/download/MINEPORTAL_AUTO_VOTE-windows-x64.zip",
    [string]$ZipPath = "",
    [string]$Sha256 = "",
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "MINEPORTAL_AUTO_VOTE"),
    [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$tmp = Join-Path $env:TEMP ("mpv-install-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

try {
    $zip = ""
    if ($ZipPath) {
        $zip = (Resolve-Path $ZipPath).Path
        Write-Host "Using local zip: $zip"
    }
    else {
        if (-not $Url) { throw "Specify -Url or -ZipPath." }
        $zip = Join-Path $tmp "app.zip"
        Write-Host "Downloading: $Url"
        Invoke-WebRequest -Uri $Url -OutFile $zip -UseBasicParsing
    }

    if ($Sha256) {
        $actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
        if ($actual -ne $Sha256.ToLower()) {
            throw "SHA-256 mismatch. expected=$($Sha256.ToLower()) actual=$actual"
        }
        Write-Host "SHA-256 OK"
    }

    Write-Host "Extracting..."
    Expand-Archive -Path $zip -DestinationPath $tmp -Force

    $src = Join-Path $tmp "MINEPORTAL_AUTO_VOTE"
    if (-not (Test-Path $src)) {
        $src = (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName
    }

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item (Join-Path $src "*") $InstallDir -Recurse -Force
    Write-Host "Installed to: $InstallDir"

    $exe = Join-Path $InstallDir "MINEPORTAL_AUTO_VOTE.exe"

    if (-not $NoLaunch) {
        Write-Host ""
        Write-Host "Creating config.json (first run)..."
        Start-Process -FilePath $exe -Wait -WindowStyle Hidden | Out-Null
        Write-Host "config.json created."
    }

    Write-Host ""
    Write-Host "=================================================="
    Write-Host " Done."
    Write-Host ""
    Write-Host " Next steps:"
    Write-Host "   1) Open config.json and set your MCID:"
    Write-Host "      $InstallDir\config.json"
    Write-Host "   2) Test (no vote is sent):"
    Write-Host "      `"$exe`" --once --dry-run"
    Write-Host "   3) Run for real:"
    Write-Host "      `"$exe`" --once            (one vote, for Task Scheduler)"
    Write-Host "      `"$exe`"                   (resident mode)"
    Write-Host "=================================================="
}
finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
