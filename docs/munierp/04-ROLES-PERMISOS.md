# MuniERP IA — Fase 0 · 04 Matriz de roles y permisos

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
| `municipal.audit.read` | – | – | – | – | – | ✔ | – |

Alcances: **M** = todo el municipio · **D** = dependencias de la membresía · **A** = solo
expedientes asignados al usuario · **P** = propios (creados por el usuario) · **Meta** = solo
folio, tipo, estado, dependencia y fechas (sin descripción ni datos del ciudadano) · **✔** = sin
restricción adicional dentro del municipio.

¹ Solo puede asignar roles cuyos permisos sean subconjunto de los propios, nunca a sí mismo, y
nunca crear otro `ADMIN_MUNICIPAL` (reservado a bootstrap/ops), siguiendo la regla de M01.
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
REGISTRADA ──turnar──► EN_TRAMITE ──► EN_ESPERA_CIUDADANO ──► EN_TRAMITE
    │                       │
    └──cancelar──► CANCELADA └──cerrar──► CERRADA (respuesta obligatoria)
```

Cada transición agrega entrada a `history[]` y un evento de bitácora con el mismo `requestId`.

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
