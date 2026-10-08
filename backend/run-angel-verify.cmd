@echo off
rem Read-only Angel One SmartAPI verification. Places NO orders.
cd /d "%~dp0"
node scripts\angel-one-live-verify.mjs --negative
echo.
echo Finished. The report is backend\angel-one-live-verify-report.json
pause
