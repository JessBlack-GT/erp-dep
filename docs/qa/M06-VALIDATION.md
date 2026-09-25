# M06 — Validación técnica y cierre QA

Fecha: 25 de septiembre de 2026. Evidencia estructurada: [M06-results.json](M06-results.json). Arquitectura y contrato: [INVENTORY.md](../modules/INVENTORY.md).

## A. Git

- Baseline confirmado limpio: main y origin/main en `b166e88532ca0eca6df0455f78b10113ecec013c`, después de fetch y pull --ff-only.
- Rama creada desde ese baseline: `codex/m06-inventory`.
- Implementación validada: `c345e1f`; el commit documental posterior no cambia código.
- Publicación: destino origin/codex/m06-inventory, sin merge, force push ni squash. El informe de entrega verifica el SHA final local/remoto.
- Main permanece en el baseline M05. No se inicia M07.
- Dependencias modificadas: ninguna.

## B. Arquitectura

Almacenes, balances y movimientos ya estaban previstos en DATABASE.md. M06 completa ese diseño con código/estado/auditoría, balances materializados por producto+almacén y un historial inmutable. No hay Product.stock.

Decisiones nuevas: cantidades exactas escaladas 1/10000, máximo 100000000.0000; stock negativo prohibido; transacciones snapshot/majority; actualización condicional; idempotencia por actor/clave; transferencia de una sola operación; coordinación transaccional con M05 para impedir que un producto con historial se convierta en servicio o pierda trackInventory. Auditoría siempre desde identidad autenticada.

Un movimiento, sus balances y las dos ramas de transferencia se confirman juntos. Se forzó un fallo al insertar el historial y se comprobó rollback sin cambios residuales. Se distinguen pruebas de orquestación con stubs y pruebas reales de transacciones en Atlas.

## C. Backend M06

| Suite | Total | Pass | Fail | Omitidas | Exit |
|---|---:|---:|---:|---:|---:|
| Dominio, precisión, validación, repositorio y coordinación de catálogo | 69 | 69 | 0 | 0 | 0 |
| HTTP/RBAC, rutas protegidas y errores | 65 | 65 | 0 | 0 | 0 |
| Total aislado M06 | 134 | 134 | 0 | 0 | 0 |

Pruebas ejecutadas mediante Mocha/Chai/Sinon/Supertest. El caso de concurrencia con almacenamiento simulado verifica el predicado de débito, pero no se acredita por sí solo como prueba de atomicidad MongoDB.

## D. Frontend M06

| Suite | Total | Pass | Fail | Omitidas | Exit |
|---|---:|---:|---:|---:|---:|
| Interfaz con API simulada | 24 | 24 | 0 | 0 | 0 |
| Cliente HTTP autenticado | 8 | 8 | 0 | 0 | 0 |
| Registro/navegación | 2 | 2 | 0 | 0 | 0 |
| Total aislado M06 | 34 | 34 | 0 | 0 | 0 |

Jest + React Native Testing Library. Cubren carga/vacío/error/reintento, saldos, historial, búsqueda/filtros/paginación, cuatro operaciones, confirmación/cancelación, stock insuficiente, idempotencia de reintento, elegibilidad de selector, permisos y almacenes. El smoke de export del módulo se cuenta adicionalmente dentro de la suite global de features.

## E. RBAC

| Suite | Total | Pass | Fail |
|---|---:|---:|---:|
| M06 aislado, matriz y protección HTTP | 65 | 65 | 0 |
| Matriz real de permisos: 10 roles × 6 acciones | 60 | 60 | 0 |
| Regresión central de identidades/política | 57 | 57 | 0 |

Los 10 usuarios reales fueron creados para QA. Se autenticaron por login HTTP y la API resolvió su rol persistido. Claims de rol/permissions del token no se usan como fuente de autorización. Las operaciones denegadas no alteraron balances. Documentos Role existentes conservan prioridad; no se modificaron roles persistidos.

