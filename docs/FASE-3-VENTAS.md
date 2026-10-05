# Fase 3 — Ventas

Base: `29b82e2b7bab0539a3ca9b9fc46c3acfb8cc8886`.
Etapa 3.1: backend, API e inventario transaccional.
Etapa 3.2: frontend de Ventas; implementación y validaciones al final del informe.
No se hizo staging, commit ni push. No se ejecutó contra Atlas ni producción.

## Etapa 3.1 — IMPLEMENTADO

### Arquitectura

`Sales → CommercialDocument (SALE) → inventory.adapter → moveInTransaction → MongoDB transaction`.

Sales utiliza la colección `commercialDocuments`, el contador por tipo de Fase 2,
los cálculos de `shared/utils/money.js`, los snapshots y el servicio de auditoría
existente. No hay colección de ventas, contador, cálculo monetario ni auditoría
adicional. El antiguo modelo vacío de Sales no se utiliza.

### Inventario

`inventory.service.move(data, actor)` conserva su contrato manual: valida la
entrada pública, abre la transacción mediante el repositorio y delega en
`moveInTransaction(command, actor, session)`.

El núcleo exige `session.inTransaction() === true`; no abre, confirma, aborta ni
cierra sesiones. Valida y bloquea producto y almacenes, reutiliza `repo.change`
para actualizar saldos condicionalmente y agrega el movimiento inmutable.

El comando interno contiene `movement` y, para operaciones comerciales,
`origin`, `expectedUnit` y eventualmente `reversalOf`. Estos campos no se aceptan
en el endpoint público de movimientos. La idempotencia manual permanece por
actor/clave y conserva su respuesta de replay. La comercial rechaza duplicados.

Reglas:

| Línea | Confirmación | Cancelación de confirmado |
|---|---|---|
| SERVICE | Sin movimiento | Sin movimiento |
| PRODUCT sin seguimiento | Sin movimiento | Sin movimiento |
| PRODUCT con seguimiento | EXIT | ENTRY inversa |

Se conserva la escala entera de cuatro decimales y el límite de saldo existente.
El débito utiliza `$gte` en la actualización; el crédito comprueba el máximo.
No se decide suficiencia únicamente mediante una lectura previa.

### Confirmación y cancelación

Confirmar bloquea el documento, limita el tipo a SALE, valida estado/revisión,
cliente activo y productos activos. Comprueba tipo, unidad y seguimiento frente
al snapshot sin refrescar precio, nombre, SKU ni importes históricos.

El adaptador usa el plan de `inventory.contract.js`, exige almacén por línea
controlada, crea una EXIT y guarda `exitMovementId` en la línea. Estado, revisión,
referencias, saldos, movimientos y auditoría se confirman en la misma sesión.

Cancelar un borrador no genera movimientos. Cancelar un confirmado localiza cada
EXIT por su ID y comprueba documento, línea, producto, cantidad, dirección y
almacén original; rechaza referencias ausentes o previamente revertidas. La ENTRY
utiliza la cantidad y el almacén de la EXIT original. Guarda `reversalOf` en el
movimiento y `reversalMovementId` en la línea, sin modificar el original.

La reversión exige producto y almacén activos, PRODUCT con seguimiento y unidad
compatible. Producto eliminado/inactivo, unidad cambiada, almacén inactivo o
saldo máximo excedido producen 409 y mantienen la venta confirmada.

Una reversión de SALE es una entrada: **saldo actual cero no impide devolver**.
El caso de insuficiencia de saldo no es aplicable a esta dirección; la prueba
correspondiente verifica cero saldo y la prueba de límite verifica overflow.
Las devoluciones de compras no forman parte de esta etapa.

### Idempotencia, concurrencia y rollback

- Documento bloqueado mediante escritura sobre `__v`, con actualización final
  condicionada por ID, tipo, estado y revisión.
- `revision` independiente: empieza en 0 y aumenta en cada PUT/confirm/cancel.
  Un documento anterior sin este campo se interpreta como revisión 0 y se
  actualiza condicionalmente sin migración masiva.
