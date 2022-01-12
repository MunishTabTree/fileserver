@echo off
echo You are currently on branch:
git branch
pause
rem set /p continue="Continue (y/n): "
rem if %continue%==n exit /b
echo.
echo List of tags created thus far:
git tag
pause
rem set /p continue="Continue (y/n): "
rem if %continue%==n exit /b
echo.
echo List of latest 5 commits
git log --pretty=oneline -5
echo.
rem set /p tag="Enter a Tag name (eg: v1.1.1): "
set /p version="Enter the release version (eg: 1.1.1): "
set tag=v%version%
set /p commit="Enter Commit to Tag: "
echo.
echo Create a new tag %tag% using %commit% commit version?
set /p continue="Continue (y/n): "
if %continue%==n exit /b

git tag -a -m "Release %tag%" %tag% %commit%

echo.
git tag
echo.
echo Confirm that the tag was created correctly and OK to push to the Git repository
set /p continue="Continue (y/n): "
if %continue%==n exit /b
git push origin %tag%
echo.
set relfile=../releases/file-server/release-%tag%.tar
echo Creating release archive file %relfile% for release %tag%
git archive --worktree-attributes -o %relfile% %tag%
echo.
echo Created release file %relfile%
echo.

echo Confirm upload to QA server
set /p continue="Continue (y/n): "
if %continue%==n exit /b
set remotedest=/home/ec2-user/gearmonkey/releases/file-server
pscp %relfile% GM-QA-API-Lightsail:%remotedest%

echo.
echo Confirm upload to PROD server
set /p continue="Continue (y/n): "
if %continue%==n exit /b
set remotedest=/home/centos/gearmonkey/releases/file-server
pscp %relfile% GM-PROD-API-Lightsail:%remotedest%

echo.
echo Completed
