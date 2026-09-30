# YJ Nexo ERP — Android Emulator

Preparación del 2026-09-29. Base:
`codex/deploy-readiness`, `1316138ccadb7b0d3756e5387428df27554a9c7d`.
Rama de trabajo: `codex/android-emulator-readiness`. No merge, deploy ni módulos
nuevos. Cierre actualizado el 2026-09-30: **ANDROID EMULATOR: APROBADO CON
PENDIENTES**. APK, instalación, actividad nativa y ejecución JavaScript real
comprobados; revisión visual/táctil y smoke autenticado pendientes. Los resultados
de la preparación inicial se conservan abajo como antecedentes.

## Continuación: resolución del monorepo (2026-09-29)

Inicio limpio en `a4fdbf78dfa26c20fb6e1a56e682eb564357c0e2`, igual a
`origin/codex/android-emulator-readiness` después de fetch. Esta continuación
no modifica dependencias, lockfile, módulos funcionales, RBAC ni UI.

React Native 0.72.17 está en `node_modules/react-native` de la raíz; Gesture
Handler 2.16.2 está en `apps/frontend/node_modules/react-native-gesture-handler`.
Los dos fallbacks de `resolveReactNativeDirectory()` de Gesture Handler terminan
buscando `apps/frontend/node_modules/react-native`, que no existe. Se verificó
en su código instalado que consulta `rootProject.ext.REACT_NATIVE_NODE_MODULES_DIR`.
El `build.gradle` raíz Android ahora define esa propiedad con
`rootProject.file("../../../node_modules/react-native").absolutePath`.
La ruta existe y apunta a la única versión de RN; no se copiaron dependencias,
no se crearon symlinks y no se editaron archivos dentro de node_modules.

`gradlew.bat -version` sin selección local devuelve JVM 24.0.1. Con JDK 17
seleccionado para el proceso devuelve **Gradle 8.0.1 / JVM JetBrains 17.0.14**.
Android Studio mantiene su selección local en `.gradle/config.properties`,
ignorado por Git. La selección del IDE no cambia automáticamente la consola.
Para comandos CLI usar el JDK 17 instalado, sin cambiar variables globales:

```powershell
# Sustituir por las rutas locales verificadas, sin versionarlas.
$env:JAVA_HOME = '<directorio del JDK 17 instalado>'
$env:ANDROID_HOME = '<directorio del SDK Android instalado>'
# Desde apps/frontend/android:
.\gradlew.bat -version
.\gradlew.bat assembleDebug --console=plain
```

El intento `help` se interrumpió durante descarga HTTPS de metadatos (exit 1
por parada controlada del daemon de esta validación). El siguiente intento
`assembleDebug --console=plain --info` añadió límites locales de conexión/lectura
de 10000 ms mediante `-Dorg.gradle.internal.http.connectionTimeout=10000` y
`-Dorg.gradle.internal.http.socketTimeout=10000`; no se guardan en el proyecto.
Este intento superó la configuración de Gesture Handler y los otros módulos.
Gradle instaló automáticamente NDK 23.1.7779620 y CMake 3.22.1 con las licencias
ya aceptadas del SDK; no se alteró compileSdk/targetSdk.

La compilación completa terminó **BUILD SUCCESSFUL in 23m 2s**, 189 tareas
(184 ejecutadas, 5 actualizadas). Se verificó nuevamente con
`gradlew.bat help :app:assembleDebug --console=plain`: **exit 0**, 139 tareas,
BUILD SUCCESSFUL in 2m 11s. Esto valida configuración Gradle por CLI y APK;
la sincronización de Android Studio se evalúa por separado.
APK real: `apps/frontend/android/app/build/outputs/apk/debug/app-debug.apk`,
49,069,408 bytes. SHA-256:
`B4315DFDCCF30831680B9BA0A6B0A021CFC51CBF7DC7E01C89F6D1A6709C233A`.
El APK es local e ignorado; no se versiona ni se publica como release.
Este hash corresponde al primer APK, compilado antes de alinear el puerto Metro.
También se instaló SDK Platform 33 y Build Tools 30.0.3 automáticamente.
Build Tools 33.0.0 sigue pendiente: la propiedad raíz existente no está aplicada
por el módulo app y AGP usa su selección por defecto. No se afirma que 33.0.0
esté instalado solo porque exista la propiedad en build.gradle.

