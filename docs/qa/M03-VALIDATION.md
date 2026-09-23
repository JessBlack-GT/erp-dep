# M03 — Cierre de integración real, 2026-09-23

**Dictamen: APROBADO CON PENDIENTES.** MongoDB, API HTTP y frontend web funcionaron juntos. Autorización empresarial: **PENDING BUSINESS DECISION**. No se implementó una política nueva ni se desarrolló M04.

## Repositorio

- Copia: `C:\Users\jessb\OneDrive\Desktop\RP\erp-dep`.
- Rama conservada: `codex/m03-validation`.
- Commit inicial de esta continuación: `5847e36b426d5059598ecf10ce06658256a5a975`; árbol inicialmente limpio.
- Evidencia anterior preservada íntegramente en `history/M03-phase7.md` y `history/M03-phase7-results.json`. Sus bloqueos corresponden a la ejecución anterior.
- Sin cambios de dependencias, push, merge, rebase ni eliminación del historial.

## Environment

| Comprobación | Resultado |
|---|---|
| MongoDB.env source | FOUND |
| Formato dotenv | VALID |
| MONGODB_URI en origen | PRESENT |
| JWT_SECRET / JWT_REFRESH_SECRET en origen | MISSING |
| Variables de origen no utilizadas | Ninguna |
| Local .env | CONFIGURED |
| .env y MongoDB.env ignorados | YES |
| Secrets committed | NO |

Se copiaron solo las variables necesarias al `.env` local ignorado y se generaron dos secretos JWT aleatorios fuertes para desarrollo local. No se mostraron ni versionaron. `.env.example` conserva valores ficticios.

El loader existente carga `apps/backend/.env` por ruta absoluta relativa a `src/config/environment.js`. No se cambió para cargar `MongoDB.env`. Requiere `MONGODB_URI`, `JWT_SECRET` y `JWT_REFRESH_SECRET`. Se configuraron `NODE_ENV=development` y `PORT=3000`. Son opcionales `MONGODB_DB_NAME`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `BCRYPT_ROUNDS`, `CORS_ORIGIN`, `CORS_ORIGIN_FRONTEND`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `COMPANY_NAME` y `COMPANY_URL`. El runner usa además `M03_QA_DATABASE` para confirmar la selección y admite `M03_ENV_FILE` como ruta alternativa.

## MongoDB

- Preflight: **PASS**. Configuración y variables obligatorias presentes, URI parseable, entorno permitido y selección QA confirmada.
- Connection: **SUCCESS**.
- Environment: **QA**, base nueva y exclusiva autorizada explícitamente por el usuario mediante `MONGODB_DB_NAME`, sin modificar la URI.
- La primera comprobación bajo restricción de red falló en DNS. El reintento autorizado fuera de ella conectó y comprobó que la base nueva estaba vacía. No se atribuye ese fallo a credenciales ni allowlist.
- Arranque real mediante `node apps/backend/src/server.js`: conexión exitosa y escucha en puerto 3000. Servidores temporales detenidos al finalizar.
- Registros creados/limpiados: **29/29**: runner inicial **3/3**, recorrido web **23/23**, runner final **3/3**. La web utilizó un usuario, 21 clientes para paginación y un cliente creado desde el formulario.
- Limpieza limitada a IDs propios y marcadores exclusivos. Sin borrado global, de bases ni de colecciones. Estado `deleted` verificado antes de limpiar el cliente web.

## API real

Runner final: **26 comprobaciones aprobadas, 0 fallidas, 0 omitidas, exit 0**. Express, middleware JWT, Mongoose y Atlas reales. Respuestas HTTP y lecturas directas posteriores verifican persistencia. El JSON adjunto conserva cada comprobación.

| Operación | Resultado | HTTP |
|---|---|---:|
| Authentication: login y token válido | PASS | 200 |
| Create: dos clientes | PASS | 201 |
| List | PASS | 200 |
| Get by ID | PASS | 200 |
| Update y lectura posterior | PASS | 200 |
| Search | PASS | 200 |
| Pagination: límites 1/2 y fechas empatadas | PASS | 200 |
| Filters: inactivo | PASS | 200 |
| Status | PASS | 200 |
| Soft delete y ausencia en listado | PASS | 200 |
| Invalid payload, nombre ausente, email inválido | PASS | 400 |
| Invalid ID | PASS | 400 |
| Missing ID | PASS | 404 |
| Duplicate | PASS | 409 |
| Sin token, token inválido, token expirado | PASS | 401 |

## Frontend → Backend

**AUTOMATED PASS** mediante control de navegador por el agente, con API y DB reales. No es una suite Playwright incluida en el repositorio ni una ejecución manual humana. Manual: **NOT EXECUTED**. Android/iOS: **NOT EXECUTED**; alcance integrado probado: web.

Recorrido: login con usuario QA temporal → Clientes → listado → creación con formulario → búsqueda → detalle → edición → cambio a inactivo → recarga y persistencia → cancelar eliminación → confirmar eliminación lógica → ausencia en búsqueda → paginación de 21 filas únicas → intento duplicado con error visible. Se observó el indicador de login en curso. MongoDB confirmó el nombre editado y luego el estado `deleted`.

Jest utiliza mocks y se contabiliza separadamente. Los fallos de carga/servicio y estados de carga tienen cobertura aislada; no se simularon cortes de Atlas en el recorrido real.

## Defectos corregidos

