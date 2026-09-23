# QA M03 — Fase 7, 2026-09-23

**Dictamen: RECHAZADO.** Se corrigieron los bloqueos de código del arranque global y se conservaron las 60 pruebas originales, pero no existe configuración Atlas accesible en las ubicaciones revisadas. No se ha demostrado el flujo con persistencia real y la política de autorización de clientes continúa pendiente de decisión empresarial.

## Evidencia preservada y estado inicial

- Rama comprobada: `codex/m03-validation`; working tree limpio antes de modificar.
- HEAD inicial: `c1bc712ca2aeba1bae98becee442e46f9084da07`.
- Reejecución inicial: 47/47 backend M03 y 13/13 frontend M03, exit 0.
- Informe y resultados anteriores conservados sin sustituir su contenido en `history/M03-phase6.md` y `history/M03-phase6-results.json`.
- Los seis archivos que contienen las 60 pruebas originales no tienen cambios respecto al HEAD inicial; se comprobó con `git diff`. No se debilitaron expectativas.

## Diagnóstico y corrección del backend global

`roles` solo tenía modelo y repositorio. El router general importaba un archivo inexistente. La documentación no define endpoints de administración de roles y no se encontró evidencia local de un router implementado anteriormente.

Se añadió un router mínimo que exige autenticación y devuelve **501 ROLES_NOT_IMPLEMENTED**. No se expuso CRUD de roles ni se asignaron privilegios. Se implementó el endpoint documentado `/api/v1/health` como liveness y `/api/v1/ready` como readiness: devuelve 503 sin conexión MongoDB.

Al resolver el primer bloqueo aparecieron errores de sintaxis en los stubs de recursos humanos: identificadores con guiones. Se corrigieron únicamente los identificadores, sin añadir funcionalidad de RR. HH. Los 121 archivos JavaScript del backend pasan comprobación sintáctica.

También se corrigieron defectos de la base de autenticación: `/auth/me` y logout requerían middleware; el registro público aceptaba roles privilegiados y respondía con el documento que contenía el hash; login/refresh no rechazaban todos los estados inactivos. Se agregaron regresiones específicas para estos cambios. No se implementó revocación completa de tokens ni gestión de permisos.

## Clasificación de los 13 fallos originales del frontend

Tabla presentada antes de modificar la estrategia de pruebas:

| Test original | Error | Clasificación | Acción realizada |
|---|---|---|---|
| Component Imports | `Button`/exports comunes ausentes | D: funcionalidad futura, no usada por M03 | Requisito conservado como TODO; sin componentes vacíos |
| Feature auth | `LoginScreen` ausente | A: archivo necesario | Login real con contexto y servicio existentes |
| Feature dashboard | `DashboardScreen` ausente | D | TODO; Clientes es la entrada autenticada |
| Feature suppliers | `SuppliersScreen` ausente | D | TODO; M04 no desarrollado |
| Feature products | `ProductsScreen` ausente | D | TODO |
| Feature inventory | `InventoryScreen` ausente | D | TODO |
| Feature sales | `SalesScreen` ausente | D | TODO |
| Feature purchases | `PurchasesScreen` ausente | D | TODO |
| Feature finance | `FinanceScreen` ausente | D | TODO |
| Feature human-resources | `HREScreen` ausente | D | TODO |
| Feature reports | `ReportsScreen` ausente | D | TODO |
| Feature notifications | `NotificationsScreen` ausente | D | TODO |
| Feature settings | `SettingsScreen` ausente | D | TODO |

Hallazgos adicionales: B — imports incorrectos en App/ApiContext; E — AuthContext no extraía `response.data.data`; F — scripts web invocaban Expo sin dependencia. Se corrigieron los imports y el contrato del login, y se añadió una entrada web con React Native Web y esbuild **0.28.2**. No se migró React/React Native.

La navegación registra Login y las tres pantallas reales de Clientes. Los módulos futuros no se importan en el arranque ni se simulan con componentes vacíos. Se añadió cambio de estado en detalle y actualización de listado/detalle al volver a una pantalla. Register/ResetPassword, biblioteca común, módulos futuros y ejecución Expo Android/iOS continúan pendientes.

La prueba antigua de imports generales era una expectativa de disponibilidad, no una prueba funcional. Los 12 requisitos no implementados se conservan como `it.todo`, contados separadamente. No se presentan como 37/37 ni se ocultan los fallos anteriores, cuya evidencia está archivada.

## A. Backend aislado

| Suite | Total | Pass | Fail | Omitidas | Exit |
|---|---:|---:|---:|---:|---:|
| M03 original | 47 | 47 | 0 | 0 | 0 |