Se creó `Pixel_7_YJNexo` desde Android Studio: Pixel 7, API 36, Google Play,
x86_64, imagen ya instalada, RAM 2048 MB y 4 CPU. No se eliminó ningún AVD.
Primer arranque lento (registro del emulador: 759591 ms); el host reportó
aproximadamente 300 MB de RAM libre de 8 GB. ADB pasó de offline a device.
La primera instalación falló porque Android seguía arrancando (exit 1).
Después de `sys.boot_completed=1`, `adb install -r` terminó **Success, exit 0**;
`adb shell am start -W -n com.yjnexo/.MainActivity` devolvió **Status: ok**, exit 0,
y se confirmó un PID de la aplicación. Esto no equivale todavía a un Login
renderizado y aprobado visualmente.

Se detectó un segundo desajuste: el APK directo de Gradle generaba
`react_native_dev_server_port=8081`, mientras Metro y el script android usan 8082.
El plugin Gradle instalado admite `reactNativeDevServerPort`; se define ahora
como 8082 en gradle.properties. El emulador usa 10.0.2.2 para llegar al host,
por lo que un adb reverse del puerto 8081 no corrige por sí solo esa dirección.
El servidor web 8081 permanece separado. API debug: 10.0.2.2:3000/api/v1.

Arranque backend mediante `node scripts/start-qa.cjs`: **exit 1**, conexión
MongoDB FAILED en el entorno QA autorizado. No se mostraron URI ni credenciales;
no se crearon ni borraron datos. El smoke autenticado queda pendiente de QA.

### Resultado final de esta continuación (2026-09-30)

La recompilación con Metro 8082 pasó: `:app:assembleDebug --console=plain
--max-workers=2`, **exit 0**, 138 tareas (16 ejecutadas, 122 actualizadas),
4m 52s. Los recursos generados confirman ambos puertos React Native en 8082.
APK final: misma ruta anterior, **49,949,977 bytes**, SHA-256
`179C6F78CF9F78BBE141B3CAD9C947E07711754F46492995AD9F232547BFAA9D`.
La reinstalación terminó Success; el primer lanzamiento de ese APK agotó su
espera (`Status: timeout`, aunque adb devolvió exit 0). No se contó como PASS.

El emulador presentó "System UI isn't responding" y posteriormente
`DeadSystemException`/servicio activity ausente. Se detuvo únicamente este AVD
con `adb -s emulator-5554 emu kill` y se inició de nuevo con:

```text
emulator -avd Pixel_7_YJNexo -no-snapshot-load -no-snapshot-save -cores 2
```

No se borraron datos ni snapshots. Arranque en frío: 95100 ms,
`sys.boot_completed=1`; `am start -W -n com.yjnexo/.MainActivity`: **Status: ok**,
exit 0, 6282 ms. El log del proceso confirma **ReactNativeJS: Running "YJNexo"**.
Esto acredita ejecución real del APK y del JavaScript compartido, no una demo web.
Metro `/status` responde HTTP 200 en 8082. Un intento redundante de arrancarlo
falló con EADDRINUSE; se conservó el servidor existente, sin cambiar puertos.

MongoDB: tras confirmación del usuario de habilitar el acceso, el arranque QA
registró **MongoDB connection: SUCCESS**. `/api/v1/ready`: **HTTP 200**,
`{"success":true,"status":"ready"}`. Entorno: development, base QA autorizada
por el guard existente. Datos creados 0; datos borrados 0. El fallo previo queda
registrado como intento fallido, no como estado final de la conexión.

