# Installs the cloudflared CLI on Windows via winget (fallback: direct download).
# Run once. Re-run is a no-op if already installed.
$ErrorActionPreference = "Stop"

if (Get-Command cloudflared -ErrorAction SilentlyContinue) {
    Write-Host "cloudflared already installed: $((Get-Command cloudflared).Source)"
    cloudflared --version
    return
}

Write-Host "Installing cloudflared via winget..."
try {
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
} catch {
    Write-Warning "winget failed ($_). Falling back to direct download."
    $dest = "$env:LOCALAPPDATA\cloudflared"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    $exe = Join-Path $dest "cloudflared.exe"
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $exe
    Write-Host "Downloaded to $exe - add '$dest' to your PATH."
}

Write-Host "`nNext steps (interactive - run these yourself):"
Write-Host "  1. cloudflared tunnel login                       # opens a browser to authorise your Cloudflare account"
Write-Host "  2. cloudflared tunnel create face-ai              # prints the TUNNEL_ID + credentials json path"
Write-Host "  3. cloudflared tunnel route dns face-ai face-ai.<your-domain>"
Write-Host "  4. Fill face-ai/cloudflare/config.example.yml -> ~/.cloudflared/config.yml"
Write-Host "  5. .\face-ai\cloudflare\start-all.ps1"