## F. Concurrencia y atomicidad reales

| Escenario | Operaciones simultáneas | HTTP observado | Resultado |
|---|---|---|---|
| Stock 10; dos salidas de 8 | 2 | 409, 201 | Origen 2; un débito aplicado |
| Stock 10; dos transferencias de 8 | 2 | 409, 201 | Origen 2, destino 8; una transferencia |
| Misma clave; dos entradas de 0.1 | 2 | 201, 200 | Saldo 0.1; un movimiento |
| Entrada frente a conversión SERVICE | 2 | 201, 409 | Sigue PRODUCT inventariable; un movimiento |
| Fallo de historial después de actualizar balances de transferencia | 1 | 500 genérico | Ambos balances e historial iguales al snapshot anterior |

Cada escenario fue reconciliado antes de limpiar. No hubo saldo negativo, doble consumo ni movimiento parcial. Para entrada/conversión se admite también el orden inverso válido: conversión 200 y entrada 400, sin balance ni movimiento.

## G. Regresión M03/M04/M05

| Módulo | Backend dedicado | Frontend dedicado | Fail | Dictamen |
|---|---:|---:|---:|---|
| M03 | 47/47 | 18/18 | 0 | APROBADO |
| M04 | 89/89 | 30/30 | 0 | APROBADO |
| M05 | 111/111 | 33/33 | 0 | APROBADO |

Además se repitió la integración **real M05** por el cambio de su repositorio: 122 comprobaciones HTTP, exit 0, 17 fixtures creados y 17 limpiados. M03/M04 no requirieron repetir sus integraciones Atlas, porque sus dominios no cambiaron; sus regresiones aisladas y la política compartida sí se ejecutaron.

## H. Global y comandos

Antes de Atlas: backend 522/522, frontend 131 PASS + 9 TODO (140 total), build web PASS. Después de ampliar cobertura y proteger catálogo: resultados finales siguientes.

| Área | Total | Pass | Fail | TODO | Exit |
|---|---:|---:|---:|---:|---:|
| Backend global | 527 | 527 | 0 | 0 | 0 |
| Frontend global | 148 | 139 | 0 | 9 | 0 |
| Build web | 1 | 1 | 0 | 0 | 0 |

Los 9 TODO corresponden a componentes comunes y módulos futuros. No se eliminaron pruebas fallidas para obtener verde. Se reemplazó el placeholder de inventario por pruebas de comportamiento y se habilitó su smoke frontend.

Comandos, sin watch:

```sh
# cwd apps/backend
node ../../node_modules/mocha/bin/mocha.js "tests/**/*.test.js" "src/**/*.test.js" --reporter json --reporter-option output=../../tmp/m06-final-backend.json

# cwd apps/frontend
node ../../node_modules/jest/bin/jest.js --watch=false --runInBand --json --outputFile=../../tmp/m06-final-frontend.json

# cwd raíz
node apps/frontend/scripts/web.cjs --build
node apps/backend/scripts/validate-m06-real.cjs
node apps/backend/scripts/validate-m05-real.cjs
```

Los reportes/logs intermedios están en tmp ignorado; se versiona solo la evidencia saneada. El build necesitó ejecutarse fuera del sandbox para que esbuild resolviera sus rutas. La primera ejecución limitada del build falló por acceso al filesystem; el build autorizado final terminó en 0.

## I. API real M06

132 comprobaciones HTTP en la ejecución final; 128 en la ejecución preliminar. Ambas PASS y limpieza completa. Los códigos negativos siguientes son resultados esperados, no fallos de suite.