Incluye HTTP con router/autenticación reales y persistencia simulada; modelo y repositorio sin DB. No acredita Atlas.

## B. Frontend aislado

| Suite | Total | Pass | Fail | Omitidas | Exit |
|---|---:|---:|---:|---:|---:|
| M03 original, ejecutada por rutas exactas | 13 | 13 | 0 | 0 | 0 |
| Nuevas pruebas M03 de estado y actualización al volver | 2 | 2 | 0 | 0 | 0 |

Además se añaden 3 pruebas del login/contexto con API simulada: validación, almacenamiento/restauración y rechazo de credenciales. No se acreditan como login real contra Atlas.

## C. Backend global

| Suite | Total | Pass | Fail | Omitidas | Exit |
|---|---:|---:|---:|---:|---:|
| Global, incluidos `src/**/*.test.js` | 138 | 138 | 0 | 0 | 0 |

Las 126 pruebas originales pasan. Se añaden 12 de arranque, autenticación y condiciones de seguridad del runner QA. La aplicación completa se importa y el health responde; readiness permanece 503 sin DB.

## D. Frontend global

| Suite | Total registrado | Pass | Fail | TODO | Exit |
|---|---:|---:|---:|---:|---:|
| Global aplicable + requisitos futuros visibles | 42 | 30 | 0 | 12 | 0 |

Compilación web: PASS, exit 0. Se comprobó mediante automatización de navegador el renderizado de Login y el mensaje de campos obligatorios. No se introdujeron credenciales reales. El servidor temporal de frontend se detuvo después de la comprobación.

## E. MongoDB real

- **MongoDB connection: FAILED**.
- Motivo: `LOCAL_ENV_MISSING`; fallo del preflight, **no se intentó conexión de red**. No se atribuye a DNS, allowlist, TLS ni autenticación de Atlas.
- Base utilizada: **no ejecutada**. No se asumió un nombre ni se utilizó producción.
- Operaciones contra DB real: **0**.
- Datos QA limpiados: **no aplica; no se creó ningún dato**.
- Runner: `node apps/backend/scripts/validate-m03-real.cjs`, exit **2**.

Solo se encontraron plantillas en el clon y la copia local de origen, y no había variables MONGODB/JWT disponibles en el proceso. Se solicitó exclusivamente la ruta de configuración y la identificación de la base QA, nunca sus credenciales; esa información sigue pendiente.

El backend ahora carga `apps/backend/.env` mediante ruta absoluta. `MONGODB_DB_NAME` solo sustituye el nombre de la URI si está definido explícitamente. El runner acepta una ruta local en `M03_ENV_FILE`, exige `NODE_ENV=development/test` y `M03_QA_DATABASE` igual a la base seleccionada como confirmación de propósito. Rechaza producción y plantillas. Si faltan JWT de desarrollo, genera claves efímeras **solo en memoria**; nunca escribe secretos al repositorio.

Se prepararon pruebas para login con un usuario temporal, dos clientes, dos páginas y dos límites, filtros, persistencia, lectura posterior, estado, errores y soft delete. La limpieza usa IDs y marcadores aleatorios exclusivos de esta ejecución; no hay `dropDatabase` ni borrado general. El camino con Atlas sigue **sin ejecutarse**, aunque las condiciones de seguridad y el tamaño de las fixtures se verificaron aisladamente.

## F. API real

| Operación | HTTP observado contra DB real | Resultado |
|---|---|---|
| Login | — | No ejecutado |
| POST cliente | — | No ejecutado |
| GET listado | — | No ejecutado |
| GET detalle | — | No ejecutado |
| PATCH actualización | — | No ejecutado |
| Búsqueda | — | No ejecutado |
| Paginación y filtros | — | No ejecutado |
| Cambio de estado | — | No ejecutado |
| DELETE lógico y lectura posterior | — | No ejecutado |
| Payload inválido / obligatorio ausente / email inválido | — | No ejecutado |
| ID inexistente / ID inválido / duplicado | — | No ejecutado |
| Sin token / inválido / expirado | — | No ejecutado |

Los códigos 200/201/400/401/404/409/500 de las pruebas aisladas no se trasladan a esta tabla como evidencia real.

## G. Autenticación

| Caso | Resultado aislado | Contra Atlas |
|---|---|---|
| Sin token | PASS, 401 | No ejecutado |
| Token inválido | PASS, 401 | No ejecutado |
| Token expirado | PASS, 401 | No ejecutado |
| Token válido | PASS | No ejecutado |
| Login malformado | PASS, 400 | No ejecutado |
| Usuario inactivo | PASS, 401 | No ejecutado |
| Registro público sin privilegios ni hash expuesto | PASS | No ejecutado |

