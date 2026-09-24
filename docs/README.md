# ============================================
# ERP-SYSTEM - Documentación Principal
# ============================================

## Qué es ERP-SYSTEM

**ERP-SYSTEM** es un sistema empresarial de planificación de recursos (ERP) diseñado para centralizar las operaciones de una organización mediante módulos conectados entre sí.

### Objetivo General

Proporcionar una plataforma integrada que permita administrar información empresarial, usuarios, clientes, proveedores, productos, inventario, ventas, compras, finanzas y reportes de manera centralizada, segura y escalable.

### Tecnologías Utilizadas

| Capa | Tecnología | Versión Mínima |
|------|-----------|----------------|
| Aplicación Web | React Native Web | 0.19.x |
| Aplicación Móvil | React Native | 0.72.x |
| Backend | Node.js | 18.x |
| Framework Backend | Express | 4.18.x |
| Base de Datos | MongoDB Atlas | 6.x |
| Funciones Nativas Android | Kotlin | 1.8+ |
| Control de Versiones | Git | 2.40+ |

### Arquitectura

El sistema sigue una arquitectura de **monolito modular**:

```
ERP-SYSTEM/
├── apps/
│   ├── frontend/       # Aplicación web y móvil (React Native)
│   └── backend/        # API REST (Node.js + Express)
├── mobile-native/      # Código nativo Android (Kotlin)
├── docs/               # Documentación completa
├── scripts/            # Scripts de utilidad
├── .gitignore
├── package.json        # Configuración raíz
└── .env.example        # Plantilla de variables de entorno
```

### Estructura de Carpetas del Backend

```
apps/backend/src/
├── app.js              # Aplicación Express principal
├── server.js           # Punto de entrada del servidor
├── config/             # Configuración (BD, entorno, CORS)
├── middleware/         # Autenticación, autorización, validación
├── shared/             # Constantes, errores, utilidades, validadores
├── modules/            # Módulos de negocio
│   ├── auth/           # Autenticación y seguridad
│   ├── users/          # Gestión de usuarios
│   ├── roles/          # Gestión de roles y permisos
│   ├── customers/      # Clientes
│   ├── suppliers/      # Proveedores
│   ├── products/       # Productos y servicios
│   ├── inventory/      # Inventario
│   ├── sales/          # Ventas
│   ├── purchases/      # Compras
│   ├── finance/        # Finanzas
│   ├── human-resources/# Recursos humanos
│   ├── reports/        # Reportes
│   ├── notifications/  # Notificaciones
│   ├── audit/          # Auditoría
│   ├── settings/       # Configuración
│   └── integrations/   # Integraciones externas
├── routes/             # Rutas principales de la API
└── tests/              # Pruebas del backend
```

### Estructura de Carpetas del Frontend

```
apps/frontend/src/
├── app/                # Aplicación principal
│   ├── App.js          # Punto de entrada
│   ├── navigation/     # Navegación
│   └── providers/      # Proveedores de contexto
├── assets/             # Imágenes, iconos, fuentes
├── components/         # Componentes reutilizables
│   ├── common/         # Botones, inputs, tarjetas
│   ├── forms/          # Formularios especializados
│   ├── tables/         # Tablas de datos
│   ├── modals/         # Modales
│   ├── feedback/       # Carga, errores, vacío
│   └── layout/         # Layout de la aplicación
├── features/           # Módulos funcionales
│   ├── auth/           # Login, registro
│   ├── dashboard/      # Panel principal
│   ├── customers/      # Clientes
│   ├── suppliers/      # Proveedores
│   ├── products/       # Productos
│   ├── inventory/      # Inventario
│   ├── sales/          # Ventas
│   ├── purchases/      # Compras
│   ├── finance/        # Finanzas
│   ├── human-resources/# RRHH
│   ├── reports/        # Reportes
│   ├── notifications/  # Notificaciones
│   └── settings/       # Configuración
├── services/           # Cliente API centralizado
├── hooks/              # Hooks personalizados
├── context/            # Contextos React
├── navigation/         # Navegación de módulos
├── utils/              # Utilidades
├── constants/          # Constantes de la app
└── theme/              # Tema y estilos
```

### Requisitos de Instalación

1. **Node.js** >= 18.0.0
2. **npm** >= 9.0.0
3. **MongoDB Atlas** - Cuenta en https://www.mongodb.com/atlas
4. **Git** >= 2.40

### Instalación de Dependencias

```bash
# Instalar dependencias del proyecto raíz
cd ERP-SYSTEM
npm install

# Instalar dependencias del backend
cd apps/backend
npm install

# Instalar dependencias del frontend
cd apps/frontend
npm install
```

### Configuración de Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cd ERP-SYSTEM
cp .env.example .env

# Editar el archivo .env con sus credenciales
# Editar cada archivo .env en apps/backend/ si es necesario
```

Variables requeridas en `.env`:
- `MONGODB_URI` - Cadena de conexión a MongoDB Atlas
- `JWT_SECRET` - Secreto para tokens JWT
- `JWT_REFRESH_SECRET` - Secreto para tokens de refresh

### Cómo Iniciar el Backend

```bash
cd apps/backend

# Modo desarrollo
npm run dev

# Modo producción
npm start
```

El backend estará disponible en `http://localhost:3000`.

La API está disponible en `http://localhost:3000/api/v1`.

### Cómo Iniciar el Frontend

```bash
cd apps/frontend

# Para desarrollo web
npm run web

# Para Android
npm run android

# Para iOS
npm run ios
```

### Cómo Ejecutar las Pruebas

```bash
# Pruebas del backend
cd apps/backend
npm test

# Pruebas del frontend
cd apps/frontend
npm test
```

### Estado Actual del Proyecto

**Fase: Estructura inicial del sistema.**

- ✅ Estructura de carpetas creada
- ✅ Configuración de backend y frontend preparada
- ✅ Middleware de autenticación y autorización estructurado
- ✅ Configuración de MongoDB Atlas preparada
- ✅ Cliente API centralizado del frontend
- ✅ Documentación inicial completa
- 🔄 Módulos de negocio: estructura preparada
- M03 Clientes y M04 Proveedores: APROBADO. RBAC activo, Atlas QA y Web validados.
- Android/iOS nativo pendiente de validación.

### Estado de módulos

M03 y M04 cuentan con evidencia QA aprobada en el baseline. M05 está aprobado en su rama de desarrollo, pendiente de integración a main. Véanse [M03](qa/M03-VALIDATION.md), [M04](qa/M04-VALIDATION.md) y [M05](qa/M05-VALIDATION.md).

| Módulo | Estado |
|--------|--------|
| M01 - Autenticación | Estructura completa |
| M02 - Dashboard | Estructura preparada |
| M03 - Clientes | APROBADO |
| M04 - Proveedores | APROBADO |
| M05 - Productos y servicios | APROBADO en rama M05 |
| M06 - Inventario | Estructura preparada |
| M07 - Ventas | Estructura preparada |
| M08 - Compras | Estructura preparada |
| M09 - Finanzas | Estructura preparada |
| M10 - RRHH | Estructura preparada |
| M11 - Reportes | Estructura preparada |
| M12 - Notificaciones | Estructura preparada |
| M13 - Auditoría | Estructura preparada |
| M14 - Configuración | Estructura preparada |
| M15 - IA | Arquitectura contemplada |
| M16 - Integraciones | Arquitectura contemplada |

### Licencia

MIT
"""
