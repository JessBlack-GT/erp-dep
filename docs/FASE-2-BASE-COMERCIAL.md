# Fase 2 — Base comercial de YJ Nexo ERP

Fecha: 4 de octubre de 2026. Base Git: `4d352c0d291d5ead277cf74c343a651e914ca4d5`, rama `main` de JessBlack-GT/erp-dep.

## Objetivo y alcance

Preparar infraestructura backend reutilizable para documentos comerciales. Esta fase **no implementa los módulos de Ventas, Compras, Finanzas ni Dashboard**, tampoco facturación fiscal, cobros, pagos, asientos, recepción de compras ni entregas de ventas. No agrega endpoints, pantallas ni componentes sin consumidores reales.

## A. Auditoría previa del repositorio

Antes de modificar se revisaron modelos, repositorios, servicios, controladores, rutas, validaciones, errores, autorización, pruebas y configuración de MongoDB. Se encontró:

- Clientes y Proveedores ya cuentan con identidades MongoDB y estados `active`, `inactive`, `deleted`. Sus servicios no son reemplazados.
- Productos/Servicios ya almacenan precio y costo como texto decimal no negativo, con hasta doce enteros y cuatro decimales. No existía una utilidad monetaria central para cálculos comerciales.
- Inventario ya dispone de cantidades escaladas a cuatro decimales, transacciones, bloqueo de Product mediante incremento de `__v`, movimientos inmutables e idempotencia. No se duplican saldos ni movimientos.
- RBAC ya resuelve identidad y permisos persistidos, ignora permisos arbitrarios del token/usuario y comprueba `sessionVersion`. `security/administration.transaction` vuelve a validar y bloquear usuario y rol dentro de la transacción; no limita sus operaciones exclusivamente a roles administradores, por lo que se reutiliza con permisos comerciales.
- Ventas y Compras contienen modelos vacíos; no había infraestructura comercial equivalente ni convención de numeración que preservar.
- Auditoría existe como módulo, pero su modelo y repositorio estaban vacíos y sus servicios eran placeholders. Se completa ese módulo, sin crear otro sistema paralelo.
- No había cotizaciones ni pedidos funcionales que requirieran tipos o estados adicionales en esta fase.

Conclusión previa aplicada: reutilizar identidades, reglas de catálogo, cantidades, RBAC, errores y autorización transaccional; extraer la normalización monetaria y crear únicamente documentos, contador, cálculos, contrato de inventario y auditoría comercial.

## B, F. Arquitectura y documentos

La entrada interna es `modules/commercial/commercial.service.js`:

- `getById(id, actor)` comprueba permisos persistidos y revocación antes de leer.
- `createDraft(data, actor)` valida, calcula, asigna número, guarda y audita en una transacción.
- `updateDraft(id, data, actor)` reemplaza los campos comerciales editables de un borrador, recalcula y audita. Requiere el contenido completo editable; no es un PATCH HTTP.
- `confirm(id, actor)` y `cancel(id, actor)` aplican exclusivamente transiciones controladas.

`actor` proviene de la autenticación confiable de un futuro controlador: `{ id, sessionVersion }`. No se debe construir desde el cuerpo enviado por un cliente. Los permisos se vuelven a consultar, no se confía en `actor.permissions` o `actor.isSuperadmin`.

El modelo `CommercialDocument`, colección `commercialDocuments`, guarda:

| Campo | Función |
| --- | --- |
| `_id` | Identidad interna MongoDB |
| `number`, `sequence`, `type` | Identidad visible, correlativo y tipo; inmutables |
| `status` | `draft`, `confirmed`, `cancelled` |
| `date` | Fecha comercial recibida como `YYYY-MM-DD`, persistida a medianoche UTC; validación de fecha calendario real |
| `currency` | Código de tres letras mayúsculas, obligatorio; sin conversión cambiaria implícita |
| `entity` | `kind`, `id`, `name`: referencia al cliente/proveedor y nombre histórico mínimo |
| `lines` | Una a doscientas líneas; cada una con identidad propia, referencia y snapshot |
| `subtotal`, `discount`, `tax`, `total` | Importes calculados, texto decimal a cuatro posiciones |
| `createdBy`, `updatedBy` | Usuarios responsables; el creador es inmutable |
| `confirmedAt`, `confirmedBy` | Confirmación, cuando exista |
| `cancelledAt`, `cancelledBy` | Cancelación, cuando exista |
| `createdAt`, `updatedAt` | Timestamps Mongoose |

