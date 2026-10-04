# Fase 1 de estabilización — YJ Nexo ERP

Fecha: 4 de octubre de 2026. Repositorio: JessBlack-GT/erp-dep, rama `main`.

## Estado inicial y preservación

El primer comando Git fue `git status --short --branch`. Mostró `main...origin/main`, dos archivos modificados y una carpeta sin seguimiento:

- `apps/backend/src/modules/auth/auth.service.js`: cambio local de correo de bienvenida.
- `apps/backend/tests/auth.bootstrap.test.js`: pruebas locales de ese correo.
- `apps/frontend/android/`: sin seguimiento.

Los dos archivos locales se leyeron y conservaron sin editarlos. Android no se modificó ni se agregó al índice. No se modificaron archivos `.env`, secretos ni credenciales. No se hicieron commits ni push.

## A–C. Hallazgos, reproducción y cambios

| Área | Evidencia del estado inicial | Corrección |
| --- | --- | --- |
| Login | Inspección: `authLimiter` estaba declarado con cinco intentos por 15 minutos, pero la ruta no lo utilizaba. | Conectado antes de la validación y el controlador en `POST /api/v1/auth/login`. Conserva la clave predeterminada basada en `req.ip`, `TRUST_PROXY_HOPS`, el limitador general y la recuperación independiente. |
| Productos | Inspección: borrar o desactivar escribía el estado sin comprobar saldos; inventario exige producto activo para mover existencias. | Ambos estados pasan por la transacción existente del catálogo, bloquean primero el mismo documento Product que inventario y rechazan con 409 cualquier saldo `quantityUnits > 0`, sin limitar la consulta a un almacén. Cubre también PATCH de estado. |
| Clientes | Inspección: lectura y escrituras por ID no excluían `deleted`; el filtro explícito de listado podía reemplazar la exclusión inicial. | Lecturas y escrituras condicionales excluyen eliminados. Un listado con `status=deleted` devuelve vacío. Si una baja ocurre entre la lectura y la escritura, el servicio devuelve 404. No hay restauración administrativa explícita en estos flujos; no se agregó ninguna. |
| Dashboard | Inspección: Sidebar ofrecía Dashboard, pero MainNavigator no registraba ese destino. | Retirado el enlace. Un comentario identifica la implementación pendiente. No se crearon pantallas, estadísticas ni consultas. |
| Prueba de productos | Inicialmente pasó aislada y en la suite con caché. Sin caché reprodujo el timeout: 5682 ms; una ejecución instrumentada midió 5631 ms de primer render y 5683 ms hasta tener el listado. | Se resuelven durante `beforeAll` los componentes que React Native carga de forma diferida, incluidos los usados para detectar componentes nativos en Testing Library. La compilación inicial de Babel deja de recaer en la primera interacción asíncrona. Se mantienen las mismas aserciones y los 5000 ms originales. Sin caché, el caso corregido tardó 602 ms y pasaron las 24 pruebas del archivo. |
| ESLint | Inspección: `.eslintrc.json` contenía `module.exports`, y no estaban instalados los dos paquetes de `extends`. | Convertido a JSON válido, conservando reglas, parser y exclusiones. Agregados `eslint-config-prettier` y `eslint-plugin-react` como dependencias de desarrollo, con su lockfile. |
| Registro público | Inspección: la validación Mongoose de nombres podía llegar al manejador como error no operacional y terminar en 500. | Solo en registro, un `mongoose.Error.ValidationError` devuelve 400 con `Datos de registro inválidos`, también con barra final. Duplicados siguen en 409 y errores internos en 500. No se exponen mensajes Mongoose, valores, contraseñas ni detalles internos. |

Los hallazgos de código se verificaron antes de editar; no se afirma que todos se reprodujeran contra una base de datos. La reproducción temporal del timeout sí se ejecutó antes de modificar `products.test.js`. La instrumentación temporal se retiró.

## D. Archivos de esta fase

Archivos existentes modificados:

- `.eslintrc.json`
- `package.json`
- `package-lock.json`
- `apps/backend/src/modules/auth/auth.routes.js`
- `apps/backend/src/modules/auth/security-errors.js`
- `apps/backend/src/modules/products/products.repository.js`
- `apps/backend/src/modules/customers/customers.repository.js`
- `apps/backend/src/modules/customers/customers.service.js`
- `apps/backend/tests/customers.http.test.js`
- `apps/backend/tests/proxy-rate-limit.test.js`
- `apps/frontend/src/components/layout/Sidebar.js`
- `apps/frontend/tests/products.test.js`
- `apps/frontend/tests/products.navigation.test.js`
- `apps/frontend/tests/shell.test.js`

Archivos nuevos:

- `apps/backend/tests/phase1.stability.test.js`
- `docs/FASE-1-ESTABILIZACION.md`

Los dos archivos de bienvenida indicados arriba aparecen también en Git, pero sus cambios son anteriores a esta fase.

## E. Logout y pendientes

Logout se revisó sin modificar su contrato ni sus archivos:

