@echo off

:: LiveKit 서버 시작 (Docker)
echo Starting LiveKit Server...
docker compose up -d livekit
if %errorlevel% neq 0 (
    echo Docker seems to be missing or not running. Please install Docker Desktop and try again.
    echo Skipping LiveKit startup...
)

echo Starting Backend...
cd backend
start /b go run cmd/server/main.go
cd ..

echo Starting Frontend...
cd frontend
start /b npm run dev
cd ..

echo Waiting for services to start...
timeout /t 5 >nul

echo Opening Chrome...
start chrome http://localhost:3000
