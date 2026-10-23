# MuniERP IA — Fase 0 · 06 Casos de prueba iniciales

Estado: **DISEÑADOS, NO EJECUTADOS** (el módulo municipal no existe todavía). Ninguno se considera
aprobado hasta ejecutarse con evidencia en `docs/qa/MUNI-*-VALIDATION.md`.

Niveles: **U** unitaria (mocha, sin DB) · **H** HTTP con supertest y repositorios simulados ·
**R** integración real contra base QA autorizada (`validate-municipal-real.cjs`) · **E** E2E web y
Android.

## Datos de prueba (sintéticos)

- Municipio `SJH` (San Juan Huactzinco) y municipio ficticio `ZZZ` para aislamiento.
- Dependencias `OBP`, `TES`, `DIF` en SJH; `OBP` en ZZZ (mismo código, otro municipio).
- Usuarios: `u_admin_erp` (rol ERP admin, sin membresía), `u_super_erp` (superadmin, sin membresía),
  `u_reg` (auto-registrado), `u_tit_obp`, `u_op_obp`, `u_op_tes`, `u_vent`, `u_sup`, `u_aud`,
  `u_admin_mun`, `u_zzz_tit_obp`.
- Ciudadanos con nombres generados y marcador `synthetic: true` + `runId` aleatorio.
- Limpieza solo por IDs/marcadores de la ejecución; nunca `dropDatabase` ni borrado de colecciones.

## A. Acceso no autorizado

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-01 | H | Sin `Authorization` en cualquier ruta municipal | 401, sin datos |
| MT-02 | H | JWT con firma inválida / expirado / `kind: refresh` | 401 |
| MT-03 | H | JWT válido de usuario con `sessionVersion` incrementado (logout previo) | 401 `Sesión revocada` |
| MT-04 | H/R | `u_super_erp` y `u_admin_erp` → `GET /municipalities/SJH/requests` | 403 `MUNICIPAL_MEMBERSHIP_REQUIRED` |
| MT-05 | H/R | `u_reg` (creado por `/auth/register`) → cualquier ruta municipal salvo `/me/memberships` | 403; `/me/memberships` → `[]` |
| MT-06 | H | Membresía `INACTIVA` o con `validTo` vencido | 403 |
| MT-07 | H | JWT con claims falsificados `role: superadmin, permissions: [municipal.*]` | Ignorados; mismo resultado que sin claims |
| MT-08 | U | Fallo de lectura de membresía (DB caída) | 503 `AUTHORIZATION_UNAVAILABLE`, nunca 200 |
| MT-09 | H | `u_op_obp` → `POST /dependencies` | 403 |
| MT-10 | H | `u_admin_mun` → crear membresía `ADMIN_MUNICIPAL` o asignarse a sí mismo | 403 |
| MT-11 | H | `u_admin_mun` → `GET /requests/{folio}` | 403 (no lee contenido) |
| MT-12 | H | `u_aud` → `PATCH /requests/{folio}` o transición | 403 |

## B. Aislamiento de datos

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-13 | R | `u_zzz_tit_obp` → `GET /municipalities/SJH/requests` | 403 (sin membresía en SJH) |
| MT-14 | R | `u_tit_obp` (SJH) → `GET /municipalities/SJH/requests/{folio de ZZZ}` | 404 (patrón de folio no coincide / fuera de municipio) |
| MT-15 | R | `u_op_tes` → `GET /requests/{folio OBP}` | 404 + evento `ACCESS_DENIED` en bitácora |
| MT-16 | R | `u_op_tes` → `GET /requests?dependency=OBP` | 200 lista vacía (el filtro del cliente no amplía alcance) |
| MT-17 | R | Listado de `u_tit_obp` contiene solo OBP + turnados a OBP + grants | Conteo exacto vs. datos sembrados |
| MT-18 | H | Body con `municipalityId`, `folio`, `createdBy`, `history` o `status` en creación | 400, nada persistido |
| MT-19 | R | Solicitud `CONFIDENCIAL` en DIF: `u_sup` sin `readConfidential` | 404 en detalle; ausente en listado |
| MT-19b | R | Grant `READ` a `u_op_tes`, luego revocación | 200 mientras vigente; 404 inmediatamente tras revocar |
| MT-19c | R | Ciudadano creado por OBP buscado por `u_op_tes` | No aparece |

## C. Dependencias

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-20 | H | Crear `OBP` dos veces en SJH | 201, luego 409 |
| MT-21 | R | Crear `OBP` en ZZZ con `OBP` existente en SJH | 201 (unicidad por municipio) |
| MT-22 | H | Desactivar dependencia con expedientes abiertos | 409 (decisión: no se desactiva con abiertos) |

