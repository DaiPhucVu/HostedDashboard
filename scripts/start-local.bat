@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
if "%HANDYMAN_OLLAMA_MODEL%"=="" set "HANDYMAN_OLLAMA_MODEL=qwen3:8b"

where ollama >nul 2>nul || goto :missing_ollama
where npm >nul 2>nul || goto :missing_npm

where py >nul 2>nul
if %errorlevel% equ 0 (
  set "PYTHON_CMD=py -3"
) else (
  where python >nul 2>nul || goto :missing_python
  set "PYTHON_CMD=python"
)

curl.exe --silent --fail http://127.0.0.1:11434/api/tags >nul 2>nul
if not errorlevel 1 goto :ollama_ready

echo Starting Ollama...
start "Ollama" /min ollama serve
for /l %%I in (1,1,15) do (
  curl.exe --silent --fail http://127.0.0.1:11434/api/tags >nul 2>nul
  if not errorlevel 1 goto :ollama_ready
  timeout /t 1 /nobreak >nul
)

echo Ollama did not start. Open Ollama and run this file again.
exit /b 1

:ollama_ready

ollama pull "%HANDYMAN_OLLAMA_MODEL%" || exit /b 1

if not exist "%PROJECT_ROOT%\handyman-admin-dashboard\node_modules" (
  pushd "%PROJECT_ROOT%\handyman-admin-dashboard"
  call npm ci || exit /b 1
  popd
)

echo AI API:    http://127.0.0.1:8080
echo Dashboard: http://127.0.0.1:3000/job-management

start "Handyman AI" cmd /k "cd /d ""%PROJECT_ROOT%\ai-service"" && set HANDYMAN_AI_PROVIDER=ollama && set HANDYMAN_OLLAMA_MODEL=%HANDYMAN_OLLAMA_MODEL% && set HANDYMAN_CORS_ORIGIN=http://127.0.0.1:3000 && %PYTHON_CMD% -m app.api.server --port 8080"
start "Handyman Dashboard" cmd /k "cd /d ""%PROJECT_ROOT%\handyman-admin-dashboard"" && set REACT_APP_USE_LOCAL_FIXTURES=false && set REACT_APP_LOCAL_AI_SERVICE_URL=http://127.0.0.1:8080 && npm start"
exit /b 0

:missing_ollama
echo Ollama is required: https://ollama.com/download
exit /b 1

:missing_npm
echo Node.js and npm are required.
exit /b 1

:missing_python
echo Python 3.9 or newer is required.
exit /b 1
