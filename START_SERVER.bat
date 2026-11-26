@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3 and try again.
  pause
  exit /b 1
)
where gcc >nul 2>nul
if errorlevel 1 (
  where clang >nul 2>nul
  if errorlevel 1 (
    echo A C compiler was not found. Install GCC or Clang and add it to PATH.
    echo See BACKEND.md for setup instructions.
    pause
    exit /b 1
  )
)
python app.py
pause
