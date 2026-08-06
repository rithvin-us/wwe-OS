# Starts the Face-AI microservice (uvicorn) on localhost:9000.
# Assumes deps are installed (see docs/services/face-ai/README.md) and face-ai/.env exists.
param(
    [int]$Port = 9000,
    [string]$BindHost = "0.0.0.0"
)
$ErrorActionPreference = "Stop"

# Repo layout: this script is at face-ai/cloudflare/ -> service root is one up.
$serviceRoot = Split-Path -Parent $PSScriptRoot
Set-Location $serviceRoot

if (-not (Test-Path ".env")) {
    Write-Warning "face-ai/.env not found - copying .env.example (edit FACE_AI_API_KEY!)"
    Copy-Item ".env.example" ".env"
}

Write-Host "Starting face-ai on ${BindHost}:${Port} ..."
python -m uvicorn app.main:app --host $BindHost --port $Port