| Operación | HTTP | Resultado |
|---|---:|---|
| Almacenes, saldos, producto, historial, filtros, paginación, elegibles | 200 | PASS |
| Alta almacén | 201 | PASS |
| Entrada, salida, transferencia, ajustes +/− | 201 | PASS |
| Repetición idempotente | 200 | PASS, mismo movimiento |
| Salida/transferencia insuficiente, duplicado, clave incompatible | 409 | PASS |
| SERVICE, no inventariable, inactivo, cantidades inválidas, IDs malformados | 400 | PASS |
| Referencias inexistentes | 404 | PASS |
| Sin token / token inválido | 401 | PASS |
| Permiso insuficiente | 403 | PASS |
| Mutación directa de saldo/movimiento | 404 | PASS, ruta ausente |
| Error de inserción de historial | 500 | PASS, saneado y rollback |
| Conversión/desactivación de seguimiento con historial | 409 | PASS |

## J. Autorización real

Read consulta balances; Warehouse manage edita un almacén QA. ENTRY/EXIT/TRANSFER/ADJUSTMENT fueron solicitudes reales.

| Rol | Read | Entry | Exit | Transfer | Adjust | Warehouse manage |
|---|---:|---:|---:|---:|---:|---:|
| superadmin | 200 | 201 | 201 | 201 | 201 | 200 |
| admin | 200 | 201 | 201 | 201 | 201 | 200 |
| manager | 200 | 201 | 201 | 201 | 201 | 200 |
| sales | 200 | 403 | 403 | 403 | 403 | 403 |
| purchasing | 200 | 201 | 403 | 403 | 403 | 403 |
| warehouse | 200 | 201 | 201 | 201 | 201 | 200 |
| finance | 200 | 403 | 403 | 403 | 403 | 403 |
| hr | 403 | 403 | 403 | 403 | 403 | 403 |
| auditor | 200 | 403 | 403 | 403 | 403 | 403 |
| user | 403 | 403 | 403 | 403 | 403 | 403 |

## K. MongoDB QA y limpieza

Conexión exitosa; entorno **QA exclusivo autorizado**, comprobado con validateQaEnvironment. No se publica nombre de cuenta, contraseña ni URI. Los fixtures de M06 usaron QA_M06_*.

Conteos acumulados de M06: API preliminar (52), API final (55) y E2E (10), total **117/117**.

| Entidad | Created | Cleaned |
|---|---:|---:|
| Products | 16 | 16 |
| Warehouses | 6 | 6 |
| Movements | 59 | 59 |
| Balances | 15 | 15 |
| Users | 21 | 21 |

La regresión M05 adicional creó/limpió otros 17 fixtures, separados de esta tabla. Limpieza por IDs, marcador y actor; nunca deleteMany vacío, drop o dropDatabase. El manifiesto temporal con credenciales sintéticas del E2E fue eliminado. Backend y web de QA detenidos, sesión del navegador cerrada.

## L. Reconciliación

Se comparó cada par producto/almacén con la suma de sus movimientos antes de borrarlo. En la ejecución final, todos los pares iniciaron en cero; las semillas se contabilizan como ENTRY.

| Par QA (orden del reporte) | Inicial | Entradas | Salidas | Transferencias netas | Ajustes netos | Esperado | Real |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0 | 20.1005 | −3.1004 | −5.0004 | +0.1004 | 12.1001 | 12.1001 |
| 2 | 0 | 0 | 0 | +5.0004 | 0 | 5.0004 | 5.0004 |
| 3 | 0 | 10 | −8 | 0 | 0 | 2 | 2 |
| 4 | 0 | 10 | 0 | −8 | 0 | 2 | 2 |
| 5 | 0 | 0 | 0 | +8 | 0 | 8 | 8 |
| 6 | 0 | 0.1 | 0 | 0 | 0 | 0.1 | 0.1 |
| 7 | 0 | 1 | 0 | 0 | 0 | 1 | 1 |

API final agregado: **0 + 41.2005 − 11.1004 + 0 + 0.1004 = 30.2005**, real 30.2005. No se usa este agregado como sustituto de la comparación por almacén.

E2E: origen **0 + 10 − 3 − 2 − 0.5 = 4.5**; destino **0 + 2 = 2**. Resultado: **PASS**, sin discrepancias.

