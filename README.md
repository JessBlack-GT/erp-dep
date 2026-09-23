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
pruebas preexistentes en `src/`. Jest termina sin watch. Las suites generales
conservan los fallos de módulos incompletos; consultar `docs/qa/M03-VALIDATION.md`.
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

El runner exige un `.env` local en backend, entorno `development` o `test` y una
base dedicada `erp_m03_test` (o sufijo alfanumérico separado por `_`). Sin esos
requisitos termina con código 2 antes de conectar. Arranca la aplicación en un
puerto efímero local, usa JWT de corta duración, comprueba HTTP y persistencia,
y elimina físicamente solo el registro identificado por su marcador aleatorio.
Nunca usa `dropDatabase` ni limpia colecciones completas. Los errores se reportan
sin URI ni credenciales. El runner está preparado, pero su camino con conexión
real todavía no se ha ejecutado y el arranque general tiene bloqueos conocidos.

El frontend completo y Expo tienen dependencias/pantallas pendientes. Una prueba
con servicios o navegación simulados no acredita ejecución nativa ni API real.
