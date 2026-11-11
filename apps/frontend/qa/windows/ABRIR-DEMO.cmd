@echo off
rem MuniERP IA - Abrir la DEMOSTRACION (API simulada, datos sinteticos, sin internet ni MongoDB).
rem Requiere Node.js 18 o superior. Si no hay Node, abre el archivo directamente en el navegador.
setlocal
cd /d "%~dp0"
set PORT=4180
where node >nul 2>nul
if errorlevel 1 goto sinnode
echo Iniciando MuniERP IA (demostracion) en http://127.0.0.1:%PORT%/demo/
echo Deje esta ventana abierta durante la demostracion. Cierrela para terminar.
start "" "http://127.0.0.1:%PORT%/demo/"
node "%~dp0servidor-local.cjs" "%~dp0app" %PORT%
goto fin
:sinnode
echo No se encontro Node.js. Se abrira la demostracion directamente desde el archivo.
start "" "%~dp0app\demo\index.html"
:fin
endlocal
