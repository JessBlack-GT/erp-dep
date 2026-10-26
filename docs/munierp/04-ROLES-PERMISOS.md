# MuniERP IA — 04 Matriz de roles y permisos

> Revisión 2026-10-26: se añaden `requests.assignUser` (RQ02), `documents.*` (RQ05) e
> `indicators.read` (RQ04). El resto de la matriz de Fase 0 se mantiene. Fuente codificada:
> `apps/backend/src/modules/municipal/policy/permissions.js` (congelada por prueba).

Catálogo **independiente** del ERP (`security/municipal-rbac.js`, ADR-04). Un permiso municipal
solo se evalúa sobre una **membresía activa y vigente** en el municipio de la ruta.

## Roles municipales

| Rol | Propósito | Alcance por defecto |
|---|---|---|
| `ADMIN_MUNICIPAL` | Configura dependencias y membresías. **No** consulta contenido de expedientes. | Municipio (configuración) |
| `SUPERVISOR_MUNICIPAL` | Presidencia / Secretaría: visión transversal, turnado entre dependencias. | Municipio (sin confidenciales) |
| `TITULAR_DEPENDENCIA` | Responsable de una dependencia: atiende, turna, cierra. | Sus dependencias |
| `OPERADOR_DEPENDENCIA` | Personal operativo: registra y da seguimiento. | Sus dependencias; edición solo si asignado |
| `VENTANILLA` | Atención ciudadana: registra solicitudes y ciudadanos para cualquier dependencia. | Lo que creó |
| `AUDITOR_MUNICIPAL` | Contraloría: bitácora y metadatos, solo lectura. | Municipio (metadatos) |
| `CONSULTA` | Lectura de su dependencia. | Sus dependencias |

Los roles del ERP (`superadmin`, `admin`, `manager`, …) **no conceden ningún permiso municipal**.

## Catálogo de permisos (`municipal.*`)

| Permiso | ADMIN | SUPERV | TITULAR | OPERADOR | VENTANILLA | AUDITOR | CONSULTA |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `municipal.dependencies.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `municipal.dependencies.manage` | ✔ | – | – | – | – | – | – |
| `municipal.memberships.read` | ✔ | ✔ | D | – | – | ✔ | – |
| `municipal.memberships.manage` | ✔¹ | – | – | – | – | – | – |
| `municipal.citizens.read` | – | M | D | D | P | – | D |
| `municipal.citizens.create` | – | – | ✔ | ✔ | ✔ | – | – |
| `municipal.citizens.update` | – | – | D | D | P | – | – |
| `municipal.requests.create` | – | ✔ | D | D | ✔ (cualquier dep.) | – | – |
| `municipal.requests.read` | – | M | D | D | P | Meta | D |
| `municipal.requests.update` | – | – | D | A | – | – | – |
| `municipal.requests.assign` (turnar) | – | M | D | – | – | – | – |
| `municipal.requests.close` | – | – | D | – | – | – | – |
| `municipal.requests.cancel` | – | M | D | – | – | – | – |
| `municipal.requests.grant` (compartir) | – | M | D | – | – | – | – |
| `municipal.requests.readConfidential` | – | ✔² | D² | – | – | – | – |
| `municipal.requests.assignUser` (responsable) | – | – | D | – | – | – | – |
| `municipal.documents.read` (listar/descargar) | – | M | D | D | P | – | D |
| `municipal.documents.upload` | – | – | D | D | P | – | – |
| `municipal.documents.retire` | – | – | D | – | – | – | – |
| `municipal.indicators.read` | – | M | D | – | – | ✔ | D |
| `municipal.audit.read` | – | – | – | – | – | ✔ | – |

Alcances: **M** = todo el municipio · **D** = dependencias de la membresía · **A** = solo
expedientes asignados al usuario · **P** = propios (creados por el usuario) · **Meta** = solo
folio, tipo, estado, dependencia y fechas (sin descripción ni datos del ciudadano) · **✔** = sin
restricción adicional dentro del municipio.

¹ Puede asignar cualquier rol excepto `ADMIN_MUNICIPAL` (reservado a bootstrap/ops), nunca a sí
mismo y nunca modificar su propia membresía. *Corrección 2026-10-26:* la regla de "subconjunto de
permisos propios" de M01 no es aplicable aquí, porque ADMIN_MUNICIPAL deliberadamente **no** tiene
permisos sobre expedientes; la separación de funciones se garantiza porque el administrador no
puede darse a sí mismo un rol operativo (otra persona con ADMIN_MUNICIPAL tendría que hacerlo, y
queda en bitácora).
² Requiere además que el expediente esté en alcance; `CONFIDENCIAL` nunca es visible por "M"
sin este permiso.

## Regla de acceso por expediente

Un usuario `u` con membresía `m` puede **leer** el expediente `e` si y solo si:

```
e.municipalityId == m.municipalityId
AND m.status == ACTIVA AND now ∈ [m.validFrom, m.validTo)
AND tiene municipal.requests.read
AND (  alcance M (rol SUPERVISOR)
    OR e.ownerDependencyId ∈ m.dependencyIds
    OR e.assignedDependencyIds ∩ m.dependencyIds ≠ ∅
    OR e.assignedUserId == u
    OR (alcance P AND e.createdBy == u)
    OR ∃ grant vigente (granteeUserId == u OR granteeDependencyId ∈ m.dependencyIds) )
