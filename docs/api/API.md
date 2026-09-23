# ============================================
# ERP-SYSTEM - Documentación de API
# ============================================

## Convenciones de Rutas

- **Versión**: Todas las rutas usan `/api/v1`
- **Base URL**: `http://localhost:3000/api/v1`
- **Formato de recursos**: Plural, snake_case (ej: `/api/v1/customers`)
- **Identificadores**: `:id` en rutas parametrizadas (ej: `/api/v1/customers/:id`)

## Métodos HTTP

| Método | Acción | Ejemplo |
|--------|--------|---------|
| GET | Obtener lista o detalle | `GET /api/v1/customers` |
| POST | Crear nuevo recurso | `POST /api/v1/customers` |
| PUT | Reemplazar recurso | `PUT /api/v1/customers/:id` |
| PATCH | Actualizar parcialmente | `PATCH /api/v1/customers/:id` |
| DELETE | Eliminar recurso | `DELETE /api/v1/customers/:id` |

## Formato de Respuestas

### Respuesta Exitosa

```json
{
  "success": true,
  "data": { ... },
  "message": "Operación exitosa",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Respuesta con Paginación

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Respuesta de Error

```json
{
  "success": false,
  "error": "Mensaje de error",
  "message": "Descripción detallada",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/customers"
}
```

## Manejo de Errores

| Código | Significado | Ejemplo |
|--------|-------------|---------|
| 400 | Error de validación | Datos inválidos |
| 401 | No autenticado | Token faltante o inválido |
| 403 | Acceso prohibido | Sin permisos |
| 404 | Recurso no encontrado | ID no existe |
| 409 | Conflicto | Recurso ya existe |
| 429 | Demasiadas solicitudes | Rate limit |
| 500 | Error interno | Error del servidor |

## Autenticación

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "123", "email": "...", "role": "admin" }
  }
}
```

### Uso del Token

```http
Authorization: Bearer <accessToken>
```

El token se incluye en el header `Authorization` de cada petición protegida.

## Autorización

- **Roles**: `super_admin`, `admin`, `manager`, `user`, `viewer`
- **Permisos**: Array de strings en el payload del JWT
- **Middlewares**: `authorizeRoles(...roles)`, `authorizePermissions(...permissions)`

## Endpoints

### Autenticación

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/auth/login` | POST | Implementado | Iniciar sesión |
| `/api/v1/auth/register` | POST | Implementado | Registrar usuario |
| `/api/v1/auth/logout` | POST | Estructura | Cerrar sesión |
| `/api/v1/auth/me` | GET | Estructura | Perfil del usuario |
| `/api/v1/auth/refresh` | POST | Estructura | Refresh de token |

### Usuarios

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/users` | GET | Estructura | Listar usuarios |
| `/api/v1/users` | POST | Estructura | Crear usuario |
| `/api/v1/users/:id` | GET | Estructura | Obtener usuario |
| `/api/v1/users/:id` | PATCH | Estructura | Actualizar usuario |
| `/api/v1/users/:id` | DELETE | Estructura | Eliminar usuario |

### Clientes

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/customers` | GET | Estructura | Listar clientes |
| `/api/v1/customers` | POST | Estructura | Crear cliente |
| `/api/v1/customers/:id` | GET | Estructura | Obtener cliente |
| `/api/v1/customers/:id` | PATCH | Estructura | Actualizar cliente |
| `/api/v1/customers/:id` | DELETE | Estructura | Eliminar cliente |

### Proveedores

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/suppliers` | GET | Estructura | Listar proveedores |
| `/api/v1/suppliers` | POST | Estructura | Crear proveedor |
| `/api/v1/suppliers/:id` | GET | Estructura | Obtener proveedor |
| `/api/v1/suppliers/:id` | PATCH | Estructura | Actualizar proveedor |
| `/api/v1/suppliers/:id` | DELETE | Estructura | Eliminar proveedor |

### Productos

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/products` | GET | Estructura | Listar productos |
| `/api/v1/products` | POST | Estructura | Crear producto |
| `/api/v1/products/:id` | GET | Estructura | Obtener producto |
| `/api/v1/products/:id` | PATCH | Estructura | Actualizar producto |
| `/api/v1/products/:id` | DELETE | Estructura | Eliminar producto |

### Inventario

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/inventory/balances` | GET | Estructura | Consultar existencias |
| `/api/v1/inventory/movements` | POST | Estructura | Registrar movimiento |
| `/api/v1/inventory/movements` | GET | Estructura | Listar movimientos |

### Ventas

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/sales` | GET | Estructura | Listar ventas |
| `/api/v1/sales` | POST | Estructura | Crear venta |
| `/api/v1/sales/:id` | GET | Estructura | Obtener venta |
| `/api/v1/sales/:id` | PATCH | Estructura | Actualizar venta |
| `/api/v1/sales/:id` | DELETE | Estructura | Eliminar venta |

### Compras

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/purchases` | GET | Estructura | Listar compras |
| `/api/v1/purchases` | POST | Estructura | Crear compra |
| `/api/v1/purchases/:id` | GET | Estructura | Obtener compra |
| `/api/v1/purchases/:id` | PATCH | Estructura | Actualizar compra |
| `/api/v1/purchases/:id` | DELETE | Estructura | Eliminar compra |

### Finanzas

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/finance` | GET | Estructura | Listar registros |
| `/api/v1/finance` | POST | Estructura | Crear registro |

### Reportes

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/reports` | GET | Estructura | Listar reportes |
| `/api/v1/reports/generate/:type` | POST | Estructura | Generar reporte |

### Auditoría

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/audit` | GET | Estructura | Listar logs |

### Configuración

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/settings` | GET | Estructura | Obtener configuración |
| `/api/v1/settings` | PATCH | Estructura | Actualizar configuración |

### Dashboard

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/v1/dashboard` | GET | Estructura | Resumen general |

## Endpoints Implementados vs Documentados

| Estado | Cantidad |
|--------|----------|
| **Implementados** | Login y Register |
| **Estructura preparada** | Todos los demás endpoints |
| **Pendientes** | Funcionalidad de negocio completa |

## Endpoints de Salud

```http
GET /api/v1/health
```

**Respuesta:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```
