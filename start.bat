@echo off
title Universal Annotator

:: Start API Server
start "API Server" bash --login -c "cd ~/usecal-app && pnpm --filter @workspace/api-server run dev"

:: Wait 3 seconds
timeout /t 3 /nobreak > nul

:: Start Tauri Frontend
start "Frontend" bash --login -c "cd ~/usecal-app/artifacts/tauri-annotator && pnpm dev"

:: Wait 5 seconds for frontend to be ready
timeout /t 5 /nobreak > nul

:: Start Tauri App
set LIB=C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\um\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\ucrt\x64;%LIB%
set PATH=D:\cargo-cache\bin;%PATH%
set CARGO_HOME=D:\cargo-cache
cd C:\Users\bhoom\usecal-app\artifacts\tauri-annotator
pnpm tauri dev