| Comprobación | Resultado |
|---|---|
| Configuración Gradle CLI (`help`) | PASS, exit 0 |
| Sync Android Studio | La importación avanzó y dejó de mostrar sync en curso; resultado final explícito no capturado |
| APK final | PASS, exit 0 |
| AVD y arranque en frío | PASS; inestabilidad previa documentada |
| Instalación final | PASS, Success |
| Actividad nativa y ReactNativeJS | PASS tras arranque en frío |
| Login visual, teclado, touch, scroll y volver | NOT EXECUTED satisfactoriamente |
| Login autenticado, shell, navegación, M01/M03/M04/M05/M06 y logout | NOT EXECUTED |
| MongoDB QA / readiness | PASS; sin mutaciones de datos |

La ventana independiente apareció inicialmente fuera del monitor. El usuario
la recolocó, pero Computer Use falló al enumerar ventanas, incluso después de
reintento y reinicio de su sesión. No se pudo obtener la captura final del Login.
No se afirma que las pantallas ni el recorrido autenticado hayan pasado QA.
Quedan pendientes la validación visual/táctil, una cuenta QA autorizada para el
recorrido y verificar estabilidad sostenida con suficiente memoria disponible.
Build Tools 33.0.0 no está instalado; la compilación comprobada usa la selección
por defecto de AGP. No hubo actualización de RN, Gradle, AGP ni dependencias npm.

Seguridad: `.env`, local.properties, .gradle, APK/build y logs ignorados. Escaneo
de historial y working tree sin hallazgos de secretos ni archivos prohibidos.
No se modificaron módulos, RBAC, UI, main, credenciales ni despliegues.

Regresión repetida: frontend 30 suites, 236 PASS, 0 FAIL, 9 TODO, exit 0;
build web PASS, exit 0, con URL HTTPS sintética; bundle Android PASS, 15 assets,
exit 0. El primer build web falló por acceso denegado del sandbox (exit 1) y
pasó al repetirlo fuera de esa restricción. No se repitieron pruebas MongoDB
porque el cambio es exclusivamente de configuración Android.

## Arquitectura detectada y decisión

React 18.2.0, React Native 0.72.17, React Native Web 0.19.x. No se utiliza Expo:
no estaba instalado y los scripts expo run:android/ios eran inconsistentes.
No existían app.json, Metro ni Gradle Android funcionales. El archivo
mobile-native/android/MainActivity.kt es un placeholder comentado; permanece
sin usar. No existe proyecto iOS funcional y no se prepara en esta fase.

Se añadió el contenedor bare React Native en apps/frontend/android, derivado
de la plantilla oficial **ya instalada** de RN 0.72.17: MainActivity,
MainApplication, manifests, recursos y Gradle wrapper. La entrada index.js
registra YJNexo y carga **el mismo src/app/App.js** utilizado por web, envuelto
por GestureHandlerRootView y SafeAreaProvider. No hay frontend duplicado, WebView,
demo estática, Kotlin de negocio ni API simulada.

Metro reconoce Android/com.yjnexo y autolinka AsyncStorage, Gesture Handler,
Safe Area Context, Screens y Vector Icons. Configuración monorepo utiliza el
node_modules de raíz. Se mantiene arquitectura RN clásica, Hermes activado,
Gradle 8.0.1, AGP 7.4.2, compile/target SDK 33 y NDK 23.1.7779620 de la plantilla.
No usar Gradle global ni actualizar RN para resolver el JDK.

Dependencias mínimas corregidas:

- react-native-gesture-handler: 2.33.0 instalado → **2.16.2 exacto**, compatible con RN 0.72.
- react-native-screens: 3.37.0 instalado → **3.35.0 exacto**; 3.37 exige RN 0.76 y 3.36 RN 0.73.
- @react-native/metro-config: **0.72.12**, añadido para la configuración de Metro de RN 0.72.
- React, React Native y módulos de dominio conservados. Lockfile actualizado.

## Networking

