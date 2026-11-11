# 01 · Ejecutar MuniERP IA en Windows

## Opción A (recomendada): con Node.js

1. Requisito: **Node.js 18 o superior** (comprobado con Node 24.21 en Windows 11). No necesita
   internet, MongoDB, cuentas ni contraseñas.
2. Abra la carpeta `01-APLICACION-DEMO`.
3. Doble clic en **`ABRIR-DEMO.cmd`**.
   - Se abre una ventana negra con el mensaje *«Iniciando MuniERP IA (demostración)…»*: **déjela abierta**.
   - El navegador predeterminado abre `http://127.0.0.1:4180/demo/`.
4. Para terminar, cierre la ventana negra.

Si el puerto 4180 está ocupado, edite `ABRIR-DEMO.cmd` y cambie `set PORT=4180` por otro número.
El servidor solo escucha en `127.0.0.1` (no es accesible desde la red).

## Opción B: sin Node.js

`ABRIR-DEMO.cmd` lo detecta y abre directamente `app\demo\index.html`. También puede abrir ese archivo
con doble clic. La aplicación no hace peticiones de red. Esta vía (`file://`) se verificó en Chromium
(motor de Chrome y Edge); en Firefox no se verificó, use la opción A.

## Qué verá

- Una franja **amarilla oscura** arriba: *MODO DEMOSTRACIÓN · API simulada · datos sintéticos · sin HTTP,
  sin MongoDB*. Siempre visible.
- La elección de **perfil** (ventanilla, titular, supervisor, administrador, auditor, consulta, usuario
  sin membresía). Cada perfil tiene los permisos reales de su rol.
- Botones **Cambiar de perfil**, **Restablecer demostración** y **Usuarios centrales de ejemplo**.

## Restablecer

**Restablecer demostración** vuelve a sembrar exactamente los mismos datos (10 solicitudes de San Juan
Huactzinco más una de otro municipio, 11 dependencias, 11 membresías, documentos y bitácora). Recargar la
página tiene el mismo efecto. Cambiar de perfil **no** borra los datos.

## Ejecutar las pruebas automáticas (opcional)

Las pruebas Playwright usan la instalación existente (Playwright 1.65 global y navegadores en
`%LOCALAPPDATA%\ms-playwright`); no instalan nada.

1. En `04-EVIDENCIAS\qa-kit`, doble clic en `EJECUTAR-F1-15A-WINDOWS.cmd`.
2. Resultado en `evidence-local\windows_<fecha>\`: `registro-<navegador>.jsonl`, capturas, `results.json`,
   `html-report\` y, si algo falla, traza, video y captura del fallo.

## Para desarrolladores

```powershell
cd apps\frontend
node qa\build-municipal-harness.cjs <carpeta>\demo demo   # compila la demostración
node qa\e2e\static-server.cjs <carpeta> 4180              # sirve http://127.0.0.1:4180/demo/
```