## M. E2E real

- Resultado: PASS.
- Modalidad: **AUTOMATED**, navegador integrado de Codex, frontend web real + Express + Atlas QA.
- Fecha de flujo web: 24/09/2026. El endurecimiento posterior del catálogo se validó por API/concurrencia real el 25/09/2026; no cambió el flujo frontend.
- Flujo: LOGIN → INVENTARIO → EXISTENCIAS → ENTRADA 10 → saldo 10 → SALIDA 3 → saldo 7 → TRANSFERIR 2 → origen 5/destino 2 → AJUSTAR −0.5 → origen 4.5 → HISTORIAL 4 → filtro transferencia, 1 resultado → LOGOUT.
- Cada uno de los cuatro pasos fue verificado directamente en Atlas y reconciliado.
- Se verificó la confirmación con resumen antes de aplicar y el resultado visible después de cada POST.
- No se usaron mocks para acreditar este E2E. Las pruebas Jest se reportan separadas.
- Android/iOS nativo no ejecutado; permanece como validación de plataforma futura.

Reproducción: setup del runner m06-ui-fixture.cjs, backend/web locales, interacción por navegador con el fixture temporal ignorado, verify-entry/verify-exit/verify-transfer/verify-adjustment y cleanup como comandos separados. No imprimir el manifiesto ni guardarlo en reportes.

## N. Seguridad

- .env, variantes, MongoDB.env y credenciales temporales ignorados.
- No se detectaron secretos en los blobs Git alcanzables ni archivos de trabajo a versionar, mediante comparación privada contra valores locales y patrones de claves privadas, GitHub/AWS y URI MongoDB no ficticia. Esta inspección finita no garantiza detectar formatos desconocidos.
- 401/403 comprobados aislados y reales; 10 roles existentes.
- Mass assignment / createdBy spoofing: 400; actor confirmado desde login.
- Elevación de rol: política central persistida y regresión real de identidad común 403.
- Movement mutation / direct balance mutation: 404; hooks del modelo bloquean mutación ordinaria del historial.
- Negative stock: débito condicional + transacciones + carreras reales 409/201.
- Error interno: 500 genérico, sin mensaje privado y con rollback.
- SERVICE/no inventariable bloqueados; cambio posterior de elegibilidad con historial bloqueado con 409.
- Sin cambios en credenciales, conexiones, TLS, allowlists ni permisos Atlas.

## O. Archivos principales

- Backend: apps/backend/src/modules/inventory/*, src/security/rbac.js y protección coordinada en modules/products/products.repository.js.
- Frontend: features/inventory/*, services/api.js y app/navigation/MainNavigator.js.
- Pruebas: backend inventory.test.js/inventory.rbac.test.js; frontend inventory.test.js/inventory.api.test.js/inventory.navigation.test.js y features.test.js.
- QA: scripts/validate-m06-real.cjs y scripts/m06-ui-fixture.cjs.
- Documentación: INVENTORY.md, M06-VALIDATION.md, M06-results.json, MODULES.md, DATABASE.md, PRODUCTS-SERVICES.md, RBAC.md e índices README.

## P. Commits de implementación

- a3dd7c1 — feat(inventory): add warehouses and atomic stock movements
- 687887a — feat(rbac): authorize inventory operations with central policy
- ae7ff59 — feat(inventory): add inventory frontend workflow
- eb13958 — test(inventory): cover domain authorization and frontend flows
- 79be316 — test(inventory): validate atomicity concurrency and QA reconciliation
- c345e1f — fix(inventory): preserve product eligibility across concurrent catalog changes

La evidencia y actualización de índices se añaden en un commit documental separado. No se hace squash.

## Q. Dictamen

**M06: APROBADO**

Aprobación del alcance backend/web y QA definido para M06. Concurrencia, atomicidad, reconciliación, limpieza y regresión demostradas. La entrega publica exclusivamente la rama de trabajo; no integra main ni desarrolla M07.

