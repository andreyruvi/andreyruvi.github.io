@echo off
setlocal enabledelayedexpansion
title Portfolio - Push to GitHub
mode con: cols=90 lines=45 >nul 2>&1
color 0E

REM ===========================================================================
REM  push.bat - publishes THIS folder to GitHub Pages. Just double-click it.
REM
REM  GitHub repository:  github.com/andreyruvi/andreyruvi.github.io
REM  Website:            https://andreyruvi.github.io/
REM
REM  - First run: if the repository does not exist yet, GitHub's "Create a
REM    new repository" page opens with everything filled in - you only click
REM    "Create repository". Then this folder is uploaded.
REM  - Later runs: saves your changes and sends them to GitHub.
REM
REM  No password or token is stored here. Git for Windows handles the login
REM  through its Credential Manager (a browser window the first time).
REM ===========================================================================

set "GH_USER=andreyruvi"
set "REPO_NAME=andreyruvi.github.io"
set "REPO_URL=https://github.com/%GH_USER%/%REPO_NAME%.git"
if defined PORTFOLIO_REPO_URL set "REPO_URL=%PORTFOLIO_REPO_URL%"
set "BRANCH=main"
set "SITE=https://andreyruvi.github.io/"
set "NEW_REPO_PAGE=https://github.com/new?name=%REPO_NAME%&visibility=public&description=Architectural+BIM+and+CAD+portfolio"

REM -- PUSH_ASSUME_YES=1 answers "Y" to every question (for automated testing only).
set "ASK=choice /c YN /n /m"
if defined PUSH_ASSUME_YES set "ASK=call :yes"

REM -- The folder this file lives in, without the trailing backslash.
set "REPO_DIR=%~dp0"
if "%REPO_DIR:~-1%"=="\" set "REPO_DIR=%REPO_DIR:~0,-1%"

cls
echo ==============================================================================
echo    PUBLISH PORTFOLIO
echo.
echo    Folder:   %REPO_DIR%
echo    GitHub:   %REPO_URL%
echo    Website:  %SITE%
echo ==============================================================================
echo.

cd /d "%REPO_DIR%" 2>nul
if errorlevel 1 (
  echo    ERROR: Could not open this folder.
  goto :fail
)

if not exist "index.html" goto :notportfolio
if not exist "content.js" goto :notportfolio
if not exist "assets\images" goto :notportfolio

REM ------------------------------------------------------------- [1] Git ----
echo [1/6] Checking that Git is installed...
where git >nul 2>&1
if errorlevel 1 (
  echo.
  echo    ERROR: Git is not installed on this computer.
  echo    Opening the download page. Install it with the DEFAULT options,
  echo    then double-click push.bat again.
  start "" https://git-scm.com/download/win
  goto :fail
)
for /f "tokens=*" %%v in ('git --version') do set "GITVER=%%v"
echo       OK - !GITVER!

REM -- Draft mode check: the "Draft mode" banner would be visible to visitors.
findstr /r /c:"draft.: true" content.js >nul 2>&1
if not errorlevel 1 (
  echo.
  echo    WARNING: Draft mode is still ON.
  echo    Visitors will see a "Draft mode" banner at the top of every page.
  echo    To turn it off: open editor.html - Settings - Draft mode - Save.
  echo.
  %ASK% "   Publish anyway? Y/N "
  if errorlevel 2 goto :cancel
)

REM ------------------------------------------------ [2] GitHub repository ----
echo.
echo [2/6] Checking the GitHub repository...
echo       ^(a GitHub login window may open in your browser the first time^)
:checkremote
git ls-remote "%REPO_URL%" >nul 2>&1
if errorlevel 1 (
  echo.
  echo    The repository %GH_USER%/%REPO_NAME% does not exist on GitHub yet.
  echo.
  echo    Opening GitHub's "Create a new repository" page with the name filled in.
  echo      1. Check that the Owner is %GH_USER% and the name is %REPO_NAME%
  echo      2. Keep it Public, and do NOT tick "Add a README file"
  echo      3. Click the green "Create repository" button
  echo      4. Come back to this window
  echo.
  start "" "%NEW_REPO_PAGE%"
  choice /c RC /n /m "   Press R when the repository is created, or C to cancel: "
  if errorlevel 2 goto :cancel
  goto :checkremote
)
echo       OK - the repository exists.

REM --------------------------------------------------- [3] local set-up ----
echo.
echo [3/6] Preparing this folder...
REM Only a .git folder INSIDE this folder counts. (If a parent folder, e.g. your
REM Windows user folder, happens to be a Git repository, it must not be used.)
if not exist ".git\" (
  echo       First run - setting this folder up for Git.
  git init -q
  if errorlevel 1 (
    echo    ERROR: git init failed.
    goto :fail
  )
  git checkout -q -B %BRANCH%
  git config core.autocrlf false
  set "FIRSTRUN=1"
)

