@echo off
setlocal enabledelayedexpansion

title VeriCred Platform Launcher

echo ===============================================================
echo   VeriCred Decentralized Credential Platform Launcher
echo ===============================================================
echo.

:: 1. Check if Node.js runtime is available
node -v >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    goto :LAUNCH_START
)

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    goto :LAUNCH_START
)

:: 2. Node.js is missing - inform user and initiate safe bootstrap
echo [PREREQUISITE CHECK] Node.js runtime was not detected in PATH.
echo VeriCred requires Node.js LTS (v20+) to execute.
echo.
echo Initiating automated Windows host bootstrap...
echo Administrator permission is required to install Node.js LTS.
echo A Windows User Account Control (UAC) dialog will now appear.
echo ===============================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-host.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Host bootstrap did not complete successfully.
    echo Please install Node.js LTS manually from https://nodejs.org
    echo and re-run start.bat or npm start.
    echo.
    pause
    exit /b 1
)

:: Refresh PATH from Windows Registry for current command session
for /f "tokens=2*" %%A in ('reg query "HKLM\System\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
set "PATH=%SYS_PATH%;%USR_PATH%;%PATH%"

:LAUNCH_START
echo.
echo [LAUNCH] Starting VeriCred unified orchestration...
echo ===============================================================
echo.

node "%~dp0scripts\start-all.js"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] VeriCred platform exited with code %ERRORLEVEL%.
    pause
)
