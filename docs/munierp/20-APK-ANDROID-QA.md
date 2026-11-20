# APK Android de YJ Nexo QA con MuniERP

Este APK es una **actualización de pruebas para un teléfono autorizado**. Usa el mismo identificador `com.erpsystem` y se verifica contra el certificado del APK anterior. Una vez instalado reemplaza la app anterior en ese teléfono y la app aparece como **YJ Nexo QA**. No cambia el backend ni la web de producción. No usar este binario para cuentas ni datos oficiales. La firma usada reproduce la distribución de pruebas previa, no una firma de distribución productiva.

El destino queda fijo en `https://yj-nexo-munierp-qa.onrender.com/api/v1`. Las tres claves de sesión de AsyncStorage tienen un prefijo independiente para que no se lean ni envíen tokens guardados por la versión normal. No incluye contraseñas ni la URI de Atlas. Conserva sin cambios los archivos de clave de tu equipo.

## Generar desde Windows

Desde la raíz de `integration/munierp-android-qa` con dependencias instaladas y Android SDK disponible:

```powershell
$rp = "C:\Users\jessb\OneDrive\Desktop\RP"
$apkAnterior = Join-Path $rp "erp-dep\apps\frontend\android\app\build\outputs\apk\release\app-release.apk"
pwsh -NoProfile -File .\apps\frontend\scripts\build-munierp-android-qa.ps1 -OriginalApk $apkAnterior -OutputDirectory (Join-Path $rp "apk-munierp-qa")
```

Gradle se ejecuta en la copia municipal. El APK anterior en `erp-dep` no se modifica. El lanzador usa el `debug.keystore` al que apuntaba la compilación previa. Si ese archivo vive en otro lugar, consulta la línea **Store** del reporte `./gradlew.bat :app:signingReport` en el proyecto anterior y pasa la ruta con `-Keystore`. No compartas ni agregues ese archivo a Git.

El lanzador verifica la firma de ambos APK, el paquete, el nombre QA, el incremento de `versionCode`, el bundle incorporado y el destino fijado. Solo exporta el APK si pasan esos controles. El incremento parte del APK anterior indicado. Si el teléfono ya tenía instalada una versión más nueva, usa la referencia de esa versión para evitar un error de downgrade. Para volver luego a una versión normal mediante actualización habrá que usar la misma firma y un `versionCode` que no sea menor que el instalado.

## Instalar y probar

Transfiere únicamente el APK que el script confirma como verificado, por un enlace privado o un método de tu preferencia. En Android abre el APK y acepta **Actualizar**, sin desinstalar la app anterior. No se necesita USB, `adb`, Metro ni encender la PC para usar la API remota.

Entra como `obras@demo.test` con la clave de Render QA. En **MuniERP IA → Solicitudes** consulta `SJH-OBP-SOL-2026-000001` y comprueba el asunto **Prueba de persistencia en Atlas** y el evento **Registro**. Si Render estaba inactivo, espera a que `/qa-ready` responda y reintenta una vez. La prueba en Android sigue pendiente hasta instalar y verificar en el teléfono.
