# MuniERP dentro de YJ Nexo ERP

Esta rama conecta las pantallas municipales que ya existían al menú y al inicio de sesión de YJ Nexo. La API comparte el anfitrión del ERP y sus protecciones globales. La identidad viene de YJ Nexo y el servidor municipal autoriza cada operación. El menú se resuelve por membresía vigente, sin conceder privilegios por rol comercial.

El montaje de la API es explícito. El arranque habitual del ERP no habilita MuniERP ni carga el proveedor de datos sintéticos. El anfitrión local de esta entrega solo escucha en `127.0.0.1:4314`. Usa HTTP real, JWT temporales y almacenamiento en memoria. Al cerrarlo se pierden los datos. No conecta a MongoDB, no configura cuotas para producción y no activa la descarga privada nativa.

## Ejecutar la web en Windows

Desde la raíz del árbol Git de esta rama, instala primero las dependencias con `npm ci`. Abre dos ventanas de PowerShell en el mismo árbol.

En la primera inicia la API local y toma la clave temporal que imprime la consola.

```powershell
node .\apps\backend\scripts\municipal-local-qa.cjs
```

En la segunda compila y sirve la web del ERP contra esa API.

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:4314/api/v1'
npm run web --workspace apps/frontend
```

Abre `http://127.0.0.1:8081` e inicia sesión como `ventanilla@demo.test`. En **MuniERP IA → Registrar**, da de alta un ciudadano ficticio. Selecciona al ciudadano y Obras Públicas, registra una solicitud y anota su folio. Con `obras@demo.test` abre **MuniERP IA → Solicitudes**, pega el folio y consulta el historial. Con `auditor@demo.test` puedes encontrar el registro del alta en la bitácora. El perfil `comercial@demo.test` no tiene entrada municipal.

## Probar Android con la misma API

Requiere un emulador o teléfono Android autorizado, el SDK y una compilación de depuración de YJ Nexo. Conserva la API de la primera consola ejecutándose. Detén el servidor web de la segunda consola para liberar el puerto 8081 que usa Metro.

Desde la raíz de esta rama, selecciona el dispositivo y configura los puertos. Si hay varios dispositivos, añade `-s ID` a los comandos `adb`.

```powershell
adb devices
adb reverse tcp:8081 tcp:8081
adb reverse tcp:4314 tcp:4314
$env:YJ_NEXO_LOCAL_QA = '1'
Set-Location .\apps\frontend
npx --no-install react-native start --reset-cache
```

En otra consola desde la raíz de esta rama ejecuta:

```powershell
Set-Location .\apps\frontend
npx --no-install react-native run-android --no-packager
```

En la app abre el menú, busca **MuniERP IA** y consulta el mismo folio como `obras@demo.test`. El ajuste local se incorpora al *bundle* de Metro, solo con `__DEV__` activo y la variable de activación explícita. No cambia el destino de una compilación de producción.

## Verificación reproducible

Con los puertos 4314 y 8081 libres, el ejecutor inicia y detiene automáticamente cada proceso. La comprobación HTTP no necesita un navegador.

```powershell
node .\apps\frontend\qa\municipal-http-smoke.cjs --http-only
```

Para continuar con Playwright, usa la instalación existente. Si Node no resuelve el Playwright global, `$env:NODE_PATH = npm root -g` lo agrega a la búsqueda del proceso. Puedes seleccionar `QA_BROWSER` (chromium, firefox o webkit), indicar `QA_BROWSER_EXE` para una revisión ya instalada y dirigir las capturas a una carpeta fuera del repo con `QA_OUTPUT`.

```powershell
$env:NODE_PATH = npm root -g
$env:QA_OUTPUT = Join-Path $env:TEMP 'municipal-http-evidence'
node .\apps\frontend\qa\municipal-http-smoke.cjs
```

Las pruebas con tamaño de pantalla móvil en Playwright son web adaptable, no Android nativo. El plan para activar la API en un entorno compartido sigue sujeto a sus pruebas de persistencia y despliegue. Las pruebas de M07 no forman parte de este cambio.