| Situación | Comportamiento actual |
| --- | --- |
| Access token vigente y usuario autorizado | El servidor incrementa atómicamente `sessionVersion`. Las comprobaciones existentes rechazan access y refresh anteriores. El cliente limpia sus credenciales en `finally`. |
| Access token expirado | El middleware devuelve 401 antes del controlador; no se incrementa `sessionVersion`. El interceptor elimina credenciales y emite `invalid`, y el `finally` de logout vuelve a limpiar. Un refresh todavía válido conservado fuera del cliente puede seguir usándose mientras no expire o se revoque la versión. |
| Error de red | Se ejecuta la limpieza local. Si la petición no llegó al servidor, no hay revocación remota; si la respuesta se perdió después del procesamiento, el cliente no puede saberlo. El error de la operación sigue propagándose. |
| Refresh | Se verifica firma, usuario activo y versión. Logout no renueva automáticamente el access token ni admite refresh como credencial de revocación. |

Pendiente: coordinar una renovación para revocar cuando el access haya expirado, incluyendo el interceptor que borra credenciales y la protección por generación de AuthContext frente a renovaciones concurrentes. Un reintento aislado después del 401 no es una corrección segura de esos flujos. Se conserva la revocación actual y sus pruebas, sin introducir sesiones por dispositivo, rotación de refresh ni cookies.

También quedan fuera de alcance el Dashboard funcional, los módulos futuros y la corrección global de todos los avisos de lint. No se borró historial de inventario ni se eliminaron físicamente clientes.

## F–K. Validación

| Verificación | Resultado |
| --- | --- |
| Backend inicial, `npm.cmd test` | 681 passing / 0 failing |
| Backend final, `npm.cmd test` | 705 passing / 0 failing |
| Frontend inicial, suite completa | 234 passing / 0 failing / 9 TODO |
| Frontend final, suite completa sin caché | 236 passing / 0 failing / 9 TODO |
| Productos corregidos, archivo completo sin caché | 24 passing / 0 failing |
| ESLint, `npm.cmd run lint` | Configuración cargada; salida 1: 823 errores y 103 advertencias |
| Web, `npm.cmd run build:web` | `Web build: SUCCESS` |
| `node --check` | Correcto para los 10 archivos JS backend revisados, incluidos los dos archivos locales preservados |
| `git diff --check` | Correcto, salida 0 |

Los archivos frontend contienen JSX y se validaron mediante Jest/Babel y el build web; `node --check` no interpreta JSX. No se aumentaron tiempos límite ni se agregaron `.skip`, `.only`, `xdescribe` o `xit`. Los 9 TODO del frontend ya existían. Una ejecución diagnóstica seleccionó el caso problemático por nombre; las verificaciones finales ejecutaron todas las pruebas.

La configuración ESLint ya carga y una prueba verifica JSON, reglas originales y resolución de plugins. El resultado global no está verde: persisten errores como entornos de Mocha/ES no declarados, sintaxis de asignación lógica que el parser configurado como ES2020 rechaza, validación de props y errores de estilo. No se desactivaron reglas ni se hizo una limpieza masiva fuera de esta fase. La comparación del lint de los archivos editados con su contenido HEAD permitió identificar los problemas heredados; los cambios locales de bienvenida se conservaron también en presencia de sus avisos.

La primera instalación de dependencias y el primer build fallaron por restricciones de acceso del sandbox. Se repitieron con autorización fuera de él; ambos finalizaron correctamente. No se cambió el script de build para eludir esas restricciones.

Cobertura añadida: límites de login e IPs con cero, uno y dos saltos de proxy; independencia de recuperación; bajas y desactivaciones con saldos ausentes, cero, uno y varios almacenes; uso del bloqueo y sesión transaccional; ausencia de operaciones sobre el historial; servicios sin stock; clientes eliminados, filtros, búsquedas, escrituras concurrentes simuladas y permisos; clasificación segura de errores de registro; carga de ESLint; correspondencia entre menú y rutas.

Las pruebas usan persistencia aislada y validación real del modelo cuando corresponde. No se conectó a MongoDB/Atlas ni a producción. La carrera real de inventario y catálogo, los reintentos del driver y el commit/rollback contra un replica set requieren una prueba de integración posterior: aquí se verifica la coordinación del bloqueo y el uso de la misma sesión, no se afirma haber demostrado esa concurrencia en un servidor real. Tampoco se probó el correo contra el proveedor real; se preservaron y ejecutaron sus pruebas con transporte simulado.

Evidencias locales (logs ignorados por Git): `apps/backend/phase1-baseline.log`, `apps/backend/phase1-results.log`, `apps/frontend/phase1-baseline.log`, `apps/frontend/phase1-results.log`, `apps/frontend/phase1-products-cold.log`, `apps/frontend/phase1-products-diagnostic.log`, `apps/frontend/phase1-products-fixed-cold.log`, `apps/frontend/phase1-build.log` y `phase1-eslint.log`.

## L–M. Estado Git

Rama `main...origin/main`. El diff de archivos ya rastreados contiene 16 archivos: 14 editados en esta fase y los 2 cambios locales preservados. `git diff --stat` informa 1905 inserciones y 52 eliminaciones, incluyendo el cambio local previo y las dependencias transitivas de lint; no incluye los dos archivos nuevos sin seguimiento. Se ejecutaron `git diff --name-only`, `git diff --stat`, `git diff --check` y `git status --short --branch`.

Permanecen sin seguimiento el archivo nuevo de pruebas, este informe y la carpeta Android original. No se ejecutó `git add`, commit ni push.
