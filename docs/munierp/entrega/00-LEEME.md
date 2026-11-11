# MuniERP IA — Entrega del 16 de noviembre de 2026

MuniERP IA es la solución municipal conectada a **YJ Nexo ERP**: registro de solicitudes ciudadanas con
folio, seguimiento e historial, consulta autorizada de expedientes, indicadores, documentos privados,
administración de dependencias y membresías, y bitácora de auditoría.

## Qué se entrega

| Carpeta | Contenido |
|---|---|
| `01-APLICACION-DEMO/` | Aplicación web navegable. Doble clic en `ABRIR-DEMO.cmd` (ver `01-INSTRUCCIONES-WINDOWS.md`) |
| `02-CODIGO-FUENTE/` | Respaldo git completo de la rama `codex/munierp-fase0-arquitectura` (bundle + parche + sumas SHA-256) |
| `03-DOCUMENTACION/` | Este juego de documentos y la documentación técnica completa (`docs/munierp`) |
| `04-EVIDENCIAS/` | Resultados de pruebas: backend (mocha), interfaz (Jest), Playwright Windows (JSONL, informes, trazas) |
| `05-CAPTURAS/` | Capturas de la aplicación por escenario y navegador, generadas por Playwright |

## Documentos

| N.º | Documento |
|---|---|
| 01 | [Instrucciones de ejecución en Windows](01-INSTRUCCIONES-WINDOWS.md) |
| 02 | [Manual breve de usuario](02-MANUAL-USUARIO.md) |
| 03 | [Descripción de módulos](03-MODULOS.md) |
| 04 | [Arquitectura del sistema](04-ARQUITECTURA.md) |
| 05 | [Matriz de requisitos RQ01–RQ06](05-MATRIZ-RQ.md) |
| 06 | [Evidencias de pruebas](06-EVIDENCIAS.md) |
| 07 | [Limitaciones conocidas](07-LIMITACIONES.md) |
| 08 | [Guion de demostración (5 minutos)](08-GUION-DEMO.md) |
| 09 | [Funcionalidades implementadas y pendientes, prioridades](09-FUNCIONALIDADES.md) |

## Lo más importante en una línea

**Todo lo que se demuestra funciona con datos sintéticos y API simulada** (el servicio municipal real se
ejecuta en el navegador con almacén en memoria). **Nada está validado todavía con persistencia real en
MongoDB** ni montado en el ERP central; esas dos validaciones dependen de Codex y del clúster de QA.
