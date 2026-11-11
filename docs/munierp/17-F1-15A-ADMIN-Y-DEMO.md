# F1-15a — Administración de dependencias y membresías, aplicación navegable y entrega

> Fecha: 2026-11-10. Base: `cae3e38`. Sin cambios en el núcleo del ERP, OpenAPI draft.3, backend municipal,
> autenticación, RBAC, `Card`, `Input` ni `app.js`. Sin MongoDB ni Atlas. Datos sintéticos.

## 1. F1-15a

| Operación (draft.3) | Pantalla | Permiso (servidor) |
|---|---|---|
| `listDependencies` (todas) | Dependencias | `dependencies.read` (todos los roles) |
| `createDependency`, `updateDependency` | Dependencias: alta, nombre, estado | `dependencies.manage` (ADMIN_MUNICIPAL) |
| `listMemberships` (role, dependency, status, page) | Membresías y permisos | `memberships.read` (ADMIN, SUPERVISOR, AUDITOR; TITULAR alcance D) |
| `createMembership` | Asignar usuario central | `memberships.manage` (ADMIN) |
| `updateMembership` (rol, dependencias, estado) | Editar, revocar (INACTIVA), reactivar | `memberships.manage` |

Seguridad: la interfaz no ofrece ADMIN_MUNICIPAL ni editar la propia membresía o las de administrador, y solo
valida la forma (24 hex, código de 3 letras, rol con dependencia). El servidor decide todo y sus mensajes 4xx
se muestran tal cual: rol no asignable, autoasignación, usuario inexistente, duplicado, dependencia con
expedientes abiertos. La paridad con `MUNICIPAL_ROLES_ASSIGNABLE`, `DEPENDENCY_SCOPED_ROLES`, `canAssignRole`
y el catálogo de permisos se prueba en Jest. No se añadieron endpoints. Métodos nuevos del cliente:
`createDependency`, `updateDependency`, `listMembershipPage`, `createMembership`, `updateMembership`.
`listDependencies(params)` mantiene `ACTIVA` por omisión.

## 2. Aplicación navegable (`MunicipalApp`)

Panel principal, Registrar solicitud, Solicitudes (filtros + folio), Detalle e historial (F1-13 sin cambios
funcionales), Dependencias, Membresías y permisos, Auditoría (solo con `audit.read`, es decir AUDITOR). El
menú se calcula con `navSections(permisos)`. Una vista pedida sin permiso cae al panel. `api` intercambiable:
API simulada (demostración) o `createMunicipalApi` (HTTP). El anfitrión local de Codex no estaba disponible
en esta ronda, así que el consumo HTTP queda preparado pero no ejecutado.

Demostración (`qa/demo-app.web.jsx`): franja «MODO DEMOSTRACIÓN · API simulada…», 7 perfiles, cambio de
perfil conservando datos, **Restablecer demostración**, identificadores sintéticos de usuarios centrales.
Lanzador `qa/windows/ABRIR-DEMO.cmd` (Node: servidor 127.0.0.1:4180; sin Node: `file://`).

## 3. Datos de demostración (`createServiceBackedWorld({ demo: true })`)

Sobre la siembra base (r1–r5, z1), con el servicio real: r6 en espera del ciudadano, r7 asignado con
documento PDF no confidencial, r8 concluido, r9 DIF y r10 TES registrados, y alta de la dependencia PCV.
Resultado en SJH: 10 solicitudes (4 registradas, 3 en trámite o en espera, 2 concluidas, 1 cancelada), 11
dependencias, 11 membresías, bitácora con altas, transiciones, documentos y un acceso denegado. Las pruebas
F1-13/F1-14 siguen usando la siembra base.

## 4. Problemas visibles corregidos (con verificación de la semántica real)

| Hallazgo | Causa real (comprobada) | Corrección |
|---|---|---|
| Todos los encabezados eran `<h1>` | RN Web 0.19 convierte `accessibilityRole="header"` sin `aria-level` en `h1` (`propsToAccessibilityComponent`) | `aria-level` explícito: pantalla = 1, sección = 2 (`Heading`, `Section`) |
| Folio del acuse, valores de indicadores y «Sin solicitudes» como `<h1>` | Variantes de encabezado en `Text`, `StatCard` y `EmptyState` del núcleo | Folio con rol texto; tarjeta de indicador propia; vacío propio. Núcleo sin cambios |
| Botones pegados | Filas sin separación | `ButtonRow` (auditoría, detalle, acuse, administración) |
| Errores de administración lejos del formulario | Aviso solo arriba | Aviso arriba (región viva) y repetido junto al formulario |
| Regresión detectada al reejecutar F1-13 | `toApiError` del adaptador QA convertía el error del lector privado en 500 | Los errores del cliente (`PrivateDocumentError`) pasan sin cambios |

No se debilitaron selectores. La prueba 10 exige un solo `h1` por pantalla y ningún salto de nivel, y mide la
separación entre botones.

## 5. Pruebas

- Backend municipal (mocha): sin cambios en el backend. 279 aprobadas, 22 pendientes (L3).
- Jest municipal: **81/81** (nuevo `municipal.admin.test.js`, 14: paridad, CRUD con servicio real, decisiones
  del servidor, navegación por rol, registro→folio→expediente, listado/404, rutas HTTP del contrato).
- Playwright (API SIMULADA; no acredita HTTP real): ver §5.1.

### 5.1 Playwright Windows

Ejecución `windows_2026-11-10_1820` (Windows 11, Node 24.21, Playwright 1.65.0 global sin reinstalar).
Se ejecutaron las cuatro especificaciones porque F1-15a tocó componentes compartidos (encabezados, filas de
botones, lista, indicadores, acuse, adaptador QA): F1-12 (14), F1-13 (18), F1-14 (14) y F1-15a (15).

| Navegador | Versión | Pasaron | Fallaron | Capturas |
|---|---|---|---|---|
| Chromium | 158.0.8127.18 | 61 | 0 | 61 |
| Firefox | 158.0 | 61 | 0 | 61 |
| WebKit | 27.2 | 61 | 0 | 61 |

**183/183** en 3,7 min, con una captura por escenario y navegador y `registro-<navegador>.jsonl` (fecha,
navegador, versión, resultado, modo de API). No hubo fallos, por eso no hay trazas en esta ejecución. Antes,
una ejecución previa en Chromium de la nube detectó la regresión del lector privado (§4), que se corrigió
antes de la ejecución en Windows.

Escenarios F1-15a: 01 navegación, 02 registro y folio, 03 listado y búsqueda, 04 expediente e historial,
05 dependencias, 06 membresías (asignar, efecto inmediato, revocar), 07 restricciones por rol, 08 auditoría,
09 teclado, 10 accesibilidad (h1 único, niveles, regiones, separación), 11 restablecer, 12 carga y error,
13 adaptable 360/800/1280.

## 6. Dependencias con Codex

C-01/C-11 (montar `MunicipalApp` en el ERP con `createMunicipalApi`), C-18/C-19 (Card/Input), C-05
(`munierp_qa`), C-22 (conciliación), C-23 (bitácora para el administrador, sin cambios), X-01 (nombres de
funcionarios), y que `EmptyState`/`StatCard` acepten nivel de encabezado (núcleo).
