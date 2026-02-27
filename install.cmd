@echo off
setlocal enableDelayedExpansion

echo ========================================
echo CR CLI Installer
echo ========================================
echo.

REM Define variables
set "CR_APP_NAME=CR CLI"
set "CR_EXE_NAME=cr.exe"
set "CR_DIR_NAME=cr"
set "CR_INSTALL_DIR=%LocalAppData%\%CR_DIR_NAME%\bin"

echo [1/3] Checking for %CR_EXE_NAME%...

REM Check if cr.exe exists
if not exist "%CR_EXE_NAME%" (
    echo.
    echo ERROR: %CR_EXE_NAME% not found in current directory
    echo Please run this script from the directory containing %CR_EXE_NAME%
    echo.
    pause
    exit /b 1
)

echo      Found %CR_EXE_NAME%
echo.

echo [2/3] Installing to %CR_INSTALL_DIR%...

REM Create install directory
if not exist "%CR_INSTALL_DIR%" (
    mkdir "%CR_INSTALL_DIR%" 2>nul
    if errorlevel 1 (
        echo      ERROR: Failed to create directory
        echo      Please check permissions
        pause
        exit /b 1
    )
)

REM Copy executable
copy /Y "%CR_EXE_NAME%" "%CR_INSTALL_DIR%\" >nul 2>&1
if errorlevel 1 (
    echo      ERROR: Failed to copy %CR_EXE_NAME%
    echo      The file may be in use
    pause
    exit /b 1
)

echo      Installed successfully
echo.

echo [3/3] Updating PATH...

REM Get current user PATH
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v PATH 2^>nul ^| findstr /I "PATH"') do set "USER_PATH=%%B"

REM Check if already in PATH
echo "%USER_PATH%" | findstr /I /C:"%CR_INSTALL_DIR%" >nul
if errorlevel 1 (
    REM Not in PATH, need to add it
    if defined USER_PATH (
        set "NEW_PATH=%USER_PATH%;%CR_INSTALL_DIR%"
    ) else (
        set "NEW_PATH=%CR_INSTALL_DIR%"
    )
    
    REM Use reg add instead of setx to avoid truncation issues
    reg add "HKCU\Environment" /v PATH /t REG_EXPAND_SZ /d "!NEW_PATH!" /f >nul 2>&1
    if errorlevel 1 (
        echo      WARNING: Failed to update PATH automatically
        echo.
        echo      Please manually add the following to your PATH:
        echo      %CR_INSTALL_DIR%
        echo.
        echo      Instructions:
        echo      1. Open "Edit environment variables for your account"
        echo      2. Find "Path" variable and click Edit
        echo      3. Click New and add: %CR_INSTALL_DIR%
        echo      4. Click OK to save
    ) else (
        echo      Added to PATH successfully
        
        REM Broadcast environment change
        setx TRIGGER_UPDATE "1" >nul 2>&1
        reg delete "HKCU\Environment" /v TRIGGER_UPDATE /f >nul 2>&1
    )
) else (
    echo      Already in PATH
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo IMPORTANT: Restart your terminal for PATH changes to take effect
echo.
echo To verify installation, open a NEW terminal and run:
echo   cr help
echo.
pause
endlocal