- Claves deterministas existentes `commercial_<documentId>_<lineId>_<action>`.
- Origen estructurado `{documentId, lineId, action}` y un índice único parcial
  global sobre esos campos, independiente de `createdBy`.
- Índice único parcial sobre `reversalOf`: una sola reversión por salida.
- Índices parciales compatibles con movimientos manuales anteriores sin origen.
- Repetir confirmación/cancelación produce 409, incluso con otro usuario; no se
  responde 200 ni se crea otra auditoría de éxito.
- Revalidación de usuario, rol y sessionVersion dentro de la transacción.
- Productos y almacenes se bloquean en orden estable; las operaciones dentro de
  una sesión son secuenciales. Se mantienen los locks `Product.__v` utilizados
  también por Inventario y el ciclo de vida de Productos.
- Transacción comercial con snapshot, majority y primary. El helper de
  autorización recibe opciones adicionales sin cambiar los valores predeterminados
  de otros consumidores.
- Reintentos del driver para errores transitorios y reintentos acotados para la
  primera inserción del contador/saldo; otros duplicados producen conflicto.
- Cualquier fallo revierte toda la transacción, incluida auditoría. No existen
  compensaciones posteriores que intenten reparar una confirmación parcial.

Después de perder la respuesta de confirm/cancel, consultar GET para conocer el
estado/revisión actual. POST de creación no incorpora una clave idempotente de
solicitud: no reintentar ciegamente una creación con resultado desconocido.

### API

Todas las rutas están autenticadas y usan permisos comerciales existentes.

| Método | Ruta | Permiso | Respuesta |
|---|---|---|---|
| GET | /api/v1/sales | commercial.read | 200, data y pagination |
| GET | /api/v1/sales/:id | commercial.read | 200, documento |
| POST | /api/v1/sales | commercial.create | 201, draft |
| PUT | /api/v1/sales/:id | commercial.update | 200, draft actualizado |
| POST | /api/v1/sales/:id/confirm | commercial.confirm | 200, confirmed |
| POST | /api/v1/sales/:id/cancel | commercial.cancel | 200, cancelled |

La respuesta individual tiene `{success: true, data}`. No se implementó DELETE
ni PATCH. Todos los accesos de Sales incluyen `type: SALE`, también dentro del
bloqueo y la escritura. Un ID PURCHASE responde 404 en todas las operaciones.

POST acepta únicamente `date`, `currency`, `entityId` y `lines`. Cada línea acepta
`productId`, `quantity`, `unitPrice`, `discountRate`, `taxRate`, `warehouseId`.

Ejemplo de borrador:

```json
{
  "date": "2026-10-05",
  "currency": "USD",
  "entityId": "<ID cliente>",
  "lines": [{
    "productId": "<ID producto>",
    "quantity": "2.0000",
    "unitPrice": "10.0000",
    "discountRate": "0.0000",
    "taxRate": "0.0000",
    "warehouseId": "<ID almacén>"
  }]
}
```

Se requieren cliente/productos activos y entre 1 y 200 líneas. Se reutilizan las
reglas decimales de Fase 2: cantidad positiva, precio no negativo, tasas 0–100,
moneda de tres letras mayúsculas y rechazo de conversión implícita. El precio
opcional se obtiene del catálogo; si tampoco existe allí, se rechaza. Las tasas
omitidas son cero. No se introducen reglas fiscales adicionales.

El almacén es opcional en borrador; si se proporciona debe existir y estar activo.
No es aplicable a servicios/productos sin seguimiento. Se exige al confirmar una
línea controlada. La ausencia al confirmar produce 409; ID malformado, 400.

PUT requiere todo el contenido editable y `expectedRevision` (entero no negativo).
Recalcula importes y reconstruye snapshots del borrador, conservando identidad y
número; no edita confirmados/cancelados. Confirm/cancel reciben exclusivamente:

```json
{ "expectedRevision": 0 }
```

El cliente no puede enviar type, status, totales, snapshots, referencias de
movimientos, revision almacenada ni auditoría. Incluso `type: SALE` se rechaza:
lo fija el servidor.

Listado: `page` (1–1000000), `limit` (1–100), `status`, `entityId`, `from`, `to`
(YYYY-MM-DD inclusivas sobre la fecha documental), `search` (número literal).
Orden: fecha descendente e ID descendente. Predeterminados: página 1, límite 20.
La paginación devuelve `page`, `limit`, `total`, `pages`.

Errores: 400 validación; 401 sesión; 403 permiso; 404 venta/referencia activa
inexistente; 409 estado/revisión/stock/incompatibilidad; 500/503 fallo interno o
indisponibilidad. Producto no elegible detectado al confirmar mediante Sales
produce 409. Cliente activo no encontrado conserva el 404 de Fase 2.

El manejador de Sales suprime stack y detalles del motor. También se monta en
app para errores de JSON anteriores al router, sin eco del cuerpo recibido.

### RBAC y auditoría

No se añadieron permisos ni se cambiaron asignaciones globales. Los roles
persistidos siguen prevaleciendo; roles sin permisos comerciales continúan sin
acceso. Los efectos de inventario derivados de una venta requieren el permiso
comercial correspondiente, no permisos de movimientos manuales arbitrarios.

Cada create/update/confirm/cancel completado registra el evento existente de
CommercialDocument con actor, acción, entidad, ID y resultado. Sin payloads,
contraseñas, JWT, claves ni connection strings. Un evento dentro de una transacción
abortada también se revierte; no se agregó auditoría durable de intentos fallidos.

### Arranque y compatibilidad

Después de conectar MongoDB y antes de escuchar HTTP, `sales.setup.js` verifica
replica set/mongos e inicializa colecciones/índices comerciales y de Inventario.
Una topología standalone o un fallo de preparación impide iniciar el servidor.
Esto no comprueba por sí solo toda la capacidad transaccional del despliegue:
la suite real sigue siendo necesaria.

No se cambiaron Clientes, Proveedores, Productos, autenticación, recuperación ni
correo de bienvenida. Los movimientos manuales siguen utilizando su API y
regresiones originales. PURCHASE conserva la base de Fase 2: los efectos de
inventario de compras permanecen bloqueados hasta un adaptador propio.

## PRUEBAS Y VALIDACIÓN EJECUTADAS

| Comprobación | Resultado |
|---|---|
| Backend `npm.cmd test -- --reporter dot` | 953 passing, 0 failing |
| Pruebas nuevas ejecutadas | 126 sobre las 827 existentes |
| Frontend `npm.cmd test` | 29 suites, 236 passing, 0 failing, 9 TODO existentes |
| Build web | SUCCESS tras repetir fuera del sandbox por acceso denegado |
| ESLint global `npm.cmd run lint` | Falla: 823 errores preexistentes, 92 warnings |
| ESLint archivos existentes de etapa: HEAD vs actual | 39 errores en ambos; warnings 9 → 3 |
| ESLint archivos nuevos, incluido replica .cjs | 0 errores, 0 warnings |
| node --check | 25 JS/CJS modificados o nuevos de esta etapa: correctos |
| git diff --check | Correcto |
| Suite real `npm.cmd run test:sales:replica` | 0 passing, 1 fallo de precondición: falta SALES_TEST_MONGODB_URI |

La suite normal usa servicios, adaptador y núcleo reales con almacenamiento
simulado, sesiones verificadas y rollback de la simulación. La actualización
condicional del repositorio se ejercita con modelos simulados. Las carreras de
esta suite se serializan explícitamente: NO prueban concurrencia de MongoDB.

Cobertura nueva: API y validación protegida, los tres tipos de línea, múltiples
líneas/almacenes, saldo insuficiente acumulado, snapshots, estados, revisión,
repeticiones entre usuarios, respuestas perdidas, reversión exacta y referencias
incorrectas, producto/unidad/almacén incompatibles, saldo máximo, rollback al
fallar movimientos/auditoría, carreras simuladas, RBAC, SALE/PURCHASE, índices,
preparación del arranque y errores sin datos internos.

