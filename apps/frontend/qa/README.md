# QA municipal con Playwright (API SIMULADA)

Arnés web aislado del espacio de trabajo municipal con **API simulada y datos sintéticos**. No usa
backend real, MongoDB ni credenciales; el navegador tiene bloqueada toda petición fuera de 127.0.0.1.
No forma parte de la app ni de su navegación.

| Archivo | Uso |
|---|---|
| `municipal-harness.web.jsx` | Entrada del arnés (escenarios: `?scenario=no-membership`, `load-error`, `submit-error`; `?delay=ms`) |
| `build-municipal-harness.cjs` | Compila el arnés con la misma configuración de esbuild que `scripts/web.cjs` |
| `e2e/municipal.e2e.spec.cjs` | 14 escenarios: carga, validación, CURP, registro, teclado, foco, continuidad, errores, membresía, accesibilidad, 3 anchos, impresión |
| `e2e/playwright.config.cjs` | Configuración (captura por prueba; traza, video y captura extra en fallos; reportes JSON/HTML) |
| `e2e/static-server.cjs` | Servidor estático local (127.0.0.1) |

## Ejecutar en Windows (Playwright global con Chromium, Firefox y WebKit)

```powershell
cd apps\frontend
node qa\build-municipal-harness.cjs qa\dist-municipal
$env:NODE_PATH = (npm root -g)
$env:MUNI_HARNESS_DIR = "qa\dist-municipal"
$env:MUNI_EVIDENCE_DIR = "qa\evidence-local\$(Get-Date -Format yyyy-MM-dd)"
$env:MUNI_BROWSERS = "chromium,firefox,webkit"
npx playwright test -c qa\e2e\playwright.config.cjs
```

Evidencias: `<MUNI_EVIDENCE_DIR>/<navegador>/<escenario>.png` (una por prueba),
`registro-<navegador>.json` (navegador, fecha, escenario, resultado), `results.json`, `html-report/`
y, solo en fallos, `artifacts/` con captura, video y traza.
