# MuniERP IA — kit QA F1-12/F1-13 (API SIMULADA, datos sintéticos, sin red externa).
# Uso:  powershell -ExecutionPolicy Bypass -File .\run-windows.ps1 [-Browsers chromium,firefox,webkit] [-Spec municipal-detail]
# En el repositorio: compile antes el arnés con  node qa\build-municipal-harness.cjs qa\dist-municipal
# En el kit autónomo (carpeta qa-kit) el arnés ya viene compilado en .\harness.
param([string]$Browsers = "chromium,firefox,webkit", [string]$Spec = "")
$ErrorActionPreference = "Stop"
$kit = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (npm root -g).Trim()
$cli = @("$root\playwright\cli.js", "$root\@playwright\test\cli.js") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $cli) { throw "No se encontró Playwright global (npm i -g playwright; npx playwright install)." }
$env:NODE_PATH = "$root;$root\@playwright\test\node_modules"
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$env:MUNI_HARNESS_DIR = $(if (Test-Path (Join-Path $kit "harness")) { Join-Path $kit "harness" } else { Join-Path $kit "dist-municipal" })
$env:MUNI_EVIDENCE_DIR = Join-Path $kit "evidence-local\windows_$stamp"
$env:MUNI_BROWSERS = $Browsers
Write-Host "Playwright: $cli  ($(node $cli --version))"
Write-Host "Evidencias: $env:MUNI_EVIDENCE_DIR"
$args2 = @($cli, "test", "-c", (Join-Path $kit "e2e\playwright.config.cjs"))
if ($Spec) { $args2 += $Spec }
& node @args2 *>&1 | Tee-Object -FilePath (New-Item -ItemType Directory -Force $env:MUNI_EVIDENCE_DIR | Join-Path -ChildPath "consola.txt")
"exit=$LASTEXITCODE" | Out-File -Append (Join-Path $env:MUNI_EVIDENCE_DIR "consola.txt")
