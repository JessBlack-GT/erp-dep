param(
    [string]$OutputDirectory = '',
    [switch]$SkipChecks
)
$ErrorActionPreference = 'Stop'
$frontend = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$android = Join-Path $frontend 'android'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path (Split-Path $frontend -Parent) '..\..\apk-munierp-standalone' }
if (-not $SkipChecks) {
    & node (Join-Path $PSScriptRoot 'check-munierp-standalone.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Falló la comprobación de independencia.' }
}
$vars = @('YJ_NEXO_ATLAS_QA_ANDROID_RELEASE', 'YJ_NEXO_QA_VERSION_CODE', 'YJ_NEXO_QA_KEYSTORE', 'EXPO_PUBLIC_API_BASE_URL', 'PUBLIC_API_BASE_URL', 'YJ_NEXO_LOCAL_QA')
$before = @{}
foreach ($key in $vars) { $before[$key] = [Environment]::GetEnvironmentVariable($key) }
Push-Location $android
try {
    foreach ($key in $vars) { [Environment]::SetEnvironmentVariable($key, $null) }
    & .\gradlew.bat --no-daemon :app:assembleRelease
    if ($LASTEXITCODE -ne 0) { throw 'La compilación Android falló.' }
} finally {
    Pop-Location
    foreach ($key in $vars) { [Environment]::SetEnvironmentVariable($key, $before[$key]) }
}
$apk = Join-Path $android 'app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $apk)) { throw "No se generó APK en $apk" }
$sdkRoots = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk") | Where-Object { $_ } | Select-Object -Unique
$tools = foreach ($sdk in $sdkRoots) {
    Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Directory -ErrorAction SilentlyContinue |
        Where-Object { (Test-Path (Join-Path $_.FullName 'aapt.exe')) -and (Test-Path (Join-Path $_.FullName 'apksigner.bat')) }
}
$latest = $tools | Sort-Object Name -Descending | Select-Object -First 1
if (-not $latest) { throw 'Faltan Android SDK Build-Tools (aapt y apksigner).' }
$aapt = Join-Path $latest.FullName 'aapt.exe'
$signer = Join-Path $latest.FullName 'apksigner.bat'
$badging = (& $aapt dump badging $apk) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer el APK.' }
if ($badging -notmatch "package: name='com\.munierp\.ia\.qa'") { throw 'Paquete Android inesperado; se detiene la exportación.' }
if ($badging -notmatch "application-label(?:-[^:]+)?:'MuniERP IA'") { throw 'La aplicación conserva un nombre incorrecto.' }
& $signer verify --print-certs $apk | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'La firma del APK no pasó la verificación.' }
Add-Type -AssemblyName System.IO.Compression
$zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
try {
    $entry = $zip.GetEntry('assets/index.android.bundle')
    if (-not $entry) { throw 'No se incluyó el bundle JavaScript.' }
    $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::ASCII)
    try { $bundle = $reader.ReadToEnd() } finally { $reader.Dispose() }
    if (-not $bundle.Contains('https://yj-nexo-munierp-qa.onrender.com/api/v1') -or
        -not $bundle.Contains('munierp-standalone-shell')) {
        throw 'El APK no apunta a la API QA o no contiene el inicio municipal independiente.'
    }
} finally { $zip.Dispose() }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$target = Join-Path $OutputDirectory ('MuniERP-IA-Standalone-QA-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.apk')
Copy-Item -LiteralPath $apk -Destination $target
Write-Host "APK independiente verificado: $target"
Write-Host 'Paquete com.munierp.ia.qa | Instalación paralela a YJ Nexo | Firma QA NO apta para producción'
Write-Host "SHA-256: $((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash)"
