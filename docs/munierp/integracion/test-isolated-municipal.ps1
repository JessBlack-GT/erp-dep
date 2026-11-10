# MuniERP IA — regresión aislada del router municipal contra el núcleo ACTUAL de YJ Nexo ERP.
# Propuesta para Codex: misma técnica que docs/qa/2026-11-10-core/test-isolated.ps1 (no se modifica ese
# archivo), con la revisión y los bundles como parámetros y el inventario completo de pruebas municipales.
# No inicia server.js, no usa MongoDB (MONGODB_URI deshabilitada) y trabaja en un directorio temporal.
param(
  [Parameter(Mandatory=$true)][string]$BundleDirectory,
  [string]$Rev = 'HEAD',
  [string[]]$Bundles = @('f1-12/munierp-fase1-f112.bundle','f1-13/munierp-f1-13.bundle','f1-05/munierp-f1-05.bundle','f1-05-paso3/munierp-f1-05-paso3.bundle','f1-14/munierp-f1-14.bundle'),
  [switch]$IncludeSalesRegression
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$work = Join-Path $env:TEMP ('municipal-regresion-' + [guid]::NewGuid())
$objects = Join-Path $work 'objects.git'
New-Item -ItemType Directory $work | Out-Null
git init --quiet --bare $objects; if ($LASTEXITCODE) { throw 'git init' }
$env:GIT_ALTERNATE_OBJECT_DIRECTORIES = (Join-Path $repo '.git/objects')
$head = $null
foreach ($file in $Bundles) {
  $path = Join-Path $BundleDirectory $file
  if (-not (Test-Path $path)) { throw "Falta el bundle $file" }
  $out = git --git-dir=$objects bundle unbundle $path; if ($LASTEXITCODE) { throw "prerrequisitos de $file" }
  $head = ($out | Select-Object -Last 1).Split(' ')[0]
}
if ($Rev -eq 'HEAD') { $Rev = $head }
Write-Host "Revisión municipal: $Rev"
$zip = Join-Path $work 'municipal.zip'
git --git-dir=$objects archive --format=zip --output=$zip $Rev apps/backend/src/modules/municipal apps/backend/tests/municipal docs/munierp/contracts
if ($LASTEXITCODE) { throw 'archive' }
$tree = Join-Path $work 'tree'
Expand-Archive -LiteralPath $zip -DestinationPath $tree
$backend = Join-Path $tree 'apps/backend'
# Núcleo actual sobre el árbol temporal (el módulo municipal de la revisión prevalece).
Get-ChildItem (Join-Path $repo 'apps/backend/src') -Exclude 'modules' | Copy-Item -Destination (Join-Path $backend 'src') -Recurse -Force
Get-ChildItem (Join-Path $repo 'apps/backend/src/modules') -Exclude 'municipal' | Copy-Item -Destination (Join-Path $backend 'src/modules') -Recurse -Force
Copy-Item (Join-Path $repo 'apps/backend/src/app.js') (Join-Path $backend 'src/app.js') -Force
$env:NODE_PATH = Join-Path $repo 'node_modules'
$env:NODE_ENV = 'test'
$env:MONGODB_URI = 'mongodb://127.0.0.1:1/disabled'
Push-Location $backend
try {
  node -e "if(!require('./tests/municipal/http-helpers').validator) process.exit(1)"; if ($LASTEXITCODE) { throw 'Validador del contrato no disponible (C-17)' }
  $tests = @(Get-ChildItem tests/municipal -Filter '*.test.js' | ForEach-Object { $_.FullName })
  if ($IncludeSalesRegression) { $tests += (Join-Path $repo 'apps/backend/tests/sales.http.test.js') }
  node (Join-Path $repo 'node_modules/mocha/bin/mocha.js') --no-config --require (Join-Path $repo 'apps/backend/tests/setup.cjs') --timeout 20000 @tests --reporter spec
  exit $LASTEXITCODE
} finally { Pop-Location }
