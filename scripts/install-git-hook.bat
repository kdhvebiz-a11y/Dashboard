@echo off
rem Install the DRM guard hook (blocks commits of files encrypted by BMS DocuRay).
cd /d "%~dp0\.."
if not exist ".git\hooks" (echo FAILED: .git\hooks not found & pause & exit /b 1)
copy /Y "scripts\git-hooks\pre-commit" ".git\hooks\pre-commit" >nul
if errorlevel 1 (echo FAILED: copy error) else (echo OK: DRM guard hook installed.)
pause
