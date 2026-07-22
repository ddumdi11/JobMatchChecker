@echo off
REM Wrapper fuer den Windows Task Scheduler.
REM Startet den nanobot-Export aus dem Tool-Verzeichnis. Zusaetzliche Argumente
REM werden durchgereicht, z. B.:  run-nanobot-export.cmd --out "D:\Sync\nanobot"
REM Alternativ Zielordner ueber NANOBOT_OUT oder nanobot.config.json setzen.
setlocal
cd /d "%~dp0"
call npm start -- %*