REM -- Remote: add it if missing, refuse to touch it if it points elsewhere.
set "ORIGIN="
for /f "delims=" %%u in ('git remote get-url origin 2^>nul') do set "ORIGIN=%%u"
if "!ORIGIN!"=="" (
  git remote add origin "%REPO_URL%"
  set "ORIGIN=%REPO_URL%"
) else (
  if /i not "!ORIGIN!"=="%REPO_URL%" (
    echo.
    echo    ERROR: This folder is connected to a different project:
    echo      !ORIGIN!
    echo    I will not change that.
    goto :fail
  )
)

REM -- Identity, so the commit can be made at all.
set "GITNAME="
set "GITMAIL="
for /f "delims=" %%n in ('git config user.name 2^>nul') do set "GITNAME=%%n"
for /f "delims=" %%e in ('git config user.email 2^>nul') do set "GITMAIL=%%e"
if "!GITNAME!"=="" git config user.name "%GH_USER%"
if "!GITMAIL!"=="" git config user.email "%GH_USER%@users.noreply.github.com"

REM -- Bring in anything already on GitHub (normally nothing on the first run).
git ls-remote --exit-code --heads origin %BRANCH% >nul 2>&1
if not errorlevel 1 (
  if defined FIRSTRUN (
    git fetch -q origin %BRANCH%
    git reset -q --mixed FETCH_HEAD
  ) else (
    git pull -q --rebase --autostash origin %BRANCH%
    if errorlevel 1 (
      echo.
      echo    ERROR: Could not sync with GitHub.
      echo    Check your internet connection, then run push.bat again.
      goto :fail
    )
  )
)
echo       OK.

REM ------------------------------------------------------ [4] what changed ----
echo.
echo [4/6] Looking for changes...
git add -A 2>nul
git diff --cached --quiet
if !errorlevel!==0 (
  git ls-remote --exit-code --heads origin %BRANCH% >nul 2>&1
  if errorlevel 1 goto :push
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

if !REMOVED! GTR 0 (
  echo.
  echo       Files that will be REMOVED from the website:
  echo       ------------------------------------------------------------------
  set /a SHOWN=0
  for /f "tokens=1,*" %%a in ('git diff --cached --name-status --diff-filter=D') do (
    if !SHOWN! LSS 15 echo         %%b
    set /a SHOWN+=1
  )
  if !REMOVED! GTR 15 echo         ... and more
  echo       ------------------------------------------------------------------
  echo.
  %ASK% "   Continue and publish? Y/N "
  if errorlevel 2 (
    git reset -q
    goto :cancel
  )
)

REM ---------------------------------------------------------- [5] commit ----
echo.
echo [5/6] Saving the changes...
git commit -q -m "Update portfolio %DATE% %TIME%"
if errorlevel 1 (
  echo    ERROR: The commit failed.
  goto :fail
)
echo       OK.

REM ------------------------------------------------------------ [6] push ----
:push
echo.
echo [6/6] Sending to GitHub... ^(the first upload has about 220 files - please wait^)
git push -q -u origin %BRANCH%
if errorlevel 1 (
  echo.
  echo    ERROR: The upload failed. The usual reasons:
  echo      - The GitHub login window was closed. Run push.bat again and
  echo        sign in when the browser opens.
  echo      - No internet connection.
  echo.
  echo    Nothing was lost. Your changes are saved in this folder and will
  echo    be sent the next time push.bat succeeds.
  goto :fail
)

color 0A
echo.
echo ==============================================================================
echo    PUBLISHED.
echo.
echo    %SITE%
echo.
if defined FIRSTRUN (
  echo    FIRST PUBLISH: GitHub needs a few minutes ^(up to 10^) to build the
  echo    website. If it shows "404" at first, wait and refresh.
  echo    Status: https://github.com/%GH_USER%/%REPO_NAME%/actions
) else (
  echo    GitHub Pages updates in 1-2 minutes. If the page still looks old,
  echo    press Ctrl+F5 to force a reload.
)
echo ==============================================================================
echo.
if defined PUSH_ASSUME_YES goto :end
choice /c YN /n /m "Open the website now? Y/N "
if errorlevel 2 goto :end
start "" %SITE%
goto :end

:notportfolio
echo    ERROR: This does not look like the portfolio folder
echo    ^(index.html, content.js or assets\images is missing^).
echo    Keep push.bat in the same folder as index.html.
goto :fail

:cancel
color 07
echo.
echo    Cancelled - nothing was published.
goto :end

:fail
color 0C
echo.
echo ==============================================================================
echo    Nothing was published.
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
