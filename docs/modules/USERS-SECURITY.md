# M01 — Usuarios y seguridad

Estado funcional: **APROBADO**, validación del 2026-09-29. Rama
`codex/m01-users-security-completion`, sin integración a main en esta fase.
Evidencia: [QA M01](../qa/M01-VALIDATION.md).

## Arquitectura y compatibilidad

Se conservan Express, Mongoose, JWT, bcrypt, React Native/Web y el RBAC central.
User.role es un **nombre string**, relacionado con Role.name; no es un ObjectId.
No hay migración destructiva ni una nueva colección Permission. Los permisos
registrados siguen la convención module.action. Role persistido sustituye la
matriz predeterminada, sin ampliar automáticamente documentos existentes.
Los permisos individuales heredados de User y los claims de rol del cliente no
son fuentes de autorización. El alias super_admin se resuelve como superadmin,
priorizando el documento canónico sobre el alias, sin renombrar datos.

Las rutas de usuarios delegan en controller/service; roles conserva handlers
pequeños en routes y reglas en service. Las operaciones administrativas usan
modelos Mongoose directamente y una transacción compartida de administración;
los repositorios antiguos permanecen por compatibilidad, sin usarse en estas
escrituras. Atlas/replica set con transacciones es requisito para administrar.
Los bloqueos de actor, rol y destino revalidan permisos y versión dentro de la
transacción. createdBy/updatedBy se toman del actor autenticado, nunca del payload.
Esto prepara identidad para M13, sin implementar un sistema de auditoría.

## API de usuarios

Prefijo `/api/v1`. Todos los endpoints administrativos exigen JWT y permiso vigente.

| Método y ruta | Permiso | Comportamiento |
|---|---|---|
| GET /users | users.read | Lista, search, role, status, page y limit |
| GET /users/:id | users.read | Detalle público |
| POST /users | users.create | Alta; rol distinto de user exige users.assignRole |
| PATCH /users/:id | users.update | Email, nombre, apellido y teléfono |
| PATCH /users/:id/status | users.status | active, inactive o deleted |
| PATCH /users/:id/role | users.assignRole | Rol activo dentro del ámbito del actor |
| DELETE /users/:id | users.status | Eliminación lógica |
| GET /users/profile/me | Identidad vigente | Perfil propio |

La lista devuelve `{items,pagination:{page,limit,total,pages}}`; límite 20 por
defecto, máximo 100, orden estable por createdAt e _id. Oculta eliminados salvo
filtro explícito. La búsqueda escapa regex y consulta email/nombre/apellido.
Se validan IDs de 24 caracteres hexadecimales, campos permitidos y tipos; no se
aceptan identidad interna, permisos, hash, versiones ni operadores MongoDB.
Email es único y normalizado. Errores: 400 validación, 401 sesión inválida,
403 autorización, 404 inexistente, 409 duplicado, 500 genérico sin datos internos.
Lectura fallida de autorización: 503 y denegación por defecto.

## Roles y permisos

Se mantienen los diez roles base: superadmin, admin, manager, sales, purchasing,
warehouse, finance, hr, auditor y user. Son roles del sistema inmutables desde
la API; también se reservan super_admin y viewer heredados. Se administran roles
personalizados por nombre estable, sin borrado físico ni cambio de nombre.

| Método y ruta | Permiso |
|---|---|
| GET /roles | roles.read |
| GET /roles/permissions | roles.read; catálogo filtrado al ámbito del actor |
| POST /roles | roles.manage |
| PATCH /roles/:name | roles.manage |

Un rol personalizado admite descripción, permisos explícitos y estado
active/inactive. No acepta comodines ni identificadores desconocidos. Nadie
puede editar su propia fuente de autorización ni conceder permisos superiores
a los propios. La UI recibe isSystem, editable y assignable del backend.

Los siete permisos M01 son users.read, users.create, users.update, users.status,
users.assignRole, roles.read y roles.manage. Admin/superadmin los reciben en la
matriz por defecto; los demás roles mantienen sus permisos anteriores. La
matriz M03–M06 no cambia. Un admin persistido con permisos explícitos no recibe
los nuevos permisos automáticamente: su incorporación requiere revisión
operativa autorizada, fuera de los datos de producción de esta fase.

Se prohíbe cambiar el propio rol/estado. Una cuenta superadmin no puede ser
eliminada, desactivada ni degradada por esta API, incluso si existen varias;
solo puede editar su propio perfil. Es una protección conservadora del último
superadmin que evita una carrera de conteo. La recuperación operativa de estas
cuentas requiere un procedimiento administrativo separado y autorizado.

## Autenticación, contraseñas y sesiones

Login emite access/refresh JWT con id, sv y kind. Cada solicitud protegida
consulta usuario, rol y versión vigentes. sessionVersion no se expone al cliente.
Logout incrementa atómicamente esa versión: revoca **todas las sesiones** del
usuario, no solo un dispositivo. Cambiar rol, estado o contraseña también revoca.
Cambiar permisos de un Role afecta la siguiente solicitud con el mismo token.
Los JWT heredados sin sv se consideran versión cero hasta su expiración o
revocación; kind separa access/refresh en tokens nuevos.

`POST /auth/password` exige contraseña actual y nueva, bcrypt coste 12 y escritura
condicional por hash/estado/versión. Mínimo 12 caracteres, máximo 72 bytes UTF-8.
No se devuelven hashes ni se guardan contraseñas en frontend. Registro público
conservado, siempre asigna user, nunca un rol solicitado por el cliente.

AuthContext restaura mediante refresh y /auth/me antes de mostrar el shell;
reemplaza permisos almacenados por la identidad vigente. Un 401 limpia sesión;
un 403 refresca permisos. Logout limpia almacenamiento incluso si la llamada
falla o el token expiró. Solicitudes tardías no deben resucitar una sesión
cerrada. No hay refresh silencioso automático por cada 401 ni lista por dispositivo.
AsyncStorage se mantiene por compatibilidad y **no es almacenamiento cifrado**;
para despliegue endurecido debe evaluarse cookie HttpOnly web y almacenamiento
seguro nativo, CSP/TLS y política de duración de tokens.

Recuperación por correo no implementada: falta proveedor e infraestructura.
Contrato futuro: respuesta indistinguible para emails existentes/inexistentes,
token aleatorio de un uso guardado como hash, TTL corto, rate limit, verificación
fuera de banda, cambio atómico y revocación de todas las sesiones. No reutilizar
JWT de acceso como enlace de recuperación. No se simula envío de correo.

## Frontend y límites

UsersScreen, UserList, UserForm y UserDetail cubren carga/vacío/error, búsqueda,
filtros, paginación, alta, edición, rol y estado. RolesScreen distingue roles
protegidos/editables; PasswordScreen cambia la contraseña propia. Rutas y
acciones usan permisos; la seguridad efectiva permanece en backend.
Se reutilizan componentes, tokens, shell e identidad de UI-01–04. E2E web real
validado en QA; visual desktop 1440×900, tablet 768×1024 y mobile 390×844.
Android/iOS: **NOT EXECUTED**. No se certifica accesibilidad completa.
La deuda del enlace Dashboard permanece; UI-05 está pausada. No se implementan
M14, M13, M08 ni M07.
