# ============================================
# ERP-SYSTEM - Scripts de Utilidad
# ============================================

## Scripts Disponibles

### create_stubs.py / create_stubs_v2.py

**Propósito**: Crear stubs de módulos automáticamente.

**Uso:**
```bash
python scripts/create_stubs_v2.py
```

**Funcionalidad**:
- Crea carpetas de módulos
- Crea archivos de controller, routes, service, model, repository y test
- Genera código inicial con comentarios de "pendiente de implementación"

## Scripts Futuros Planificados

### migrate.js
- Migraciones de base de datos (MongoDB)
- Creación de índices iniciales

### seed.js
- Sembrado de datos de prueba
- Creación de roles y permisos iniciales
- Creación de usuario administrador

### setup.js
- Configuración inicial del sistema
- Verificación de dependencias
- Validación de conexión a MongoDB Atlas

### lint.js
- Ejecutar linter en todo el proyecto
- Formatear código con Prettier
