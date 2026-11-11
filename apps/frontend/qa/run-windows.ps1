# MuniERP IA — QA Playwright F1-12/F1-13 en Windows (API SIMULADA, datos sintéticos, sin red externa).
# Uso:  powershell -ExecutionPolicy Bypass -File .\run-windows.ps1 [-Browsers chromium,firefox,webkit] [-Spec municipal-detail]
# En el repositorio: compile antes el arnés con  node qa\build-municipal-harness.cjs qa\dist-municipal
# En el kit autónomo el arnés ya viene compilado en .\harness.
#
# NO instala Playwright ni descarga navegadores. Usa los ejecutables existentes:
#   1. QA_CHROMIUM_EXE / QA_FIREFOX_EXE / QA_WEBKIT_EXE si ya están definidas (convención del ejecutor de Codex);
#   2. si no, la revisión instalada más reciente en PLAYWRIGHT_BROWSERS_PATH (por defecto %LOCALAPPDATA%\ms-playwright);
#   3. si tampoco existe, Playwright busca su revisión propia y, si falta, la prueba se registra como no ejecutada.
param([string]$Browsers = "chromium,firefox,webkit", [string]$Spec = "")
$ErrorActionPreference = "Stop"
$kit = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (npm root -g).Trim()
$cli = @("$root\playwright\cli.js", "$root\@playwright\test\cli.js") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $cli) { throw "No se encontró Playwright global (playwright o @playwright/test)." }
$env:NODE_PATH = "$root;$root\@playwright\test\node_modules"
if (-not $env:PLAYWRIGHT_BROWSERS_PATH) { $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $env:LOCALAPPDATA "ms-playwright" }

function Find-Exe([string]$prefix, [string]$relative) {
  if (-not (Test-Path $env:PLAYWRIGHT_BROWSERS_PATH)) { return $null }
  Get-ChildItem $env:PLAYWRIGHT_BROWSERS_PATH -Directory -Filter "$prefix-*" |
    Where-Object { $_.Name -match "^$prefix-\d+$" -and (Test-Path (Join-Path $_.FullName $relative)) } |
    Sort-Object { [int]($_.Name -replace "^$prefix-", "") } -Descending |
    ForEach-Object { Join-Path $_.FullName $relative } | Select-Object -First 1
}
if (-not $env:QA_FIREFOX_EXE) { $f = Find-Exe "firefox" "firefox\firefox.exe"; if ($f) { $env:QA_FIREFOX_EXE = $f } }
if (-not $env:QA_WEBKIT_EXE)  { $w = Find-Exe "webkit" "Playwright.exe";       if ($w) { $env:QA_WEBKIT_EXE = $w } }

$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$env:MUNI_HARNESS_DIR = $(if (Test-Path (Join-Path $kit "harness")) { Join-Path $kit "harness" } else { Join-Path $kit "dist-municipal" })
$env:MUNI_EVIDENCE_DIR = Join-Path $kit "evidence-local\windows_$stamp"
$env:MUNI_BROWSERS = $Browsers
New-Item -ItemType Directory -Force $env:MUNI_EVIDENCE_DIR | Out-Null
$hide = { param($p) if ($p) { $p -replace [regex]::Escape($env:USERPROFILE), '%USERPROFILE%' } else { $null } }
$entorno = [ordered]@{
  fecha = (Get-Date).ToString("o"); so = [Environment]::OSVersion.VersionString; node = (node --version)
  playwright = (node $cli --version); cli = (& $hide $cli); navegadores = $Browsers
  QA_CHROMIUM_EXE = (& $hide $env:QA_CHROMIUM_EXE); QA_FIREFOX_EXE = (& $hide $env:QA_FIREFOX_EXE); QA_WEBKIT_EXE = (& $hide $env:QA_WEBKIT_EXE)
  modoApi = "SIMULADA: servicio municipal real en memoria (sin HTTP/JWT/MongoDB)"
}
$entorno | ConvertTo-Json | Out-File -Encoding utf8 (Join-Path $env:MUNI_EVIDENCE_DIR "entorno.json")
Write-Host ($entorno | ConvertTo-Json)
$args2 = @($cli, "test", "-c", (Join-Path $kit "e2e\playwright.config.cjs"))
if ($Spec) { $args2 += $Spec }
& node @args2 *>&1 | ForEach-Object { "$_" -replace [regex]::Escape($env:USERPROFILE), '%USERPROFILE%' } | Out-File -Encoding utf8 (Join-Path $env:MUNI_EVIDENCE_DIR "consola.txt")
"exit=$LASTEXITCODE" | Out-File -Append -Encoding utf8 (Join-Path $env:MUNI_EVIDENCE_DIR "consola.txt")
