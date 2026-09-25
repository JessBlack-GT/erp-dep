# M05 — Productos y servicios

M05 es un catálogo maestro común para bienes físicos (`PRODUCT`) y servicios (`SERVICE`). Reutiliza Express, Mongoose, JWT, la política RBAC central, AuthContext, `usePermissions`, el cliente Axios y MainNavigator existentes. No modifica el dominio de Clientes o Proveedores.

## Arquitectura e infraestructura existente

`products.model → repository → service → controller → routes`, con validación independiente en `products.validation`. La ruta `/api/v1/products` y el servicio frontend `productService` ya existían como scaffolding; se completan, sin un segundo cliente HTTP. Las pantallas previas solo estaban referenciadas por exports y ahora se implementan.

El diseño preliminar de DB menciona categories, stock y taxRate, pero no hay un repositorio funcional de categorías, unidades, precios ni motor fiscal. M05 utiliza metadatos simples y extensibles; no desarrolla esos subsistemas ni almacena stock. La especificación de este módulo prevalece sobre esas referencias conceptuales anteriores.

## Modelo

Colección `products`, modelo `Product`, esquema estricto. Timestamps automáticos y campos `createdBy`/`updatedBy` derivados de la identidad autenticada, nunca del payload.

| Campo | Regla y utilidad |
|---|---|
| name | Obligatorio, máximo 255; nombre comercial |
| sku | Obligatorio, máximo 80; código interno estable y único |
| type | PRODUCT o SERVICE; PRODUCT predeterminado |
| description | Descripción comercial, máximo 2000 |
| barcode | Opcional, 3–80 caracteres ASCII imprimibles sin espacios; solo PRODUCT |
| category | Clasificación libre, máximo 100; espacios internos normalizados |
| unit | Unidad extensible, máximo 40; predeterminado `unit` para PRODUCT y `service` para SERVICE |
| price | Precio base de venta opcional; texto decimal exacto |
| cost | Costo base/estimado opcional, distinto del precio; admitido para ambos tipos |
| currency | Código de tres letras, requerido cuando hay precio o costo |
| taxCategory | Referencia fiscal opcional, máximo 80; metadato, no calcula impuestos |
| trackInventory | Booleano, predeterminado false; exclusivamente metadato PRODUCT |
| notes | Notas internas, máximo 2000 |
| status | active, inactive o deleted; alta activa |

El nombre y SKU son los únicos campos obligatorios para un alta básica. Una SERVICE no necesita campos físicos; rechaza barcode no vacío y trackInventory=true. Al convertir PRODUCT a SERVICE se validan también los valores persistidos: debe limpiarse explícitamente barcode y desactivar el indicador. La UI realiza esa limpieza al elegir Servicio. La unidad existente se conserva en una edición; el usuario puede elegir otra según el negocio.

Unidades: identificador libre normalizado a minúsculas, letras Unicode/números y separadores habituales. Admite pieza, unidad, kg, g, l, ml, m, cm, hora, servicio, paquete u otras unidades propias. No aplica conversiones ni equivalencias automáticas.

## Identidad, normalización y duplicados

SKU se recorta, convierte a mayúsculas y transforma cada secuencia de espacios en un guion. Admite letras ASCII, números, punto, guion, guion bajo y barra; comienza con letra o número. ` ab  12 ` y `AB-12` representan el mismo SKU. No se generan códigos automáticos susceptibles de colisiones.

Barcode se recorta y conserva mayúsculas/minúsculas; es un identificador opaco compatible con códigos alfanuméricos, no exclusivamente EAN/UPC. No comprueba dígito de control ni incorpora cámara/escáner. El índice único parcial solo se aplica cuando existe barcode.

SKU tiene índice único. Ambas claves se comprueban antes de escribir y también mediante índices MongoDB para prevenir carreras (409). Nombres coincidentes no son duplicados por sí solos. La eliminación lógica conserva reservados SKU y barcode. No existe restauración pública ni reasignación automática.

## Importes e impuestos

Precio y costo se envían y devuelven como **cadenas decimales**, no números JSON. Se admiten 0–12 dígitos enteros (sin ceros iniciales salvo cero) y hasta cuatro decimales; rango `0.0000` a `999999999999.9999`. Se almacenan como texto canónico de cuatro decimales, sin conversión intermedia a Number ni redondeo silencioso. Por ejemplo `"0.1"` pasa a `"0.1000"`.

Se rechazan negativos, exponentes, NaN, infinitos, números JSON, exceso de precisión y valores mayores al rango. En futuras operaciones aritméticas se deberá usar aritmética decimal o enteros escalados, nunca sumar estas cadenas como Number. M05 no ordena por campos monetarios para evitar orden lexicográfico incorrecto.

