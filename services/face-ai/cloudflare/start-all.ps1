# One-shot launcher: starts the Face-AI service and the Cloudflare tunnel in
# separate windows, then waits for the local /health to go green.
param(
    [int]$Port = 9000,
    [string]$TunnelName = "wwe-tunnel",
    [switch]$Silent,
    [switch]$NoTunnel
)
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot

$windowStyle = if ($Silent) { "Hidden" } else { "Normal" }
$aiArgs = if ($Silent) { @("-WindowStyle", "Hidden", "-File", "`"$here\start-ai.ps1`"", "-Port", "$Port") } else { @("-NoExit", "-File", "`"$here\start-ai.ps1`"", "-Port", "$Port") }
$tunnelArgs = if ($Silent) { @("-WindowStyle", "Hidden", "-File", "`"$here\start-tunnel.ps1`"", "-TunnelName", "$TunnelName") } else { @("-NoExit", "-File", "`"$here\start-tunnel.ps1`"", "-TunnelName", "$TunnelName") }

Write-Host "==> launching face-ai service (port $Port)"
Start-Process powershell -ArgumentList $aiArgs -WindowStyle $windowStyle

Write-Host "==> waiting for local health ..."
$ok = $false
foreach ($i in 1..30) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:$Port/health" -TimeoutSec 3
        if ($r.status -eq "ok") { $ok = $true; break }
    } catch { }
}
if (-not $ok) { throw "face-ai did not become healthy on port $Port" }
Write-Host "    local health OK (engine=$($r.engine) ready=$($r.ready))"

if (-not $NoTunnel) {
    Write-Host "==> launching cloudflared tunnel '$TunnelName'"
    Start-Process powershell -ArgumentList $tunnelArgs -WindowStyle $windowStyle
}

Write-Host "`nBoth started. Verify the public endpoint with:"
Write-Host "  .\verify-tunnel.ps1 -Url https://face-ai.<your-domain> -ApiKey <key>"
