@echo off
chcp 65001 >nul
title TK Clocking — Stop Services
color 0C

echo ╔══════════════════════════════════════════════════════════════╗
echo ║           TK Clocking System — Stop Services                 ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Stop Backend (port 3000)
echo [1/4] Stopping Backend API (port 3000)...
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 2^>nul') do taskkill /F /PID %%a 2>nul
echo     ✓ Backend shutdown check completed

:: Stop Dashboard (port 3001)
echo.
echo [2/4] Stopping Dashboard (port 3001)...
powershell -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 2^>nul') do taskkill /F /PID %%a 2>nul
echo     ✓ Dashboard shutdown check completed

:: Stop Flutter debug sessions
echo.
echo [3/4] Stopping Flutter debug sessions...
taskkill /F /IM dart.exe 2>nul >nul
taskkill /F /IM flutter.exe 2>nul >nul
echo     ✓ Flutter sessions cleaned up

:: Verify ports are free
echo.
echo [4/4] Verifying ports are free...
timeout /t 2 /nobreak >nul

set PORT_3000_FREE=1
netstat -ano | findstr ":3000" | findstr /V ":3001" >nul
if %errorlevel% == 0 set PORT_3000_FREE=0

set PORT_3001_FREE=1
netstat -ano | findstr ":3001" >nul
if %errorlevel% == 0 set PORT_3001_FREE=0

if %PORT_3000_FREE% == 1 (
    echo     ✓ Port 3000 is free
) else (
    echo     ⚠ Port 3000 still in use — forcing cleanup...
    powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*tk_clocking*backend*' } | Stop-Process -Force"
)

if %PORT_3001_FREE% == 1 (
    echo     ✓ Port 3001 is free
) else (
    echo     ⚠ Port 3001 still in use — forcing cleanup...
    powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*tk_clocking*dashboard*' } | Stop-Process -Force"
)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  All services stopped.                                       ║
echo ║                                                              ║
echo ║  💡 Tip: PostgreSQL is left running.                        ║
echo ║     To stop it, use Services.msc or your DB manager.         ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause