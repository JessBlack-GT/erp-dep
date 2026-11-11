# 05 · Matriz de requisitos RQ01–RQ06

Columnas:
- **Demostrable (sintético)**: se ve en la demostración con la API simulada, que ejecuta el servicio municipal real.
- **Probado**: pruebas automáticas aprobadas (backend con almacén en memoria, Jest, Playwright con API simulada).
- **Persistencia real**: validado contra MongoDB. **Ningún requisito está validado todavía con persistencia real.**

| RQ | Requisito | Criterio | Implementación | Demostrable (sintético) | Probado | Persistencia real |
|---|---|---|---|---|---|---|
| RQ01 | Registrar solicitudes con folio único | Dos solicitudes no comparten folio | Folio emitido por el servidor con contador por municipio/dependencia/tipo/año; idempotencia por municipio + usuario + clave | **Sí**: registro en ventanilla y acuse | Sí: unicidad, idempotencia, concurrencia en memoria; Playwright 02 | **No**: concurrencia real (RC-30) pendiente |
| RQ02 | Asignación e historial | Cada cambio conserva actor, fecha y estado | Máquina de estados con historial inmutable y evento de bitácora en la misma transacción | **Sí**: turnar, asignar, espera, reanudar, concluir, cancelar | Sí: backend; Playwright F1-13 y 04 | **No**: RC-34 pendiente |
| RQ03 | Consultar expedientes autorizados | Nadie obtiene datos de otro expediente | Filtro de alcance en la consulta; 404 indistinguible; aislamiento por municipio en el puerto | **Sí**: el titular de Obras no abre Tesorería ni otro municipio | Sí: HTTP F1-04/F1-12/F1-14; Playwright 03 y 07 | **No**: aislamiento L1 contra `munierp_qa` pendiente |
| RQ04 | Indicadores administrativos | Cifras = registros de prueba | Función pura sobre el mismo alcance del usuario | **Sí**: panel del supervisor (10 solicitudes, 7 abiertas, 2 concluidas) | Sí: oráculo en backend; Jest (total = listado) | **No**: agregación Mongo (MT-74) pendiente |
| RQ05 | Acceso por roles y documentos privados | La API deniega lo no autorizado | Catálogo `municipal.*`, 7 roles, membresías administradas (F1-12/F1-15a), documentos sin URL pública con sha256, bitácora de denegaciones (F1-14) | **Sí**: perfiles con menús y respuestas distintas, revocación inmediata, bitácora del auditor | Sí: 403/404 HTTP, Playwright 05–08, F1-14 | **No**: GridFS y roles de BD (RC-32/33) pendientes |
| RQ06 | Inclusión y continuidad | Teclado, celular y ventanilla | Navegación por teclado, encabezados con nivel, 360/800/1280 px, canal presencial con acuse imprimible, reintento sin duplicar | **Sí** en web | Sí: Playwright 09, 10, 13 (3 navegadores) | No aplica. Android físico/APK **no** probado |

Trazabilidad técnica completa: `docs/munierp/03-ARQUITECTURA-CONECTADA.md` §2 y `06-CASOS-PRUEBA.md`.
