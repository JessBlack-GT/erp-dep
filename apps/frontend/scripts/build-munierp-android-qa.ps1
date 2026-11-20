param(
    [Parameter(Mandatory = $true)][string]$OriginalApk,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [string]$Keystore
)

$ErrorActionPreference = 'Stop'
$original = (Resolve-Path -LiteralPath $OriginalApk).Path
$android = (Resolve-Path (Join-Path $PSScriptRoot '..\android')).Path
$built = Join-Path $android 'app\build\outputs\apk\release\app-release.apk'
if ($built -ieq $original) { throw 'Compila desde la copia de QA, no en la carpeta que conserva el APK anterior.' }
if (!$Keystore) {
    $Keystore = Join-Path (Split-Path -Parent $original) '..\..\..\..\debug.keystore'
}
if (!(Test-Path -LiteralPath $Keystore -PathType Leaf)) {
    throw 'No se encontró el keystore original. Consulta Store en :app:signingReport del proyecto anterior y vuelve a ejecutar con -Keystore.'
}
$keyFile = (Resolve-Path -LiteralPath $Keystore).Path

$sdkRoots = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk")
$sdkTools = $sdkRoots | Where-Object { $_ } | Select-Object -Unique | ForEach-Object {
    Get-ChildItem -LiteralPath (Join-Path $_ 'build-tools') -Directory -ErrorAction SilentlyContinue
} | Where-Object {
    (Test-Path -LiteralPath (Join-Path $_.FullName 'apksigner.bat')) -and
    (Test-Path -LiteralPath (Join-Path $_.FullName 'aapt.exe'))
} | Sort-Object Name -Descending | Select-Object -First 1
if (!$sdkTools) { throw 'No se encontraron apksigner y aapt en Android SDK Build-Tools.' }
$apksigner = Join-Path $sdkTools.FullName 'apksigner.bat'
$aapt = Join-Path $sdkTools.FullName 'aapt.exe'

function Read-ApkInfo([string]$file) {
    $badging = (& $aapt dump badging $file) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible leer los metadatos del APK.' }
    $packageLine = [regex]::Match($badging, "(?m)^package:\s+name='(?<name>[^']+)'\s+versionCode='(?<version>[0-9]+)'")
    if (!$packageLine.Success) { throw 'No se encontró package o versionCode en el APK.' }
    $printed = (& $apksigner verify --print-certs $file) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'La verificación de firma del APK falló.' }
    $signers = [regex]::Matches($printed, '(?im)^Signer #\d+ certificate SHA-256 digest:\s*([a-f0-9]{64})\s*$')
    if ($signers.Count -ne 1) { throw 'No se pudo identificar un único certificado en el APK.' }
    return @{
        Package = $packageLine.Groups['name'].Value
        Version = [long]$packageLine.Groups['version'].Value
        LabelIsQa = ($badging -match "(?m)^application-label(?:-[^:]+)?:'YJ Nexo QA'\s*$")
        Sha256 = $signers[0].Groups[1].Value.ToLowerInvariant()
    }
}

$oldInfo = Read-ApkInfo $original
if ($oldInfo.Package -ne 'com.erpsystem') { throw 'El APK anterior no corresponde a com.erpsystem (YJ Nexo).' }
$nextVersion = $oldInfo.Version + 1
if ($nextVersion -gt 2100000000) { throw 'versionCode fuera del rango admitido.' }

$envNames = @('YJ_NEXO_ATLAS_QA_ANDROID_RELEASE', 'YJ_NEXO_QA_VERSION_CODE', 'YJ_NEXO_QA_KEYSTORE')
$savedEnv = @{}
foreach ($name in $envNames) { $savedEnv[$name] = [Environment]::GetEnvironmentVariable($name) }
Push-Location $android
try {
    $env:YJ_NEXO_ATLAS_QA_ANDROID_RELEASE = '1'
    $env:YJ_NEXO_QA_VERSION_CODE = [string]$nextVersion
    $env:YJ_NEXO_QA_KEYSTORE = $keyFile
    & .\gradlew.bat --no-daemon :app:assembleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Gradle no terminó correctamente. No se exportó el APK.' }
} finally {
    Pop-Location
    foreach ($name in $envNames) { [Environment]::SetEnvironmentVariable($name, $savedEnv[$name]) }
}

$newInfo = Read-ApkInfo $built
if ($newInfo.Package -ne $oldInfo.Package -or $newInfo.Sha256 -ne $oldInfo.Sha256 -or
    $newInfo.Version -ne $nextVersion -or !$newInfo.LabelIsQa) {
    throw 'El APK generado no coincide en paquete, firma, versión de QA o nombre esperado. No se exportó.'
}

Add-Type -AssemblyName System.IO.Compression.ZipFile
$archive = [System.IO.Compression.ZipFile]::OpenRead($built)
try {
    $entry = $archive.GetEntry('assets/index.android.bundle')
    if (!$entry) { throw 'El APK no contiene JavaScript integrado.' }
    $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::ASCII)
    try { $bundle = $reader.ReadToEnd() } finally { $reader.Dispose() }
    if (!$bundle.Contains('https://yj-nexo-munierp-qa.onrender.com/api/v1') -or !$bundle.Contains('munierp-atlas-qa:')) {
        throw 'No se encontró el destino HTTPS fijo de QA o su prefijo de sesión en el APK.'
    }
} finally {
    $archive.Dispose()
}

$targetDir = New-Item -ItemType Directory -Path $OutputDirectory -Force
$stamp = Get-Date -Format yyyyMMdd-HHmmss
$target = Join-Path $targetDir.FullName "YJ-Nexo-MuniERP-QA-v${nextVersion}-${stamp}.apk"
Copy-Item -LiteralPath $built -Destination $target
Write-Host "APK QA verificado: $target"
Write-Host "Paquete: $($newInfo.Package) | versionCode: $($newInfo.Version) | firma igual a la anterior."
Write-Host "SHA-256 del archivo: $((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash)"