No se eliminaron ni deshabilitaron pruebas existentes. Se ajustaron dos fixtures
de sesión para representar una transacción activa y el nombre de una prueba cuyo
bloqueo pendiente pasó a ser la ausencia de almacén. No se añadieron skips/TODO.

### Suite real preparada

`npm.cmd run test:sales:replica` ejecuta explícitamente
`tests/replica/sales.replica.cjs`; no forma parte del glob de pruebas simuladas.
Requiere `SALES_TEST_MONGODB_URI` en el proceso para un replica set de pruebas.
No utiliza MONGODB_URI de la aplicación ni requiere editar .env.

La suite crea una base aleatoria `erp_sales_test_<UUID>` y elimina exclusivamente
esa base al terminar, comprobando su identidad. No se debe apuntar a producción.
Incluye 9 escenarios reales preparados: movimientos inversos, tres carreras,
último stock, dos fallos de auditoría, índices únicos y reintentos/cancelaciones.

En esta ejecución no hubo URI dedicada ni mongod instalado: el before hook falló
de forma explícita. **No se ejecutó ningún escenario real y no se afirma
concurrencia, rollback o recuperación comprobados contra Atlas/replica set.**

## ARCHIVOS DE LA ETAPA

16 archivos existentes modificados:

```text
apps/backend/package.json
apps/backend/src/app.js
apps/backend/src/modules/commercial/commercial.model.js
apps/backend/src/modules/commercial/commercial.repository.js
apps/backend/src/modules/commercial/commercial.service.js
apps/backend/src/modules/commercial/commercial.validation.js
apps/backend/src/modules/inventory/inventory.model.js
apps/backend/src/modules/inventory/inventory.repository.js
apps/backend/src/modules/inventory/inventory.service.js
apps/backend/src/modules/inventory/inventory.test.js
apps/backend/src/modules/sales/sales.controller.js
apps/backend/src/modules/sales/sales.routes.js
apps/backend/src/modules/sales/sales.service.js
apps/backend/src/security/administration.js
apps/backend/src/server.js
apps/backend/tests/commercial.foundation.test.js
```

11 archivos nuevos:

```text
apps/backend/src/modules/commercial/inventory.adapter.js
apps/backend/src/modules/sales/sales.errors.js
apps/backend/src/modules/sales/sales.setup.js
apps/backend/src/modules/sales/sales.validation.js
apps/backend/tests/helpers/sales.fixture.js
apps/backend/tests/replica/sales.replica.cjs
apps/backend/tests/sales.http.test.js
apps/backend/tests/sales.inventory.integration.test.js
apps/backend/tests/sales.persistence.test.js
apps/backend/tests/sales.rbac.test.js
docs/FASE-3-VENTAS.md
```

## PENDIENTE Y LIMITACIONES

- El frontend quedó pendiente al cerrar la etapa 3.1. La etapa 3.2 descrita
  abajo implementa pantallas, formularios, navegación y cliente Sales.
- Ejecutar y validar la suite real en un replica set aislado antes de despliegue.
- La capacidad de cancelar un producto eliminado no se resuelve recreándolo ni
  alterando sus reglas: se rechaza atómicamente, según el diseño aprobado.
- No hay entregas parciales, reserva de stock, facturación fiscal, pagos,
  conversión monetaria ni movimientos de compras en esta etapa.
- No hay idempotencia de creación de borradores ni auditoría separada de intentos
  fallidos. Las respuestas perdidas de confirm/cancel se resuelven consultando.
- El lint global sigue con deuda anterior; no se ocultaron sus errores.

## GIT Y ARCHIVOS PROTEGIDOS

HEAD y origin/main permanecen en `29b82e2b7bab0539a3ca9b9fc46c3acfb8cc8886`.
Staging vacío. Los 27 archivos de esta etapa permanecen sin confirmar.

