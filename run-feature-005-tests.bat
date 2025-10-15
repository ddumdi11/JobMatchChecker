@echo off
REM Feature 005: Job Offer Management - Test Runner (Batch)
REM
REM This script runs all tests for Feature 005 in the correct order:
REM 1. Unit tests (jobService, aiExtractionService)
REM 2. Contract tests (IPC handlers)
REM
REM Usage:
REM   run-feature-005-tests.bat

setlocal enabledelayedexpansion

echo ========================================
echo Feature 005: Job Offer Management Tests
echo ========================================
echo.

set "TESTS_FAILED=0"

REM ========================================
REM Phase 1: Unit Tests
REM ========================================
echo Phase 1: Unit Tests
echo -------------------
echo.

echo Running Unit Tests...
echo   - tests/unit/jobService.test.ts
echo   - tests/unit/aiExtractionService.test.ts
echo.

call npx vitest run tests/unit/jobService.test.ts tests/unit/aiExtractionService.test.ts

if errorlevel 1 (
    echo.
    echo [ERROR] Unit Tests FAILED
    echo.
    set "TESTS_FAILED=1"
) else (
    echo.
    echo [OK] Unit Tests PASSED
    echo.
)

REM ========================================
REM Phase 2: Contract Tests
REM ========================================
echo Phase 2: Contract Tests
echo -----------------------
echo.

echo Running Contract Tests...
echo   - tests/contract/job-crud.test.ts
echo   - tests/contract/job-ai-extraction.test.ts
echo.

call npx vitest run tests/contract/job-crud.test.ts tests/contract/job-ai-extraction.test.ts

if errorlevel 1 (
    echo.
    echo [ERROR] Contract Tests FAILED
    echo.
    set "TESTS_FAILED=1"
) else (
    echo.
    echo [OK] Contract Tests PASSED
    echo.
)

REM ========================================
REM Summary
REM ========================================
echo.
echo ========================================
echo Test Summary
echo ========================================

if "%TESTS_FAILED%"=="1" (
    echo [ERROR] SOME TESTS FAILED
    echo.
    echo Please fix the failing tests before proceeding.
    exit /b 1
) else (
    echo [OK] ALL TESTS PASSED
    echo.
    echo Feature 005 implementation is ready for integration!
    exit /b 0
)
