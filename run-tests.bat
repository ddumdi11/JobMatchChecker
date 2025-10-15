@echo off
chcp 65001 >nul
REM Batch-Datei zum Ausführen der Tests
REM Usage: run-tests.bat [test-pattern]
REM Beispiele:
REM   run-tests.bat                    - Alle Tests
REM   run-tests.bat BackupVerifier     - Nur BackupVerifier Tests
REM   run-tests.bat BackupManager      - Nur BackupManager Tests

setlocal enabledelayedexpansion

echo ======================================
echo   JobMatchChecker Test Runner
echo ======================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo node_modules nicht gefunden. Installiere Dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install fehlgeschlagen!
        exit /b 1
    )
)

REM Run tests
echo Starte Tests...
echo.

if "%~1"=="" (
    REM Run all tests
    call npm test -- --run
) else (
    REM Run specific tests
    echo Filter: %~1
    call npm test -- --run %~1
)

REM Check exit code
if errorlevel 1 (
    echo.
    echo ======================================
    echo   Tests fehlgeschlagen! X
    echo ======================================
    exit /b 1
) else (
    echo.
    echo ======================================
    echo   Alle Tests bestanden! ✓
    echo ======================================
    exit /b 0
)