## D. Solicitudes y folios

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-30 | U | Formato de folio | Coincide `^[A-Z]{3}-[A-Z]{3}-[A-Z]{3}-\d{4}-\d{6}$` |
| MT-31 | R | 50 creaciones concurrentes en OBP | 50 folios distintos y consecutivos 1..50, sin huecos por fallas |
| MT-32 | R | Creación que falla tras reservar folio (error forzado en la transacción) | Contador no avanza (rollback) |
| MT-33 | H/R | Reintento con misma `Idempotency-Key` y cuerpo | 200 con el mismo folio; un solo documento |
| MT-34 | H | Misma `Idempotency-Key`, cuerpo distinto | 409 |
| MT-35 | R | Cambio de año (reloj inyectado 31-dic → 1-ene) | Secuencia reinicia en 000001 para el nuevo año |
| MT-36 | R | Cancelar solicitud | Folio conservado, estado `CANCELADA`, no reutilizado por la siguiente |

## E. Turnado y estados

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-40 | H | `CERRAR` sin `note` | 400 |
| MT-41 | H | Transición desde `CERRADA` | 409 `INVALID_TRANSITION` |
| MT-42 | R | `TURNAR` OBP→TES por `u_tit_obp` | TES puede leer; history y bitácora registrados |
| MT-43 | H | `TURNAR` por `u_op_obp` | 403 |
| MT-44 | R | Dos actualizaciones con la misma `version` | Primera 200, segunda 409 |
| MT-45 | H | `TURNAR` a dependencia inexistente o de otro municipio | 400 |

## F. Bitácora

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-50 | R | Toda escritura exitosa genera exactamente un evento con IP y requestId | Conteo = operaciones |
| MT-51 | U | `updateOne`/`deleteOne`/`save` sobre evento existente | Error de inmutabilidad |
| MT-52 | R | Denegaciones 403/404 de alcance | Evento `ACCESS_DENIED` sin contenido del expediente |
| MT-53 | H | `u_tit_obp` → `GET /audit-events` | 403 |

## G. No regresión del ERP

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-60 | U | `rbac.PERMISSIONS` del ERP | Igual al catálogo de `d5b64b0` (30 entradas, mismo orden) |
| MT-61 | U | Prueba de frontera de imports (ERP ↛ municipal; municipal → solo security/shared/middleware/config) | Pasa |
| MT-62 | — | Suite backend y frontend completas | Sin fallos nuevos respecto a la línea base |
| MT-63 | E | Login, Clientes, Ventas, Inventario en web y APK con usuario sin membresía | Idénticos; el menú no muestra MuniERP |
| MT-64 | E | Usuario con membresía en web **y** Android | Menú MuniERP visible; 404 de alcance mostrado como "No encontrado" |

## Ejecución de la línea base

Ejecutado el 2026-10-23 sobre una **copia limpia** de `main@d5b64b0` (`git archive`), en la VM
Linux del equipo del usuario (Node v22.23.2), reutilizando el `node_modules` local ya instalado.
No se usó base de datos real. El entorno en la nube no pudo instalar dependencias (registro npm
bloqueado por política de red).

| Suite | Resultado | Nota |
|---|---|---|
| Backend (mocha, `tests/**` + `src/**`) | **953 passing, 0 failing** | 952 en la corrida completa + 1 (`Phase 1 ESLint configuration`) que excedió el timeout de 20 s por E/S del disco montado; re-ejecutado con 150 s: pasa (44 s). |
| Frontend (jest) — **parcial** | **20 de 32 suites ejecutadas: 19 PASS, 1 FAIL.** Pruebas: ≥161 passing, **3 failing**, 9 todo | La corrida se hizo por lotes (límite de 180 s por comando en la VM) y se interrumpió al desconectarse el equipo. |

**Fallos reales en `main` (no introducidos por esta fase)** — `tests/m01.frontend.test.js`:
1. `detail confirms status before sending` — no encuentra el texto `Estado: inactive`.
2. `roles distinguish protected system and editable custom roles`.
3. `roles read only hides create/edit`.

La copia local de trabajo del usuario tiene cambios **sin commit** en ese archivo de prueba (y en
otros 9), por lo que es probable que la corrección ya exista localmente; debe integrarse por rama
y PR antes de iniciar MuniERP para tener una línea base verde.

**Suites no ejecutadas aún (12):** `inventory`, `components`, `customers.phase7`,
`inventory.navigation`, `products.navigation`, `inventory.api`, `m01.sessions`, `products.api`,
`auth-experience`, `suppliers.navigation`, `suppliers`, `shell`. **No se declaran aprobadas.**

Ejecutadas y aprobadas: `frontend`, `suppliers.api`, `navigation`, `customers.navigation`, `api`,
`products`, `auth-navigation`, `m01.navigation`, `sales`, `customers.frontend`,
`sales.navigation`, `theme`, `customers.api`, `features`, `password-recovery`,
`customers.web-actions`, `sales.api`, `login`, `rbac`.

No se ejecutaron: build web, APK Android, integración real contra Atlas QA (no autorizado en esta
fase) ni E2E.