## H. Autorización

Roles reales: `super_admin`, `admin`, `manager`, `user`, `viewer`. Usuarios contienen un rol string y permisos explícitos; JWT copia `user.permissions`. El modelo Role existe pero no hay una relación de asignación implementada; la documentación que describe una referencia ObjectId no coincide con el esquema actual. Otros módulos importan middleware de roles sin una matriz aplicable a clientes.

Propuesta presentada, **pendiente de decisión**, sin asignación automática a roles:

| Acción | Permiso propuesto |
|---|---|
| Listar, consultar, buscar y estadísticas | `customers.read` |
| Crear | `customers.create` |
| Modificar y cambiar estado | `customers.update` |
| Eliminar lógicamente | `customers.delete` |

Se pidió confirmar la aplicación de estos permisos explícitos sin privilegios implícitos. No se recibió una decisión específica; la instrucción «Continúa» no se interpretó como aprobación de la matriz. **No se modificó la autorización de M03.** El middleware `authorizeRoles` conserva su prueba aislada admin/viewer/usuario ausente, pero los cuatro permisos propuestos **no están aplicados ni probados en las rutas de clientes**.

## I. Frontend → Backend

- Automatizado: componentes/contexto/cliente con mocks, compilación web y smoke de Login en navegador.
- Manual: no se realizó un flujo manual con API/Atlas.
- No ejecutado: LOGIN → CUSTOMERS → LIST → CREATE → DETAIL → EDIT → SEARCH → PAGINATION → STATUS con persistencia real y recarga.
- Persistencia de sesión probada con AsyncStorage simulado; no confundirla con persistencia MongoDB.

## J. Regresiones y comandos

Las **60 pruebas originales siguen aprobadas y sus archivos no cambiaron**. Nuevas pruebas agregadas sin reducir aserciones anteriores. Los únicos cambios de estrategia son los requisitos futuros del frontend descritos arriba.

Desde backend:

```sh
node ../../node_modules/mocha/bin/mocha.js "tests/customers*.test.js" "src/modules/customers/*.test.js" --reporter json --reporter-option output=../../tmp/phase7-backend-m03.json
node ../../node_modules/mocha/bin/mocha.js "tests/**/*.test.js" "src/**/*.test.js" --reporter json --reporter-option output=../../tmp/phase7-backend-global.json
```

Desde frontend:

```sh
node ../../node_modules/jest/bin/jest.js --runTestsByPath tests/customers.frontend.test.js tests/customers.api.test.js tests/customers.navigation.test.js --watch=false --runInBand
node ../../node_modules/jest/bin/jest.js --watch=false --runInBand
```

Desde raíz: `npm run build:web --workspace=apps/frontend` y `npm ci --dry-run --ignore-scripts --no-audit --no-fund`, exit 0. El dry-run comprueba coherencia de lockfile, no acredita una segunda instalación limpia. Node 24.19.0; npm 11.19.0. PATH ajustado solo en procesos de esta sesión.

Seguridad: `.env`, `.env.local`, `.env.qa`, variantes sensibles y artefactos `dist/` ignorados; solo `.env.example` con placeholders está versionado. Escaneo previo del historial: 242 blobs, sin candidatos a secretos reales ni `.env` locales. No se detectaron secretos en el análisis de patrones; no es una certificación de todos los formatos posibles. Sin URI, contraseñas ni tokens reales en informes.

## K. Git

Commits nuevos de implementación:

- `deb28a6` — preservar evidencia de fase 6.
- `1a3ff84` — router global, roles mínimo y health.
- `561043a` — límites seguros de autenticación y registro.
- `b5c99e5` — entorno QA confirmado y runner de integración.
- `784a674` — base web/login/clientes y estrategia honesta de pruebas.
- `889935c` — marcadores QA compatibles con el esquema.

Este informe y JSON se guardan en un commit posterior de documentación. Se revisó `git diff --check`. Sin push, merge, rebase ni eliminación de historial. No se inició M04; solo se conserva su estructura previa.

## L. Dictamen

**RECHAZADO**.

El arranque de código y las pruebas aplicables están corregidos. Persisten tres condiciones que impiden demostrar M03 integral: configuración Atlas/QA no disponible, frontend contra API y persistencia real no ejecutados, y autorización empresarial de clientes no definida/aplicada. No corresponde APROBADO CON PENDIENTES porque el extremo a extremo todavía no está demostrado.
