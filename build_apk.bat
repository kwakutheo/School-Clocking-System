@echo off
chcp 65001 >nul
title Flutter APK Builder
color 0B

echo ========================================
echo          Flutter APK Builder
echo ========================================
echo.

echo [INFO] Step 1: Cleaning previous builds...
set /p DO_CLEAN="Do you want to run 'flutter clean' and fetch packages first? (Y/N - N is better if offline): "
if /I "%DO_CLEAN%"=="Y" (
    echo.
    echo Running flutter clean...
    call flutter clean
    echo.
    echo Running flutter pub get...
    call flutter pub get
    echo.
) else (
    echo Skipping clean and package fetch.
    echo.
)

echo [INFO] Step 2: Building Release APK...
echo This might take a few minutes. Please wait...
call flutter build apk --release

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] APK built successfully!
    echo ========================================
    echo.
    echo The APK is located at:
    echo %CD%\build\app\outputs\flutter-apk\app-release.apk
    echo.
    
    set /p OPEN_FOLDER="Do you want to open the output folder? (Y/N): "
    if /I "%OPEN_FOLDER%"=="Y" (
        explorer "build\app\outputs\flutter-apk"
    )
) else (
    echo.
    color 0C
    echo ========================================
    echo [ERROR] APK build failed!
    echo ========================================
)

echo.
pause