| Escenario | API |
|---|---|
| Web local | Fallback http://localhost:3000/api/v1 |
| Android Emulator debug | Fallback http://10.0.2.2:3000/api/v1 |
| Producción web/nativa | PUBLIC_API_BASE_URL explícita HTTPS, sin fallback local |

10.0.2.2 es el puente del emulador Android hacia Windows, no una dirección global
de producción. PUBLIC_API_BASE_URL permite otro puerto o backend; no se cambia
el backend completo al usar Android. Metro inserta **solo esa variable pública**
mediante un plugin Babel local; no carga .env ni copia secretos al bundle.
Después de cambiarla hay que reiniciar Metro con --reset-cache. El build web
conserva su validación de Production Readiness.

Android main/release declara usesCleartextTraffic=false. El manifest **debug**
lo sobreescribe para permitir HTTP local de API y Metro. Release no hereda esa
excepción; no se configura firma de producción. La llave debug la genera AGP
localmente y no está versionada. No introducir una clave de firma en Git.

Backend local confirmado por configuración: puerto **3000**, bind **0.0.0.0**.
Android nativo no está sujeto a CORS del navegador y normalmente no envía Origin;
el backend permite solicitudes sin Origin, manteniendo JWT/RBAC. No se amplía
CORS de producción. Se añadió start-qa.cjs para rechazar una DB no confirmada
como QA antes de iniciar la demo. No crea usuarios ni otros fixtures.

## Toolchain observado

| Componente | Resultado |
|---|---|
| Node / npm | Disponibles; Node 24.21.0, bundle Metro/web y tests pasan |
| Android Studio | Instalado en C:\Program Files\Android\Android Studio |
| SDK | C:\Users\jessb\AppData\Local\Android\Sdk, confirmado con acceso fuera del sandbox |
| ANDROID_HOME | No estaba definido en la sesión |
| adb / emulator | Disponibles por ruta completa; adb iniciado correctamente |
| Dispositivos adb | Ninguno conectado |
| AVD | Lista vacía; no se lanzó emulador |
| Imagen instalada | Android API 36, google_apis_playstore, x86_64; reutilizarla |
| Plataformas SDK | 34, 36, 36.1; falta 33 para esta plantilla |
| Build Tools | 35.0.0, 36.0.0, 36.1.0; falta 33.0.0 |
| NDK requerido | 23.1.7779620 no localizado |
| Command-line Tools / sdkmanager | No localizado; SDK Manager gráfico disponible en Studio |
| Java predeterminado | JDK 24.0.1, incompatible con Gradle 8.0.1 |
| Otros Java encontrados | JDK 21 y JBR 25 de Studio; no se encontró JDK 17 |
| Gradle | Wrapper 8.0.1 descargado; no se usa Gradle 9 global/caché |

Intento real `gradlew.bat :app:assembleDebug --no-daemon`: **FAIL, exit 1**.
La descarga del wrapper terminó; falló al evaluar settings.gradle con
`Unsupported class file major version 68` debido a Java 24. No se generó APK.
La consulta de paquetes de JDK/CLI no completó y se canceló; no se instaló JDK.
No se aceptaron licencias ni se descargaron imágenes adicionales.

## Android Studio — pasos reproducibles

1. Abrir **C:\Users\jessb\OneDrive\Desktop\RP\erp-dep\apps\frontend\android**
   en Android Studio. No abrir mobile-native/android: es el placeholder antiguo.
   También se puede usar solo Device Manager y compilar desde terminal, pero
   la carpeta anterior es el proyecto Gradle correcto.
2. Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK:
   elegir **Download JDK**, versión **17**, y seleccionar ese JDK. Conservar la
   ruta que muestre Studio para usarla en JAVA_HOME. No elegir el JBR 25 integrado.
3. Tools → SDK Manager → SDK Platforms: instalar Android 13 **API 33**.
   SDK Tools → Show Package Details: Android SDK Build-Tools **33.0.0**,
   NDK (Side by side) **23.1.7779620**. Mantener Platform-Tools y Emulator
   existentes. Command-line Tools es opcional si se usa el SDK Manager gráfico.
   Revisar y aceptar personalmente las licencias que solicite Studio.
