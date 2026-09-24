# ============================================
# ERP-SYSTEM - Documentación de Módulos
# ============================================

## Tabla de Módulos

| ID  | Módulo                  | Responsabilidad                            | Estado       |
| --- | ----------------------- | ------------------------------------------ | ------------ |
| M01 | Usuarios y seguridad    | Usuarios, roles, permisos y autenticación. | Estructura completa |
| M02 | Panel principal         | Resumen general de las operaciones.        | Estructura preparada |
| M03 | Clientes                | Administración de clientes.                | APROBADO |
| M04 | Proveedores             | Administración de proveedores.             | APROBADO |
| M05 | Productos y servicios   | Catálogo de productos y servicios.         | APROBADO |
| M06 | Inventario              | Existencias y movimientos.                 | Estructura preparada |
| M07 | Ventas                  | Cotizaciones, pedidos y ventas.            | Estructura preparada |
| M08 | Compras                 | Solicitudes y órdenes de compra.           | Estructura preparada |
| M09 | Finanzas y gastos       | Registros financieros básicos.             | Estructura preparada |
| M10 | Recursos humanos        | Información laboral autorizada.            | Estructura preparada |
| M11 | Reportes y analítica    | Consultas e indicadores.                   | Estructura preparada |
| M12 | Notificaciones y tareas | Alertas y actividades pendientes.          | Estructura preparada |
| M13 | Auditoría               | Registro de acciones relevantes.           | Estructura preparada |
| M14 | Configuración           | Parámetros generales de la empresa.        | Estructura preparada |
| M15 | Inteligencia artificial | Funciones inteligentes futuras.            | Arquitectura contemplada |
| M16 | Integraciones           | Conexión con servicios externos.           | Arquitectura contemplada |

## Convenciones de Módulos

Cada módulo debe seguir la estructura estándar:

```
modules/{moduleName}/
├── {moduleName}.routes.js     # Endpoints HTTP
├── {moduleName}.controller.js # Recibe peticiones HTTP
├── {moduleName}.service.js    # Lógica de negocio
├── {moduleName}.model.js      # Esquema MongoDB
├── {moduleName}.repository.js # Acceso a datos
├── {moduleName}.validation.js # Validaciones (opcional)
└── {moduleName}.test.js       # Pruebas
```

## Flujo de Datos en un Módulo

```
Request HTTP
    │
    ▼
Routes (autenticación + autorización)
    │
    ▼
Controller (recibe, valida, delega)
    │
    ▼
Service (reglas de negocio)
    │
    ▼
Repository (acceso a datos)
    │
    ▼
Model (Mongoose schema)
    │
    ▼
MongoDB Atlas
```

## Convenciones de Nombres

- **Archivos**: snake_case (ej: `customers.routes.js`)
- **Funciones**: camelCase (ej: `getCustomers`)
- **Variables**: camelCase (ej: `customerList`)
- **Constantes**: UPPER_SNAKE_CASE (ej: `MAX_RETRIES`)
- **Clases**: PascalCase (ej: `CustomerService`)
- **Rutas**: plural snake_case (ej: `/api/v1/customers`)
- **Parámetros de ruta**: snake_case (ej: `:customerId`)

## Interacción entre Módulos

Los módulos NO deben comunicarse directamente entre sí. Toda la comunicación debe pasar por:
1. El backend (API REST)
2. El frontend (navegación)

Si un módulo necesita datos de otro:
- Se consulta a través de la API
- O se utiliza un evento/emisor

## Reglas para Desarrolladores de Módulos

1. **No modificar** archivos de otros módulos sin necesidad
2. **No crear** dependencias circulares
3. **Usar** el formato de respuesta estándar del API
4. **Documentar** cada endpoint con comentarios
5. **Escribir** pruebas para cada servicio
6. **Seguir** las convenciones de nombres
7. **No hardcodear** credenciales ni configuración
8. **Usar** el sistema de errores personalizados
9. **Incluir** la autorización en las rutas
10. **Validar** todos los datos de entrada
