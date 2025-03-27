@echo off
:: run.bat

:: 设置标题
title 后台运行服务

:: 创建日志目录
if not exist "logs" mkdir logs

:: 后台启动服务器
START "Server" cmd /k "cd server && bun run server.ts"

:: 后台启动Koishi
START "KOIshi" cmd /k "cd meow && yarn start"

:: 启动 launcher (保持窗口显示)
START "Launcher" cmd /c "cd NapCat.Shell && launcher.bat -q 2314554773"

echo serverStart
echo LOGGer: logs/server.log and logs/koishi.log
echo Launcher new window