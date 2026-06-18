@echo off
chcp 65001 >nul
title Android Wireless Debugging Helper
color 0A
echo ========================================
echo   Android Wireless Debugging Helper
echo ========================================
echo.

REM Try to find adb in common Android SDK locations
set ADB_PATH=
for %%p in (
    "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
    "C:\Android\Sdk\platform-tools\adb.exe"
    "%USERPROFILE%\Documents\Android\Sdk\platform-tools\adb.exe"
    "%ProgramFiles%\Android\Sdk\platform-tools\adb.exe"
    "%ProgramFiles(x86)%\Android\Sdk\platform-tools\adb.exe"
) do (
    if exist %%p (
        set ADB_PATH=%%p
        goto :found_adb
    )
)

REM Check if adb is on PATH as fallback
where adb >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set ADB_PATH=adb.exe
    goto :found_adb
)

REM If we get here, adb not found
echo [ERROR] adb not found!
echo.
echo Tried these locations:
echo   - %%LOCALAPPDATA%%\Android\Sdk\platform-tools\adb.exe
echo   - C:\Android\Sdk\platform-tools\adb.exe
echo   - %%USERPROFILE%%\Documents\Android\Sdk\platform-tools\adb.exe
echo   - %%ProgramFiles%%\Android\Sdk\platform-tools\adb.exe
echo   - %%ProgramFiles(x86)%%\Android\Sdk\platform-tools\adb.exe
echo   - System PATH
echo.
echo Please install Android SDK Platform Tools:
echo https://developer.android.com/studio/releases/platform-tools
echo.
pause
exit /b 1

:found_adb
echo [INFO] Found adb at: %ADB_PATH%
echo.

REM Step 1: Connect via USB first
echo ========================================
echo Step 1: Connect your phone via USB cable
echo ========================================
echo - Enable "USB Debugging" in Developer Options
echo - Connect phone to PC with a USB cable
echo - Allow USB debugging authorization on your phone
echo.
pause

REM Check devices
echo.
echo [INFO] Checking connected devices...
"%ADB_PATH%" devices
echo.

REM Step 2: Get phone IP
echo ========================================
echo Step 2: Get your phone's IP address
echo ========================================
echo Option A - From phone: Settings -^> About Phone -^> Status
echo Option B - We'll try to get it automatically (if connected):
echo.
"%ADB_PATH%" -d shell ip route
echo.

REM Ask for IP
set /p PHONE_IP="Please enter your phone's IP address (e.g., 192.168.1.105): "

if "%PHONE_IP%"=="" (
    echo [ERROR] No IP address entered!
    pause
    exit /b 1
)

REM Step 3: Start TCP mode
echo.
echo ========================================
echo Step 3: Starting wireless debugging...
echo ========================================
echo.
"%ADB_PATH%" -d tcpip 5555
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to switch to TCP mode!
    pause
    exit /b 1
)
echo.

REM Step 4: Connect
echo [INFO] Connecting to %PHONE_IP%:5555...
"%ADB_PATH%" connect %PHONE_IP%:5555
echo.

REM Step 5: Verify
echo ========================================
echo Step 4: Verify connection
echo ========================================
echo.
"%ADB_PATH%" devices
echo.

echo [INFO] You can now unplug your USB cable!
echo.

REM Step 6: Run Flutter App
echo ========================================
echo Step 5: Run Flutter App
echo ========================================
echo.
set /p RUN_FLUTTER="Do you want to run the Flutter app now? (Y/N): "
if /I "%RUN_FLUTTER%"=="Y" (
    echo.
    echo [INFO] Starting Flutter app...
    flutter run
) else (
    echo.
    echo [INFO] You can run it later using 'flutter run'
    pause
)
