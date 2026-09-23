# Informe QA — M03 Clientes

Fecha: 2026-09-23. Dictamen: **RECHAZADO como módulo integrado del ERP**.
Las pruebas aisladas pasan, pero no acreditan arranque completo ni persistencia real.

## 1. Estado del repositorio

- Remoto solicitado: `JessBlack-GT/erp-dep`. `git clone` y `git ls-remote --symref origin` confirmaron un repositorio vacío, sin referencias ni commits publicados.
- Rama principal remota: no disponible. Commit inicial remoto: inexistente.
- La carpeta local `ERP-SYSTEM` no tenía repositorio Git propio. No había cambios locales que pudieran atribuirse a un checkout de GitHub.
- Con autorización explícita del usuario se importó esa copia en un clon separado `RP/erp-dep`, preservando el original.
- Se creó la rama huérfana `codex/m03-validation`; primer commit local: `77e21f0`.
- Estructura: workspaces `apps/backend`, `apps/frontend`, documentación, scripts y base Android en `mobile-native`.
- No hubo push, merge, force push, rebase ni eliminación de historial.

## 2. Archivos y cambios

Todos los archivos mencionados para M03 estaban en la copia local, pero **ninguno estaba en GitHub** al comenzar:

| Elemento | Copia local inicial |
|---|---|
| `apps/backend/tests/customers.functional.test.js` | Existe: 15 pruebas |
| `@babel/register` | Declarado en backend; eliminado por innecesario para CommonJS |
| `apps/backend/.mocharc.json` | Existe; requería Babel innecesariamente |
| Módulo customers backend | Modelo, repositorio, servicio, controlador, rutas, validadores y tests presentes |
| `apps/frontend/tests/customers.frontend.test.js` | Existe: 4 pruebas iniciales |
| `apps/frontend/jest.config.js` y `babel.config.js` | Existen; preset Expo no declarado y dependencias incompatibles |
| Pantallas y servicio customers | Existen; se corrigieron exports, `_id`, token, búsqueda y paginación |
| `MainNavigator.js` | Existe; importaba un proveedor inexistente y trataba exports nombrados como defaults |

Cambios principales:

- JSON raíz válido, runners sin watch, lockfile único del workspace y Babel compatible con RN 0.72.
- Corrección de rutas de imports y aserciones Chai/Jest en pruebas preexistentes. Mocha incluye ahora `tests/` **y** todos los tests de `src/`.
- Backend M03: propagación de filtros, validación de estado/ID/paginación, búsqueda literal, exclusión de eliminados del listado, normalización de email, documento opcional vacío, duplicados al editar y rechazo de operadores/campos internos enviados por el cliente.
- `asyncHandler` devuelve la promesa; se corrigen imports de middlewares, un import roto del logger y la conexión duplicada de la aplicación.
- Frontend M03: listado, búsqueda con texto actual, carga de páginas acumulada, respuesta obsoleta descartada, navegación con `_id`, exports de pantallas y lectura correcta de AsyncStorage.
- Se corrige la fecha de solo calendario para evitar retroceder un día por zona horaria; el test existente detectó el error.
- Se añaden pruebas HTTP aisladas, de repositorio/modelo, roles, pantallas, registro en navegador y cliente HTTP con adaptador simulado.
- Plantilla segura, reglas Git de secretos y runner real protegido, separado de las suites aisladas.

Inventario exacto de archivos respecto a la base local: `git diff --name-status 77e21f0 HEAD`.
La importación inicial conserva los stubs preexistentes; no se implementó M04.

## 3. Dependencias y entorno

- Backend: se elimina la dependencia directa `@babel/register`. Se mantienen Mocha, Chai, Sinon y Supertest.
- Frontend: `react` fijado a `18.2.0`, `react-native` a `0.72.17`; se añaden `react-dom@18.2.0`, `react-test-renderer@18.2.0` y `metro-react-native-babel-preset@0.76.8`.
- Jest y React Native Testing Library se mantienen. No se usaron `--force` ni `--legacy-peer-deps`.
- Se reemplazan los lockfiles secundarios por `package-lock.json` raíz.
- Instalación `npm install --ignore-scripts --no-audit --no-fund`: exit 0. Verificación del lockfile `npm ci --dry-run --ignore-scripts --no-audit --no-fund`: exit 0. El dry-run no equivale a una segunda instalación limpia.
- Ejecución: Windows, Node 24.19.0, npm 11.19.0. npm instalado fuera del PATH inicial; se ajustó únicamente el PATH del proceso.
- Hay paquetes antiguos con avisos de deprecación. No se realizó una migración de framework ni una auditoría completa de vulnerabilidades.

## 4. Pruebas backend

| Suite | Total | Pasaron | Fallaron | Omitidas | Exit code del runner |
|---|---:|---:|---:|---:|---:|
| M03 aislada: servicio, HTTP, modelo/repositorio, roles y tests antiguos del módulo | 47 | 47 | 0 | 0 | 0 |
| Global, incluyendo `src/**/*.test.js` | 126 | 123 | 3 | 0 | 3 |

