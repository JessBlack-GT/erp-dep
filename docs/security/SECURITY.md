# ============================================
# ERP-SYSTEM - Documentación de Seguridad
# ============================================

## Visión General

El sistema ERP-SYSTEM implementa una estrategia de seguridad en capas que protege la aplicación, los datos y las credenciales de los usuarios.

## Capas de Seguridad

### 1. Variables de Entorno

Toda la configuración sensible se almacena en variables de entorno.

**Archivo `.env` (NUNCA commitado al repositorio):**
```
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/DATABASE
JWT_SECRET=...
JWT_REFRESH_SECRET=...
```

El archivo `.gitignore` excluye `.env`, `.env.local`, y archivos de credenciales.

**Documentación**: Copie `.env.example` a `.env` y configure sus valores.

### 2. Validación de Datos

- **Frontend**: Validación de formularios con Yup
- **Backend**: Validación con express-validator
- **Modelos**: Validación de esquemas con Mongoose
- **Middleware**: `validateRequest` valida todos los inputs

### 3. Autenticación

- **JWT**: Tokens de acceso (1h) y refresh (7d)
- **Bcrypt**: Hash de contraseñas con 12 rounds
- **Algoritmo**: HS256 para JWT
- **Almacenamiento de tokens**: AsyncStorage en el frontend

**Flujo:**
1. Usuario envía email y contraseña
2. Backend verifica credenciales
3. Se genera token JWT de acceso
4. Se genera token de refresh
5. Ambos tokens se almacenan de forma segura

### 4. Autorización

- **Roles**: `super_admin`, `admin`, `manager`, `user`, `viewer`
- **Permisos**: Array de strings en el JWT
- **Middleware**: `authorizeRoles(...roles)`, `authorizePermissions(...permissions)`
- **Propiedad**: Middleware `authorizeOwnerOrAdmin` para recursos propios

**Política de Denegación por Defecto**: Si no se especifica acceso, se deniega.

### 5. Configuración de CORS

```javascript
// Configuración en config/cors.js
const corsOptions = {
  origin: function (origin, callback) {
    // Solo permite orígenes autorizados
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origen no permitido'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
};
```

### 6. Rate Limiting

- **API general**: 100 solicitudes cada 15 minutos
- **Autenticación**: 5 intentos de login cada 15 minutos
- **Protección contra**: Brute force, DDoS

### 7. Manejo Centralizado de Errores

- **No expone**: Errores internos, cadenas de conexión, información sensible
- **Formato consistente**: Todos los errores siguen el mismo formato JSON
- **Logging**: Solo se registran información no sensible
- **Producción**: Mensajes genéricos en lugar de detalles técnicos

### 8. Protección de Credenciales

- **Contraseñas**: Nunca en texto plano, siempre hasheadas con bcrypt
- **Tokens JWT**: Nunca se registran en logs
- **Secretos**: Nunca se incluyen en el código fuente
- **Logs**: No registran contraseñas, tokens completos ni secretos

### 9. Registro de Eventos (Audit Logging)

- Todos los eventos relevantes se registran en la colección `auditLogs`
- El logger no expone datos sensibles
- Se registra: usuario, acción, entidad, IP, timestamp

## Configuraciones Externas Pendientes

Las siguientes configuraciones de seguridad necesitan ser ajustadas:

- [ ] **Certificados SSL/TLS**: Configurar HTTPS en producción
- [ ] **CORS en producción**: Agregar los dominios reales de producción
- [ ] **Rate Limiting en producción**: Ajustar valores según el tráfico esperado
- [ ] **Headers de seguridad adicionales**: Content-Security-Policy, HSTS
- [ ] **Cifrado de datos sensibles**: En MongoDB Atlas con campos cifrados
- [ ] **Política de contraseñas**: Longitud mínima, complejidad requerida
- [ ] **Bloqueo de IP**: Después de múltiples intentos fallidos
- [ ] **Autenticación de dos factores (2FA)**: Pendiente de implementación
- [ ] **Revisión de permisos**: Auditoría periódica de roles y permisos

## Reglas de Seguridad

### Lo Que NO Se Debe Hacer

1. ❌ No almacenar contraseñas en texto plano
2. ❌ No exponer errores internos en respuestas HTTP
3. ❌ No desactivar controles de seguridad para pruebas
4. ❌ No incluir credenciales en el código fuente
5. ❌ No registrar tokens completos ni secretos en logs
6. ❌ No confiar en la ocultación de UI del frontend para seguridad
7. ❌ No permitir que rutas protegidas queden accesibles por falta de implementación
8. ❌ No crear credenciales de administrador predeterminadas
9. ❌ No usar el archivo `.env` en el repositorio
10. ❌ No desactivar CORS o rate limiting

### Lo Que SÍ Se Debe Hacer

1. ✅ Siempre usar variables de entorno para configuración sensible
2. ✅ Siempre validar datos de entrada en el backend
3. ✅ Siempre verificar autenticación y autorización en el backend
4. ✅ Siempre manejar errores con el middleware centralizado
5. ✅ Siempre registrar eventos relevantes en auditoría
6. ✅ Siempre usar HTTPS en producción
7. ✅ Siempre actualizar dependencias
8. ✅ Siempre documentar configuraciones de seguridad

## Configuración de Entorno de Desarrollo vs Producción

| Aspecto | Desarrollo | Producción |
|---------|-----------|------------|
| NODE_ENV | `development` | `production` |
| CORS | `http://localhost:3000` | Dominios autorizados |
| Rate Limit | 100/15min | Ajustado a tráfico |
| Errores | Detallados | Genéricos |
| Logging | Console | Sistema de logs |
| SSL | No requerido | Obligatorio |
| MongoDB | Local/Atlas | Atlas con cifrado |
| JWT Expiry | 1h | 1h (o menos) |
| Debug | Activado | Desactivado |

## Vulnerabilidades Conocidas y Prevención

| Vulnerabilidad | Prevención |
|----------------|-----------|
| Inyección MongoDB | Validación con Mongoose schemas |
| XSS | Sanitización de inputs |
| CSRF | Validación de CORS, tokens |
| Brute Force | Rate limiting en auth |
| Token Theft | HTTPS, almacenamiento seguro |
| Data Exposure | Middleware de errores, sin datos sensibles |
| Reconocimiento | Headers de seguridad, sin exposición de tech stack |
