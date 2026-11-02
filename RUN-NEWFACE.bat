@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  set "PYTHON=py -3"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 is required. Install it from https://www.python.org/downloads/windows/
    echo During installation, enable "Add Python to PATH".
    pause
    exit /b 1
  )
  set "PYTHON=python"
)
if not exist "public\models\det_10g.onnx" (
  echo WARNING: ONNX model files are missing from public\models.
  echo Read public\models\README.txt for the required files.
  echo.
)
start "NewFace Live" http://localhost:8080
%PYTHON% -m http.server 8080 --bind 127.0.0.1 --directory public
pause
