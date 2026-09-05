@echo off
setlocal
echo =======================================================
echo   Pushing Personal Knowledge Assistant to GitHub
echo   Repository: https://github.com/jagantj28-wq/Personal-Knowledge-Assistant
echo =======================================================
echo.

set "GIT_CMD=git"
where git >nul 2>&1
if errorlevel 1 (
    if exist "C:\ProgramData\jagan\GitHubDesktop\app-3.6.5\resources\app\git\cmd\git.exe" (
        set "GIT_CMD=C:\ProgramData\jagan\GitHubDesktop\app-3.6.5\resources\app\git\cmd\git.exe"
    ) else if exist "C:\ProgramData\jagan\GitHubDesktop\app-3.6.4\resources\app\git\cmd\git.exe" (
        set "GIT_CMD=C:\ProgramData\jagan\GitHubDesktop\app-3.6.4\resources\app\git\cmd\git.exe"
    )
)

echo Using Git: %GIT_CMD%
echo.

"%GIT_CMD%" remote set-url origin https://github.com/jagantj28-wq/Personal-Knowledge-Assistant.git
echo Pushing branch 'main' to GitHub...
"%GIT_CMD%" push -u origin main

if errorlevel 1 (
    echo.
    echo [!] Push failed or authentication required.
    echo If GitHub asks for login, please sign in via browser or Personal Access Token (PAT).
    echo You can also use push_to_github.ps1 with a Personal Access Token.
) else (
    echo.
    echo [OK] Successfully pushed to https://github.com/jagantj28-wq/Personal-Knowledge-Assistant!
)

echo.
pause