Los cambios locales previos de `auth.service.js` y `auth.bootstrap.test.js`
permanecen intactos; se compararon sus SHA-256 antes y después. Android permanece
sin seguimiento. No se modificó .env ni se agregaron estos archivos al índice.
No se hizo commit ni push.

## Etapa 3.2 — Frontend

### IMPLEMENTADO

Auditoría previa: MainNavigator, WebAppShell/Sidebar/PageContainer, cliente Axios,
AuthContext/usePermissions, Clientes, Proveedores, Productos, Inventario,
formularios, modales, loading y empty states. Se conservaron las convenciones de
features y las rutas existentes. Los índices de tablas/formularios contienen
exports de componentes aún inexistentes: no se importaron esos placeholders.
Se usan tarjetas como los otros módulos y Button/Input/EmptyState del sistema
visual existente. El shell proporciona scroll y navegación adaptable.

- **Componentes:** SalesScreen, SaleDetailScreen, SaleForm, SaleLineEditor,
  SalesSelector y SaleTotals. `shared.js` reúne etiquetas, estilos, validación UX,
  mensajes seguros y una whitelist de campos editables.
- **Navegación:** Sales/SaleDetail requieren commercial.read; SaleForm requiere
  además create o update y verifica el permiso correspondiente al documento.
  Ventas aparece en Sidebar solamente con commercial.read. Nueva venta limpia
  explícitamente el id de edición cuando se reutiliza la ruta.
- **Listado:** GET /sales, número, fecha, cliente, total, moneda y estado;
  búsqueda, estado, rango de fechas, paginación, actualización, loading, error y
  vacío. Descarta respuestas antiguas al cambiar filtros y refresca al enfocar.
- **Formulario:** fecha AAAA-MM-DD, moneda, cliente y líneas; POST crea borrador;
  PUT envía el contenido editable más expectedRevision. No permite editar
  confirmed/cancelled. El cuerpo se construye expresamente; no copia documentos
  ni envía type/status/revision/totales/snapshots/referencias/auditoría.
- **Catálogos:** se reutiliza InventorySelector con loader, formato, filtro y
  mensaje de error configurables. Conserva su comportamiento de Inventario.
  Consulta customers/products/inventory warehouses existentes, con status=active,
  y filtra también registros inactivos/eliminados recibidos. Clientes admite
  paginación sin metadatos (una página llena permite consultar la siguiente).
  Al editar se revalidan cliente y productos por GET: un snapshot por sí solo
  no se interpreta como prueba de que el registro sigue activo.
- **Productos/servicios:** muestra nombre, SKU, tipo, unidad y precio/moneda del
  catálogo cuando existen. El precio sigue siendo editable; sin precio de
  catálogo exige que el usuario lo ingrese. No inventa importes ni convierte
  monedas. Agregar/eliminar líneas y validación UX de cantidad > 0, precio >= 0,
  descuento/impuesto entre 0 y 100.
- **Almacenes:** selector solo para PRODUCT + trackInventory. Opcional en draft,
  necesario para confirmar. Cambiar de producto limpia el almacén anterior.
  SERVICE y PRODUCT sin inventario nunca envían warehouseId. El backend sigue
  decidiendo existencias y movimientos. Detalle muestra los IDs reales de
  almacén/salida/reversión; no inventa nombres históricos de almacén.
- **Totales:** subtotal, descuento, impuestos, total y moneda exactamente como
  devuelve el servidor, preservando sus strings decimales. No hay cálculo
  monetario paralelo. Antes de guardar se explica que aún no hay totales; al
  editar se identifican los del último guardado hasta recibir la nueva respuesta.
- **Detalle:** usa snapshots persistidos, sin sustituirlos por el catálogo actual.
  Draft ofrece editar/confirmar/cancelar según permisos; confirmed solo cancelar;
  cancelled ninguna mutación. Consulta de estado y retorno al listado permanecen.
