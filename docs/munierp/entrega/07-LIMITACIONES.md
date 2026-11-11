# 07 · Limitaciones conocidas

## Validación pendiente (no se presenta como terminada)

| Limitación | Consecuencia | Depende de |
|---|---|---|
| **MongoDB real no validado**. El adaptador está preparado; las pruebas L3 RC-29 a RC-35 están escritas pero **sin ejecutar** | No hay evidencia de concurrencia, transacciones, índices, GridFS ni roles de base de datos reales | C-05 (clúster QA `munierp_qa`) |
| **Módulo no montado en el ERP central** | La demostración usa la API simulada; la ruta HTTP real solo está probada con supertest | C-01 / C-11 (anfitrión local de Codex) |
| La demostración corre en el navegador | Los datos viven en memoria: se pierden al recargar (es intencional y reproducible) | — |
| Reloj de demostración fijo en octubre de 2026 | Las fechas de registro y los indicadores corresponden a ese periodo | Intencional (resultados reproducibles) |

## Funcionalidad posterior

| Limitación | Detalle |
|---|---|
| Conciliación de documentos PENDIENTE | **No implementada.** El contrato no expone su estado; propuesta documentada (C-22, doc 16 §3) |
| Nombres de funcionarios | El contrato solo entrega identificadores: se muestran como «Usuario ···abc123» (propuesta X-01) |
| Alta de membresía por identificador | No hay buscador de usuarios centrales en draft.3; se escribe el identificador de 24 caracteres. En la demostración se listan identificadores sintéticos |
| Vigencia (`validTo`) de membresías | El contrato la admite; la interfaz aún no la edita |
| Búsqueda de texto en solicitudes | El contrato filtra por estado y dependencia; la búsqueda es por folio exacto |
| Bitácora solo para el auditor | Política vigente: el administrador municipal no la consulta (decisión C-23, sin ampliar permisos) |
| Documentos privados en Android | Descarga no disponible en la app móvil hasta el lector privado nativo (C-21) |
| Android/APK y lector de pantalla real | No probados en dispositivo; RQ06 verificado en web (3 navegadores) |
| Card e Input corregidos por Codex | No integrados en esta rama; las pruebas aceptan ambos comportamientos (C-18/C-19) |
| `EmptyState` y `StatCard` del núcleo exponen su título como `<h1>` | Las pantallas municipales ya no los usan; el componente del núcleo sigue igual (reportado a Codex) |
| Pruebas del núcleo del ERP | 3 pruebas de `m01.frontend.test.js` (usuarios y roles) fallan también en la base `cae3e38`: son anteriores a esta entrega y ajenas al módulo municipal. Se reportan a Codex |
| IA | Fuera de la Fase 1 (no se agregan funciones de IA antes de la entrega) |
