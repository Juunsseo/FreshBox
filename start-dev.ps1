$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "freshbox-backend"
$Frontend = Join-Path $Root "freshbox-frontend"
$VenvPython = Join-Path $Backend ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    python -m venv (Join-Path $Backend ".venv")
    Push-Location $Backend
    try { & $VenvPython -m pip install -e ".[dev]" } finally { Pop-Location }
}

if (-not (Test-Path (Join-Path $Backend ".env"))) {
    Copy-Item (Join-Path $Backend ".env.example") (Join-Path $Backend ".env")
}

if (-not (Test-Path (Join-Path $Frontend ".env.local"))) {
    Copy-Item (Join-Path $Frontend ".env.example") (Join-Path $Frontend ".env.local")
}

if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Push-Location $Frontend
    try { npm ci } finally { Pop-Location }
}

$BackendProcess = Start-Process -FilePath $VenvPython `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--env-file", ".env") `
    -WorkingDirectory $Backend -PassThru -NoNewWindow

try {
    Push-Location $Frontend
    npm run dev
} finally {
    Pop-Location
    if (-not $BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id
    }
}