El registro central `TYPES` relaciona `SALE` con cliente y `PURCHASE` con proveedor. Los códigos identifican documentos genéricos de esa naturaleza: no representan la implementación de aquellos módulos. Agregar un tipo futuro requiere ampliar explícitamente este registro, la política de inventario y las pruebas; no se aceptan tipos arbitrarios desde entrada externa. No se agregaron cotizaciones ni pedidos especulativos.

Los campos protegidos, estados, números, actores, snapshots y totales no se aceptan como datos de entrada. El tipo no puede cambiar al actualizar. No hay borrado físico ni método de eliminación comercial.

## G. Numeración persistente

`CommercialCounter`, colección `commercialCounters`, guarda `_id = tipo` y `value`. La asignación usa `findOneAndUpdate` con `$inc`, `upsert` y la **misma sesión** de la creación documental. No usa reloj ni contador local.

Formato inicial: `SALE-000001`, `SALE-000002`, `PURCHASE-000001`. Seis posiciones es el ancho mínimo: no se truncan números mayores. El contador está limitado a enteros seguros de JavaScript y no se reinicia por año ni al reiniciar el proceso. No existe una regla fiscal, sucursal o multiempresa definida que justifique otras particiones.

El `_id` del contador tiene unicidad nativa MongoDB. El documento declara índices únicos para `number` y para `{ type, sequence }`. Se reintenta hasta tres veces una carrera identificable de la primera inserción del contador, dentro de una nueva transacción. Otros errores de duplicidad documental se traducen a conflicto sin publicar mensajes del motor. El agotamiento persistente no produce un número reciclado.

Un fallo al guardar el documento o la auditoría aborta también el incremento. La cancelación conserva el número. Este correlativo interno no es una promesa de numeración fiscal sin huecos. La idempotencia de solicitudes completas de venta/compra deberá diseñarse al crear sus APIs: llamar dos veces a `createDraft` crea dos documentos con números distintos.

## H. Estados y transiciones

| Origen | Destino permitido |
| --- | --- |
| `draft` | `confirmed` o `cancelled` |
| `confirmed` | `cancelled`, sujeto al contrato de inventario |
| `cancelled` | Ninguno |

Solo se edita un borrador. Confirmar dos veces, cancelar dos veces, recuperar un cancelado o devolver un confirmado a borrador produce conflicto. Los estados desconocidos producen error de validación. Las comprobaciones se realizan en backend sobre el documento bloqueado dentro de la transacción.

Al confirmar se vuelven a comprobar referencias activas y elegibilidad actual del catálogo. Los cambios de tipo, unidad o seguimiento de inventario obligan a actualizar el borrador. Los cambios posteriores de nombre o precio no reescriben el snapshot ni el precio pactado.

## I. Líneas, dinero, descuentos e impuestos

Una línea acepta `productId`, `quantity` y, opcionalmente, `unitPrice`, `discountRate`, `taxRate`. Cantidades, precios y tasas se envían como **texto decimal**, nunca como números flotantes JSON.

La línea persiste referencia de producto/servicio y snapshot de `name`, `sku`, `type`, `unit`, `trackInventory`. También persiste cantidad, precio, porcentajes aplicados y resultados calculados. No copia descripción, código de barras, notas u otros campos ajenos al historial requerido. La consulta devuelve snapshots, sin poblar nombres o precios actuales. El snapshot de entidad conserva únicamente su nombre y referencia, sin copiar contactos ni datos fiscales.

La unidad proviene del catálogo; no se convierte. Si se omite precio, `SALE` toma el precio y `PURCHASE` toma el costo vigente del catálogo durante la preparación del borrador. Si no existe, se requiere un precio explícito; no se inventa cero. Se permite negociar un precio explícito no negativo, incluido cero. Si el catálogo define otra moneda, la operación se rechaza hasta que exista una política explícita de conversión.

