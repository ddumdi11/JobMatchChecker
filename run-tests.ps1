# PowerShell Script zum Ausfuehren der Tests
# Usage: .\run-tests.ps1 [test-pattern]
# Beispiele:
#   .\run-tests.ps1                    # Alle Tests
#   .\run-tests.ps1 BackupVerifier     # Nur BackupVerifier Tests
#   .\run-tests.ps1 BackupManager      # Nur BackupManager Tests

param(
    [string]$TestPattern = ""
)

# Set UTF-8 encoding for proper display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  JobMatchChecker Test Runner" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules nicht gefunden. Installiere Dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install fehlgeschlagen!" -ForegroundColor Red
        exit 1
    }
}

# Run tests
Write-Host "Starte Tests..." -ForegroundColor Green
Write-Host ""

if ($TestPattern -eq "") {
    # Run all tests
    npm test -- --run
} else {
    # Run specific tests
    Write-Host "Filter: $TestPattern" -ForegroundColor Yellow
    npm test -- --run $TestPattern
}

# Check exit code
$checkmark = [char]0x2713
$crossmark = [char]0x2717

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Green
    Write-Host "  Alle Tests bestanden! $checkmark" -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Red
    Write-Host "  Tests fehlgeschlagen! $crossmark" -ForegroundColor Red
    Write-Host "======================================" -ForegroundColor Red
    exit 1
}
