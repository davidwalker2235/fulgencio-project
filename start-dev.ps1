# Script para levantar el entorno de desarrollo completo
# Activa el venv, arranca el backend y levanta el frontend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Iniciando entorno de desarrollo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Obtener la ruta del proyecto
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backPath = Join-Path $projectRoot "back"
$frontPath = Join-Path $projectRoot "front"
$pythonPath = Join-Path $backPath ".venv\Scripts\python.exe"

# Verificar que existe el entorno virtual
if (-not (Test-Path $pythonPath)) {
    Write-Host "ERROR: No se encontro Python en: $pythonPath" -ForegroundColor Red
    Write-Host "Crea back/.venv con Python 3.12 e instala back/requirements.txt." -ForegroundColor Red
    exit 1
}

# Verificar que existe el directorio front
if (-not (Test-Path $frontPath)) {
    Write-Host "ERROR: No se encontró el directorio front en: $frontPath" -ForegroundColor Red
    exit 1
}

Write-Host "1. Iniciando LiteLLM Proxy..." -ForegroundColor Yellow
Write-Host "2. Iniciando backend con back/.venv..." -ForegroundColor Yellow
Write-Host "3. Iniciando frontend..." -ForegroundColor Yellow
Write-Host ""

# Clave interna local compartida entre el backend y el Proxy.
if ([string]::IsNullOrWhiteSpace($env:LITELLM_MASTER_KEY)) {
    $env:LITELLM_MASTER_KEY = "sk-litellm-local-dev"
}
if ([string]::IsNullOrWhiteSpace($env:LITELLM_PROXY_API_KEY)) {
    $env:LITELLM_PROXY_API_KEY = $env:LITELLM_MASTER_KEY
}

# Iniciar LiteLLM Proxy en una nueva ventana de PowerShell
Write-Host "Iniciando LiteLLM Proxy en nueva ventana..." -ForegroundColor Green
$litellmScript = @"
Set-Location -LiteralPath '$backPath'
& '$pythonPath' '$backPath\run_litellm_proxy.py'
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $litellmScript

# Esperar a que el Proxy acepte conexiones antes de iniciar el backend.
$proxyReady = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
        $proxyHealth = Invoke-WebRequest `
            -UseBasicParsing `
            -Uri "http://127.0.0.1:4000/health/liveliness" `
            -TimeoutSec 2
        if ($proxyHealth.StatusCode -eq 200) {
            $proxyReady = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $proxyReady) {
    Write-Host "ERROR: LiteLLM Proxy no ha arrancado en el puerto 4000." -ForegroundColor Red
    Write-Host "Revisa la ventana de LiteLLM Proxy para ver el error." -ForegroundColor Red
    exit 1
}

# Iniciar el backend en una nueva ventana de PowerShell
Write-Host "Iniciando backend en nueva ventana..." -ForegroundColor Green
$backendScript = @"
Set-Location -LiteralPath '$backPath'
& '$pythonPath' main.py
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

# Esperar un poco para que el backend se inicie
Start-Sleep -Seconds 3

# Iniciar el frontend en una nueva ventana de PowerShell
Write-Host "Iniciando frontend en nueva ventana..." -ForegroundColor Green
$frontendScript = @"
cd '$frontPath'
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Servicios iniciados correctamente" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend: http://localhost:8000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Presiona Ctrl+C en las ventanas de PowerShell para detener los servicios." -ForegroundColor Gray

