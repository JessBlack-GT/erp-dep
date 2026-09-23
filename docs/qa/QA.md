# ============================================
# ERP-SYSTEM - Documentación de QA
# ============================================

## Estructura de Pruebas

El sistema tiene una estructura de pruebas organizada para verificar el sistema desde las primeras etapas.

### Tipos de Pruebas

| Tipo | Ubicación | Framework |
|------|-----------|-----------|
| Unitarias | `apps/backend/src/tests/`, `apps/backend/tests/`, `apps/frontend/tests/` | Mocha/Chai/Supertest |
| Integración | `apps/backend/tests/integration.test.js` | Chai/Supertest |
| Frontend | `apps/frontend/tests/` | Jest/Testing Library |
| Estructura | `apps/backend/tests/structure.test.js` | Chai/FS |

### Pruebas Implementadas

#### Backend

1. **Estructura del Backend** (`tests/structure.test.js`)
   - Verifica que existan todos los directorios de módulos
   - Verifica que existan los middleware de autenticación y autorización
   - Verifica los módulos de configuración

2. **Integración de Módulos** (`tests/integration.test.js`)
   - Verifica que los módulos auth, users, roles tengan estructura completa
   - Verifica que los módulos compartidos tengan constantes, validadores y errores

3. **Configuración del Servidor** (`src/tests/app.test.js`)
   - Verifica la carga de la configuración de entorno
   - Prueba la creación de errores personalizados

4. **Servidor** (`tests/server.test.js`)
   - Verifica que el módulo de configuración exista
   - Verifica que tenga las funciones `getConfig` y `getConfigValue`

#### Frontend

1. **Estructura del Frontend** (`tests/frontend.test.js`)
   - Prueba utilidades de formato de fecha, email, moneda
   - Prueba la estructura de utils

2. **Navigation** (`tests/navigation.test.js`)
   - Verifica que la estructura de navegación existe

3. **API Client** (`tests/api.test.js`)
   - Verifica que los servicios API están definidos

4. **Features** (`tests/features.test.js`)
   - Verifica que todos los features del frontend estén estructurados

## Cómo Ejecutar las Pruebas

### Backend

```bash
cd apps/backend
npm test
```

Para ver cobertura:
```bash
npm test -- --coverage
```

### Frontend

```bash
cd apps/frontend
npm test
```

## Criterios de Pruebas

### Pruebas que Se Pueden Ejecutar (Sin Dependencias Externas)

- ✅ Validación de estructura de archivos
- ✅ Validación de configuración de entorno
- ✅ Validación de utilidades
- ✅ Pruebas de errores personalizados
- ✅ Pruebas de middlewares

### Pruebas que Requieren MongoDB Atlas

- ❌ Pruebas de conexión a BD
- ❌ Pruebas de CRUD completo
- ❌ Pruebas de autenticación real

### Pruebas que Requieren el Servidor Corriendo

- ⏳ Pruebas de endpoints HTTP
- ⏳ Pruebas de integración completa

## Cómo Escribir Nuevas Pruebas

### Para el Backend

```javascript
const { expect } = require('chai');
const request = require('supertest');

describe('Módulo', () => {
  it('descripción de la prueba', async () => {
    // Arrange
    const data = { ... };

    // Act
    const result = await action(data);

    // Assert
    expect(result).to.have.property('property');
  });
});
```

### Para el Frontend

```javascript
import { expect } from '@jest/globals';

describe('Feature', () => {
  it('descripción de la prueba', () => {
    expect(funcion()).toBe(true);
  });
});
```

## Buenas Prácticas de QA

1. **Cada módulo debe tener al menos un test** que verifique su estructura
2. **Las pruebas deben ser independientes** entre sí
3. **Usar datos de prueba realistas** pero no reales
4. **No depender de datos de producción** para las pruebas
5. **Documentar** las pruebas que no se pueden ejecutar por falta de dependencias
6. **Ejecutar pruebas** antes de cada commit
7. **Las pruebas de autorización** deben verificar que rutas protegidas rechacen solicitudes no autenticadas

## Limitaciones Actuales

- MongoDB Atlas no está configurado en el entorno de desarrollo actual
- Las pruebas de conexión a BD no se pueden ejecutar
- Las pruebas de endpoints HTTP no se pueden ejecutar sin el servidor corriendo
- No hay servicios de email configurados para pruebas de registro
