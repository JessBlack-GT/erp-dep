# M04 — Proveedores

Implementado sobre el baseline M03 aprobado. El módulo reutiliza el arranque Express, la conexión Mongoose, JWT, `requirePermission`, el catálogo RBAC, el cliente Axios, AuthContext, `usePermissions` y la navegación existentes. No añade dependencias ni otro sistema de autenticación.

## Arquitectura y modelo

Backend: `suppliers.model → repository → service → controller → routes`, con validación explícita en `suppliers.validation.js`. Modelo `Supplier`, colección `suppliers`, timestamps y campos de auditoría `createdBy`/`updatedBy` obtenidos del usuario autenticado. El payload no puede establecerlos.

| Campo | Uso y límite |
|---|---|
| name | Razón social o nombre; único obligatorio, 255 caracteres |
| tradeName | Nombre comercial, 255 |
| type | `natural` o `legal`; predeterminado `legal` |
| taxId, taxType, taxCountry | Identificador fiscal (80), sistema fiscal (40) y país emisor (2) |
| email, phone, contactName | Correo empresarial (254), teléfono (30) y contacto principal (200) |
| address, city, region, country, zipCode | Dirección (500), ciudad (100), estado/provincia (100), país (2), código postal (20) |
| website | URL HTTP/HTTPS sin credenciales incrustadas, 500 |
| paymentTerms, currency | Condiciones de pago (200) y código de moneda (3) |
| category, notes | Clasificación empresarial (100) y notas (2000) |
| status | `active`, `inactive` o `deleted`; alta en `active` |
| createdAt, updatedAt | Timestamps administrados por MongoDB/Mongoose |

Los campos opcionales pueden omitirse. En PATCH, una cadena vacía limpia un campo opcional mediante `$unset`; `name` y `type` no admiten vacío. Se rechazan arrays, tipos inesperados, campos desconocidos y payloads vacíos. Se recortan espacios; email se convierte a minúsculas; identificador/sistema fiscal, países y moneda a mayúsculas. Teléfono: 7–20 dígitos con separadores habituales. Los IDs deben ser ObjectId hexadecimal de 24 caracteres.

El identificador fiscal admite letras Unicode, dígitos, espacios, punto, guion y barra. Si se proporciona, requiere `taxCountry` y `taxType` (por ejemplo VAT, RFC o RUC). No valida exclusivamente RFC ni consulta autoridades fiscales. Los códigos de país/moneda validan longitud y letras; no se verifica pertenencia al catálogo ISO. La puntuación fiscal interna se conserva: no se presume que identificadores con formatos distintos sean equivalentes.

## Duplicados y eliminación

- Email normalizado único cuando existe.
- Combinación `taxCountry + taxType + taxId` única cuando existe `taxId`.
- Índices únicos parciales previenen carreras; conflictos de DB se traducen a 409.
- Nombres iguales o similares no bloquean altas. Un identificador puede repetirse en otro país o sistema fiscal.
- Los registros eliminados conservan sus identificadores reservados. Su reutilización/restauración requiere una política futura; no hay restauración pública.
- DELETE establece `status: deleted`. Los registros eliminados no aparecen en listados/búsqueda/detalle ni admiten modificaciones o reactivación. La API no elimina físicamente documentos.

## API

Prefijo `/api/v1/suppliers`. Todas las rutas requieren JWT e identidad activa persistida.

| Método y ruta | Permiso | Éxito |
|---|---|---|
| GET / | suppliers.read | 200, listado paginado |
| GET /search?q=texto | suppliers.read | 200, búsqueda paginada |
| GET /:id | suppliers.read | 200, detalle |
| POST / | suppliers.create | 201, proveedor creado |
| PATCH /:id | suppliers.update | 200, proveedor actualizado |
| PATCH /:id/status | suppliers.update | 200; solo `{ "status": "active" }` o `inactive` |
| DELETE /:id | suppliers.delete | 200, confirmación de eliminación lógica |

