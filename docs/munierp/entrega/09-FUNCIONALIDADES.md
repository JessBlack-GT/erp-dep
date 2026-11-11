# 09 · Funcionalidades implementadas y pendientes

Leyenda de validación: **S** = demostrable con datos sintéticos y API simulada · **H** = probado por HTTP
con supertest (router real, almacén en memoria) · **M** = validado con MongoDB real.

## Implementadas

| Funcionalidad | Historia | S | H | M |
|---|---|---|---|---|
| Registro de solicitud con folio único, idempotencia y acuse | F1-06, F1-11 | ✔ | ✔ | — |
| Listado con filtros y paginación; búsqueda por folio | F1-04, F1-15a | ✔ | ✔ | — |
| Detalle, historial y transiciones con confirmación | F1-07, F1-13 | ✔ | ✔ | — |
| Documentos privados: subida validada, descarga autorizada y verificada (web) | F1-08, C-21 | ✔ | ✔ | — |
| Indicadores por alcance | F1-09 | ✔ | ✔ | — |
| Dependencias: consulta, alta, edición, desactivación con reglas | F1-12 (API), F1-15a (UI) | ✔ | ✔ | — |
| Membresías: consulta con alcance, alta de usuario central, cambio, revocación, reactivación | F1-12 (API), F1-15a (UI) | ✔ | ✔ | — |
| Bitácora de auditoría (solo auditor) | F1-10, F1-14 | ✔ | ✔ | — |
| Aplicación navegable con menú por permisos y modo demostración identificado | F1-15a | ✔ | — | — |
| Datos de demostración reproducibles y restablecimiento | F1-15a | ✔ | — | — |
| Adaptador MongoDB y prueba previa (preflight) de solo lectura | F1-05 | — | — | **preparado, sin ejecutar** |

## Pendientes por prioridad (al 10-11-2026)

### CRÍTICA (sin ella no se abre, recorre o demuestra)

| Tarea | Estado |
|---|---|
| Aplicación navegable abrible en Windows | **Hecha** (`ABRIR-DEMO.cmd`; alternativa sin Node) |
| Datos de demostración y restablecimiento | **Hecha** |
| Administración de dependencias y membresías (F1-15a) | **Hecha** |
| Respaldo del código y carpeta de entrega | **Hecha** (bundle git verificado con SHA-256) |
| Ensayo manual del guion en el equipo de la presentación | **Pendiente del equipo** (≈ 10 min) |

### IMPORTANTE (presentación, accesibilidad, evidencia)

| Tarea | Estado |
|---|---|
| Jerarquía de encabezados, separación de botones, etiquetas, teclado | Hecha (Playwright 10 y 09) |
| Evidencia Playwright en Chromium, Firefox y WebKit | Hecha (ver 06) |
| Integrar Card/Input corregidos de Codex y repetir F1-12…F1-15a | Depende de Codex (C-18/C-19) |
| Montar `MunicipalApp` en la navegación del ERP con HTTP real | Depende de Codex (C-01/C-11); la aplicación ya acepta `createMunicipalApi` |
| Prueba en Android (APK) y con lector de pantalla | No realizada |
| Nombres de funcionarios en lugar de identificadores (X-01) | Propuesta de contrato |

### POSTERIOR (Atlas, despliegue real o funciones avanzadas)

| Tarea | Depende de |
|---|---|
| Ejecutar preflight y pruebas L1–L3 contra `munierp_qa` | C-05 |
| Conciliación de documentos PENDIENTE | C-22 (contrato y backend) |
| Bitácora para el administrador municipal | C-23 (decisión de política; hoy no se amplía) |
| Lector privado de documentos en Android | C-21 |
| Edición de vigencia de membresías, buscador de usuarios centrales | Contrato / UX |
| Funciones de IA, pagos, contabilidad, nómina | Fuera de alcance de esta entrega |
