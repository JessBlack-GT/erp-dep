# F1-05 pasos 1 y 2 — puerto asíncrono y suite de contrato del repositorio

> **Estado (2026-11-10): pasos 1 y 2 HECHOS, en memoria.** No hubo conexión a MongoDB ni a Atlas, no
> se crearon colecciones ni índices y no se tocaron credenciales. La persistencia en MongoDB **no está
> aprobada**: la suite en memoria fija la semántica del puerto, no certifica MongoDB.
> También en esta entrega: Playwright Firefox/WebKit en Windows, revisión C-18/C-19 y X-01…X-04.

## 1. Paso 1 — puerto asíncrono

| Pieza | Cambio |
|---|---|
| `persistence/repository-port.js` (nuevo) | Lista de operaciones por agregado, códigos de error y `assertRepositoryPort()`. Reglas 1–8 del puerto en la cabecera |
| `mocks/in-memory-store.js` | Todas las operaciones devuelven promesas (`newId` síncrono). `transaction(fn)` llama a `fn(tx)` sobre una copia y confirma o descarta; transacciones y escrituras sueltas en cola; lecturas fuera de la transacción solo ven lo confirmado; exige municipio; devuelve copias; historial solo crece. `store.testing` (síncrono) solo para pruebas |
| `application/municipal.service.js` | `await` en todo acceso al puerto. **Cada escritura y su evento de bitácora en la misma transacción** (antes solo altas, transiciones y ediciones de expediente). Documento en tres pasos: metadatos `PENDIENTE` → binario → `VIGENTE` + bitácora. Descarga solo de `VIGENTE`. Revocación de concesión verificada dentro de la transacción |
| `http/municipal.router.js` | Contexto municipal asíncrono; manejadores con `await` y el **mismo orden de validación** (ruta → contexto → parámetros), para conservar 401/403/404/400 actuales |
| `apps/frontend/qa/service-backed-api.js` | El arnés de QA y Jest leen membresías y concesiones del puerto asíncrono, como la capa HTTP |

**Contrato público:** sin cambios. Mismas rutas, códigos, cuerpos y ETag; las 117 pruebas HTTP/servicio
de F1-04/F1-12 pasan con los mismos asertos (solo se añadió `await` donde llamaban al servicio
directamente, y la inspección de estado pasó a `store.testing`).

**Comportamiento interno corregido (no visible en la API salvo en fallos):**
- un fallo de bitácora ya no deja una dependencia, membresía, ciudadano o concesión escrita sin
  evento de auditoría;
- un fallo del almacenamiento de binarios ya no deja un documento visible sin contenido: queda
  `PENDIENTE`, no se lista ni descarga, y no genera evento `DOCUMENT_UPLOADED`;
- dos revocaciones simultáneas de la misma concesión: una procede, la otra responde 404 (antes ambas
  podían registrar `GRANT_REVOKED`).

## 2. Paso 2 — suite de contrato del repositorio

`apps/backend/tests/municipal/repository-contract/` — 35 casos parametrizados por implementación:

| Archivo | Función |
|---|---|
| `cases.js` | Casos con id, área, nivel y verificación |
| `define.js` | Registra la suite para una implementación (`kind: 'memory' \| 'mongo'`) |
| `faults.js` | Inyección de fallos que envuelve **cualquier** implementación del puerto (no pide ganchos al adaptador) |
| `seed.js` | Semilla sintética común |
| `../repository-contract.memory.test.js` | Ejecutor en memoria |
| `../repository-contract.mongo.test.js` | Ejecutor MongoDB **preparado**: no importa mongoose; se omite si la guardia de QA no autoriza o falta el adaptador |

### Niveles (lo que cada resultado significa)

| Nivel | Casos | En memoria | Significado |
|---|---|---|---|
| **L1 semántica** | RC-01…RC-25 (25) | Ejecutados: **25/25** | Comportamiento del puerto. Deben pasar igual en MongoDB; aprobar en memoria no lo certifica |
| **L2 aproximación** | RC-26…RC-28 (3) | Ejecutados: **3/3** | Concurrencia. En memoria pasan porque el almacén serializa; contra MongoDB ejercitan índices y transacciones reales. **Sin valor de certificación** |
| **L3 solo MongoDB** | RC-29…RC-35 (7) | **Pendientes** (no ejecutados) | Índices reales, `writeConcern`/`readConcern`, reintentos transitorios, topología, GridFS, rol de Atlas sobre la bitácora, `$push` concurrente y tamaño de documento, lectura tras revocación |

Cobertura por área pedida: creación y consulta (RC-01…03), aislamiento municipal (04…06, 31), folios
únicos (07…09, 26, 29), colisiones y conflictos (10, 11, 27, 28), revisiones (12, 13), historial y
auditoría (14, 15, 33, 34), revocación (16, 35), documentos privados (17, 18, 32), errores de
persistencia (19…21, 30), consistencia tras rechazos (22…25).

