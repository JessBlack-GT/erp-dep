# ============================================
# ERP-SYSTEM - Documentación de Arquitectura
# ============================================

## Arquitectura General

El sistema ERP-SYSTEM utiliza una arquitectura de **monolito modular** con una separación clara entre capas.

### Visión General

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │  React Native Web / React Native                   │ │
│  │  ┌─────────┐ ┌─────────┐ ┌───────────────────┐   │ │
│  │  │Navegación│ │Componentes│ │ Features Módulos  │   │ │
│  │  │         │ │         │ │                  │   │ │
│  │  └─────────┘ └─────────┘ └───────────────────┘   │ │
│  └────────────────────────────────────────────────────┘ │
│                        │ HTTPS (API)                    │
└────────────────────────┼────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────┐
│                     BACKEND                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Express.js (Node.js)                              │ │
│  │  ┌─────────┐ ┌─────────┐ ┌───────────────────┐   │ │
│  │  │Rutas    │ │Middleware │ │ Módulos de Negocio│   │ │
│  │  │ v1      │ │Auth/Auto/ │ │ auth, users,     │   │ │
│  │  │         │ │Val/Error  │ │ customers, etc.  │   │ │
│  │  └─────────┘ └─────────┘ └───────────────────┘   │ │
│  └────────────────────────────────────────────────────┘ │
│                        │ MongoDB Atlas                   │
└────────────────────────┼────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────┐
│                   BASE DE DATOS                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  MongoDB Atlas                                     │ │
│  │  Colecciones: users, roles, customers, products... │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Responsabilidades de Cada Capa

#### Frontend (Apps/Frontend)
- **Navegación**: Gestión de rutas y pantallas
- **Componentes**: Interfaz de usuario reutilizable
- **Features**: Lógica de presentación de cada módulo
- **Servicios**: Cliente API centralizado
- **Contextos**: Gestión de estado global
- **Hooks**: Lógica reusable personalizada

#### Backend (Apps/Backend)
- **Routes**: Definen endpoints y middleware
- **Controllers**: Reciben solicitudes HTTP y construyen respuestas
- **Services**: Contienen reglas de negocio
- **Repositories**: Centralizan acceso a MongoDB
- **Models**: Definen esquemas de datos
- **Middleware**: Autenticación, autorización, validación, errores
- **Config**: Conexión BD, entorno, CORS

#### Capas de Datos
- **Models**: Esquemas Mongoose con validaciones
- **Repositories**: Patrón de acceso a datos
- **Config**: Conexión centralizada a MongoDB Atlas

### Organización de Módulos

Cada módulo del sistema (M01-M16) tiene su propia estructura dentro de `src/modules/`:

```
modules/{moduleName}/
├── {moduleName}.routes.js     # Endpoints HTTP
├── {moduleName}.controller.js # Lógica de petición/respuesta
├── {moduleName}.service.js    # Reglas de negocio
├── {moduleName}.model.js      # Esquema MongoDB
├── {moduleName}.repository.js # Acceso a datos
├── {moduleName}.validation.js # Validaciones (pendiente)
└── {moduleName}.test.js       # Pruebas
```

### Comunicación entre Frontend y Backend

1. **Frontend → Backend**: Solicitudes HTTP REST (axios)
2. **Autenticación**: JWT Bearer Token en header `Authorization`
3. **Formato de Respuesta**: JSON uniforme con `success`, `data`, `error`
4. **Versionado**: Todas las rutas bajo `/api/v1/`
5. **CORS**: Configurado para permitir solo orígenes autorizados

### Criterios de Separación de Responsabilidades

1. **Un solo responsabilidad por archivo**: Cada archivo tiene un propósito claro
2. **No concentrar lógica en controladores**: Los controladores solo orquestan
3. **Servicios independientes del HTTP**: Se pueden reutilizar sin Express
4. **Modelos independientes de servicios**: El esquema no conoce la lógica de negocio
5. **Repositorios sin lógica de negocio**: Solo acceso a datos
6. **Frontend no accede directamente a BD**: Toda comunicación pasa por la API
7. **Autenticación y autorización en el backend**: El frontend solo oculta UI

### Principios de Diseño

- **Monolito modular**: Módulos independientes dentro de una sola aplicación
- **Escalabilidad**: Preparado para evolucionar a microservicios
- **Seguridad**: Capas de protección desde la validación hasta el almacenamiento
- **Mantenibilidad**: Convenciones claras y documentadas
- **Testabilidad**: Cada capa se puede probar independientemente
