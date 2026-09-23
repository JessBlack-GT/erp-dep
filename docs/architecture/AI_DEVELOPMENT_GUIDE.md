# ============================================
# ERP-SYSTEM - Guía para Desarrolladores IA
# ============================================

Este documento explica cómo trabajar en el sistema ERP-SYSTEM cuando usted es una IA encargada de desarrollar un módulo específico.

## 1. Cómo Está Organizado el Proyecto

```
ERP-SYSTEM/
├── apps/
│   ├── frontend/    # React Native / React Native Web
│   └── backend/     # Node.js + Express
├── docs/            # Documentación técnica
├── scripts/         # Scripts de utilidad
└── mobile-native/   # Código nativo Android (Kotlin)
```

**Puede modificar**: Archivos dentro de su módulo asignado.
**NO debe modificar**: Archivos compartidos sin autorización (ver sección 2).

## 2. Qué Archivos Puede Modificar

### Dentro de su Módulo

Cada módulo tiene su propia carpeta en `apps/backend/src/modules/{moduleName}/` y `apps/frontend/src/features/{moduleName}/`.

**Puede modificar sin restricciones:**
- `{moduleName}.routes.js` - Agregar o modificar endpoints
- `{moduleName}.controller.js` - Implementar lógica del controlador
- `{moduleName}.service.js` - Implementar reglas de negocio
- `{moduleName}.model.js` - Definir/especificar el esquema Mongoose
- `{moduleName}.repository.js` - Implementar acceso a datos
- `{moduleName}.test.js` - Agregar pruebas

**Puede agregar sin restricciones:**
- `{moduleName}.validation.js` - Validaciones específicas del módulo
- Cualquier otro archivo auxiliar dentro de su carpeta de módulo

### Dentro del Frontend

**Puede modificar sin restricciones:**
- `apps/frontend/src/features/{moduleName}/*` - Pantallas, componentes del módulo
- `apps/frontend/src/services/api.js` - Agregar métodos de servicio (coordinado)
- `apps/frontend/src/hooks/*` - Hooks del módulo

## 3. Qué Archivos Compartidos Requieren Autorización

### ARCHIVOS PROTEGIDOS (NO MODIFICAR SIN AUTORIZACIÓN)

```
apps/backend/src/
├── app.js                  # Punto de entrada de Express
├── server.js               # Servidor principal
├── config/                 # Configuración global
│   ├── database.js         # Conexión BD
│   ├── environment.js      # Variables de entorno
│   └── cors.js             # Configuración CORS
├── middleware/             # Middlewares globales
│   ├── authenticate.js     # Autenticación JWT
│   ├── authorize.js        # Autorización por roles
│   ├── errorHandler.js     # Manejo centralizado de errores
│   └── rateLimiter.js      # Rate limiting
├── routes/index.js         # Rutas principales de la API
└── shared/                 # Compartido entre módulos
    ├── constants/
    ├── errors/
    ├── utils/
    └── validators/
```

```
apps/frontend/src/
├── app/App.js              # Punto de entrada
├── app/navigation/         # Navegación principal
├── app/providers/          # Proveedores de contexto
├── components/             # Componentes compartidos
├── theme/                  # Tema global
└── context/                # Contextos globales
```

```
docs/architecture/           # Documentación de arquitectura
package.json                 # Configuración raíz
.env.example                 # Plantilla de variables
```

**Si necesita modificar estos archivos**, debe presentar una solicitud documentando:
1. El problema que se necesita resolver
2. El cambio propuesto
3. El impacto sobre otros módulos
4. Por qué es necesario

## 4. Cómo Agregar un Módulo

### Paso 1: Crear la estructura del módulo en el backend

```
apps/backend/src/modules/{moduleName}/
├── {moduleName}.model.js       # Esquema Mongoose
├── {moduleName}.repository.js  # Acceso a datos
├── {moduleName}.service.js     # Lógica de negocio
├── {moduleName}.controller.js  # Controlador Express
├── {moduleName}.routes.js      # Rutas Express
├── {moduleName}.validation.js  # Validaciones (opcional)
└── {moduleName}.test.js        # Pruebas
```

### Paso 2: Registrar las rutas

En `apps/backend/src/routes/index.js`, agregar:

```javascript
const {moduleName}Routes = require('../modules/{moduleName}/{moduleName}.routes');
// ...
router.use('/{moduleName}', {moduleName}Routes);
```

### Paso 3: Crear la estructura del módulo en el frontend

```
apps/frontend/src/features/{moduleName}/
├── index.js                  # Exportaciones
├── {moduleName}Screen.js     # Pantalla principal
├── {moduleName}List.js       # Lista de elementos (opcional)
└── {moduleName}Form.js       # Formulario (opcional)
```

### Paso 4: Agregar navegación

En `apps/frontend/src/app/navigation/MainNavigator.js`, agregar la pantalla:

```javascript
const {moduleName}Screen = React.lazy(() => import('../../features/{moduleName}/{moduleName}Screen'));
// En el Stack.Navigator:
<Stack.Screen name="{moduleName}" component={{moduleName}Screen} />
```

### Paso 5: Documentar

Actualizar `docs/modules/MODULES.md` y `docs/architecture/ARCHITECTURE.md` si es necesario.

## 5. Cómo Implementar una Ruta

### En el Backend

1. **Definir el modelo** en `{moduleName}.model.js`
2. **Crear el repositorio** en `{moduleName}.repository.js`
3. **Implementar el servicio** en `{moduleName}.service.js`
4. **Crear el controlador** en `{moduleName}.controller.js`
5. **Definir las rutas** en `{moduleName}.routes.js`