- **Confirmar/cancelar:** modal de intención, bloqueo visual y guard síncrono con
  ref contra doble clic; envía exclusivamente expectedRevision. La respuesta
  actualiza el estado. Ante error consulta GET, nunca repite automáticamente la
  mutación. Si también falla la consulta, muestra estado sin verificar y bloquea
  mutaciones hasta recuperar el estado real.
- **Conflictos/guardado incierto:** 409 o red/5xx en PUT consulta el documento y
  exige recarga explícita antes de editar otra vez. No sobrescribe con una revisión
  nueva automáticamente. POST incierto bloquea un segundo envío y dirige al
  listado para evitar duplicados; el backend no tiene idempotencia de creación.
- **Errores:** mensajes españoles locales para 400/401/403/404/409/500/503/red;
  jamás renderiza message/error/stack recibidos del servidor. Se conserva la
  gestión global de sesión 401 y actualización de permisos 403 de Axios.
- **Permisos:** commercial.* controla únicamente UX; la API conserva autoridad.
  Los selectores respetan customers.read/products.read/inventory.read, sin crear
  permisos ni mecanismos de acceso alternativos.
- **Responsive:** tarjetas en columna, ancho disponible, acciones con flexWrap y
  modal con ancho máximo adaptable; no se introdujo una tabla de ancho fijo.
  Se reutilizan scroll y drawer móvil del shell.
- **Dependencia:** prop-types 15.8.1 ya estaba resuelto transitivamente; se declaró
  dependencia directa del frontend y se actualizó su entrada en package-lock.
  No se cambiaron versiones de otras dependencias.

### Pruebas y validación ejecutada

| Comprobación | Resultado |
| --- | --- |
| Nuevas suites sales.test.js, sales.navigation.test.js, sales.api.test.js | 62 passing, 0 failing |
| npm.cmd test (frontend completo) | 32 suites; 298 passing, 0 failing, 9 TODO preexistentes |
| Regresión existente | 236 pruebas conservadas; Clientes, Proveedores, Productos, Inventario, autenticación, permisos y navegación pasan |
| npm.cmd run build:web | SUCCESS; el sandbox bloqueó resolución de directorios, repetido correctamente con permiso fuera del sandbox |
| npm.cmd run lint (frontend completo) | 338 errores y 11 advertencias; al inicio 344 errores y 11 advertencias |
| ESLint de sales y InventorySelector | 0 errores, 0 advertencias de código |
| git diff --check | Correcto |

Las pruebas usan mocks de API/adapter; no llaman servicios reales. Cubren carga,
vacío, filtros/paginación, respuestas fuera de orden, navegación, creación,
selección activa, PRODUCT/SERVICE, líneas, importes exactos del servidor, edición,
expectedRevision, estados, confirmación/cancelación, modales, doble clic, red y
recuperación, permisos y errores 400/401/403/404/409/500/503. El adapter verifica
verbos, rutas, cuerpos y autenticación del cliente real, incluyendo PUT.
No se borraron pruebas, no se añadieron skip/only/xit/xdescribe ni TODO.
La suite anterior de usuarios m01.frontend sigue emitiendo avisos act() de React;
no se ocultaron. Los nuevos tests de Ventas pasan sin esos avisos.

### Archivos de etapa 3.2

8 archivos existentes al iniciar esta etapa, modificados:

```text
apps/frontend/package.json
apps/frontend/src/app/navigation/MainNavigator.js
apps/frontend/src/components/layout/Sidebar.js
apps/frontend/src/features/inventory/InventorySelector.js
apps/frontend/src/features/sales/index.js
apps/frontend/src/services/api.js
package-lock.json
docs/FASE-3-VENTAS.md
```

El informe ya existía localmente desde 3.1 y continúa sin seguimiento en Git.
10 archivos nuevos en esta etapa:

```text
apps/frontend/src/features/sales/SalesScreen.js
apps/frontend/src/features/sales/SaleDetailScreen.js
apps/frontend/src/features/sales/SaleForm.js
apps/frontend/src/features/sales/SaleLineEditor.js
apps/frontend/src/features/sales/SalesSelector.js
apps/frontend/src/features/sales/SaleTotals.js
apps/frontend/src/features/sales/shared.js
apps/frontend/tests/sales.test.js
apps/frontend/tests/sales.navigation.test.js
apps/frontend/tests/sales.api.test.js
```

