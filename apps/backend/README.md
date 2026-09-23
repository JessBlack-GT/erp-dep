# ============================================
# ERP-SYSTEM - README del Backend (Actualizado)
# ============================================

## Descripción

El backend de ERP-SYSTEM es una API REST construida con **Node.js** y **Express**.

## Módulos Implementados

| Módulo | Estado | Endpoints |
|--------|--------|-----------|
| **Auth (M01)** | ✅ Funcional | POST /auth/login, POST /auth/register, POST /auth/refresh, GET /auth/me, POST /auth/logout |
| **Users** | 📋 Estructura | GET/POST/GET/:id/PATCH/:id/DELETE /users |
| **Roles** | 📋 Estructura | CRUD completo preparado |
| **Customers (M03)** | ✅ Implementado | GET/POST/GET/:id/PATCH/:id/DELETE /customers, GET /customers/search, GET /customers/stats, PATCH /customers/:id/status |
| **Otros módulos** | 📋 Estructura | Preparados para desarrollo |

## Endpoints Funcionales

### Autenticación
```
POST   /api/v1/auth/register    # Registrar usuario
POST   /api/v1/auth/login       # Iniciar sesión
POST   /api/v1/auth/refresh     # Refresh de token
GET    /api/v1/auth/me          # Perfil del usuario
POST   /api/v1/auth/logout      # Cerrar sesión
```

### Clientes (M03) ✅
```
GET    /api/v1/customers        # Listar clientes (con paginación, búsqueda, filtros)
POST   /api/v1/customers        # Crear cliente
GET    /api/v1/customers/:id    # Obtener cliente por ID
PATCH  /api/v1/customers/:id    # Actualizar cliente
PATCH  /api/v1/customers/:id/status  # Cambiar estado
DELETE /api/v1/customers/:id    # Eliminar cliente (soft delete)
GET    /api/v1/customers/search # Buscar clientes
GET    /api/v1/customers/stats  # Estadísticas
```

## Instalación

```bash
cd apps/backend
npm install
cp ../../.env.example .env
# Editar .env con las credenciales
npm run dev
```

## Pruebas

```bash
npm test
```

## Estructura del Módulo Customer

```
src/modules/customers/
├── customers.model.js       # Esquema Mongoose con campos: name, email, phone, address, etc.
├── customers.repository.js  # Acceso a datos con CRUD y búsqueda
├── customers.service.js     # Lógica de negocio completa
├── customers.controller.js  # Endpoints implementados
├── customers.routes.js      # Rutas con autenticación
├── customers.validation.js  # Validaciones de entrada
└── customers.test.js        # Pruebas de validación y estructura
```