4. Tools → Device Manager. En la pantalla de bienvenida: More Actions →
   Virtual Device Manager. Create Virtual Device → **Pixel 7** (o equivalente).
5. Seleccionar la imagen **API 36 Google Play x86_64 ya instalada**. No descargar
   otra imagen solo para esta demo. API de emulador y compileSdk son distintos.
6. Finalizar AVD y pulsar ▶. Esperar a la pantalla de inicio. La validación
   deseada es smartphone cerca de 390×844 dp; Pixel 7 es equivalente, no exacto.
   Deben comprobarse tamaño de texto, scroll y teclado en el dispositivo real.
7. Abrir terminales **PowerShell**. En las terminales nativas establecer:

```powershell
$env:ANDROID_HOME = 'C:\Users\jessb\AppData\Local\Android\Sdk'
# Usar la ruta REAL del JDK 17 que acaba de seleccionar/descargar Studio:
$env:JAVA_HOME = '<RUTA_LOCAL_JDK_17>'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
java -version
adb devices
```

   La ruta entre ángulos debe reemplazarse; no es una ruta inventada de instalación.
   java debe indicar 17 y adb un identificador emulator-… con estado device.
8. Terminal backend, directorio exacto:
   **C:\Users\jessb\OneDrive\Desktop\RP\erp-dep\apps\backend**.
   Ejecutar **`node scripts/start-qa.cjs`**. Es el arranque real del backend,
   precedido de la comprobación de base QA autorizada. No usar producción.
9. Otra terminal: `Invoke-RestMethod http://localhost:3000/api/v1/health` y
   `Invoke-RestMethod http://localhost:3000/api/v1/ready`. Ambos deben ser 200;
   ready debe indicar ready. No imprimir la configuración MongoDB.
10. Terminal Metro, directorio exacto:
    **C:\Users\jessb\OneDrive\Desktop\RP\erp-dep\apps\frontend**.
    Ejecutar **`npm.cmd run start:native -- --reset-cache`**. Puerto **8082**
    para no competir con el servidor web existente en 8081. Mantener abierta.
11. Otra terminal en el mismo directorio frontend, con JAVA_HOME/ANDROID_HOME
    definidos: **`npm.cmd run android`**. Equivale a
    `react-native run-android --port 8082 --no-packager`. Instala/abre debug con
    Metro ya iniciado. No usar npx expo, npm start (servidor web) ni otra app.
12. Variables necesarias, **solo nombres**: ANDROID_HOME, JAVA_HOME,
    PUBLIC_API_BASE_URL (opcional debug); backend MONGODB_URI, MONGODB_DB_NAME,
    M03_QA_DATABASE, JWT_SECRET, JWT_REFRESH_SECRET, NODE_ENV, PORT.
    Las del backend permanecen en su .env local ignorado. No copiarlas a Metro.
13. Conexión: backend imprime conexión exitosa sin URI; readiness responde 200.
    Desde el navegador del emulador abrir http://10.0.2.2:3000/api/v1/health.
14. App conectada: login con **cuenta QA autorizada**, carga de listado y
    solicitudes HTTP reales en backend. No inventar credenciales. Si no existe
    cuenta QA apropiada, preparar un fixture controlado en una fase autorizada;
    no usar el registro público para autoasignar admin.
15. **Network Error:** verificar ready, puerto 3000, dirección 10.0.2.2,
    conectividad de Windows/firewall y build debug. Si cambió el puerto, definir
    PUBLIC_API_BASE_URL en Metro con la dirección del emulador y reiniciar con
    --reset-cache. No desactivar globalmente el firewall ni TLS de producción.
16. **Unable to connect to Metro:** verificar 8082 y ejecutar
    `adb reverse tcp:8082 tcp:8082`. Reiniciar la app. En Dev Settings, si hace
    falta, usar servidor 10.0.2.2:8082. No confundir el puerto API con Metro.
