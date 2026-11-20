param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9][a-z0-9.-]*\.mongodb\.net$')]
    [string]$AtlasHost
)

$ErrorActionPreference = 'Stop'
$confirmacion = 'solo-datos-sinteticos:munierp_qa'
if ((Read-Host "Para guardar datos sintéticos en Atlas QA escribe $confirmacion") -cne $confirmacion) {
    Write-Host "Cancelado. No se abrió ninguna conexión."
    return
}

$claveSegura = Read-Host "Contraseña de munierp_qa_app (no la de instalación)" -AsSecureString
Push-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..\..'))
try {
    $env:MUNICIPAL_STORE = 'mongo'
    $env:MUNICIPAL_QA_DATABASE = 'munierp_qa'
    $env:MUNICIPAL_QA_AUTHORIZED = "$([DateTime]::UtcNow.ToString('yyyy-MM-dd'))|operador-qa|munierp_qa"
    $env:MUNICIPAL_QA_PERSIST_CONFIRM = $confirmacion
    $env:MUNICIPAL_QA_URI = 'mongodb+srv://munierp_qa_app:{0}@{1}/munierp_qa?authSource=admin' -f [uri]::EscapeDataString(
        [System.Net.NetworkCredential]::new('', $claveSegura).Password
    ), $AtlasHost

    node .\apps\backend\scripts\municipal-local-qa.cjs --mongo
    if ($LASTEXITCODE -ne 0) { throw "El anfitrión de QA terminó con código $LASTEXITCODE." }
} finally {
    Remove-Item Env:\MUNICIPAL_STORE, Env:\MUNICIPAL_QA_DATABASE, Env:\MUNICIPAL_QA_AUTHORIZED, Env:\MUNICIPAL_QA_PERSIST_CONFIRM, Env:\MUNICIPAL_QA_URI -ErrorAction SilentlyContinue
    $claveSegura.Dispose()
    Pop-Location
}