### PENDIENTE y límites de validación

- Atlas/replica set real continúa sin validar: siguen pendientes los escenarios
  reales descritos en etapa 3.1. Las 953 pruebas backend aprobadas pertenecen a
  esa etapa; no se presentan como una ejecución nueva de etapa 3.2.
- No se hizo una sesión manual autenticada de extremo a extremo contra un
  servidor real ni una inspección visual en dispositivos físicos. Responsive se
  implementó reutilizando el shell y estilos flexibles; el build y los tests no
  sustituyen esa comprobación visual.
- Dashboard sigue siendo un placeholder previo sin pantalla registrada ni enlace
  de Sidebar. No se afirma que exista un Dashboard funcional ni se añadió en 3.2.
- El lint global del frontend conserva deuda anterior. La reducción de seis
  errores procede de las propTypes del selector reutilizado; no se desactivaron
  reglas ni se reformatearon componentes ajenos para ocultar errores.
- No hay cambio de moneda automático, vista de stock calculada en frontend,
  facturación fiscal, pagos, compras o entregas parciales.

### Git y preservación de backend

HEAD == origin/main == `29b82e2b7bab0539a3ca9b9fc46c3acfb8cc8886`.
Rama main sin commits adelantados; índice vacío. Las etapas 3.1 y 3.2 continúan
locales, sin commit ni push. Se revisaron status --short --branch, diff --name-only,
diff --stat y diff --check. diff/stat no incluyen los archivos nuevos sin seguimiento.

Los 193 archivos backend versionados o nuevos no ignorados se compararon antes y
después por ruta y contenido: SHA-256 agregado idéntico
`f6eef9bfa28664415d58e03a6cd089d89c6aa30cbaeec5f4a0e12756cb588565`.
Por tanto no se modificó backend en 3.2, incluidos auth.service.js y
auth.bootstrap.test.js. Android permanece sin seguimiento y no se tocó.
No se modificó .env ni se ejecutó git add, commit o push.

## Etapa 3.3 — Validación real contra MongoDB Atlas

Fecha: 2026-10-05 (America/Mexico_City). Base exclusiva: `erp_sales_test`.
Se utilizó únicamente SALES_TEST_MONGODB_URI, sin registrar su contenido.
Conexión Atlas, autenticación SCRAM y Replica Set: PASS. El alcance de conexión
y de los dos borrados previstos por la suite (inicial/final) queda fijado a
erp_sales_test, con verificación de identidad antes del borrado. No se consultó
ni modificó producción ni se creó otra base de pruebas.

Se ejecutó `npm.cmd run test:sales:replica`, sin modificar pruebas, tiempos,
credenciales ni código funcional. Resultado real: **7 passing / 2 failing**.

| Escenario | Resultado | Evidencia de la suite contra MongoDB real |
| --- | --- | --- |
| 1. EXIT y ENTRY inversa exacta | PASS | Consulta saldo, movimiento original, reversión y relación reversalOf; verifica original intacto y tres auditorías |
| 2. Confirmar/confirmar concurrentes | PASS | Una operación exitosa, un conflicto 409, revisión 1 y saldo consistente |
| 3. Confirmar/cancelar concurrentes | PASS | Una operación exitosa, un conflicto 409, revisión 1 y saldo según estado final |
| 4. Actualizar/confirmar concurrentes | PASS | Una operación exitosa, un conflicto 409, revisión 1 y dos auditorías |
| 5. Dos ventas sobre el último stock | PASS | Una confirmación, un conflicto 409, saldo cero y una sola EXIT |
| 6. Rollback al confirmar por fallo de auditoría | FAIL | Error inesperado de esquema __v, antes de completar las aserciones de rollback |
| 7. Rollback al cancelar por fallo de auditoría | FAIL | Mismo error inesperado de esquema __v |
| 8. Índices únicos de origen/reversión | PASS | Inserciones duplicadas directas rechazadas por MongoDB con código 11000 |
| 9. Reintentos y cancelaciones sin duplicación | PASS | Reconfirmación rechazada, una cancelación efectiva, saldo restaurado y dos movimientos de origen comercial |