Se reutilizan las validaciones de cantidades de Inventario: positivas, hasta cuatro decimales y máximo 100000000 unidades. `SERVICE` conserva la prohibición de barcode y seguimiento de inventario. Referencias inexistentes, inactivas o eliminadas no permiten crear/actualizar/confirmar.

`shared/utils/money.js` centraliza la normalización anterior de Productos y los cálculos. Productos conserva su exportación `money` y el mismo formato y mensaje de validación; precio y costo utilizan la misma función.

Reglas exactas:

1. Los importes se convierten a enteros `BigInt` con escala 10000; la salida y persistencia son cadenas con cuatro decimales.
2. `subtotal = cantidad × precio unitario`, redondeado a cuatro decimales con **HALF_UP**.
3. `discount = subtotal × discountRate / 100`, redondeado con la misma regla.
4. `tax = (subtotal − discount) × taxRate / 100`, redondeado con la misma regla.
5. `total = subtotal − discount + tax`.
6. El encabezado suma los resultados ya redondeados de las líneas. No recalcula impuestos sobre un agregado distinto.

Porcentajes entre 0 y 100, con hasta cuatro decimales. Omitirlos equivale a cero; no hay una tasa fiscal fija ni inferencia por país. Es una base de un impuesto porcentual no compuesto y un descuento porcentual por línea. La arquitectura previa no necesita descuentos globales; `discount` del encabezado es la suma de descuentos de línea. Múltiples impuestos, retenciones, descuentos globales, cambio de moneda y políticas fiscales siguen pendientes.

Se rechazan importes negativos, cantidades cero/negativas, formatos exponenciales, precisión excedida y desbordamientos, tanto en resultados por línea como en sumas del documento. El límite monetario sigue siendo 999999999999.9999. No se usa `parseFloat`, `toFixed` ni aritmética monetaria binaria.

## J. Contrato preparado para Inventario

`inventory.contract.js` produce **descriptores puros**, no movimientos:

- Confirmación de `SALE`: propuesta `EXIT` para líneas de producto con seguimiento.
- Confirmación de `PURCHASE`: propuesta `ENTRY` para esas líneas.
- Cancelación de borrador: ninguna propuesta.
- Cancelación de confirmado: dirección inversa y `requiresOriginalMovement: true`.

Cada descriptor identifica documento, línea, producto, cantidad, acción y clave de idempotencia determinista. Servicios y productos sin seguimiento no generan propuestas.

**No existe todavía un adaptador ejecutor.** Si la operación requiere alguna propuesta, `requireImplemented` devuelve 409 antes de cambiar el estado. Por tanto, actualmente se pueden confirmar documentos que no requieren stock; los documentos con stock permanecen en borrador hasta integrar el adaptador. Una cancelación de confirmado con stock tampoco puede ejecutarse silenciosamente.

El futuro módulo debe decidir almacenes y momento de recepción/entrega, obtener referencias a movimientos originales en cancelaciones, validar permisos de inventario, aplicar movimientos y registrar recibos junto con documento y auditoría en **una misma transacción**. No debe llamar al actual `inventory.service.move` dentro de esta transacción: ese método abre su propia sesión. Será necesario un adaptador explícito que comparta la sesión y reutilice las operaciones existentes del repositorio de inventario, con idempotencia y pruebas de reversión.

No se modificaron los flujos de inventario. Su único cambio es exportar el validador de objetos ya existente para reutilizarlo en documentos y auditoría.

## K. RBAC

Se agregan únicamente cinco permisos al catálogo central:

`commercial.read`, `commercial.create`, `commercial.update`, `commercial.confirm`, `commercial.cancel`.

Se conserva la política existente: superadmin y el fallback de admin cubren el catálogo; los roles persistidos continúan usando sus asignaciones vigentes y no se migran automáticamente. Los roles manager, sales, purchasing, warehouse, finance, hr, auditor y user no reciben nuevos permisos por defecto. Un rol configurable puede asignar cada permiso por separado mediante la administración ya existente.

Lectura resuelve RBAC persistido y compara `sessionVersion`. Escrituras reutilizan la comprobación dentro de `administration.transaction`, con bloqueo de usuario/rol; los permisos suministrados por el llamador no conceden acceso. No hay endpoints utilitarios públicos de contador, cálculo o auditoría.