**Sensibilidad de la suite (comprobada, no incluida en `npm test`):** contra dos mutantes del almacén
falla donde debe: «transacción sin aislamiento ni rollback» → 7 fallos (RC-19…24 y RC-28); «consultas
sin exigir municipio» → 1 fallo (RC-04). Script y registro en `RP\munierp-fase1\f1-05\evidencias\sensibilidad-contrato\`.

### Guardia de QA (`persistence/qa-guard.js`)

Función pura; no conecta. Exige `MUNICIPAL_STORE=mongo`, `MUNICIPAL_QA_DATABASE=munierp_qa`,
`MUNICIPAL_QA_URI` (si nombra base, `munierp_qa`), `MUNICIPAL_QA_AUTHORIZED=AAAA-MM-DD|responsable|munierp_qa`
con fecha válida no futura y `NODE_ENV≠production`. Rechaza la base si otra variable `*_QA_DATABASE`
tiene el mismo valor y la autorización si se reutiliza de otra variable `*AUTHORIZ*` (p. ej. la de
M07/Ventas). Hoy, sin variables, informa el ejecutor Mongo como **omitido**.

## 3. Resultados de pruebas (ejecutadas)

| Suite | Entorno | Resultado |
|---|---|---|
| Backend municipal (`tests/municipal/*.test.js`) | VM Linux, Node 22 | **163 pasan, 0 fallan, 8 pendientes** (7 casos L3 + ejecutor Mongo omitido) |
| Backend completo (`tests/**`, `src/**`) en 3 lotes + municipal | VM Linux, Node 22 | **1 116 pasan, 0 fallan, 8 pendientes**. La prueba `Phase 1 ESLint configuration` excedió 20 s en el lote y pasa sola con límite de 170 s (22 s), como en fases previas |
| Jest `municipal.detail.test.js` | VM Linux | **16/16** (límite del archivo subido a 30 s: la primera prueba tarda 16-18 s en frío) |
| Jest `municipal.frontend.test.js` | VM Linux | **12/12** |
| Jest `municipal.compat-c18-c19` + `compat-c18-corregido` | VM Linux | **8/8** |
| Playwright F1-13 (17) + F1-12 (14), arnés reconstruido con el puerto asíncrono | **Windows**, ver §4 | **93/93** |

## 4. Playwright en Windows: Chromium, Firefox y WebKit

Antes de instalar nada se revisó el ejecutor de Codex (`docs/qa/m07-2026-11-09/windows-offline.cjs`
de la copia de trabajo, solo lectura): usa `executablePath` desde `QA_<NAVEGADOR>_EXE` y
`PLAYWRIGHT_BROWSERS_PATH`. El kit adopta la misma convención (`playwright.config.cjs` y
`run-windows.ps1`) y, si las variables no están definidas, toma la revisión instalada más reciente en
`%LOCALAPPDATA%\ms-playwright`. **No se instaló Playwright ni se descargó ningún navegador.**

Ejecución del 2026-11-10 13:25 (hora de México), lanzada desde el Explorador con el kit
`RP\munierp-fase1\f1-05\qa-kit`:

| Navegador | Ejecutable | Versión | F1-13 | F1-12 | Capturas |
|---|---|---|---|---|---|
| Chromium | revisión propia de Playwright 1.65.0 | 158.0.8127.18 | **17/17** | **14/14** | 31 |
| Firefox | `ms-playwright\firefox-1569\firefox\firefox.exe` | 158.0 | **17/17** | **14/14** | 31 |
| WebKit | `ms-playwright\webkit-2386\Playwright.exe` | 27.2 | **17/17** | **14/14** | 31 |

Total 93 pasan, 0 fallan, 0 inestables, 188 s. Modo de API en cada registro: **SIMULADA** (servicio
municipal real en memoria para F1-13; mock básico para F1-12). Sin fallos no se generaron trazas
(la configuración las conserva solo en fallo: `trace` y `video` `retain-on-failure`). Registros por
navegador (`registro-<navegador>.jsonl`) con versión, plataforma, fecha, escenario, resultado,
duración, captura y modo de API; `entorno.json` con versiones y rutas (perfil de usuario sustituido
por `%USERPROFILE%`); `results.json` y reporte HTML. Ruta del usuario sustituida en `results.json`.

Esto completa los navegadores que F1-13 dejó pendientes. No equivale a certificación con lectores de
pantalla (NVDA, TalkBack, VoiceOver), que sigue sin ejecutarse.

## 5. Compatibilidad con las correcciones C-18 (Card) y C-19 (Input)

Revisado el diff de Codex en la copia de trabajo (sin integrarlo): `Card` estático ahora reenvía
`accessibilityLabel`; `Input` ya no fija `accessibilityRole="search"`.

| Uso municipal | Con el Card actual | Con el Card corregido | Ajuste |
|---|---|---|---|
| `RequestList` estático (sin `onSelect`): etiqueta en Card **y** en el elemento interior (compensación F1-12) | 1 anuncio (Card la descarta) | **2 anuncios** (duplicado) | La etiqueta va en Card solo si es interactiva; en estático, solo en el interior. Compatible con ambas versiones |
| `RequestList` interactivo | 1 (botón) | 1 (botón) | Ninguno |
| `ReceiptView`: etiqueta «Acuse de solicitud, folio …» en Card | 0 (descartada) | Etiqueta de contenedor que repite el folio y agrupa los botones hijos (contra la indicación de Codex) | Se retira la etiqueta del contenedor; «Acuse de solicitud» pasa a encabezado (`header`) |
| `Section` de `RequestDetail` (Card sin etiqueta) | — | — | Ninguno |
| `Input` «Asunto» del registro | rol `search` (defecto C-19) | sin rol (campo de texto) | Ninguno: el módulo no compensa ni sobrescribe el rol |

Pruebas: los mismos 3 casos C-18 se ejecutan con el Card actual y con una **réplica de prueba** del
corregido (`jest.mock` solo en esa prueba); más 2 casos C-19. Comprobación inversa: con la versión
F1-12 de `RequestList` y el Card corregido, la prueba de fila estática **falla** (2 anuncios), lo que
confirma que el ajuste es necesario. Los 93 casos Playwright pasan con los ajustes (núcleo actual).
Pendiente para la integración coordinada: repetir F1-12/F1-13 y la prueba de compatibilidad con el
`Card`/`Input` reales de Codex, y verificar el árbol accesible (indicación de Codex).

## 6. Contrato: X-01 a X-04

Evaluación completa en [contracts/PROPUESTAS-DRAFT4.md](contracts/PROPUESTAS-DRAFT4.md). draft.3 sigue
vigente; no se publicó draft.4.

| ID | Veredicto |
|---|---|
| X-01 `actorName` | Requiere cambio de contrato (campo opcional aditivo). Mantener como propuesta |
| X-02 `scopes` | Retirada: `MyMembership` ya trae rol, dependencias y permisos; el servidor autoriza |
| X-03 `allowedActions` | Diferida: aditiva y útil, no bloquea; la paridad está cubierta por prueba |
| X-04 `restricted` | Retirada: **ya existe en draft.3** y la interfaz ya la usa (el doc 13 lo afirmaba mal; corregido) |

## 7. Preparación de MongoDB (sin ejecutar)

Listo: puerto y sus reglas, suite de contrato con niveles, ejecutor Mongo con guardia, inyección de
fallos portable y diseño actualizado (doc 12: la transacción usa un repositorio `tx` explícito en vez
de `AsyncLocalStorage`). Falta (paso 3, requiere C-05): adaptador `persistence/mongo-store.js`,
modelos, `municipal.setup.js`, adaptador GridFS y la base `munierp_qa` exclusiva con **autorización
propia, independiente de la de M07** (la guardia rechaza una autorización reutilizada).

## 8. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-15a | El almacén en memoria serializa; MongoDB no. Los casos L2 pueden comportarse distinto | Ejecutar L2 y L3 contra `munierp_qa` antes de declarar persistencia |
| R-15b | `updateRequest` recibe el historial completo; el adaptador debe traducirlo a `$push` y validar el prefijo | Caso RC-14 y nota en doc 12 §5 |
| R-15c | La subida de binarios deja metadatos `PENDIENTE` si falla el almacenamiento | Visible para conciliación; sin borrado automático (doc 12 §7) |
| R-15d | Integrar el Card corregido sin los ajustes de este paso duplicaría etiquetas | Ajustes ya aplicados y probados con ambas versiones |
| R-15e | Firefox de Playwright falló en el entorno aislado de Codex (código 0xC0000022) | En la sesión del usuario funcionó; documentado para CI |
| R-15f | La primera prueba Jest del detalle tarda 16-18 s en la VM | Límite de 30 s en ese archivo; revisar en CI |

## 9. Siguiente historia recomendada

**F1-05 paso 3 — adaptador MongoDB**, en cuanto Codex entregue C-05 (base `munierp_qa` exclusiva y
autorización propia): adaptador, modelos e índices explícitos, `municipal.setup.js` con verificación de
topología, y ejecución de los niveles L1–L3 contra QA. Mientras C-05 siga abierta, sin tocar el
núcleo: preparar la integración coordinada de C-18/C-19 con Codex y X-01 si se aprueba.
