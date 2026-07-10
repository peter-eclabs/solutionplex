$bin = "$PSScriptRoot\.mongodb\mongodb-win32-x86_64-windows-8.3.4\bin\mongod.exe"
$data = "$PSScriptRoot\.mongodb\data"
$log = "$PSScriptRoot\.mongodb\mongod.log"
if (-not (Test-Path $data)) { New-Item -ItemType Directory -Path $data >$null }
Start-Process -FilePath $bin -ArgumentList "--dbpath", $data, "--logpath", $log, "--bind_ip", "127.0.0.1" -WindowStyle Hidden
Start-Sleep -Seconds 3
try { $c = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 27017); "MongoDB started on 127.0.0.1:27017"; $c.Close() }
catch { "MongoDB failed to start - see $log" }
