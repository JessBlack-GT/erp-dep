# ERP — preparación Git y QA de M03

Base local importada con autorización desde `ERP-SYSTEM`. El remoto estaba vacío.
Rama de trabajo: `codex/m03-validation`. No se ha desarrollado M04.

## Instalación y pruebas

Desde la raíz, con Node.js y npm disponibles en PATH:

```sh
npm ci --ignore-scripts
npm run test:m03 --workspace=apps/backend
npm run test:m03 --workspace=apps/frontend
npm run test:backend
npm run test:frontend
```

El lockfile raíz es el único lockfile del workspace. Mocha incluye también las
pruebas preexistentes en `src/`. Jest termina sin watch. Los requisitos de frontend
futuros se muestran como TODO y no se cuentan como aprobados. La evidencia de los
fallos anteriores se conserva en `docs/qa/history/`.
La instalación se verificó con Node 24.19.0 y npm 11.19.0 en Windows.
En esta sesión npm estaba instalado en `C:\Program Files\nodejs` pero no en PATH;
se añadió temporalmente esa carpeta al PATH del proceso, sin cambiar el sistema.

## Integración real

La única plantilla de configuración es `apps/backend/.env.example`, sin secretos.
El backend requiere `MONGODB_URI`, `JWT_SECRET` y `JWT_REFRESH_SECRET`; la base
seleccionada depende de `MONGODB_DB_NAME`, que puede sustituir el nombre de la URI.
No introducir secretos en archivos versionados.

```sh
node apps/backend/scripts/validate-m03-real.cjs
```

El runner exige un `.env` local en backend (o ruta en `M03_ENV_FILE`), entorno
`development` o `test` y `M03_QA_DATABASE` igual al nombre de la base confirmada
para QA. Respeta el nombre en la URI salvo que exista `MONGODB_DB_NAME`; no asume
que una base sea QA por su nombre. Rechaza producción y configuraciones sin
confirmar. Sin esos requisitos termina con código 2 antes de conectar. Arranca la aplicación en un
puerto efímero local, usa JWT de corta duración, comprueba HTTP y persistencia,
y elimina físicamente solo los clientes y el usuario de esta ejecución,
identificados por IDs y marcadores aleatorios.
Nunca usa `dropDatabase` ni limpia colecciones completas. Los errores se reportan
sin URI ni credenciales. El runner está preparado, pero su camino con conexión
real todavía no se ha ejecutado por falta de configuración local autorizada.

## Arranque de desarrollo

```sh
npm run dev:backend
npm run web --workspace=apps/frontend
npm run build:web --workspace=apps/frontend
```

El backend requiere MongoDB y ambos secretos JWT configurados. Lee
`apps/backend/.env` independientemente del directorio de ejecución. El runner QA
puede generar JWT efímeros solo en memoria si no están definidos localmente.
La web se sirve en `http://localhost:8081`, con Login y Clientes. Usa React Native
Web y esbuild; no requiere Expo para web. `PUBLIC_API_BASE_URL` puede seleccionar
una API de desarrollo al compilar: nunca poner credenciales en esa variable pública.

`/api/v1/health` es liveness; `/api/v1/ready` devuelve 503 mientras no haya conexión
MongoDB. `/api/v1/roles` exige token y devuelve 501: no hay API de administración
de roles implementada. La política de permisos de clientes sigue pendiente de decisión.

Dashboard, M04 y otros módulos futuros no están registrados en la navegación.
Register/ResetPassword, la biblioteca de componentes comunes y el entorno Expo
Android/iOS siguen pendientes. Una prueba con mocks o una compilación web no
acredita ejecución nativa, autenticación real ni persistencia.
