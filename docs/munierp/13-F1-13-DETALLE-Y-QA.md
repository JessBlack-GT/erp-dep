# F1-13 — Detalle de expediente en la interfaz y QA con Playwright

> **Estado: HECHO-A (2026-11-10)**, aislado y sin montar (no está en la navegación del ERP; C-01/C-11).
> Todas las pruebas de esta historia usan **API SIMULADA**: el servicio municipal real del backend con
> almacén en memoria y datos sintéticos, ejecutado dentro del navegador o de Jest. **No** hubo HTTP al
> backend, JWT, MongoDB ni Atlas.

## 1. Qué se entregó

| Requisito | Implementación |
|---|---|
| Folio, tipo, descripción, estado, municipio y dependencia | `RequestDetail` → encabezado (folio, insignias de estado y confidencialidad) y sección «Datos de la solicitud» |
| Historial cronológico con fecha y actor | Sección «Historial» (lista accesible; cada elemento con nombre `Acción, de X a Y, fecha, por actor`) |
| Documentos y evidencias | Sección «Documentos»: descarga **solo** por el endpoint del servidor; los documentos restringidos se muestran como «Documento restringido (Confidencial)» sin nombre ni botón |
| Acciones según rol | `availableActions(permisos, estado)` refleja `ACTIONS` del servidor (prueba de paridad); el servidor sigue siendo quien autoriza |
| Carga, vacío, error y acceso denegado | `municipal-detail-loading`, `detail-history-empty`, `detail-documents-empty`, error de red con «Reintentar», 404 sin divulgación, «sin membresía», `detail-meta-only` para auditor |
| Validación y confirmación | Nota obligatoria (≥ 5 caracteres) para concluir/cancelar; dependencia o responsable obligatorios; paso de confirmación con `role=alert`; avisos de éxito/error; 409 recarga el expediente |
| Responsivo, teclado, accesible | 1 columna < 1024 px, 60/40 ≥ 1024 px; flujo completo con Tab/Enter; encabezados, listas y nombres de botones verificados |
| Reutilizar frontend y servicios | Componentes comunes del ERP (`Button`, `Text`, `Card` vía `Section`, `Badge`, `TextArea`, `LoadingSpinner`), `apiClient` de `services/api.js` y `utils/downloadFile`. **No** se modificaron `Card` ni `Input` |

**Cliente HTTP real** (`municipalApi.js`): reutiliza el `apiClient` del ERP con `baseURL`
`/api/municipal/v1` por petición. Queda listo para cuando Codex monte la API (C-01); hoy la app usa la
API simulada.

## 2. Contrato draft.3 y extensiones propuestas (no implementadas en el servidor)

La interfaz usa solo campos de draft.3. Propuestas documentadas para draft.4 (**reevaluadas el 2026-11-10 en [contracts/PROPUESTAS-DRAFT4.md](contracts/PROPUESTAS-DRAFT4.md): X-02 y X-04 retiradas, X-01 se mantiene, X-03 diferida**):

| ID | Extensión | Motivo | Mientras tanto |
|---|---|---|---|
| X-01 | `HistoryEntry.actorName` (o `actor: {id, displayName}`) | El historial solo trae `actorId`; un funcionario no reconoce un ObjectId | Se muestra «Funcionario ···<últimos 6>» |
| X-02 | `MyMembership.scopes` (o permisos con alcance) | La interfaz infiere acciones por permiso + estado; el alcance (M/D/A) lo decide el servidor | Botones según permiso; un 403/404 del servidor se muestra como mensaje y recarga |
| X-03 | `RequestFull.allowedActions` calculado por el servidor | Eliminaría la duplicación de la tabla de transiciones en el cliente | Prueba de paridad `TRANSITIONS` ↔ `ACTIONS` |
| X-04 | ~~`Document.restricted: true`~~ | **Corrección:** draft.3 ya define `DocumentRestricted` con `restricted: true` y la interfaz ya lo usa; esta fila afirmaba lo contrario por error | Sin cambio |

## 3. Pruebas

### Unitarias y funcionales (Jest, en la VM Linux del equipo, Node 22)

| Suite | Resultado |
|---|---|
| `tests/municipal.detail.test.js` (nueva) | **16/16 pasan** — paridad con el servidor, permisos del mock = SUPERVISOR real, detalle titular, descarga por servicio (bytes PDF, `no-store`), documento restringido para CONSULTA, auditor solo metadatos, ajeno/otro municipio/inexistente → mismo mensaje, membresía revocada, error de red + reintento, flujo CERRAR, conflicto 409, ASIGNAR vía membresías, lista → detalle → volver, auditor en el espacio de trabajo, cliente HTTP (rutas y normalización de errores) |
| `tests/municipal.frontend.test.js` | **12/12 pasan** (1 advertencia `act()` no bloqueante del `Button` del ERP) |
| Backend municipal | Sin cambios en F1-13 (117 pruebas de F1-12, no re-ejecutadas en esta historia) |

### Playwright — 17 casos que cubren los 10 escenarios pedidos

`apps/frontend/qa/e2e/municipal-detail.e2e.spec.cjs` (modo `?persona=`; API simulada):

