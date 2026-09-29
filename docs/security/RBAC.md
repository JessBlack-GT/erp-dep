# RBAC del ERP — M01 y M03–M06

## Inspección y arquitectura

En la inspección inicial de M03 existían `User` (rol string y permisos individuales), `Role` (nombre único, permisos string y estado), repositorio de roles y middleware de roles/permisos. No existía modelo `Permission`, resolución de permisos mediante Role ni autorización en Clientes. `/roles` respondía 501. M01 sustituye ese stub por administración protegida de roles personalizados y consola de Usuarios/Roles, sin duplicar modelos. Véase la sección M01 al final.

Antes de M03 los JWT transportaban email, rol y permisos individuales. Las rutas de usuarios permitían escrituras a cualquier usuario autenticado. M03 añadió una restricción administrativa central; M01 la sustituye por permisos explícitos users.* y defensas transaccionales. `/users/profile/me` sigue disponible para el propio usuario activo con sesión vigente.

Inspección real de la base QA autorizada: colecciones `users`, `roles`, `customers`; cero usuarios y roles al inicio. No hay colección Permission. No se inspeccionaron ni migraron bases de producción.

Flujo actual:

1. `authenticateToken` verifica la firma y expiración del JWT.
2. `requirePermission('module.action')` exige identidad y consulta el `User` persistido por ID. Usuario inexistente/inactivo: 401.
3. `resolveAccess` obtiene el rol vigente y busca `Role.name`. Nunca usa permisos/rol del cliente ni permisos individuales heredados como autoridad.
4. Si existe Role, sus permisos sustituyen la matriz predeterminada; un Role inactivo/eliminado concede cero permisos. Si no existe, usa la política inicial centralizada de `src/security/rbac.js`.
5. Permiso válido: continúa. Falta de permiso: 403. Fallo de lectura de autorización: 503 genérico, cerrado por defecto.

La relación usuario→rol usa el nombre string existente, sin migración destructiva a ObjectId. Los permisos son identificadores del catálogo central; no necesitan otra colección para este alcance. M01 permite administrar roles personalizados mediante roles.manage, limitado al ámbito vigente del actor. Los roles del sistema permanecen protegidos y no se permite editar la propia fuente de permisos. No hay escritura automática de roles durante el arranque.

## Matriz inicial aprobada

| Rol | customers.read | customers.create | customers.update | customers.delete |
|---|---|---|---|---|
| superadmin | Sí | Sí | Sí | Sí |
| admin | Sí | Sí | Sí | Sí |
| manager | Sí | Sí | Sí | No |
| sales | Sí | Sí | Sí | No |
| purchasing | Sí | No | No | No |
| warehouse | Sí | No | No | No |
| finance | Sí | No | No | No |
| hr | No | No | No | No |
| auditor | Sí | No | No | No |
| user | No | No | No | No |

`superadmin` activo concede todas las acciones registradas en el catálogo desde una única capa. Sigue necesitando JWT válido, usuario activo y rol no deshabilitado. No se aceptan comodines arbitrarios del cliente o del documento Role.

Compatibilidad: `super_admin` se normaliza a `superadmin`; se prioriza el Role canónico y, si falta, se consulta el nombre heredado. No se renombra ningún registro. `viewer` sigue permitido en el esquema antiguo, pero no recibe permisos M03 predeterminados porque no está en la matriz aprobada. Los permisos heredados de User se conservan físicamente y se ignoran para M03; revisar asignaciones antes de desplegar sobre otros entornos.

## Rutas y semántica

| Rutas reales bajo /api/v1/customers | Permiso |
|---|---|
| GET /, /search, /stats, /:id | customers.read |
| POST / | customers.create |
| PATCH /:id, /:id/status | customers.update |
| DELETE /:id | customers.delete |

DELETE solo cambia el estado a `deleted`. Crear o actualizar con `status: deleted` se rechaza con 400: no permite eludir el permiso de borrado por PATCH. No se ha añadido eliminación física a la API.

401 significa que no hay autenticación válida (incluye usuario desactivado o eliminado después de emitir el token). 403 significa usuario autenticado vigente sin permiso suficiente. Las denegaciones no devuelven datos del cliente ni detalles sensibles de DB.

## JWT y frontend

Los nuevos tokens de acceso/refresh contienen solo el ID y claims temporales estándar. Login y `/auth/me` devuelven el rol y los permisos efectivos calculados en backend para la UX. Un JWT antiguo firmado con claims privilegiados no conserva esos privilegios: cada operación M03 vuelve a consultar User/Role. Los cambios de rol, revocaciones y desactivaciones se aplican al siguiente request sin renovar JWT.

`usePermissions` centraliza la consulta de permisos en frontend: oculta Crear, Editar, Estado y Eliminar según corresponda y bloquea formularios sin permiso. El estado local es una instantánea de sesión y puede quedar desactualizado hasta volver a iniciar sesión; modificarlo no concede acceso a la API. La barrera de seguridad siempre es el backend.

