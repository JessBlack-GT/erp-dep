# 03 · Descripción de módulos

## Backend — `apps/backend/src/modules/municipal`

| Módulo | Archivos | Responsabilidad |
|---|---|---|
| HTTP | `http/municipal.router.js`, `erp-identity.js`, `errors.js`, `params.js` | 24 operaciones de `/api/municipal/v1` (contrato OpenAPI draft.3). Identidad central del ERP, errores sin datos internos |
| Aplicación | `application/municipal.service.js`, `presenters.js` | Casos de uso: solicitudes, transiciones, documentos, indicadores, dependencias, membresías, ciudadanos, bitácora |
| Dominio | `domain/folio.js`, `request-state.js`, `documents.js`, `indicators.js`, `receipt.js`, `validation.js` | Folios por municipio/dependencia/tipo/año, máquina de estados, validación de archivos (firma, tipo, 5 MiB, sha256), indicadores |
| Política | `policy/permissions.js`, `access.js`, `context.js` | Catálogo `municipal.*` separado del ERP, matriz de 7 roles, alcance municipio → dependencia → expediente |
| Persistencia | `persistence/repository-port.js`, `scope.js`, `qa-guard.js`, `persistence/mongo/*` | Puerto asíncrono con aislamiento por municipio; adaptador MongoDB **preparado, sin validar contra un servidor real** |
| Almacenamiento | `storage/memory-storage.js` (+ GridFS en el adaptador Mongo) | Documentos privados sin URL pública |
| Simulación | `mocks/in-memory-store.js`, `fixtures.js` | Almacén en memoria y datos sintéticos (pruebas y demostración) |

## Interfaz — `apps/frontend/src/features/municipal`

| Componente | Historia | Función |
|---|---|---|
| `MunicipalApp.js` | F1-15a | Aplicación navegable: menú por permisos, panel principal, ruteo entre pantallas |
| `RequestIntakeForm.js`, `ReceiptView.js` | F1-11 | Registro en ventanilla con clave de idempotencia y acuse imprimible |
| `RequestBrowser.js` | F1-15a | Listado con filtros del contrato, paginación y búsqueda por folio |
| `RequestList.js` | F1-11 | Filas accesibles (folio deletreado, estado en texto) |
| `RequestDetail.js` | F1-13 | Datos, historial, documentos privados y acciones con confirmación |
| `IndicatorsPanel.js` | F1-11 | Indicadores tal como los calcula el servidor |
| `AuditLog.js` | F1-14 | Bitácora de solo lectura (solo AUDITOR_MUNICIPAL) |
| `DependencyAdmin.js` | F1-15a | Alta y cambio de dependencias |
| `MembershipAdmin.js` | F1-15a | Alta, cambio, revocación y reactivación de membresías |
| `OptionGroup.js`, `CheckboxGroup.js`, `Section.js` | — | Controles accesibles (radio, casillas, encabezados con nivel, filas de botones) |
| `municipalApi.js` | F1-04+ | Cliente HTTP real (reutiliza `apiClient` del ERP) |
| `mockApi.js` | F1-11 | API simulada mínima |
| `privateDocument.js` | C-21 | Lector de documentos privados separado del exportador comercial |
| `model.js` | — | Etiquetas, validaciones de forma y paridad con el servidor |

## QA y demostración — `apps/frontend/qa`

| Archivo | Función |
|---|---|
| `service-backed-api.js` | Ejecuta el **servicio municipal real** en el navegador con almacén en memoria y siembra los datos sintéticos (`demo: true` para el conjunto ampliado) |
| `demo-app.web.jsx` | Aplicación de demostración: perfiles, restablecer, usuarios de ejemplo |
| `municipal-harness.web.jsx` | Arnés de pruebas F1-12/F1-13/F1-14 |
| `e2e/*.e2e.spec.cjs` | Pruebas Playwright (F1-12, F1-13, F1-14, F1-15a) |
| `windows/ABRIR-DEMO.cmd`, `run-windows.ps1` | Lanzadores de Windows |
