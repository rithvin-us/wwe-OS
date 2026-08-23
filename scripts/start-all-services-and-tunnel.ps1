# PowerShell Master Startup Script for WWE OS Local Services & Cloudflare Tunnel
# Runs Face-AI (Port 9000), Telegram Bot (Port 9001), and Cloudflare Tunnel (wwe-tunnel) in the background.

$ErrorActionPreference = "SilentlyContinue"
$RootDir = if ($PSScriptRoot) { Split-Path -Path $PSScriptRoot -Parent } else { "E:\w\wwe OS" }

# Resolve full Python executable path to ensure boot reliability
$PythonExe = "python"
if (Test-Path "C:\Python314\python.exe") {
    $PythonExe = "C:\Python314\python.exe"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $PythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
}

# Resolve full Cloudflared executable path
$CloudflaredExe = "cloudflared"
if (Test-Path "C:\Program Files (x86)\cloudflared\cloudflared.exe") {
    $CloudflaredExe = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
} elseif (Test-Path "C:\Program Files\cloudflared\cloudflared.exe") {
    $CloudflaredExe = "C:\Program Files\cloudflared\cloudflared.exe"
} elseif (Get-Command cloudflared -ErrorAction SilentlyContinue) {
    $CloudflaredExe = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
}

# Ensure log directory exists
$LogDir = Join-Path $RootDir "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

$FaceAiLog = Join-Path $LogDir "face-ai.log"
$FaceAiErr = Join-Path $LogDir "face-ai-error.log"
$TelegramLog = Join-Path $LogDir "telegram-bot.log"
$TelegramErr = Join-Path $LogDir "telegram-bot-error.log"
$TunnelLog = Join-Path $LogDir "cloudflare-tunnel.log"
$TunnelErr = Join-Path $LogDir "cloudflare-tunnel-error.log"

# 1. Start Face-AI Microservice on Port 9000 if not already running
$net9000 = Get-NetTCPConnection -LocalPort 9000 -State Listen -ErrorAction SilentlyContinue
if (-not $net9000) {
    $FaceAiDir = Join-Path $RootDir "services\face-ai"
    $args9000 = @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000")
    Start-Process -FilePath $PythonExe -ArgumentList $args9000 -WorkingDirectory $FaceAiDir -RedirectStandardOutput $FaceAiLog -RedirectStandardError $FaceAiErr -WindowStyle Hidden
}

# 2. Start Telegram Bot Service on Port 9001 if not already running
$net9001 = Get-NetTCPConnection -LocalPort 9001 -State Listen -ErrorAction SilentlyContinue
if (-not $net9001) {
    $TelegramDir = Join-Path $RootDir "services\telegram-bot"
    $env:PORT = "9001"
    $args9001 = @("main.py")
    Start-Process -FilePath $PythonExe -ArgumentList $args9001 -WorkingDirectory $TelegramDir -RedirectStandardOutput $TelegramLog -RedirectStandardError $TelegramErr -WindowStyle Hidden
}

# 3. Start Cloudflare Tunnel if not already running
$tunnelProc = Get-Process cloudflared -ErrorAction SilentlyContinue
if (-not $tunnelProc) {
    $argsTunnel = @("tunnel", "run", "wwe-tunnel")
    Start-Process -FilePath $CloudflaredExe -ArgumentList $argsTunnel -WorkingDirectory $RootDir -RedirectStandardOutput $TunnelLog -RedirectStandardError $TunnelErr -WindowStyle Hidden
}


