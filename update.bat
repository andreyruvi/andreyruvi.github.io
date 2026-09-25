@echo off
setlocal enabledelayedexpansion
title Portfolio - Update website
mode con: cols=90 lines=45 >nul 2>&1
color 0B

REM ===========================================================================
REM  update.bat - sends your latest edits to the EXISTING GitHub repository.
REM
REM  Use it after editing in editor.html and pressing Save:
REM  just double-click this file.
REM
REM  It never creates a repository. If this folder is not connected to
REM  github.com/andreyruvi/andreyruvi.github.io yet, it stops and tells you.
REM ===========================================================================

set "REPO_URL=https://github.com/andreyruvi/andreyruvi.github.io.git"
if defined PORTFOLIO_REPO_URL set "REPO_URL=%PORTFOLIO_REPO_URL%"
set "BRANCH=main"
set "SITE=https://andreyruvi.github.io/"

REM -- PUSH_ASSUME_YES=1 answers "Y" to every question (for automated testing only).
set "ASK=choice /c YN /n /m"
if defined PUSH_ASSUME_YES set "ASK=call :yes"

set "REPO_DIR=%~dp0"
if "%REPO_DIR:~-1%"=="\" set "REPO_DIR=%REPO_DIR:~0,-1%"

cls
echo ==============================================================================
echo    UPDATE WEBSITE
echo.
echo    Folder:   %REPO_DIR%
echo    Website:  %SITE%
echo ==============================================================================
echo.

cd /d "%REPO_DIR%" 2>nul
if errorlevel 1 (
  echo    ERROR: Could not open this folder.
  goto :fail
)

REM ------------------------------------------------------------ [1] checks ----
echo [1/5] Checking...
if not exist "index.html" goto :notportfolio
if not exist "content.js" goto :notportfolio

where git >nul 2>&1
if errorlevel 1 (
  echo.
  echo    ERROR: Git is not installed on this computer.
  echo    Opening the download page. Install it with the DEFAULT options,
  echo    then double-click update.bat again.
  start "" https://git-scm.com/download/win
  goto :fail
)

REM -- This folder must already be connected (push.bat did that the first time).
if not exist ".git\" (
  echo.
  echo    ERROR: This folder is not connected to GitHub yet.
  echo    Run push.bat once ^(it connects the folder^), then use update.bat.
  goto :fail
)
set "ORIGIN="
for /f "delims=" %%u in ('git remote get-url origin 2^>nul') do set "ORIGIN=%%u"
if /i not "!ORIGIN!"=="%REPO_URL%" (
  echo.
  echo    ERROR: This folder is connected to a different place:
  echo      "!ORIGIN!"
  echo    Expected:
  echo      %REPO_URL%
  echo    Nothing was changed.
  goto :fail
)
echo       OK - connected to %REPO_URL%

REM -- Draft mode check: the "Draft mode" banner would be visible to visitors.
findstr /r /c:"draft.: true" content.js >nul 2>&1
if not errorlevel 1 (
  echo.
  echo    WARNING: Draft mode is ON - visitors will see a "Draft mode" banner.
  echo    To turn it off: open editor.html - Settings - Draft mode - Save.
  echo.
  %ASK% "   Update anyway? Y/N "
  if errorlevel 2 goto :cancel
)

REM ------------------------------------------------------ [2] sync GitHub ----
echo.
echo [2/5] Getting the latest version from GitHub...
git pull -q --rebase --autostash origin %BRANCH%
if errorlevel 1 (
  echo.
  echo    ERROR: Could not get the latest version from GitHub.
  echo    Check your internet connection and run update.bat again.
  echo    If GitHub asks you to sign in, sign in and try again.
  goto :fail
)
echo       OK.

REM ------------------------------------------------------ [3] what changed ----
echo.
echo [3/5] Looking for your changes...
git add -A 2>nul
git diff --cached --quiet
if !errorlevel!==0 (
  REM Nothing new to save - but maybe an earlier update was saved and not sent.
  git fetch -q origin %BRANCH% >nul 2>&1
  for /f %%c in ('git rev-list --count origin/%BRANCH%..HEAD 2^>nul') do set "AHEAD=%%c"
  if defined AHEAD if not "!AHEAD!"=="0" (
    echo       Found !AHEAD! saved update^(s^) that were not sent yet.
    goto :push
  )
  echo.
  echo    Nothing has changed - your website is already up to date.
  echo    ^(Did you press Save in the editor?^)
  goto :end
)

set /a ADDED=0, CHANGED=0, REMOVED=0
for /f "tokens=1" %%s in ('git diff --cached --name-status') do (
  set "ST=%%s"
  if "!ST:~0,1!"=="A" set /a ADDED+=1
  if "!ST:~0,1!"=="M" set /a CHANGED+=1
  if "!ST:~0,1!"=="R" set /a CHANGED+=1
  if "!ST:~0,1!"=="D" set /a REMOVED+=1
)
echo       New files:      !ADDED!
echo       Changed files:  !CHANGED!
echo       Removed files:  !REMOVED!
echo.
echo       ------------------------------------------------------------------
set /a SHOWN=0
for /f "tokens=1,*" %%a in ('git diff --cached --name-status') do (
  set "ST=%%a"
  set "LBL=changed"
  if "!ST:~0,1!"=="A" set "LBL=new    "
  if "!ST:~0,1!"=="D" set "LBL=REMOVED"
  if !SHOWN! LSS 20 echo         !LBL!  %%b
  set /a SHOWN+=1
)
if !SHOWN! GTR 20 echo         ... and more
echo       ------------------------------------------------------------------

if !REMOVED! GTR 0 (
  echo.
  echo       Some files will be REMOVED from the website ^(listed above^).
  %ASK% "   Continue? Y/N "
  if errorlevel 2 (
    git reset -q
    goto :cancel
  )
)

REM ---------------------------------------------------------- [4] commit ----
echo.
echo [4/5] Saving the changes...
git commit -q -m "Update portfolio %DATE% %TIME%"
if errorlevel 1 (
  echo    ERROR: Could not save the changes.
  goto :fail
)
echo       OK.

REM ------------------------------------------------------------ [5] push ----
:push
echo.
echo [5/5] Sending to GitHub...
git push -q origin %BRANCH%
if errorlevel 1 (
  echo.
  echo    ERROR: Sending failed. The usual reasons:
  echo      - The GitHub sign-in window was closed. Run update.bat again and
  echo        sign in when the browser opens.
  echo      - No internet connection.
  echo.
  echo    Nothing was lost. Your changes are saved in this folder and will be
  echo    sent the next time update.bat succeeds.
  goto :fail
)

color 0A
echo.
echo ==============================================================================
echo    WEBSITE UPDATED.
echo.
echo    %SITE%
echo.
echo    Changes appear in 1-2 minutes. If the page still looks old,
echo    press Ctrl+F5 to force a reload.
echo ==============================================================================
echo.
if defined PUSH_ASSUME_YES goto :end
choice /c YN /n /m "Open the website now? Y/N "
if errorlevel 2 goto :end
start "" %SITE%
goto :end

:notportfolio
echo.
echo    ERROR: This does not look like the portfolio folder.
echo    Keep update.bat in the same folder as index.html.
goto :fail

:cancel
color 07
echo.
echo    Cancelled - nothing was sent.
goto :end

:fail
color 0C
echo.
echo ==============================================================================
echo    The website was NOT updated.
echo ==============================================================================
echo.
if not defined PUSH_ASSUME_YES pause
exit /b 1

:end
echo.
if not defined PUSH_ASSUME_YES pause
exit /b 0

:yes
echo %~1 Y
exit /b 1
