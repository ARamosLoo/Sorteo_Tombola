@echo off
title Construir instalador - Gran Sorteo INEI
echo Instalando dependencias...
call npm install
if errorlevel 1 goto error
echo Generando instalador...
call npm run dist
if errorlevel 1 goto error
echo.
echo Listo. El instalador esta en la carpeta "dist".
explorer dist
goto end
:error
echo Ocurrio un error. Revisa que Node.js este instalado.
:end
pause
