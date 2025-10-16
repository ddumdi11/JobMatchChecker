# Feature 005: Job Offer Management - Test Runner (PowerShell)
#
# This script runs all tests for Feature 005 in the correct order:
# 1. Unit tests (jobService, aiExtractionService)
# 2. Contract tests (IPC handlers)
#
# Usage:
#   .\run-feature-005-tests.ps1
#   .\run-feature-005-tests.ps1 -Verbose

param(
    [switch]$Verbose
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Feature 005: Job Offer Management Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
$testsFailed = $false

# Colors
$successColor = "Green"
$errorColor = "Red"
$infoColor = "Yellow"

# Test files
$unitTests = @(
    "tests/unit/jobService.test.ts",
    "tests/unit/aiExtractionService.test.ts"
)

$contractTests = @(
    "tests/contract/job-crud.test.ts",
    "tests/contract/job-ai-extraction.test.ts"
)

# Function to run tests
function Run-Tests {
    param(
        [string]$Name,
        [string[]]$Files
    )

    Write-Host "Running $Name..." -ForegroundColor $infoColor
    Write-Host ""

    foreach ($file in $Files) {
        if (Test-Path $file) {
            Write-Host "  - $file" -ForegroundColor Gray
        } else {
            Write-Host "  ✗ File not found: $file" -ForegroundColor $errorColor
            $script:testsFailed = $true
            return
        }
    }

    Write-Host ""

    # Run vitest
    $testArgs = $Files -join " "
    if ($Verbose) {
        $vitestCmd = "npx vitest run --reporter=verbose $testArgs"
    } else {
        $vitestCmd = "npx vitest run $testArgs"
    }

    try {
        Invoke-Expression $vitestCmd

        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "✗ $Name FAILED" -ForegroundColor $errorColor
            Write-Host ""
            $script:testsFailed = $true
        } else {
            Write-Host ""
            Write-Host "✓ $Name PASSED" -ForegroundColor $successColor
            Write-Host ""
        }
    } catch {
        Write-Host ""
        Write-Host "✗ Error running $Name`: $_" -ForegroundColor $errorColor
        Write-Host ""
        $script:testsFailed = $true
    }
}

# Run test suites
Write-Host "Phase 1: Unit Tests" -ForegroundColor Cyan
Write-Host "-------------------" -ForegroundColor Cyan
Run-Tests "Unit Tests" $unitTests

Write-Host ""
Write-Host "Phase 2: Contract Tests" -ForegroundColor Cyan
Write-Host "-----------------------" -ForegroundColor Cyan
Run-Tests "Contract Tests" $contractTests

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($testsFailed) {
    Write-Host "✗ SOME TESTS FAILED" -ForegroundColor $errorColor
    Write-Host ""
    Write-Host "Please fix the failing tests before proceeding." -ForegroundColor $errorColor
    exit 1
} else {
    Write-Host "✓ ALL TESTS PASSED" -ForegroundColor $successColor
    Write-Host ""
    Write-Host "Feature 005 implementation is ready for integration!" -ForegroundColor $successColor
    exit 0
}
