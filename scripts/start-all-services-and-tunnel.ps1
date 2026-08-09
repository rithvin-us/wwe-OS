# PowerShell Master Startup Script for WWE OS Local Services & Cloudflare Tunnel
# Runs Face-AI (Port 9000), Telegram Bot (Port 9001), and Cloudflare Tunnel (wwe-tunnel) in the background.

$ErrorActionPreference = "SilentlyContinue"
$RootDir = "E:\w\wwe OS"

# 1. Start Face-AI Microservice on Port 9000 if not already running
$net9000 = Get-NetTCPConnection -LocalPort 9000 -State Listen -ErrorAction SilentlyContinue
if (-not $net9000) {
    $FaceAiDir = Join-Path $RootDir "services\face-ai"
    Start-Process -FilePath "python" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 9000" -WorkingDirectory $FaceAiDir -WindowStyle Hidden
}

# 2. Start Telegram Bot Service on Port 9001 if not already running
$net9001 = Get-NetTCPConnection -LocalPort 9001 -State Listen -ErrorAction SilentlyContinue
if (-not $net9001) {
    $TelegramDir = Join-Path $RootDir "services\telegram-bot"
    $env:PORT = "9001"
    Start-Process -FilePath "python" -ArgumentList "main.py" -WorkingDirectory $TelegramDir -WindowStyle Hidden
}

# 3. Start Cloudflare Tunnel if not already running
$tunnelProc = Get-Process cloudflared -ErrorAction SilentlyContinue
if (-not $tunnelProc) {
    Start-Process -FilePath "cloudflared" -ArgumentList "tunnel run wwe-tunnel" -WorkingDirectory $RootDir -WindowStyle Hidden
}
