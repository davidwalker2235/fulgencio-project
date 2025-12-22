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
$venvPath = Join-Path $backPath "venv\Scripts\Activate.ps1"

# Verificar que existe el entorno virtual
if (-not (Test-Path $venvPath)) {
    Write-Host "ERROR: No se encontró el entorno virtual en: $venvPath" -ForegroundColor Red
    Write-Host "Por favor, crea el entorno virtual primero." -ForegroundColor Red
    exit 1
}

# Verificar que existe el directorio front
if (-not (Test-Path $frontPath)) {
    Write-Host "ERROR: No se encontró el directorio front en: $frontPath" -ForegroundColor Red
    exit 1
}

Write-Host "1. Activando entorno virtual..." -ForegroundColor Yellow
Write-Host "2. Iniciando backend..." -ForegroundColor Yellow
Write-Host "3. Iniciando frontend..." -ForegroundColor Yellow
Write-Host ""

# Iniciar el backend en una nueva ventana de PowerShell
Write-Host "Iniciando backend en nueva ventana..." -ForegroundColor Green
$backendScript = @"
cd '$backPath'; & '$venvPath'; python main.py
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

