@echo off
setlocal
set "BIN=%~dp0.mongodb\mongodb-win32-x86_64-windows-8.3.4\bin\mongod.exe"
set "DATA=%~dp0.mongodb\data"
set "LOG=%~dp0.mongodb\mongod.log"
if not exist "%DATA%" mkdir "%DATA%"
start "" /b "%BIN%" --dbpath "%DATA%" --logpath "%LOG%" --bind_ip 127.0.0.1
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try { $c = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 27017); Write-Output 'MongoDB started on 127.0.0.1:27017'; $c.Close() } catch { Write-Output 'MongoDB failed to start - see %LOG%' }"
endlocal
