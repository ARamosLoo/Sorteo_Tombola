@echo off
title Gran Sorteo Institucional - INEI
start "" "msedge.exe" --app="file:///%~dp0index.html" --start-maximized
if %ERRORLEVEL% NEQ 0 (
  start "" "%~dp0index.html"
)