Omitir el importe significa precio/costo no definido, no gratuito. `"0"` representa cero explícito. La moneda valida tres letras y se normaliza a mayúsculas; no valida el catálogo ISO completo ni las fracciones propias de cada moneda. Precio y costo comparten moneda. `taxCategory` permite clasificación fiscal internacional futura; no aplica tasas, IVA, jurisdicciones ni facturación.

## Validación y eliminación

Se rechazan objetos, arrays, campos desconocidos/protegidos, payloads vacíos, tipos incorrectos, IDs malformados y query parameters no permitidos. Las cadenas opcionales vacías se omiten al crear y se eliminan mediante `$unset` al editar; name, sku, type y unit no admiten vacío explícito. Quitar currency requiere limpiar también los importes existentes.

PATCH general no acepta status. PATCH de estado solo permite active/inactive. DELETE cambia status a deleted; detalle, búsqueda y mutaciones excluyen eliminados. El comportamiento normal nunca borra físicamente documentos.

## API

Prefijo `/api/v1/products`; permisos compartidos por PRODUCT y SERVICE.

| Método/ruta | Permiso | Éxito |
|---|---|---:|
| GET / | products.read | 200 |
| GET /search?q=texto | products.read | 200 |
| GET /:id | products.read | 200 |
| POST / | products.create | 201 |
| PATCH /:id | products.update | 200 |
| PATCH /:id/status | products.update | 200 |
| DELETE /:id | products.delete | 200 |

Listado: page (1 por defecto, máximo 1000000), limit (20, máximo 100), search, type, category, status, currency, sortBy y sortOrder. Orden por name/sku/type/status/createdAt/category, asc/desc; defecto createdAt desc, con `_id` como desempate. Búsqueda literal por nombre, SKU o barcode, escapando expresiones regulares. `/search` admite únicamente q, page y limit. Categoría es exacta después de normalizar espacios; moneda se normaliza a mayúsculas.

Listado devuelve `{success:true,data:[...],pagination:{page,limit,total,pages}}`; detalle/alta/edición devuelven `{success:true,data:{...}}`. Errores: 400 validación, 401 identidad no válida, 403 falta de permiso, 404 inexistente/eliminado, 409 duplicado, 500 genérico sin detalles internos. Autorización central puede devolver 503 si no logra resolver la política.

## RBAC

| Rol | Read | Create | Update/estado | Delete |
|---|---|---|---|---|
| superadmin | Sí | Sí | Sí | Sí |
| admin | Sí | Sí | Sí | Sí |
| manager | Sí | Sí | Sí | No |
| sales | Sí | No | No | No |
| purchasing | Sí | Sí | Sí | No |
| warehouse | Sí | Sí | Sí | No |
| finance | Sí | No | No | No |
| hr | No | No | No | No |
| auditor | Sí | No | No | No |
| user | No | No | No | No |

Se amplía el catálogo central con products.read/create/update/delete; no se crean services.* ni comprobaciones de rol dispersas. Los permisos Customers/Suppliers permanecen iguales. Un documento Role explícito conserva su prioridad sobre la matriz predeterminada; no se amplían roles persistidos automáticamente. Backend consulta identidad y política vigentes; la UI usa permisos efectivos para UX.

## Frontend y QA

ProductsScreen/ProductList: catálogo, tipo visible, búsqueda, filtros, paginación, estados vacío/carga/error y reintento. ProductForm: formulario común dinámico con campos físicos exclusivos de PRODUCT. ProductDetailScreen: detalle, edición, estado y confirmación de eliminación mediante Modal React Native. MainNavigator incorpora Products/ProductDetail/ProductForm mediante el botón Catálogo.

Las pruebas aisladas cubren dominio, HTTP con persistencia simulada, RBAC, UI, API Axios y navegación. Los runners `validate-m05-real.cjs` y `m05-ui-fixture.cjs` reutilizan el preflight de la base QA existente. Los fixtures emplean prefijos QA_M05 y limpieza por IDs/marcador/actor; no hay limpieza global. El manifiesto temporal de UI se guarda exclusivamente en tmp ignorado y se elimina tras cleanup. Consultar el informe QA para distinguir lo ejecutado de lo pendiente.

## Fuera de alcance

Stock real, movimientos, almacenes, transferencias, kardex, lotes, series, reservas, valoración, conversiones complejas, listas avanzadas de precios, promociones, descuentos, motor fiscal completo y contabilidad. Android/iOS requieren validación nativa independiente; la implementación mantiene componentes React Native y React Native Web. No se desarrolla M06.

## Integración M06 en rama de desarrollo

M06 aplica una protección transaccional al catálogo: una vez que un PRODUCT tiene movimientos, no puede convertirse en SERVICE ni desactivar trackInventory (409), incluso si su saldo es cero. M05 y M06 bloquean el mismo documento Product para resolver carreras entrada/conversión. No se añaden campos de stock a Product. La condición se valida de nuevo contra Atlas QA; ver [Inventario](INVENTORY.md).
