# Verifies the public Cloudflare HTTPS endpoint end-to-end:
#   1. GET /health  (open)      -> service is reachable through the tunnel
#   2. GET /version (open)      -> model/engine metadata
#   3. POST /verify-face 401    -> API-key gate is enforced (when a key is set)
# Exits non-zero on any failure so it can gate a deploy.
param(
    [Parameter(Mandatory=$true)][string]$Url,      # e.g. https://face-ai.example.com
    [string]$ApiKey = ""
)
$ErrorActionPreference = "Stop"
$Url = $Url.TrimEnd("/")
$fail = 0

Write-Host "== /health =="
try {
    $h = Invoke-RestMethod -Uri "$Url/health" -TimeoutSec 10
    Write-Host "  OK  status=$($h.status) engine=$($h.engine) ready=$($h.ready)"
    if ($h.status -ne "ok") { $fail = 1 }
} catch { Write-Error "  FAIL: $_"; $fail = 1 }

Write-Host "== /version =="
try {
    $v = Invoke-RestMethod -Uri "$Url/version" -TimeoutSec 10
    Write-Host "  OK  version=$($v.version) model=$($v.model) dim=$($v.embedding_dim)"
} catch { Write-Error "  FAIL: $_"; $fail = 1 }

if ($ApiKey) {
    Write-Host "== /verify-face without key (expect 401) =="
    try {
        Invoke-WebRequest -Uri "$Url/verify-face" -Method Post -TimeoutSec 10 -Form @{ file = "x" } | Out-Null
        Write-Error "  FAIL: unauthenticated call was NOT rejected"; $fail = 1
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 401) { Write-Host "  OK  rejected (401)" }
        else { Write-Error "  FAIL: expected 401, got $code"; $fail = 1 }
    }
}

if ($fail) { Write-Error "TUNNEL VERIFICATION FAILED"; exit 1 }
Write-Host "`nTUNNEL OK - set the backend FACE_AI_URL to $Url"