Listado: `page` (predeterminado 1, máximo 1000000), `limit` (20, máximo 100), `search`, `status`, `category`, `country`, `type`, `sortBy` (`name`, `createdAt`, `status`, `category`, `country`) y `sortOrder` (`asc`, `desc`). Predeterminado `createdAt desc`; `_id` desempata para mantener orden estable. El filtro de categoría es exacto; país se normaliza a mayúsculas. Búsqueda literal, sin ejecutar expresiones regulares del usuario, por nombre, nombre comercial, email, identificador fiscal y contacto. `/search` acepta únicamente `q`, `page` y `limit`.

Respuesta de listado: `{ success: true, data: [...], pagination: { page, limit, total, pages } }`. Detalle/alta/edición: `{ success: true, data: {...} }`. Errores: 400 validación, 401 autenticación, 403 autorización, 404 inexistente/eliminado, 409 duplicado, 500 genérico sin stack/detalles de DB. La capa central de autorización puede devolver 503 si no puede resolver la política; deniega acceso por defecto.

## Matriz inicial centralizada

| Rol | Read | Create | Update/estado | Delete |
|---|---|---|---|---|
| superadmin | Sí | Sí | Sí | Sí |
| admin | Sí | Sí | Sí | Sí |
| manager | Sí | Sí | Sí | No |
| sales | Sí | No | No | No |
| purchasing | Sí | Sí | Sí | No |
| warehouse | Sí | No | No | No |
| finance | Sí | No | No | No |
| hr | No | No | No | No |
| auditor | Sí | No | No | No |
| user | No | No | No | No |

La matriz vive en `apps/backend/src/security/rbac.js`. Un documento Role existente sustituye la política predeterminada, conservando la semántica de M03. No se migran ni amplían automáticamente sus permisos. Antes de desplegar en otra base, un administrador debe revisar las asignaciones explícitas que necesiten `suppliers.*`. Los permisos/roles enviados por el cliente o incrustados en JWT no conceden privilegios. La política Customers permanece igual.

## Frontend y navegación

`SuppliersScreen` presenta listado, búsqueda, filtros, página de 20 registros, vacío/error/reintento y carga. `SupplierList` exporta el mismo listado sin duplicar lógica. `SupplierForm` crea/edita todos los campos empresariales y muestra los errores de validación del servidor. `SupplierDetailScreen` permite edición, activación/desactivación y eliminación con confirmación mediante Modal compatible con React Native.

El encabezado compartido permite navegar Clientes/Proveedores y cerrar sesión. Rutas: `Suppliers → SupplierForm → SupplierDetail → SupplierForm → regresar`. `supplierService` reutiliza el cliente HTTP existente, sus tokens, interceptores y configuración. Los permisos efectivos controlan botones y acceso directo a formularios; la seguridad efectiva sigue en backend.

Se validó React Native Web contra API y Atlas. Los componentes usan APIs React Native; no se ejecutaron binarios ni emuladores Android/iOS. No se añadieron flujos de compras, productos ni M05.

## Pruebas y reproducción

Consultar [evidencia QA](../qa/M04-VALIDATION.md) y [resultados estructurados](../qa/M04-results.json). Las suites aisladas no requieren MongoDB real. Los runners reales usan la configuración local ignorada, validan la selección exacta de la base QA autorizada y limpian exclusivamente sus propios registros.

Desde la raíz, para una sesión E2E autorizada:

```powershell
node apps/backend/scripts/m04-ui-fixture.cjs setup
node apps/backend/src/server.js
node apps/frontend/scripts/web.cjs
# Ejecutar el flujo UI con la cuenta temporal local; no imprimir ni versionar sus credenciales.
node apps/backend/scripts/m04-ui-fixture.cjs verify
node apps/backend/scripts/m04-ui-fixture.cjs cleanup
```

`setup` reserva 21 proveedores y un usuario QA. Guarda el manifiesto temporal únicamente en `tmp/` después de verificar `git check-ignore`; rechaza sobrescribir otro manifiesto. `verify` informa campos inocuos de persistencia. `cleanup` exige misma base, IDs, actor y marcador; elimina el manifiesto al terminar. Cerrar sesión y detener ambos servidores al finalizar. El flujo UI debe conservar el prefijo generado para que se identifiquen sus registros en la limpieza.