Comandos exactos desde `apps/backend` (se añadió `--reporter json` para capturar resultados):

```sh
node ../../node_modules/mocha/bin/mocha.js "tests/customers*.test.js" "src/modules/customers/*.test.js" --reporter json
node ../../node_modules/mocha/bin/mocha.js "tests/**/*.test.js" "src/**/*.test.js" --reporter json
```

Equivalentes de uso: `npm run test:m03 --workspace=apps/backend` y `npm run test:backend`.
El wrapper npm puede devolver 1 mientras comunica el código 3 de Mocha; la tabla refleja el proceso de Mocha invocado directamente.

Los tres fallos globales son: registro de customers en el router general, estructura de roles y health check. Los tres quedan bloqueados al importar `roles.routes.js`, que no existe. Además, no se identificó una ruta health implementada: el antiguo test solo importaba configuración y no acreditaba HTTP; ahora intenta comprobar la aplicación real.

Las pruebas HTTP aisladas montan el router real de customers en Express con JWT y middleware reales; solo se simula persistencia. **No arrancan la aplicación completa ni prueban MongoDB real.** Se verificaron respuestas 200, 201, 400, 401, 404, 409 y 500. Las pruebas del repositorio inspeccionan consultas Mongoose simuladas y el modelo se valida sin conexión.

## 5. Pruebas frontend

| Suite | Total | Pasaron | Fallaron | Omitidas | Exit code |
|---|---:|---:|---:|---:|---:|
| M03 aislada: pantallas 10, API simulada 1, navegación simulada 2 | 13 | 13 | 0 | 0 | 0 |
| Global | 37 | 24 | 13 | 0 | 1 |

Comandos exactos desde `apps/frontend` (se añadieron `--json --outputFile=...` para capturar resultados):

```sh
node ../../node_modules/jest/bin/jest.js --watch=false --runInBand customers
node ../../node_modules/jest/bin/jest.js --watch=false --runInBand
```

Equivalentes: `npm run test:m03 --workspace=apps/frontend` y `npm run test:frontend`.

Se probaron render/apertura de CustomersScreen, listado, formulario, creación, detalle, edición, errores, carga, búsqueda, paginación y destinos de navegación con mocks. También se verificó que el cliente adjunta el token almacenado y utiliza PATCH. El registro en MainNavigator usa un stack nativo y contexto de autenticación simulados; no acredita navegación en dispositivo.

Los 13 fallos globales se conservan: `Button` ausente y pantallas ausentes en auth, dashboard, suppliers, products, inventory, sales, purchases, finance, human-resources, reports, notifications y settings. `App.js` también referencia proveedores/rutas inexistentes. Expo no está declarado aunque los scripts lo invocan. No se construyó ni ejecutó la app nativa/web completa.

Frontend contra API real: **BLOQUEADO / no ejecutado**.

## 6. MongoDB y variables de entorno

- Conexión: **no intentada / bloqueada**, no es una conexión exitosa ni un fallo de credenciales.
- Entorno utilizado: pruebas aisladas `NODE_ENV=test`, sin base de datos.
- No se encontró `.env` en la copia local ni en el clon. No se solicitaron credenciales.
- Comando `node apps/backend/scripts/validate-m03-real.cjs`: exit **2**, previo a cualquier conexión.
- Operaciones HTTP contra DB real: 0. Datos creados en DB real: 0; limpieza no necesaria.
- El runner está preparado para POST, listado, GET por ID, PATCH, búsqueda, cambio de estado y DELETE lógico, con verificación del registro persistido y exclusión posterior del listado. Su camino con conexión real **no está validado**.
- La plantilla selecciona una base dedicada mediante `MONGODB_DB_NAME`; el runner rechaza producción, plantillas ficticias y nombres de base no dedicados.