## L. Auditoría reutilizada

Se completa el modelo existente `audit` y su colección existente `audits`, sin un segundo sistema. Cada evento guarda `actorId`, `action`, `module`, `entity`, `entityId`, `result` y timestamps.

Las acciones son `create`, `update`, `confirm`, `cancel`. Para esta fase, módulo y entidad están acotados a `commercial` y `CommercialDocument`. Los resultados admiten `success`/`failure`; los flujos comerciales actuales registran éxito en la misma transacción de negocio. No hay un canal durable separado para auditar intentos fallidos: un fallo revierte el evento junto con la operación.

No se aceptan payloads, mensajes libres, contraseñas, JWT, API keys, tokens, connection strings ni campos arbitrarios. Identificadores y enums se validan; las operaciones de actualización y eliminación del modelo están bloqueadas. Esto es auditoría de aplicación, no almacenamiento externo inviolable frente a administradores de base de datos.

## M. Transacciones y preparación de almacenamiento

Escrituras usan el helper de autorización transaccional existente. Documento, contador cuando corresponde y auditoría comparten sesión. Lecturas no agregan transacciones innecesarias. Los bloqueos de referencias activas coordinan cambios de catálogo y entidades con preparación/confirmación. La revisión y actualización del estado ocurren bajo el bloqueo del documento y una escritura condicional por estado.

Antes de habilitar un futuro consumidor comercial en un entorno conectado, ejecutar una vez tras conectar Mongoose:

```js
await require('./modules/commercial/commercial.setup')();
```

La función crea explícitamente colecciones e índices de `CommercialCounter`, `CommercialDocument` y `audit`, incluso cuando la creación automática de índices está desactivada. Debe ejecutarse fuera de transacciones, antes de recibir tráfico. No se añadió al arranque actual porque esta fase no expone un consumidor comercial. No se ejecutó contra Atlas ni contra producción.

Se requiere una topología MongoDB compatible con transacciones, como replica set. No se modifica la configuración actual de conexión, Render, Resend ni variables de entorno. **No se ha demostrado concurrencia real, rollback ni recuperación tras reinicio contra Atlas/replica set**. Las pruebas aíslan almacenamiento y simulan concurrencia, reinicio de módulo y rollback; no sustituyen esa integración pendiente.

## C–D. Archivos

Existentes modificados exclusivamente para Fase 2:

- `apps/backend/src/modules/audit/audit.model.js`
- `apps/backend/src/modules/audit/audit.repository.js`
- `apps/backend/src/modules/audit/audit.service.js`
- `apps/backend/src/modules/inventory/inventory.validation.js`
- `apps/backend/src/modules/products/products.validation.js`
- `apps/backend/src/security/rbac.js`

Nuevos:

- `apps/backend/src/modules/commercial/commercial.model.js`
- `apps/backend/src/modules/commercial/commercial.repository.js`
- `apps/backend/src/modules/commercial/commercial.service.js`
- `apps/backend/src/modules/commercial/commercial.setup.js`
- `apps/backend/src/modules/commercial/commercial.validation.js`
- `apps/backend/src/modules/commercial/inventory.contract.js`
- `apps/backend/src/modules/commercial/numbering.js`
- `apps/backend/src/shared/utils/money.js`
- `apps/backend/tests/commercial.foundation.test.js`
- `apps/backend/tests/commercial.money.test.js`
- `apps/backend/tests/commercial.persistence.test.js`
- `docs/FASE-2-BASE-COMERCIAL.md`

No se modificaron frontend, rutas, controladores de negocio actuales, dependencias ni configuración de correo.

## N–U. Pruebas y validación

| Verificación | Resultado |
| --- | --- |
| Backend completo: `npm.cmd test` | **827 passing / 0 failing** |
| Pruebas nuevas backend | **122**, en los tres archivos comerciales |
| Frontend completo: `npm.cmd test` | **236 passing / 0 failing / 9 TODO existentes**; 29 suites correctas |
| Total de pruebas ejecutadas correctamente | **1063 passing**, más 9 TODO existentes |
| Build: `npm.cmd run build:web` | `Web build: SUCCESS` |
| ESLint inicial | 823 errores / 103 advertencias |
| ESLint final: `npm.cmd run lint` | 823 errores / 98 advertencias, salida 1 |
| Nuevos problemas de lint atribuibles a esta fase | **0 errores y 0 advertencias**, comparando mensajes/reglas de los seis archivos editados con HEAD y revisando los once JS nuevos |
| `node --check` | Correcto en los 17 JS nuevos/modificados de Fase 2 |
| `git diff --check` | Correcto |

