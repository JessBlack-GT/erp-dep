# 06 · Evidencias de pruebas

> **Modo de API.** Todas las pruebas de interfaz usan **API SIMULADA**: el servicio municipal real se
> ejecuta en el navegador (o en Jest) con almacén en memoria y datos sintéticos. **No acreditan la
> integración HTTP real ni la persistencia.** La ruta HTTP se prueba en el backend con supertest (router real,
> sin MongoDB). **Ninguna prueba se ejecutó contra MongoDB.**

## Resumen (10 de noviembre de 2026)

| Suite | Entorno | Resultado | Archivo en `04-EVIDENCIAS/` |
|---|---|---|---|
| Backend municipal (mocha): HTTP, servicio, política, contrato, adaptador Mongo con dobles | VM Linux, Node | **279 aprobadas, 22 pendientes, 0 fallidas**. Pendientes = L3/doble que requieren MongoDB real, registrados como pendientes y no como aprobados | `backend-municipal-mocha.txt` |
| Interfaz municipal (Jest) | VM Linux | **81/81** (7 suites, incluida F1-15a) | `frontend-jest-municipal.txt` |
| Playwright F1-12, F1-13, F1-14, F1-15a | **Windows 11**, Playwright 1.65.0 | **183/183**: Chromium 158 (61), Firefox 158 (61), WebKit 27.2 (61) | `playwright-windows_2026-11-10_1820/` |
| Regresión del ERP (Jest, muestras) | VM Linux | `sales.test.js` 48/48. `m01.frontend.test.js` 18/21: las **mismas 3 fallas aparecen en la base `cae3e38`**, sin cambios de F1-15a (pantallas de usuarios y roles del núcleo); son anteriores y ajenas al módulo municipal. El resto de suites del ERP no se reejecutó en esta ronda: la VM no termina el lote completo dentro de su límite de tiempo. F1-15a no modifica archivos del núcleo | `frontend-jest-erp.txt` |

Cada prueba Playwright deja:
- una captura por escenario y navegador (`<navegador>/<suite>/*.png`, copiadas también en `05-CAPTURAS/`);
- un registro JSONL (`registro-<navegador>.jsonl`) con suite, navegador y versión, plataforma, fecha, escenario, resultado, duración, captura, error y **modo de API**;
- `results.json` e `html-report/`. Las trazas, videos y capturas de fallo se guardan solo si una prueba falla. En la ejecución final no falló ninguna.

## Escenarios de la demostración (F1-15a, ×3 navegadores)

| N.º | Escenario | Cubre |
|---|---|---|
| 01 | Navegación principal: perfiles, secciones, modo identificado, `aria-current` | Navegación |
| 02 | Registro de solicitud y folio, apertura del expediente | RQ01, RQ06 |
| 03 | Listado, filtro por estado, búsqueda por folio, 404 fuera de alcance | RQ03 |
| 04 | Expediente e historial: reanudar trámite | RQ02 |
| 05 | Dependencias: alta, edición, regla de desactivación | RQ05 |
| 06 | Membresías: asignar usuario central, efecto inmediato, revocar | RQ05 |
| 07 | Restricciones por rol (5 roles, vista sin permiso, solo lectura) | RQ05 |
| 08 | Auditoría solo para el auditor, sin IP ni identificadores técnicos | RQ05 |
| 09 | Recorrido solo con teclado | RQ06 |
| 10 | Un `h1` por pantalla, niveles sin saltos, regiones, etiquetas, separación de botones | RQ06 |
| 11 | Restablecer demostración | Demostración |
| 12 | Estados de carga y error con reintento | RQ06 |
| 13 | Adaptable 360 / 800 / 1280 px sin desplazamiento horizontal | RQ06 |

Las suites F1-12 (registro, 14), F1-13 (detalle, 18) y F1-14 (auditoría, 14) se repitieron porque F1-15a tocó
componentes que comparten.

## Historial de ejecuciones Playwright en Windows

| Ejecución | Resultado | Nota |
|---|---|---|
| `windows_2026-11-10_1728` (F1-14) | 87/96 | 9 fallos por el selector de la prueba frente al `role="search"` del Input del núcleo (C-19); se corrigió la prueba |
| `windows_2026-11-10_1736` (F1-14) | 96/96 | |
| `windows_2026-11-10_1820` (F1-15a) | **183/183** | Ejecución final de esta entrega |