**Ejemplo de ruta protegida:**
```javascript
router.use(authenticateToken); // Todos los endpoints requieren autenticación
router.route('/').get(controller.getAll).post(controller.create);
```

**Ejemplo de ruta con autorización:**
```javascript
router.use(authenticateToken);
router.route('/').get(authorizeRoles('admin', 'manager'), controller.getAll);
```

### En el Frontend

1. **Crear el componente pantalla**
2. **Usar el servicio API** correspondiente de `src/services/api.js`
3. **Usar hooks** como `useData` para cargar datos
4. **Manejar estados** de carga, error y vacío

## 6. Cómo Implementar un Servicio

La capa de servicio contiene toda la lógica de negocio. Debe ser independiente del framework web.

**Reglas:**
- No usar `req`, `res` en el servicio
- Usar el repositorio para acceder a datos
- Lanzar errores personalizados (`NotFoundError`, `ValidationError`, etc.)
- Retornar datos, no objetos de respuesta HTTP

**Ejemplo:**
```javascript
class CustomerService {
  async getAll() {
    return customerRepository.findAll();
  }
  
  async getById(id) {
    const customer = await customerRepository.findById(id);
    if (!customer) throw new NotFoundError('Cliente no encontrado', 'Customer');
    return customer;
  }
}
```

## 7. Cómo Crear un Modelo

Usar Mongoose para definir esquemas.

**Reglas:**
- Usar `timestamps: true` para `createdAt` y `updatedAt`
- Definir índices para campos de búsqueda frecuente
- Usar validaciones de Mongoose
- No referenciar módulos de otros módulos directamente
- Usar `ObjectId` para referencias a otros módulos

**Ejemplo:**
```javascript
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 255 },
  email: { type: String, required: true, unique: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

customerSchema.index({ email: 1 }, { unique: true });
customerSchema.index({ status: 1 });
```

## 8. Cómo Escribir Pruebas

### Para el Backend

Usar **Mocha + Chai + Supertest**.

```javascript
const { expect } = require('chai');
const request = require('supertest');
const app = require('../../app'); // Importar la app Express

describe('Customer Module', () => {
  it('GET /api/v1/customers debería retornar lista', async () => {
    const res = await request(app).get('/api/v1/customers');
    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
  });
});
```

**Estructura de pruebas:**
- `tests/structure.test.js` - Verificar estructura de módulos
- `tests/integration.test.js` - Verificar módulos compartidos
- `{moduleName}.test.js` - Pruebas específicas del módulo

### Para el Frontend

Usar **Jest + @testing-library/react-native**.

```javascript
import { expect } from '@jest/globals';

describe('Utils', () => {
  it('formatDate debería formatear correctamente', () => {
    const { formatDate } = require('../../utils');
    expect(formatDate('2024-01-15')).toBe('15/01/2024');
  });
});
```

### Reglas de Pruebas

1. Cada módulo debe tener al menos un test de estructura
2. Las pruebas deben ser independientes
3. No usar datos de producción
4. Las pruebas de autenticación deben verificar que rutas protegidas rechacen sin token
5. Las pruebas de validación deben verificar que rechacen datos inválidos
6. **No marcar pruebas como exitosas si no las ejecutó**

## 9. Cómo Documentar una Entrega

Cuando complete un módulo, actualice:

1. **`docs/modules/MODULES.md`** - Cambiar el estado del módulo
2. **`docs/architecture/ARCHITECTURE.md`** - Si cambia la arquitectura
3. **`docs/API.md`** - Documentar nuevos endpoints
4. **`apps/backend/src/modules/{moduleName}/{moduleName}.test.js`** - Agregar pruebas reales
5. **`README.md`** - Actualizar funcionalidades implementadas

## 10. Cómo Evitar Conflictos con Otros Módulos

1. **Trabaje en su módulo de forma aislada**: No modifique archivos de otros módulos
2. **Use ramas separadas**: Si usa Git, cree una rama por módulo
3. **Comuníquese**: Si necesita compartir esquemas o tipos, cree archivos compartidos
4. **No modifique `shared/`**: Si necesita una utilidad compartida, solicítelo al coordinador
5. **Siga las convenciones**: Nombres de archivos, formatos de respuesta, estilos de código

## 11. Cómo Solicitar Cambios Arquitectónicos

Si necesita cambiar la estructura base del proyecto:

1. **Identifique el problema**: ¿Qué no funciona o qué falta?
2. **Propuesta de cambio**: ¿Cómo debería ser?
3. **Beneficios**: ¿Qué mejora?
4. **Riesgos**: ¿Qué podría romper?
5. **Archivos afectados**: ¿Qué archivos necesitarían cambiar?
6. **Impacto sobre otros módulos**: ¿Qué módulos dependen de lo que va a cambiar?
7. **Presente al coordinador**: Para autorización antes de implementar

## 12. Buenas Prácticas Generales

- **No invente reglas de negocio**: Solo implemente según requisitos aprobados
- **No afirme que una función funciona si no la probó**
- **No elimine código sin justificación**
- **No cree endpoints duplicados**
- **No cree modelos incompatibles entre módulos**
- **No introduzca dependencias circulares**
- **No oculte errores para aparentar que el sistema funciona**
- **No presente código incompleto como funcionalidad terminada**
- **Separe claramente lo implementado de lo documentado**

## 13. Contacto y Coordinación

- **Para dudas sobre estructura**: Revise `docs/architecture/ARCHITECTURE.md`
- **Para dudas sobre API**: Revisa `docs/API.md`
- **Para dudas sobre base de datos**: Revise `docs/database/DATABASE.md`
- **Para cambios arquitectónicos**: Solicite autorización al coordinador
