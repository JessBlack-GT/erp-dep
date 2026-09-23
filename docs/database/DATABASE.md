# ============================================
# ERP-SYSTEM - Documentación de Base de Datos
# ============================================

## Configuración de MongoDB Atlas

### Conexión

La conexión a MongoDB Atlas se configura en `apps/backend/src/config/database.js`.

La cadena de conexión se lee desde la variable de entorno `MONGODB_URI`.

**NUNCA** incluya credenciales en el código fuente.

```javascript
// Archivo .env
MONGODB_URI=mongodb+srv://<usuario>:<contraseña>@cluster0.xxxxx.mongodb.net/erp-db?retryWrites=true&w=majority
MONGODB_DB_NAME=erp-db
```

### Configuración de Pool

- **Max Pool Size**: 50 conexiones
- **Min Pool Size**: 10 conexiones
- **Server Selection Timeout**: 5000ms
- **Socket Timeout**: 45000ms
- **Connect Timeout**: 10000ms
- **Retry Writes**: true
- **Write Concern**: majority

## Colecciones Previstas

### Módulo M01 - Seguridad

#### users
- **Propósito**: Almacenar información de usuarios del sistema
- **Campos principales**: email, password (hash), firstName, lastName, role, status, permissions
- **Índices**: email (único), role, status
- **Relaciones**: referencia a roles, creadoPor/actualizadoPor (self-reference)

#### roles
- **Propósito**: Definir roles y permisos del sistema
- **Campos principales**: name, description, permissions, status, isSystem
- **Índices**: name (único), status
- **Relaciones**: user.role referencia a roles._id

### Módulo M03 - Clientes

#### customers
- **Propósito**: Administrar clientes de la empresa
- **Campos principales**: name, email, phone, address, type, status
- **Relaciones**: referencias a sales, purchases

### Módulo M04 - Proveedores

#### suppliers
- **Propósito**: Administrar proveedores
- **Campos principales**: name, email, phone, address, category, status
- **Relaciones**: referencias a purchases

### Módulo M05 - Productos

#### products
- **Propósito**: Catálogo de productos y servicios
- **Campos principales**: name, description, price, category, sku, stock, status
- **Relaciones**: referencia a categories, inventory

#### categories
- **Propósito**: Categorías de productos
- **Campos principales**: name, description, parent, status

### Módulo M06 - Inventario

#### warehouses
- **Propósito**: Almacenes de la empresa
- **Campos principales**: name, location, capacity, status

#### inventoryBalances
- **Propósito**: Stock actual por producto/almacén
- **Campos principales**: productId, warehouseId, quantity, reserved, available
- **Relaciones**: productos, almacenes

#### inventoryMovements
- **Propósito**: Registro de movimientos de inventario
- **Campos principales**: productId, warehouseId, type, quantity, reference, date
- **Relaciones**: productos, almacenes, ventas, compras

### Módulo M07 - Ventas

#### sales
- **Propósito**: Registro de ventas realizadas
- **Campos principales**: customerId, items[], total, status, paymentMethod, dates
- **Relaciones**: clientes, inventario

### Módulo M08 - Compras

#### purchaseOrders
- **Propósito**: Órdenes de compra a proveedores
- **Campos principales**: supplierId, items[], total, status, dates
- **Relaciones**: proveedores, inventario

### Módulo M09 - Finanzas

#### expenses
- **Propósito**: Gastos de la empresa
- **Campos principales**: category, amount, description, date, paymentMethod, status
- **Relaciones**: categorías de gastos

### Módulo M10 - Recursos Humanos

#### employees
- **Propósito**: Información laboral autorizada
- **Campos principales**: name, document, position, department, hireDate, salary, status
- **Relaciones**: departamentos, roles

### Módulo M11 - Reportes

#### reports
- **Propósito**: Generación y almacenamiento de reportes
- **Campos principales**: type, parameters, data, generatedAt, generatedBy

### Módulo M12 - Notificaciones

#### notifications
- **Propósito**: Alertas y actividades pendientes
- **Campos principales**: userId, type, message, read, createdAt, metadata

### Módulo M13 - Auditoría

#### auditLogs
- **Propósito**: Registro de acciones relevantes del sistema
- **Campos principales**: userId, action, entity, entityId, oldValues, newValues, ip, timestamp
- **Índices**: userId, timestamp, action

### Módulo M14 - Configuración

#### companySettings
- **Propósito**: Parámetros generales de la empresa
- **Campos principales**: companyName, logo, taxRate, currency, timezone, address

#### numberSequences
- **Propósito**: Secuencias numéricas para documentos
- **Campos principales**: prefix, lastNumber, year, entityType

## Relaciones entre Colecciones

```
users ──┬──> roles (referencia a roles._id)
        ├──> sales (creador de ventas)
        ├──> purchases (creador de compras)
        ├──> auditLogs (usuario que realizó acción)
        └──> employees (información laboral)

roles ──┬──> users (rol asignado)
        └──> permissions (permisos del rol)

customers ──┬──> sales (compras del cliente)
            └──> notifications (notificaciones al cliente)

suppliers ──┬──> purchaseOrders (compras al proveedor)
            └──> notifications (notificaciones al proveedor)

products ──┬──> inventoryBalances (stock)
           ├──> inventoryMovements (movimientos)
           └──> sales (items de venta)

sales ──┬──> customers (cliente)
        └──> products (items vendidos)

purchaseOrders ──┬──> suppliers (proveedor)
                 └──> products (items de compra)
```

## Criterios de Indexación

- **Campos de búsqueda frecuente**: email, name, code
- **Campos de filtrado**: status, role, dates, category
- **Campos de ordenamiento**: createdAt, updatedAt
- **Campos únicos**: email, username, sku

## Reglas de Integridad

1. **Usuarios**: Cada usuario debe tener un rol válido
2. **Clientes**: Una venta debe referenciar un cliente existente
3. **Inventario**: Los movimientos deben mantener la coherencia del stock
4. **Auditoría**: Toda acción relevante debe registrarse
5. **Soft Delete**: Los registros no se eliminan físicamente, se marca como deleted

## Decisiones Pendientes

- [ ] Definir si se usará referencias (ObjectId) o embeddings para todas las relaciones
- [ ] Determinar la estrategia de sharding para MongoDB Atlas si el volumen crece
- [ ] Definir políticas de TTL para datos de auditoría antiguos
- [ ] Decidir entre GridFS para almacenar archivos o un servicio externo
- [ ] Planificar replica sets y read preference para rendimiento