Los middlewares antiguos `authorizeRoles` y `authorizeOwnerOrAdmin` se conservan para compatibilidad; no son la política de M03 ni deben copiarse a módulos futuros como sustitutos de `requirePermission`. `authorizePermissions` delega ahora en la misma resolución vigente, conservando su semántica OR.

## Extensión futura

Convención: `module.action`. Para incorporar un módulo futuro: registrar sus identificadores explícitos en el catálogo, aprobar su matriz central o documentos Role, aplicar `authenticateToken` + `requirePermission` en cada ruta, reutilizar el hook UX y añadir pruebas positivas/negativas y de revocación. Nunca aceptar permisos del payload ni dispersar comparaciones de nombres de rol en controladores.

M04 registra `suppliers.read`, `suppliers.create`, `suppliers.update` y `suppliers.delete` en el mismo catálogo y aplica los mismos middlewares a sus siete endpoints. La matriz Customers anterior permanece intacta. La [matriz Proveedores](../modules/SUPPLIERS.md) permite crear/actualizar a purchasing, pero reserva eliminar a admin/superadmin. Role persistido sigue sustituyendo los valores predeterminados; no se actualizan documentos Role existentes automáticamente.

M05 registra `products.read`, `products.create`, `products.update` y `products.delete` para el catálogo PRODUCT/SERVICE. La [matriz M05](../modules/PRODUCTS-SERVICES.md) concede lectura/alta/edición a warehouse y purchasing, pero no eliminación. No agrega `services.*` ni altera los permisos Customers/Suppliers. Los documentos Role explícitos mantienen su prioridad y no se modifican automáticamente.

M06 registró inventory.* y M01 registra users.* y roles.*. Siguen sin registrarse sales.*, purchases.*, finance.*, hr.*, reports.*, audit.* ni settings.*.

## Verificación

Desde backend:

```powershell
node ../../node_modules/mocha/bin/mocha.js tests/rbac.test.js
node scripts/validate-rbac-real.cjs
node scripts/validate-m03-real.cjs
```

Desde frontend:

```powershell
node ../../node_modules/jest/bin/jest.js --runTestsByPath tests/rbac.test.js --watch=false --runInBand
```

El runner real requiere `.env` local ignorado y confirmación exacta de base QA con `M03_QA_DATABASE`. Rechaza colisiones con documentos Role de los nombres usados y no los sobrescribe. Crea usuarios/roles/clientes sintéticos, usa login y HTTP reales, verifica que denegaciones no modifican el cliente y limpia únicamente IDs/marcadores propios. Emite `RBAC_RESULT` sin secretos. El límite de solicitudes se eleva solo dentro del proceso QA y de pruebas aisladas para ejecutar la matriz completa; no cambia el límite predeterminado de la aplicación.

Cobertura: los diez roles, los cuatro permisos independientes, las ocho rutas, 401/403, claims falsificados/obsoletos, revocación de Role, usuarios inactivos/eliminados, autoelevación vía API de usuarios y bypass de borrado por PATCH. Consultar `../qa/M03-VALIDATION.md` para cantidades y resultados de esta ejecución.

## M06 — Inventario

Se añaden `inventory.read`, `inventory.entry`, `inventory.exit`, `inventory.transfer`, `inventory.adjust` e `inventory.warehouse.manage`. La matriz completa y la decisión de administración de almacenes están en [Inventario](../modules/INVENTORY.md#rbac). Los permisos anteriores no cambian. Los documentos Role existentes conservan prioridad, sin ampliación automática de permisos persistidos. La identidad auditada se obtiene del usuario autenticado actual.

## M01 — Usuarios y seguridad (2026-09-29)

M01 agrega users.read, users.create, users.update, users.status,
users.assignRole, roles.read y roles.manage: 25 permisos explícitos totales.
Admin/superadmin por defecto los reciben; los demás roles preservan exactamente
su matriz M03–M06. Role persistido sigue teniendo prioridad, sin migración ni
ampliación automática. El estado del alias super_admin se consulta también para
usuarios con nombre canónico cuando no existe Role superadmin.

Toda ruta administrativa usa authenticateToken + requirePermission. La versión
JWT se contrasta con sessionVersion persistida; logout revoca todos los tokens
anteriores, y los cambios de permisos se aplican en la siguiente solicitud.
Las escrituras vuelven a comprobar actor/rol dentro de una transacción. Los diez
roles base son inmutables; un admin no puede asignar superadmin ni otorgar
permisos superiores a los propios. No puede modificar su propio rol/estado.
La API prohíbe toda degradación/desactivación/eliminación de superadmin, evitando
el riesgo de perder la última cuenta operativa por cambios simultáneos.

Arquitectura, endpoints y límites: [M01](../modules/USERS-SECURITY.md).
Pruebas finales: [QA M01](../qa/M01-VALIDATION.md): backend 617 PASS,
frontend 222 PASS + 9 TODO anteriores, API real 90 checks, E2E autenticado y build.
