# PowerShell Startup script for WWE OS Local AI & Telegram Bot Services
# Runs Face-AI on Port 9000 and Telegram Bot on Port 9001

$RootDir = Split-Path -Path $PSScriptRoot -Parent
Write-Host "Starting WWE OS Local Desktop Services from $RootDir..." -ForegroundColor Green

# 1. Start Face-AI Microservice on Port 9000
$FaceAiDir = Join-Path $RootDir "services\face-ai"
Write-Host "Starting Face-AI Microservice on http://localhost:9000 ..." -ForegroundColor Cyan
Start-Process -FilePath "python" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 9000" -WorkingDirectory $FaceAiDir -WindowStyle Minimized

# 2. Start Telegram Bot Service on Port 9001
$TelegramDir = Join-Path $RootDir "services\telegram-bot"
Write-Host "Starting Telegram Bot Service on http://localhost:9001 ..." -ForegroundColor Cyan
$env:PORT = "9001"
Start-Process -FilePath "python" -ArgumentList "main.py" -WorkingDirectory $TelegramDir -WindowStyle Minimized

Write-Host "Both services launched successfully!" -ForegroundColor Green
Write-Host "   - Face AI: http://localhost:9000 (Health: http://localhost:9000/health)" -ForegroundColor Yellow
Write-Host "   - Telegram Bot: http://localhost:9001 (Health: http://localhost:9001/health)" -ForegroundColor Yellow
