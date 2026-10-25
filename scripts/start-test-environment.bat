@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
set "EMULATOR_PROJECT_ID=demo-handyman"
set "DATABASE_NAMESPACE=handymanapplicationcos40006"
set "NPM_CONFIG_CACHE=%TEMP%\handyman-npm-cache"
set "FIREBASE_EMULATORS_PATH=%TEMP%\handyman-firebase-emulators"
set "FIREBASE_TOOLS_DISABLE_UPDATE_CHECK=1"
set "CI=1"
if "%HANDYMAN_OLLAMA_MODEL%"=="" set "HANDYMAN_OLLAMA_MODEL=qwen3:8b"

where npx >nul 2>nul || goto :missing_node
where npm >nul 2>nul || goto :missing_node
where ollama >nul 2>nul || goto :missing_ollama

where py >nul 2>nul
if %errorlevel% equ 0 (
  set "PYTHON_CMD=py -3"
) else (
  where python >nul 2>nul || goto :missing_python
  set "PYTHON_CMD=python"
)

curl.exe --silent --fail http://127.0.0.1:11434/api/tags >nul 2>nul
if errorlevel 1 start "Ollama" /min ollama serve
ollama pull "%HANDYMAN_OLLAMA_MODEL%" || exit /b 1

if not exist "%PROJECT_ROOT%\handyman-admin-dashboard\node_modules" (
  pushd "%PROJECT_ROOT%\handyman-admin-dashboard"
  call npm ci || exit /b 1
  popd
)

start "Firebase Emulators" cmd /k "cd /d ""%PROJECT_ROOT%\handyman-admin-dashboard"" && npx --yes firebase-tools emulators:start --config firebase.emulator.json --project %EMULATOR_PROJECT_ID%"

for /l %%I in (1,1,30) do (
  curl.exe --silent --fail "http://127.0.0.1:9000/.settings/rules.json?ns=%DATABASE_NAMESPACE%" >nul 2>nul
  if not errorlevel 1 goto :emulator_ready
  timeout /t 1 /nobreak >nul
)

echo Firebase emulators did not start.
exit /b 1

:emulator_ready
%PYTHON_CMD% "%PROJECT_ROOT%\ai-service\scripts\seed_firebase_emulator.py" || exit /b 1

start "Handyman AI" cmd /k "cd /d ""%PROJECT_ROOT%\ai-service"" && set HANDYMAN_AI_PROVIDER=ollama && set HANDYMAN_OLLAMA_MODEL=%HANDYMAN_OLLAMA_MODEL% && set HANDYMAN_CORS_ORIGIN=http://127.0.0.1:3000 && %PYTHON_CMD% -m app.api.server --port 8080"
start "Handyman Auto Assignment" cmd /k "cd /d ""%PROJECT_ROOT%\ai-service"" && set HANDYMAN_AI_PROVIDER=ollama && set HANDYMAN_OLLAMA_MODEL=%HANDYMAN_OLLAMA_MODEL% && set HANDYMAN_FIREBASE_DATABASE_URL=http://127.0.0.1:9000 && set HANDYMAN_FIREBASE_DATABASE_NAMESPACE=%DATABASE_NAMESPACE% && set HANDYMAN_FIREBASE_AUTH_TOKEN=owner && %PYTHON_CMD% -m app.workers.firebase_auto_assignment"
start "Handyman Dashboard" cmd /k "cd /d ""%PROJECT_ROOT%\handyman-admin-dashboard"" && set REACT_APP_USE_LOCAL_FIXTURES=false && set REACT_APP_LOCAL_AI_SERVICE_URL=http://127.0.0.1:8080 && set REACT_APP_FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 && set REACT_APP_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099 && npm start"

echo Firebase UI: http://127.0.0.1:4000
echo Dashboard:   http://127.0.0.1:3000/job-management
echo Login:       admin@example.com / admin123
exit /b 0

:missing_node
echo Node.js and npm are required.
exit /b 1

:missing_ollama
echo Ollama is required: https://ollama.com/download
exit /b 1

:missing_python
echo Python 3.9 or newer is required.
exit /b 1
