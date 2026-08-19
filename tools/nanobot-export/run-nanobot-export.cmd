@echo off
REM ==========================================================================
REM Wrapper fuer den Windows Task Scheduler.
REM Startet den nanobot-Export aus dem Tool-Verzeichnis. Zusaetzliche Argumente
REM werden durchgereicht, z. B.:  run-nanobot-export.cmd --out "D:\Sync\nanobot"
REM Alternativ Zielordner ueber NANOBOT_OUT oder nanobot.config.json setzen.
REM
REM Headless-tauglich: schreibt jeden Lauf ueberschreibend nach last-run.log
REM (Start-/End-Zeitstempel + Exit-Code) UND auf die Konsole, damit ein Task-
REM Scheduler-Lauf ohne Fenster nachpruefbar bleibt.
REM ==========================================================================
setlocal EnableExtensions

REM Immer aus dem Tool-Verzeichnis heraus laufen (Scheduler-"Start in" egal).
cd /d "%~dp0"

set "LOG=%~dp0last-run.log"

REM --- Log frisch anlegen (ueberschreibend) --------------------------------
> "%LOG%" echo ============================================================
>>"%LOG%" echo [%DATE% %TIME%] nanobot-export gestartet
>>"%LOG%" echo Arbeitsverzeichnis: %CD%
>>"%LOG%" echo Argumente: %*
>>"%LOG%" echo ------------------------------------------------------------

REM --- npm auffindbar? (Scheduler hat nach Reboot oft schlanke PATH) --------
where npm >nul 2>nul
if errorlevel 1 (
  >>"%LOG%" echo [FEHLER] npm wurde im PATH nicht gefunden.
  >>"%LOG%" echo          Ist Node.js installiert und die PATH fuer den Task gesetzt?
  >>"%LOG%" echo          Tipp: im Task "Aktion" node\npm mit vollem Pfad aufrufen,
  >>"%LOG%" echo          oder die PATH-Umgebung fuer das Task-Konto ergaenzen.
  >>"%LOG%" echo [%DATE% %TIME%] Exit-Code: 9009
  type "%LOG%"
  endlocal & exit /b 9009
)

REM --- Export ausfuehren; Ausgabe in Log (Konsole via type am Ende) ---------
call npm start -- %* >>"%LOG%" 2>&1
set "EXITCODE=%ERRORLEVEL%"

>>"%LOG%" echo ------------------------------------------------------------
>>"%LOG%" echo [%DATE% %TIME%] Exit-Code: %EXITCODE%

REM --- Log auch auf die Konsole spiegeln (interaktiver Aufruf) --------------
type "%LOG%"

endlocal & exit /b %EXITCODE%