AND (e.confidentiality != CONFIDENCIAL OR tiene readConfidential OR e.assignedUserId == u)
```

Para **escribir** se exige además el permiso de la acción y que el expediente no esté en estado
terminal (`CERRADA`, `CANCELADA`). Un grant `READ` nunca permite escribir.

## Ciclo de vida de una solicitud

```
REGISTRADA ──turnar/asignar──► EN_TRAMITE ──► EN_ESPERA_CIUDADANO ──► EN_TRAMITE
    │                       │
    └──cancelar──► CANCELADA └──cerrar──► CERRADA (respuesta obligatoria)
```

Acciones: `TURNAR` (cambia dependencias; REGISTRADA→EN_TRAMITE), `ASIGNAR` (responsable dentro
de una dependencia en alcance; REGISTRADA→EN_TRAMITE o sin cambio de estado), `ESPERAR_CIUDADANO`,
`REANUDAR`, `CERRAR` (nota obligatoria), `CANCELAR` (nota obligatoria).

**RQ02:** cada acción agrega a `history[]` una entrada inmutable con `actorId`, `at`, `action`,
`fromStatus`, `toStatus` (y `assignedUserId`/`toDependencyIds`/`note` cuando aplica), más un evento
de bitácora con el mismo `requestId`. Una acción que no cambia el estado registra igualmente
`fromStatus == toStatus`.

## Casos límite decididos

| Caso | Decisión |
|---|---|
| Superadmin ERP intenta leer expedientes | 403 (`MUNICIPAL_MEMBERSHIP_REQUIRED`). |
| Usuario creado por `/auth/register` | Sin membresía → 403 en todo `/api/municipal/v1`. |
| Membresía vencida (`validTo` pasado) | Igual que inexistente: 403. |
| Usuario ERP desactivado | 401 en la siguiente petición (vía `resolveAccess`). |
| Expediente de otra dependencia | 404 (no revela existencia) + evento `ACCESS_DENIED`. |
| Municipio distinto en la ruta | 403 si no hay membresía en ese municipio; nunca se infiere municipio del payload. |
| `municipalityId`/`folio`/`createdBy` en el body | Rechazado (400): se derivan del servidor. |
| Descarga de documento de expediente fuera de alcance | 404 + evento `ACCESS_DENIED` (RQ05). |
| Documento `CONFIDENCIAL` en expediente `PUBLICA` sin `readConfidential` | Se lista sin nombre de archivo; descarga 404. |
| Ventanilla descarga documento que no subió de un expediente que sí creó | Permitido mientras el expediente esté en su alcance P y el documento no sea más restrictivo. |
| Indicadores pedidos por un usuario de TES | Solo cuentan expedientes en su alcance; nunca totales del municipio. |