1. Paginación no estable: clientes con la misma fecha se repetían entre páginas. Se agregó `_id` como segundo criterio. Verificado con 21 filas distintas en navegador y fechas iguales en el runner real.
2. Eliminación web sin efecto: `Alert.alert` de React Native Web no muestra diálogos. Se añadió confirmación Modal en web, conservando confirmación nativa. Cancelar no elimina; confirmar elimina y vuelve al listado. Errores visibles.
3. Errores de formulario invisibles en web: mensaje en pantalla para errores de API/carga; conflicto real de email visible.
4. Protección `*.env`, rechazo de URI no parseable, conteo de creación/limpieza y resultado JSON sanitizado del runner.
5. Tres regresiones nuevas del frontend y limpieza de temporizadores de animación bajo `act`, sin silenciar avisos ni debilitar expectativas originales.

## Regresión

| Suite | Total | Pass | Fail | Omitidas | TODO | Exit code |
|---|---:|---:|---:|---:|---:|---:|
| Backend M03 original | 47 | 47 | 0 | 0 | 0 | 0 |
| Backend global | 139 | 139 | 0 | 0 | 0 | 0 |
| Frontend M03 original | 13 | 13 | 0 | 0 | 0 | 0 |
| Frontend global | 45 | 33 | 0 | 0 | 12 | 0 |
| API real M03 | 26 | 26 | 0 | 0 | 0 | 0 |

Las 60 pruebas originales pasan; sus seis archivos no cambiaron respecto a `c1bc712`. El backend suma una comprobación de URI inválida. Frontend suma tres pruebas de confirmación, error de eliminación y duplicado visible. Compilación web: PASS, exit 0. Última regresión frontend sin advertencias de `act`.

Los 12 TODO conservados son requisitos futuros: componentes comunes, dashboard, suppliers, products, inventory, sales, purchases, finance, human-resources, reports, notifications y settings. No se contabilizan como aprobados ni ejecutados; clasificación previa conservada en el informe histórico.

Comandos reproducibles sin watch:

```powershell
# Desde apps/backend
node ../../node_modules/mocha/bin/mocha.js "tests/customers*.test.js" "src/modules/customers/*.test.js" --reporter json --reporter-option output=../../tmp/backend-m03-final.json
node ../../node_modules/mocha/bin/mocha.js "tests/**/*.test.js" "src/**/*.test.js" --reporter json --reporter-option output=../../tmp/backend-global-final.json
# Desde apps/frontend
node ../../node_modules/jest/bin/jest.js --runTestsByPath tests/customers.frontend.test.js tests/customers.api.test.js tests/customers.navigation.test.js --watch=false --runInBand --json --outputFile=../../tmp/frontend-original-final.json
node ../../node_modules/jest/bin/jest.js --watch=false --runInBand --json --outputFile=../../tmp/frontend-global-final.json
# Desde raíz; runner requiere .env local y base QA confirmada
node apps/backend/scripts/validate-m03-real.cjs
node apps/frontend/scripts/web.cjs --build
# Para repetir recorrido web
node apps/backend/src/server.js
node apps/frontend/scripts/web.cjs
```

La red Atlas y la resolución de archivos de esbuild requirieron ejecución autorizada fuera del sandbox. No se modificaron credenciales existentes, CORS ni autenticación para sortear fallos.

## Clasificación M03 y autorización

Crear, listar, consultar por ID, actualizar, buscar, paginar/filtrar, cambiar estado, eliminar lógicamente, validar datos, rechazar duplicados y exigir autenticación: **Implementadas y validadas contra API/DB**, además de cobertura aislada. Errores internos de servicio: **Implementados y validados con prueba aislada**; no se provocó caída real de DB. Errores HTTP de entrada, autenticación y recursos inexistentes: validados contra API real.

**Authorization policy: PENDING BUSINESS DECISION.** No se implementó ninguna política nueva `customers.read/create/update/delete`. Autenticación obligatoria probada real y aisladamente. Middleware de roles: prueba aislada conservada. Matriz por rol de clientes: no definida, aplicada ni probada contra API real. El usuario web usó el rol existente `user`, sin permisos adicionales. Este pendiente no invalida los resultados técnicos.

## Seguridad, archivos y commits

`.env` y `MongoDB.env` ignorados; ningún archivo de entorno sensible versionado. Escaneo previo a commits: 281 blobs del historial disponible, comparación con secretos locales conocidos y patrones de claves privadas/tokens: **0 coincidencias**, también 0 en archivos pendientes. Es un análisis acotado, no una garantía sobre todos los formatos posibles. Sin URI, contraseñas ni JWT en informes. Credenciales temporales web eliminadas localmente tras limpiar sus registros.

Archivos cambiados: `.gitignore`; `apps/backend/scripts/qa-environment.cjs`; `apps/backend/scripts/validate-m03-real.cjs`; `apps/backend/src/modules/customers/customers.repository.js`; `apps/backend/tests/qa-environment.test.js`; `apps/frontend/src/features/customers/CustomerDetailScreen.js`; `apps/frontend/src/features/customers/CustomerForm.js`; `apps/frontend/tests/customers.web-actions.test.js`; `apps/frontend/tests/login.test.js`; este informe, JSON y copias históricas. Dependencias modificadas: ninguna.

- `48456b3` — proteger configuración local y validar URI QA.
- `1bb7079` — paginación estable y evidencia real de limpieza.
- `c2afde8` — confirmación web y errores visibles con regresiones.

Informe y JSON se guardan en un commit posterior de documentación. Sin push ni merge. M04 no iniciado.
