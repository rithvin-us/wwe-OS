# Installs the cloudflared tunnel as a real Windows service, so it survives
# reboot/logoff instead of dying whenever the terminal that started
# `start-tunnel.ps1` closes. This is the REQUIRED setup for any machine that
# hosts the Face-AI / Telegram-bot local services — Render's production
# backend depends on ai.water-works.in and bot.water-works.in staying up
# 24/7, not just while someone has a terminal open.
#
# Run this once, from an elevated ("Run as Administrator") PowerShell.
# Safe to re-run: cloudflared service install is idempotent, and this script
# skips the elevation re-launch if already elevated.
param(
    [string]$TunnelName = "wwe-tunnel"
)
$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Not elevated — relaunching as Administrator (accept the UAC prompt)..."
    Start-Process powershell -Verb RunAs -ArgumentList @(
        "-NoExit", "-File", "`"$PSCommandPath`"", "-TunnelName", "`"$TunnelName`""
    )
    exit
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    throw "cloudflared not found. Run .\install-cloudflared.ps1 first."
}

$userConfig = "$env:USERPROFILE\.cloudflared\config.yml"
if (-not (Test-Path $userConfig)) {
    throw "$userConfig not found. Follow docs/deployment/cloudflare-tunnel-setup.md steps 1-4 first."
}

# The Windows service runs as LocalSystem, which cannot read files under the
# interactive user's profile — copy config + credentials into ProgramData
# (cloudflared's default lookup path for the service) and rewrite the
# credentials-file path to match.
$serviceDir = "C:\ProgramData\Cloudflare\cloudflared"
New-Item -ItemType Directory -Force -Path $serviceDir | Out-Null

$config = Get-Content $userConfig -Raw
if ($config -notmatch "credentials-file:\s*(.+)") {
    throw "$userConfig has no credentials-file entry — check step 4 of the setup guide."
}
$credSrc = $Matches[1].Trim()
$credName = Split-Path $credSrc -Leaf
Copy-Item $credSrc "$serviceDir\$credName" -Force
($config -replace [regex]::Escape($credSrc), "$serviceDir\$credName") |
    Set-Content "$serviceDir\config.yml"

Write-Host "Installing cloudflared as a Windows service..."
cloudflared service install --config "$serviceDir\config.yml"

Start-Service cloudflared
Set-Service cloudflared -StartupType Automatic

Write-Host "`nDone. Service status:"
Get-Service cloudflared | Format-Table -AutoSize

Write-Host "`nIf you were also running start-tunnel.ps1 in a terminal, stop that one:"
Write-Host "  Get-Process cloudflared | Where-Object { `$_.Path -notlike '*ProgramData*' } | Stop-Process"
