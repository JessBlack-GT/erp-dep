# QA municipal con Playwright (API SIMULADA)

Arnés web aislado del espacio de trabajo municipal con **API simulada y datos sintéticos**. No usa
backend real, MongoDB ni credenciales; el navegador tiene bloqueada toda petición fuera de 127.0.0.1.
No forma parte de la app ni de su navegación.

| Archivo | Uso |
|---|---|
| `municipal-harness.web.jsx` | Entrada del arnés (escenarios: `?scenario=no-membership`, `load-error`, `submit-error`; `?delay=ms`) |
| `build-municipal-harness.cjs` | Compila el arnés con la misma configuración de esbuild que `scripts/web.cjs` |
| `service-backed-api.js` + `shims/` | F1-13: servicio municipal **real** con almacén en memoria dentro del navegador (`?persona=`, `?openFolio=`, `?latency=`, `?fail=`) |
| `e2e/municipal-detail.e2e.spec.cjs` | F1-13: 17 casos del detalle de expediente (10 escenarios pedidos) |
| `e2e/evidence.cjs` | Captura por prueba, registro JSONL y bloqueo de red externa |
| `run-windows.ps1` | Ejecución en Windows con el Playwright global (detecta `cli.js`, fija `NODE_PATH`) |
| `e2e/municipal.e2e.spec.cjs` | 14 escenarios: carga, validación, CURP, registro, teclado, foco, continuidad, errores, membresía, accesibilidad, 3 anchos, impresión |
| `e2e/playwright.config.cjs` | Configuración (captura por prueba; traza, video y captura extra en fallos; reportes JSON/HTML) |
| `e2e/static-server.cjs` | Servidor estático local (127.0.0.1) |

## Ejecutar en Windows (Playwright global con Chromium, Firefox y WebKit)

```powershell
cd apps\frontend
node qa\build-municipal-harness.cjs qa\dist-municipal
npx playwright install firefox webkit        # solo si faltan (descarga navegadores)
powershell -ExecutionPolicy Bypass -File qa\run-windows.ps1                        # 3 navegadores
powershell -ExecutionPolicy Bypass -File qa\run-windows.ps1 -Spec municipal-detail # solo F1-13
```

Verificado el 2026-11-10 en Windows con Chromium 158 (31/31). Firefox y WebKit no arrancaron porque
faltaban sus binarios para la versión global de Playwright (ver `docs/munierp/13`).

Evidencias: `<MUNI_EVIDENCE_DIR>/<navegador>/<escenario>.png` (una por prueba),
`registro-<navegador>.json` (navegador, fecha, escenario, resultado), `results.json`, `html-report/`
y, solo en fallos, `artifacts/` con captura, video y traza.