17. **SDK location not found:** comprobar ANDROID_HOME o crear
    apps/frontend/android/local.properties con
    `sdk.dir=C:/Users/jessb/AppData/Local/Android/Sdk`. Este archivo está ignorado.
18. **adb not recognized:** utilizar
    `& "$env:ANDROID_HOME\platform-tools\adb.exe" devices` o corregir Path como
    en el paso 7. No descargar otro adb si ya existe.

## Compatibilidad y QA

| Área | Auditoría de código/bundle | Validación visual/táctil Android |
|---|---|---|
| Login y password | COMPATIBLE: RN TextInput, secureTextEntry, ScrollView, KeyboardAvoidingView | NOT EXECUTED |
| Shell / navegación | COMPATIBLE: native-stack, Modal con onRequestClose, drawer responsive | NOT EXECUTED |
| Clientes | COMPATIBLE: Alert de React Native, formularios/listas nativas | NOT EXECUTED |
| Proveedores | COMPATIBLE: componentes RN compartidos | NOT EXECUTED |
| Productos/servicios | COMPATIBLE: componentes RN compartidos | NOT EXECUTED |
| Inventario | COMPATIBLE: componentes RN compartidos | NOT EXECUTED |
| Usuarios / Roles | COMPATIBLE: componentes RN compartidos y permisos existentes | NOT EXECUTED |
| Logout | COMPATIBLE: AuthContext/AsyncStorage nativo | NOT EXECUTED |

Única dependencia DOM encontrada: src/web.jsx, que no se importa desde index.js
nativo. Sin window.confirm, localStorage directo ni ReactDOM en el árbol nativo.
No se hizo un rediseño. adjustResize en Activity y keyboardShouldPersistTaps en
scrolls preparan formularios; **no se afirma** que teclado, touch targets,
modales, errores, loading o empty states estén aprobados en dispositivo.
Icono launcher heredado de la plantilla: WARNING cosmético; identidad UI interna
YJ Nexo conservada. Release firmado e iOS quedan fuera de alcance.

Resultados reproducibles de esta fase:

| Comando | Resultado |
|---|---|
| npm test --workspace=apps/backend | 633 PASS, 0 FAIL, exit 0 |
| npm test --workspace=apps/frontend | 30 suites, 236 PASS, 0 FAIL, 9 TODO previos, exit 0 |
| npm run build:web --workspace=apps/frontend | SUCCESS, URL HTTPS sintética de validación, exit 0 |
| npm run bundle:android --workspace=apps/frontend | SUCCESS, Metro 0.76.9, 15 assets, exit 0 |
| react-native config desde frontend | Android reconocido, cinco módulos autolink, exit 0 |
| gradlew.bat :app:assembleDebug --no-daemon | FAIL por Java 24, exit 1 |
| Smoke Login → Shell → M03/M04/M05/M06/M01 → Logout | NOT EXECUTED |
| MongoDB / fixtures | NOT USED; CREATED 0 = CLEANED 0 |

Después de completar toolchain: repetir compilación/instalación y el recorrido
anterior con QA. Comprobar formularios y teclado, loading/errores/listas, abrir
y cerrar drawer, navegar por cada módulo y confirmar logout. Solo entonces
puede cambiar el dictamen a ANDROID EMULATOR READY.

## Referencias

- Plantilla distribuida por react-native@0.72.17, utilizada sin regenerar el ERP.
- [Android: red del emulador](https://developer.android.com/studio/run/emulator-networking-address).
- [Screens: matriz de compatibilidad y Activity restart](https://github.com/software-mansion/react-native-screens/blob/3.37.0/README.md).
- [Gradle: compatibilidad Java](https://docs.gradle.org/8.0.1/userguide/compatibility.html).

Bloqueos de la fase inicial (anteriores a la continuación documentada arriba):
JDK 17 no disponible; SDK/Build Tools 33 y NDK de la plantilla
pendientes; no existe AVD ni dispositivo conectado. No se desplegó, no se integró
a main y no se inició M14/UI-05.
