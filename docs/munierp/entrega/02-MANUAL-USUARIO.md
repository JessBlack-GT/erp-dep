# 02 · Manual breve de usuario

MuniERP IA se usa con la misma cuenta de YJ Nexo. El acceso municipal depende de la **membresía** que el
administrador municipal asigna a cada funcionario: rol y dependencias. El menú muestra solo las secciones
de su rol, y el servidor vuelve a comprobar cada consulta.

> En la demostración la cuenta se sustituye por la elección de **perfil** (datos sintéticos).

## Pantallas

| Sección | Quién la ve | Para qué |
|---|---|---|
| Panel principal | Todos con membresía | Rol, accesos rápidos, indicadores y solicitudes recientes de su alcance |
| Registrar solicitud | Ventanilla, titular, operador, supervisor | Captura de la solicitud ciudadana y emisión del folio |
| Solicitudes | Quien puede leer expedientes | Listado con filtros por estado y dependencia, búsqueda por folio |
| Detalle del expediente | Desde Solicitudes | Datos, historial, documentos y acciones permitidas |
| Dependencias | Todos (consulta); administrador (alta y cambios) | Catálogo de dependencias del municipio |
| Membresías y permisos | Administrador, supervisor, auditor; titular (solo su dependencia) | Quién tiene acceso, con qué rol y en qué dependencias |
| Auditoría | Solo auditor municipal | Bitácora de operaciones y accesos denegados (solo lectura) |

## Tareas frecuentes

**Registrar una solicitud (ventanilla).** Registrar solicitud → elija la dependencia, el ciudadano y el canal
→ escriba el asunto → *Registrar y emitir folio*. Se muestra el **acuse con el folio** (puede imprimirlo).
Si la red falla, *Reintentar registro* no duplica el folio. No capture CURP ni identificaciones oficiales.

**Buscar y abrir un expediente.** Solicitudes → filtre por estado o dependencia, o escriba el folio
completo (`SJH-OBP-SOL-2026-000001`) y pulse *Abrir expediente*. Si el folio no existe o no le corresponde,
verá «Expediente no encontrado o sin acceso» (por seguridad no se distingue un caso del otro).

**Atender un expediente (titular).** En el detalle, sección *Acciones*: turnar, asignar responsable, poner en
espera, reanudar, concluir o cancelar. Cada acción pide confirmación y queda en el **historial** con fecha,
actor y estados.

**Crear o editar una dependencia (administrador).** Dependencias → *Nueva dependencia*: código de 3 letras,
nombre y, opcionalmente, la dependencia superior. *Editar* permite cambiar nombre y estado. El código no se
modifica. No se puede desactivar una dependencia con expedientes abiertos o subordinadas activas.

**Dar acceso a un funcionario (administrador).** Membresías y permisos → *Asignar usuario al municipio*:
escriba el **identificador del usuario de YJ Nexo** (24 caracteres), elija el rol y las dependencias. El
usuario debe existir y estar activo en YJ Nexo. No es posible crear administradores municipales ni modificar
la propia membresía.

**Retirar un acceso.** En la membresía, *Revocar* → *Confirmar revocación*. El acceso se pierde de inmediato;
*Reactivar* lo restituye.

**Consultar la bitácora (auditor).** Auditoría → filtre por folio, recurso o fechas (AAAA-MM-DD). No se
muestran direcciones IP ni identificadores técnicos.

## Accesibilidad y uso en celular

Todas las tareas se pueden hacer **solo con teclado** (Tab para avanzar, Enter para activar, Espacio para
marcar opciones). En pantallas angostas el menú pasa arriba y el contenido ocupa una sola columna. Los
estados se comunican con texto, no solo con color.