La suite completa incluye Clientes, Proveedores, Productos/Servicios, Inventario, Autenticación, RBAC, recuperación de contraseña, configuración de proxy y las pruebas locales existentes de bienvenida. Las nuevas pruebas no conectan servicios externos. No se prueban credenciales ni envío real por Resend.

Cobertura nueva: dinero exacto, cantidades decimales, cero, redondeo, descuentos/impuestos, desbordamiento; numeración por tipo, 100 llamadas concurrentes simuladas, recarga de módulo conservando almacenamiento simulado, unicidad declarada y duplicados; estados válidos/inválidos; snapshots y precios históricos; referencias ausentes/inactivas/eliminadas; validación de entradas protegidas; permisos por acción, revocación y roles inactivos; auditoría mínima sin secretos, inmutabilidad y rollback simulado; descriptores de inventario y bloqueo de ejecución pendiente; inicialización de índices.

El primer pase de desarrollo detectó que el validador de objetos de Inventario era interno y no estaba exportado; se corrigió mediante una exportación aditiva y las suites completas posteriores pasan. No se retiraron ni desactivaron pruebas. No se agregaron `.skip`, `.only`, `xit`, `xdescribe` ni aserciones vacías para obtener resultados verdes.

El build inicial encontró la restricción de acceso de esbuild en el sandbox; se repitió con autorización fuera de este y terminó correctamente, sin modificar el script. Los errores de lint heredados no se ocultaron ni se desactivaron reglas. La reducción de cinco advertencias proviene de reemplazar métodos vacíos de auditoría que tenían parámetros sin uso.

Logs locales ignorados por Git: `apps/backend/phase2-backend.log`, `apps/frontend/phase2-frontend.log`, `apps/frontend/phase2-build.log`, `phase2-eslint-before.log`, `phase2-eslint-after.log`.

## E. Pendientes de las siguientes fases

- APIs y pantallas reales de Ventas, Compras y Finanzas; validaciones específicas de esos módulos.
- Decisión sobre recepción, entrega, almacenes, permisos adicionales de stock e idempotencia de solicitudes completas.
- Adaptador transaccional de inventario, recibos de movimientos y reversión controlada de cancelaciones.
- Integración real contra replica set/Atlas: contención entre procesos, reintentos, primer contador concurrente, rollback, reinicio y fallos de commit.
- Inicialización de colecciones e índices en el despliegue donde se habiliten consumidores comerciales.
- Reglas fiscales, conversiones monetarias, impuestos múltiples/compuestos, descuentos globales y redondeo legal si posteriormente se requieren.
- Dashboard con datos reales, contabilidad, cartera, pagos y reportes.

## V–W. Git y preservación

`HEAD` y `origin/main` permanecen en `4d352c0d291d5ead277cf74c343a651e914ca4d5`. Se ejecutaron status, diff de nombres, estadísticas, chequeo de espacios y comprobación del índice. El staging permanece vacío: no hubo `git add`, commit ni push.

Git muestra seis archivos existentes de Fase 2 modificados y los archivos nuevos anteriores, además de estos cambios previos que **no pertenecen a Fase 2**:

- `apps/backend/src/modules/auth/auth.service.js`
- `apps/backend/tests/auth.bootstrap.test.js`
- `apps/frontend/android/`, sin seguimiento.

Los hashes SHA-256 de los dos archivos de bienvenida coinciden antes y después. Android no se modificó, agregó ni eliminó. No se modificaron `.env`, credenciales, API keys o secretos. Los ejemplos y datos de pruebas son ficticios. El diff de archivos rastreados incluye los cambios locales previos y no debe interpretarse como una selección de commit: una futura preparación del staging deberá seleccionar explícitamente los archivos de Fase 2.
