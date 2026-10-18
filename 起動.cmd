@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>&1
if errorlevel 1 goto missingnode
node.exe "%~dp0launch.cjs"
if errorlevel 1 goto failed
exit /b 0
:missingnode
echo Node.js is not installed or is not on PATH.
goto wait
:failed
echo The application could not start. See startup.log in this folder.
:wait
pause
exit /b 1
