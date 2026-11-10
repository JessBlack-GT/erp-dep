# Contrato municipal-v1 — propuestas para una futura draft.4 (NO publicada)

> **Referencia vigente: `municipal-v1.openapi.yaml` 1.0.0-draft.3.** Este archivo no modifica el
> contrato. Reúne las propuestas X-01…X-04 surgidas en F1-13, reevaluadas el 2026-11-10 contra los
> datos que draft.3 ya entrega, para que Codex decida antes de integrar. Ninguna se implementó en el
> servidor ni en la interfaz.

| ID | Propuesta original (F1-13) | Veredicto | ¿Cambia el contrato? |
|---|---|---|---|
| X-01 | `HistoryEntry.actorName` | **Mantener** como extensión aditiva opcional | Sí (campo opcional nuevo) |
| X-02 | `MyMembership.scopes` | **Retirar**: se resuelve con datos existentes | No |
| X-03 | `RequestFull.allowedActions` | **Diferir** (opcional, prioridad baja) | Sí, si se aprueba |
| X-04 | `Document.restricted: true` | **Retirar**: ya existe en draft.3 | No |

## X-01 — nombre visible del actor en el historial

- **Hoy (draft.3):** `HistoryEntry` solo trae `actorId`. Los nombres de los funcionarios viven en el
  `User` del ERP; ningún endpoint municipal los expone. `MembershipView` trae `userId` y `role`, pero
  solo lo pueden leer roles con `municipal.memberships.read` (operador, ventanilla y consulta no).
- **Con los datos existentes** se puede mejorar sin tocar el contrato, pero solo de forma parcial:
  para quien tiene `memberships.read`, mostrar «Titular · OBP» cruzando `actorId` con `userId`; para
  los demás, se conserva «Funcionario ···<6 últimos>». No da un nombre.
- **Propuesta:** `actorDisplayName?: string` (opcional, ≤ 120, sin correo ni teléfono) en `HistoryEntry`,
  resuelto por el servidor a partir del `User` del ERP en el momento de la lectura. Es aditivo (los
  clientes de draft.3 lo ignoran) y no exige versión `v2`.
- **Decisiones para Codex:** (a) si el nombre del servidor público puede mostrarse a todo rol con
  acceso al expediente; (b) lectura en vivo o copia al escribir (la copia preserva el nombre histórico
  pero duplica datos personales); (c) qué hacer con cuentas desactivadas.

## X-02 — alcance por permiso en `MyMembership` (retirada)

`MyMembership` ya entrega `role`, `dependencies` y `permissions`. La interfaz solo usa esos datos para
**mostrar u ocultar** acciones; la autorización real (alcance M/D/A/P, expediente, confidencialidad)
la decide el servidor en cada petición, y la interfaz ya trata 403/404/409 con mensaje y recarga.
Exponer el alcance no añadiría seguridad y obligaría a mantener otra representación de la matriz.

## X-03 — acciones permitidas calculadas por el servidor (diferida)

- **Hoy:** la interfaz replica la tabla de transiciones (`TRANSITIONS` ↔ `ACTIONS`), vigilada por una
  prueba de paridad en Jest. Puede mostrar un botón que el servidor rechace por alcance (p. ej. un
  operador con `requests.update` de alcance A sobre un expediente no asignado); el rechazo es seguro.
- **Propuesta (si Codex la aprueba):** `allowedActions?: string[]` en `Request` (vista completa),
  calculado con las mismas funciones de `policy/access.js`. Aditiva. Eliminaría la duplicación y los
  botones que terminan en 403.
- **Por qué diferirla:** no bloquea ninguna historia y aumenta el costo de cada lectura de detalle.

## X-04 — documento restringido (retirada; corrección del informe F1-13)

draft.3 ya define `DocumentRestricted` (`required: [id, confidentiality, restricted]`,
`restricted: { const: true }`), el servicio lo emite en `listDocuments` y `RequestDetail` ya usa
`d.restricted`. El documento 13 decía por error que la interfaz deducía la restricción por la ausencia
de `filename`; queda corregido. No se requiere cambio.
