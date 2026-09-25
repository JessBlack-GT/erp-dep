# M06 — Inventario

## Alcance y decisiones de arquitectura

El diseño anterior de `DATABASE.md` ya asignaba **warehouses**, **inventoryBalances** e **inventoryMovements** a M06, con relaciones producto/almacén. Se implementan esas tres colecciones. Se reutiliza el modelo Product de M05; no existe Product.stock ni una segunda colección de productos.

Las decisiones nuevas necesarias son: cuatro tipos de movimiento, precisión fija, transacciones, límites de stock, clave de idempotencia, auditoría, política de elegibilidad y permisos. Capacity y reserved pertenecían al diseño conceptual; quedan fuera de esta entrega porque no se implementan capacidad logística ni reservas. Por ahora available es exactamente quantity.

Capas: model → repository → service → controller → routes. La API pública conserva /api/v1/inventory. La UI usa inventoryService y el cliente Axios autenticado existentes, AuthContext, usePermissions y MainNavigator.

La recomendación general de módulos independientes se mantiene para sus flujos públicos. Hay una coordinación interna explícita y necesaria entre los repositorios de M05/M06: consultan el mismo catálogo y usan una sesión MongoDB para mantener elegibilidad e inventario coherentes. No se hace una llamada HTTP entre módulos dentro de una transacción, pues no compartiría su snapshot/bloqueo. No se duplican reglas ni se introduce una dependencia circular de servicios. M05 solo consulta la existencia de historial y no calcula stock.

## Modelo

- **Warehouse / warehouses**: code único, name, description, location, status active/inactive, createdBy/updatedBy y timestamps. Código inmutable después de crear; edición administrativa de nombre, descripción, ubicación y estado. Sin eliminación pública.
- **InventoryBalance / inventoryBalances**: productId + warehouseId con índice compuesto único, quantityUnits entero escalado, createdAt/updatedAt. La API convierte quantityUnits en quantity y available como texto decimal y no expone el entero interno.
- **InventoryMovement / inventoryMovements**: productId, type, quantityUnits, sourceWarehouseId/destinationWarehouseId según operación, reason obligatorio, reference, notes, createdBy, createdAt, idempotencyKey y requestHash privado. Índices para producto, origen, destino y tiempo; índice único actor + idempotencyKey.

El balance es la materialización de stock actual. El historial inmutable es su explicación auditable y fuente para reconciliarlo. Ambos se escriben juntos. No hay endpoint para establecer arbitrariamente un saldo.

Solo se aceptan productos activos, type=PRODUCT y trackInventory=true. SERVICE, productos no inventariables, inactivos y eliminados se rechazan. El selector elegible se filtra en backend y nuevamente en UI; solo devuelve campos necesarios del catálogo, sin precio/costo.

## Movimientos y precisión

| Tipo | Efecto | Almacenes |
|---|---|---|
| ENTRY | suma cantidad positiva | destinationWarehouseId |
| EXIT | resta cantidad positiva | sourceWarehouseId |
| TRANSFER | resta origen y suma destino en una operación | ambos, distintos |
| ADJUSTMENT | aplica delta firmado distinto de cero | destino para positivo, origen para negativo |

Todas las operaciones requieren reason. Reference queda disponible para futuras referencias comerciales; no dispara Compras/Ventas. El actor se toma de la identidad autenticada resuelta por RBAC; no se acepta desde el cuerpo.

Cantidades HTTP como cadenas decimales, hasta cuatro decimales: por ejemplo "0.1" retorna "0.1000". Se convierten con BigInt y se almacenan como enteros Number exactos de unidades 1/10000. Magnitud máxima por movimiento y saldo: **100000000.0000**, equivalente a 10^12 unidades. Las sumas y límites permanecen muy por debajo de Number.MAX_SAFE_INTEGER. No hay redondeo silencioso. Se rechazan números JSON, exponentes, NaN, Infinity, cero, precisión excesiva y negativos fuera de ajustes.

No se permite stock negativo. Falta de saldo y desbordamiento son conflictos de dominio **409**. Las actualizaciones usan condiciones quantityUnits >= débito y quantityUnits <= máximo - crédito.

## Atomicidad, concurrencia y catálogo

Cada movimiento corre en withTransaction, snapshot, primary y writeConcern majority. Producto y almacenes se bloquean mediante incremento de su versión interna __v, sin alterar timestamps comerciales. Esto coordina cambios simultáneos de elegibilidad/estado y movimientos. Luego se crea si falta un balance cero, se actualiza con condición atómica, y se inserta el movimiento. Transferencia completa y registro se confirman o revierten juntos. Un fallo de inserción del historial revierte ambos balances.

El driver reintenta conflictos transitorios. Un máximo de tres intentos externos resuelve duplicados de creación inicial/idempotencia. El bloqueo por producto serializa operaciones del mismo producto incluso entre almacenes; es una decisión conservadora de consistencia para M06, susceptible de optimización con mediciones futuras.

M05 usa una transacción al intentar convertir a SERVICE o desactivar trackInventory, adquiriendo el mismo bloqueo de Product antes de consultar historial. Si el cambio retiraría elegibilidad de un producto con movimientos, devuelve 409, incluso con saldo cero. Esto conserva la identidad de los registros históricos. Una carrera entrada/conversión tiene una sola operación válida: entrada aplicada y conversión rechazada, o conversión aplicada y entrada rechazada.

Desactivar un producto/almacén impide movimientos posteriores; los saldos e historial siguen consultables. Reactivarlo permite operar nuevamente. No se añade un proceso de cierre/baja contable. Cambiar nombres/unidad del catálogo no reescribe cantidades históricas; no se implementan conversiones de unidades y deben gestionarse como decisiones maestras del catálogo.