Variables consumidas por el backend: `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `NODE_ENV`, `PORT`, `BCRYPT_ROUNDS`, `CORS_ORIGIN`, `CORS_ORIGIN_FRONTEND`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `COMPANY_NAME`, `COMPANY_URL`. Las tres primeras credenciales críticas son URI y ambos secretos JWT; email/empresa son opcionales. No se añadió ningún valor real.

## 7. Clasificación M03

| Operación | Clasificación | Evidencia/límite |
|---|---|---|
| Crear cliente | Implementada y validada con prueba aislada | Servicio y POST 201 |
| Listar clientes | Implementada y validada con prueba aislada | GET 200 y pantalla |
| Consultar por ID | Implementada y validada con prueba aislada | GET 200, 400, 404 y detalle |
| Actualizar | Implementada y validada con prueba aislada | PATCH y formulario de edición |
| Buscar | Implementada y validada con prueba aislada | HTTP, consulta literal y pantalla |
| Paginación y filtros | Implementada y validada con prueba aislada | Query de repositorio y páginas del listado |
| Cambio de estado | Implementada y validada con prueba aislada | HTTP y rechazo de estado inválido |
| Eliminación lógica | Implementada y validada con prueba aislada | HTTP y escritura de status, exclusión del listado |
| Validaciones | Implementada y validada con prueba aislada | Modelo y entradas HTTP |
| Duplicados | Implementada y validada con prueba aislada | Email/documento y traducción de error de índice |
| Manejo de errores | Implementada y validada con prueba aislada | HTTP y pantallas |
| Autenticación requerida | Implementada y validada con prueba aislada | Sin token, inválido, expirado y válido |
| Permisos por rol en M03 | Parcial | Middleware general probado; no aplicado a customers |
| Navegación del ERP completo | Parcial | Registro M03 probado con mocks; arranque general pendiente |
| API completa y MongoDB real | Bloqueada | Sin entorno local y con router general incompleto |
| Frontend contra API real | Bloqueada | Sin ejecución integral |

Ninguna operación se clasifica como validada contra API/DB real.

## 8. Seguridad

- `.env`, `.env.local`, variantes `.env.*`, credenciales JSON, claves y certificados: ignorados. `git check-ignore` comprobado; `.env.example` es la excepción versionable.
- Secretos reales detectados en Git: **no detectados en el análisis realizado**. El remoto no tenía historial. Se revisaron también los blobs del historial local creado buscando URI con credenciales, tokens de proveedores y claves privadas; las coincidencias revisadas eran ejemplos o valores ficticios de pruebas. Es un análisis de patrones, no una certificación de ausencia de todos los formatos posibles de secreto.
- No se versionaron `.env` locales ni logs/resultados temporales. No se mostraron URI reales, contraseñas ni tokens reales.
- Autenticación probada mediante `authenticateToken`, nombre real del middleware exportado.
- Roles definidos: `super_admin`, `admin`, `manager`, `user`, `viewer`. No se inventaron roles.
- `authorizeRoles` probado aisladamente con admin/viewer y ausencia de usuario. **Permisos por rol en las rutas de M03: no aplicados/no validados**, porque el import existe pero ninguna ruta usa el middleware.
- No se probó login/refresh completo contra una base real.

## 9. Git

Commits de implementación:

1. `77e21f0` — `chore(repo): import authorized local ERP baseline`
2. `a212b5f` — `fix(test): stabilize workspace dependencies and test runners`
3. `48b5751` — `chore(env): add safe template and redact connection failures`
4. `0ee7ca1` — `fix(customers): validate HTTP contracts and persistence boundaries`
5. `541a189` — `fix(customers): validate frontend flows and API authentication`
6. `deaf32a` — `test(customers): add guarded real MongoDB validation runner`

Este informe y la evidencia resumida se registran en un commit posterior de documentación.
Se revisó el diff y `git diff --check`. No se modificó la rama principal ni se publicó al remoto.

## 10. Conclusión QA

**RECHAZADO** para considerar M03 terminado dentro del ERP. Las 60 pruebas aisladas de M03 pasan, pero existen fallos globales que bloquean el arranque, falta validar MongoDB/API real y frontend real, y no está aplicada una política de autorización por roles en customers.

Los fallos se conservan y están separados de los resultados aislados. La base Git y los comandos de QA permiten continuar el desarrollo. No se inició M04.

## Inventario de archivos modificados después de importar la base

```text
A	.gitattributes
M	.gitignore
A	README.md
A	apps/backend/.env.example
M	apps/backend/.mocharc.json
D	apps/backend/package-lock.json
M	apps/backend/package.json
A	apps/backend/scripts/validate-m03-real.cjs
M	apps/backend/src/app.js
M	apps/backend/src/config/database.js
M	apps/backend/src/middleware/errorHandler.js
M	apps/backend/src/modules/auth/auth.test.js
M	apps/backend/src/modules/customers/customers.controller.js
M	apps/backend/src/modules/customers/customers.repository.js
M	apps/backend/src/modules/customers/customers.service.js
M	apps/backend/src/modules/customers/customers.validation.js
M	apps/backend/src/server.js
M	apps/backend/src/shared/utils/logger.js
M	apps/backend/src/tests/app.test.js
M	apps/backend/tests/customer.structure.test.js
M	apps/backend/tests/customers.functional.test.js
A	apps/backend/tests/customers.http.test.js
M	apps/backend/tests/integration.test.js
M	apps/backend/tests/server.test.js
A	apps/backend/tests/setup.cjs
M	apps/backend/tests/structure.test.js
M	apps/frontend/babel.config.js
M	apps/frontend/jest.config.js
M	apps/frontend/package.json
M	apps/frontend/src/app/navigation/MainNavigator.js
M	apps/frontend/src/features/customers/CustomersScreen.js
M	apps/frontend/src/features/customers/index.js
M	apps/frontend/src/services/api.js
M	apps/frontend/src/utils/index.js
M	apps/frontend/tests/api.test.js
A	apps/frontend/tests/customers.api.test.js
M	apps/frontend/tests/customers.frontend.test.js
A	apps/frontend/tests/customers.navigation.test.js
M	apps/frontend/tests/frontend.test.js
A	apps/frontend/tests/setup.js
M	docs/security/SECURITY.md
R078	apps/frontend/package-lock.json	package-lock.json
M	package.json
A	docs/qa/M03-VALIDATION.md
A	docs/qa/M03-results.json
```
