# PowerShell Master Startup Script for WWE OS Local Services & Cloudflare Tunnel
# Runs Face-AI (Port 9000), Telegram Bot (Port 9001), and Cloudflare Tunnel (wwe-tunnel) in the background.

$ErrorActionPreference = "SilentlyContinue"
$RootDir = "E:\w\wwe OS"

# Resolve full Python executable path to ensure boot reliability
$PythonExe = if (Test-Path "C:\Python314\python.exe") { "C:\Python314\python.exe" } else { (Get-Command python -ErrorAction SilentlyContinue).Source }
if (-not $PythonExe) { $PythonExe = "python" }

# Ensure log directory exists
$LogDir = Join-Path $RootDir "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

# 1. Start Face-AI Microservice on Port 9000 if not already running
$net9000 = Get-NetTCPConnection -LocalPort 9000 -State Listen -ErrorAction SilentlyContinue
if (-not $net9000) {
    $FaceAiDir = Join-Path $RootDir "services\face-ai"
    $FaceAiLog = Join-Path $LogDir "face-ai.log"
    Start-Process -FilePath $PythonExe -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 9000" -WorkingDirectory $FaceAiDir -RedirectStandardOutput $FaceAiLog -RedirectStandardError $FaceAiLog -WindowStyle Hidden
}

# 2. Start Telegram Bot Service on Port 9001 if not already running
$net9001 = Get-NetTCPConnection -LocalPort 9001 -State Listen -ErrorAction SilentlyContinue
if (-not $net9001) {
    $TelegramDir = Join-Path $RootDir "services\telegram-bot"
    $TelegramLog = Join-Path $LogDir "telegram-bot.log"
    $env:PORT = "9001"
    Start-Process -FilePath $PythonExe -ArgumentList "main.py" -WorkingDirectory $TelegramDir -RedirectStandardOutput $TelegramLog -RedirectStandardError $TelegramLog -WindowStyle Hidden
}

# 3. Start Cloudflare Tunnel if not already running
$tunnelProc = Get-Process cloudflared -ErrorAction SilentlyContinue
if (-not $tunnelProc) {
    $TunnelLog = Join-Path $LogDir "cloudflare-tunnel.log"
    Start-Process -FilePath "cloudflared" -ArgumentList "tunnel run wwe-tunnel" -WorkingDirectory $RootDir -RedirectStandardOutput $TunnelLog -RedirectStandardError $TunnelLog -WindowStyle Hidden
}