| Escenario pedido | Casos |
|---|---|
| 1. Apertura del detalle desde la lista | 01 |
| 2. Folio y estado | 02 |
| 3. Historial | 03 |
| 4. Documentos autorizados | 04 (descarga real del PDF), 05 (confidencial restringido para CONSULTA) |
| 5. Denegación de expedientes ajenos | 06 (otra dependencia, otro municipio, inexistente → mismo 404), 14 (auditor solo metadatos) |
| 6. Usuario sin membresía | 07 (sin membresía y admin comercial del ERP), 10 (revocación durante la sesión) |
| 7. Carga y errores | 08 (latencia), 09 (red + reintento; fallo parcial de documentos) |
| 8. Navegación con teclado | 12 (lista → detalle → concluir solo con teclado) |
| 9. Accesibilidad de formularios y controles | 11 (validación y confirmación), 13 (encabezado, listas, nombres, alertas) |
| 10. Adaptable 360/800/1280 | 15 × 3 (sin desplazamiento horizontal, apilado vs columnas, altura de botones) |

### Resultados por navegador (ejecutados vs. pendientes)

| Entorno | Navegador | F1-13 (17) | F1-12 regresión (14) | Estado |
|---|---|---|---|---|
| Nube Linux (contenedor) | Chromium 153.0.8010.12 | **17/17** | **14/14** | Ejecutado |
| **Windows** (equipo del usuario, Playwright global) | Chromium 158.0.8127.18 | **17/17** | **14/14** | Ejecutado (2026-11-10 06:32 UTC) |
| Windows | Firefox | — | — | **NO ejecutado**: falta el binario `firefox-1572` de la versión global de Playwright |
| Windows | WebKit | — | — | **NO ejecutado**: falta el binario `webkit-2388` |

Las 62 entradas «fallidas» de Firefox/WebKit en `results.json` de Windows son **fallos de arranque
del navegador** (`browserType.launch: Executable doesn't exist`), no fallos de la interfaz. No se
declaran ni aprobadas ni reprobadas. Para completarlas (descarga de navegadores, requiere su
autorización):

```powershell
npx playwright install firefox webkit
cd C:\Users\<usuario>\OneDrive\Desktop\RP\munierp-fase1\f1-13\qa-kit
powershell -ExecutionPolicy Bypass -File .\run-windows.ps1 -Browsers firefox,webkit
```

### Evidencias (sin secretos ni datos personales; la ruta de usuario de Windows se sustituyó por `<usuario>`)

```
RP\munierp-fase1\f1-13\
├── qa-kit\                         kit autónomo (arnés compilado + specs + run-windows.ps1)
│   └── evidence\windows_2026-11-10_0032\
│       ├── chromium\f1-13-detalle\*.png   17 capturas (una por prueba)
│       ├── chromium\*.png                 14 capturas F1-12
│       ├── registro-chromium.jsonl        navegador, versión, plataforma, fecha, escenario, resultado, modo API
│       ├── results.json, html-report\, consola.txt
│       └── artifacts\                     contexto de error de Firefox/WebKit (arranque)
└── qa\evidencias\nube-linux-chromium\
    ├── f1-13-cloud\       17 capturas + registro + reporte HTML
    └── f1-12-regresion\   14 capturas + registro + reporte HTML
```

## 4. Hallazgos y riesgos de integración

| ID | Hallazgo / riesgo | Acción |
|---|---|---|
| R-13a | `downloadFile.android.js` solo admite PDF/XLSX y rotula «Reporte de inventario»; los documentos municipales pueden ser PNG/JPEG | **C-21** (Codex): parametrizar tipos y descripción. En web funciona para los tres tipos |
| R-13b | La tabla de transiciones existe en cliente y servidor | Prueba de paridad; propuesta X-03 |
| R-13c | El actor se muestra abreviado | Propuesta X-01 |
| R-13d | La membresía se consulta al cargar; la revocación surte efecto en la siguiente carga, no en tiempo real | El servidor rechaza igualmente cada petición; documentado en F1-05 §6 |
| R-13e | Firefox/WebKit sin ejecutar | Instalar navegadores en Windows o CI (C-20) |
| R-13f | Navegación al detalle por estado local, sin ruta profunda | Al registrar la pantalla (C-11) definir ruta con folio y volver a validar 404 sin divulgación |

## 5. Archivos

**Nuevos:** `apps/frontend/src/features/municipal/components/RequestDetail.js`,
`apps/frontend/src/features/municipal/municipalApi.js`, `apps/frontend/tests/municipal.detail.test.js`,
`apps/frontend/qa/service-backed-api.js`, `apps/frontend/qa/shims/crypto.js`,
`apps/frontend/qa/shims/buffer-global.js`, `apps/frontend/qa/e2e/evidence.cjs`,
`apps/frontend/qa/e2e/municipal-detail.e2e.spec.cjs`, `apps/frontend/qa/run-windows.ps1`,
`docs/munierp/12-F1-05-DISENO-MONGODB.md`, `docs/munierp/13-F1-13-DETALLE-Y-QA.md`.

**Modificados:** `features/municipal/model.js`, `MunicipalWorkspaceScreen.js`, `mockApi.js`,
`index.js`; `qa/build-municipal-harness.cjs`, `qa/municipal-harness.web.jsx`, `qa/README.md`;
docs `06`, `07`, `08`, `README.md`.

**No modificados:** `app.js`, autenticación central, RBAC comercial, `Card`, `Input` y demás
componentes comunes, Ventas, Inventario (M07), backend municipal, `package.json`, lockfiles, `main`.