Movimientos aplicados no tienen PATCH, PUT ni DELETE. Hooks del modelo rechazan actualizaciones y borrados ordinarios. Un administrador de DB con acceso directo conserva capacidad técnica de alterar datos: no se pretende sustituir control de acceso de Atlas. Los runners QA usan acceso a colección únicamente para limpiar sus documentos exactos, fuera de la API pública.

## Idempotencia y auditoría

Cada POST exige idempotencyKey de 8–100 caracteres alfanuméricos, guion o guion bajo. Unicidad por actor. La huella SHA-256 se calcula sobre payload normalizado. Repetir misma clave/mismo payload devuelve el movimiento original con 200 y replayed=true, sin stock adicional. Reutilizar clave con otro payload devuelve 409. Un movimiento nuevo devuelve 201.

La UI conserva la clave al reintentar errores de red con el mismo payload; editar datos implica otra operación. Futuras integraciones deben usar un actor de integración estable y una clave estable por documento/operación. Reference por sí sola no es una restricción única. No se eliminan claves ni movimientos mediante la API.

Fecha/usuario/tipo/cantidad/origen/destino/motivo quedan en el historial. Ajustar crea otro movimiento; no modifica el original. El usuario no puede proporcionar createdBy, timestamps, quantityUnits, saldos o requestHash.

## API y errores

| Método/ruta bajo /api/v1/inventory | Permiso | Éxito |
|---|---|---|
| GET /warehouses | inventory.read | 200 |
| POST /warehouses | inventory.warehouse.manage | 201 |
| PATCH /warehouses/:id | inventory.warehouse.manage | 200 |
| GET /products | inventory.read | 200 |
| GET /balances | inventory.read | 200 |
| GET /balances/product/:id | inventory.read | 200 |
| GET /movements | inventory.read | 200 |
| POST /movements, type=ENTRY | inventory.entry | 201/200 replay |
| POST /movements, type=EXIT | inventory.exit | 201/200 replay |
| POST /movements, type=TRANSFER | inventory.transfer | 201/200 replay |
| POST /movements, type=ADJUSTMENT | inventory.adjust | 201/200 replay |

Listas: page=1, limit=20, máximo 100; orden createdAt descendente y _id como desempate. Devuelven success, data y pagination con page/limit/total/pages. Saldos inexistentes no generan filas: un par sin movimientos tiene stock cero.

Filtros: almacenes search/status; productos elegibles search; balances productId/warehouseId/search por nombre o SKU; movimientos productId/warehouseId/type/search/from/to. Fechas UTC ISO con segundos, milisegundos opcionales, rango inclusivo. Se rechazan fechas de calendario inválidas, campos desconocidos y IDs malformados; búsquedas literales escapadas.

Errores: 400 datos/dominio inválidos, 401 sin token/token inválido/identidad inválida, 403 permiso insuficiente, 404 referencia inexistente o ruta de mutación no implementada, 409 duplicado/stock/límite/idempotencia/cambio de catálogo incompatible, 500 genérico sin detalles internos. La política central puede devolver 503 si no puede consultar autorización.

## RBAC

| Rol | Read | Entry | Exit | Transfer | Adjust | Warehouse manage |
|---|---|---|---|---|---|---|
| superadmin | Sí | Sí | Sí | Sí | Sí | Sí |
| admin | Sí | Sí | Sí | Sí | Sí | Sí |
| manager | Sí | Sí | Sí | Sí | Sí | Sí |
| sales | Sí | No | No | No | No | No |
| purchasing | Sí | Sí | No | No | No | No |
| warehouse | Sí | Sí | Sí | Sí | Sí | Sí |
| finance | Sí | No | No | No | No | No |
| hr | No | No | No | No | No | No |
| auditor | Sí | No | No | No | No | No |
| user | No | No | No | No | No | No |

La matriz de cinco operaciones procede del requerimiento M06. Warehouse manage se concede a superadmin/admin/manager/warehouse como decisión inicial explícita. Se amplía el catálogo central; no se crean roles nuevos. Documentos Role persistidos conservan prioridad y no se migran automáticamente. Token claims y permisos legacy enviados por usuario no sustituyen la política persistida.

## Frontend

InventoryScreen reúne Existencias e Historial con búsqueda, almacén, tipo, fechas, paginación, carga/vacío/error/reintento. InventoryMovementForm reúne cuatro operaciones, selecciona productos elegibles y almacenes activos con búsqueda/paginación, exige motivo, muestra resumen y confirmación y conserva idempotencia al reintentar. Transferencia es un único POST. WarehouseForm registra almacenes; edición de almacenes está disponible por API.

Se integran tres rutas en MainNavigator. Acciones según permisos efectivos; backend sigue siendo autoridad. Componentes React Native compatibles con web. Android/iOS nativo continúa pendiente y no se acredita por el build web.

## QA y extensiones futuras

Ver [validación M06](../qa/M06-VALIDATION.md) y [resultados](../qa/M06-results.json). Pruebas aisladas separadas de API/Atlas y E2E. La reconciliación se realiza antes de limpiar por IDs + marcador QA_M06 + actor. Los runners exigen la base QA autorizada mediante el preflight existente; jamás borran globalmente colecciones o bases.

Fuera de alcance: compras, ventas, facturación, devoluciones comerciales, lotes, series, caducidad, picking/packing, reservas, FIFO/LIFO, costo promedio avanzado, forecasting y reabastecimiento. Tampoco hay multiempresa, conversión automática de unidades ni administración pública de roles. No se inicia M07.

