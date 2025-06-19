@echo off

echo Stopping and removing existing container...
docker stop barreiros-threeai-container >nul 2>&1
docker rm barreiros-threeai-container >nul 2>&1

echo Building Docker image...
docker build -t barreiros-threeai .

if %errorlevel% equ 0 (
    echo Build successful! Starting container...
    docker run -p 3001:3001 ^
        --env-file .env ^
        --name barreiros-threeai-container ^
        barreiros-threeai
) else (
    echo Build failed!
    exit /b 1
)