### Stock, movimientos y límites de evidencia

La preparación ingresa **2 unidades**; cada venta demanda **2 unidades**.
La consulta directa de InventoryBalance en el escenario 1 comprueba **0** después
de confirmar y **20000 quantityUnits = 2 unidades** después de cancelar.
La cantidad inicial proviene del ENTRY de preparación; el test no realiza una
lectura independiente del saldo inmediatamente anterior a confirmar.
Se resolvieron exitMovementId y reversalMovementId mediante consultas reales y
se comprobó reversalOf, almacén inverso y que la EXIT original permaneció intacta.
No se afirma una verificación adicional de todos los campos de origen/cantidad
que la suite no compara explícitamente.

El caso concurrente de último stock usa 2 unidades disponibles y dos ventas de
2 unidades cada una. Pasó contra Atlas real con Promise.allSettled, sin
serialización artificial; el caso literal stock=1 y ventas=1 no fue ejecutado.
Las transacciones reales de los escenarios exitosos funcionaron: PASS.

### Fallos de rollback y auditoría

Los escenarios 6 y 7 esperaban `Injected audit failure`, pero recibieron:
`Field __v is not in schema and strict mode is set to throw.`
La aserción falló en `sales.replica.cjs:279`. No se llegó a las comprobaciones
posteriores de igualdad del documento, saldo y cantidad de movimientos.
Por tanto **rollback ante fallo de auditoría: FAIL / NO CONFIRMADO**; no se
afirma que hubiera efectos parciales ni que se hubieran revertido correctamente.
La causa interna exacta del error de esquema no se diagnosticó ni corrigió en
esta ejecución de validación.

Auditoría de operaciones exitosas: las comprobaciones de conteo del escenario 1
y de las carreras pasaron. Auditoría completa: NO CONFIRMADA; no se verificó
la ausencia de auditoría de éxito tras los fallos 6/7 ni todos los campos de los
eventos. No se presenta como validación integral de auditoría.
Índices de origen/reversalOf: restricciones reales PASS por rechazos 11000;
no hubo inspección adicional listIndexes antes del cleanup.

SERVICE: NO EJECUTADO. PRODUCT sin inventario: NO EJECUTADO.
SALE/PURCHASE: NO EJECUTADO. No están cubiertos por los nueve escenarios reales.

### Cleanup, regresión y veredicto

El hook final ejecutó el cleanup previsto sin reportar error. Una conexión
posterior, verificando `db.databaseName === 'erp_sales_test'`, consultó
listCollections y obtuvo **0 colecciones**: cleanup PASS. No quedaron datos de
prueba tras la ejecución; ya no es posible inspeccionar los documentos del
instante de los fallos. No se realizó ningún borrado adicional.

`npm.cmd test` del backend: **953 passing / 0 failing**, después de la suite real.
No se repitió frontend en esta solicitud (última ejecución: 298 passing, 0 failing,
9 TODO existentes). No hubo prueba manual de frontend en esta ejecución.

`git diff --check`: PASS. HEAD y origin/main permanecen en
`29b82e2b7bab0539a3ca9b9fc46c3acfb8cc8886`; staging vacío. Solo se actualizó
este informe. Código, tests, auth.service.js, auth.bootstrap.test.js y Android
permanecen intactos. No se modificó .env ni se hizo staging, commit o push.

**VEREDICTO DE ETAPA 3.3: NO APROBADA.** Hay dos fallos reales, rollback y
auditoría completa no confirmados, y cobertura SERVICE/PRODUCT sin inventario/
SALE-PURCHASE no ejecutada. Los resultados de pruebas simuladas no sustituyen
esas comprobaciones.
