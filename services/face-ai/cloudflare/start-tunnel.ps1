# Runs the cloudflared tunnel that publishes localhost:9000 as public HTTPS.
# Requires the one-time setup in install-cloudflared.ps1 (login/create/route/config).
param(
    [string]$TunnelName = "face-ai"
)
$ErrorActionPreference = "Stop"

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    throw "cloudflared not found. Run .\install-cloudflared.ps1 first."
}

# Uses ~/.cloudflared/config.yml (ingress -> http://localhost:9000).
Write-Host "Starting cloudflared tunnel '$TunnelName' ..."
cloudflared tunnel run $TunnelName
