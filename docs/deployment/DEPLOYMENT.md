# YJ Nexo ERP — Render + Cloudflare Pages + MongoDB Atlas

Preparación del 2026-09-29 sobre baseline
`55e3ff3d1699f4e695d0a8decdc656d7769bef49`, rama `codex/deploy-readiness`.
No se despliega, no se integra a main y no se crean proyectos de hosting.
M14/UI-05 y módulos nuevos permanecen sin iniciar.

**Código preparado; despliegue bloqueado hasta completar la configuración
externa y aprobar la integración de esta rama.** No se ha verificado acceso a
cuentas Render/Cloudflare ni a una base de producción.

## Arquitectura real

```text
Cloudflare Pages (archivos estáticos + HTTPS + fallback SPA)
  → Frontend React Native Web / React 18
    → API Express en Render (HTTPS)
      → MongoDB Atlas (TLS, transacciones)
```

Monorepo npm workspaces con un package-lock.json en la raíz. Backend CommonJS
sin compilación, entrada apps/backend/src/server.js. Web compila con esbuild
desde apps/frontend/src/web.jsx: **no es un export de Expo**, aunque scripts
android/ios heredados mencionan Expo. Expo no es dependencia del frontend.
No se cambian esquemas, RBAC, módulos ni diseño.

## Render — configuración propuesta

| Campo | Configuración |
|---|---|
| Producto | Web Service |
| Runtime | Node |
| Production branch | main, solo después de integrar esta preparación con autorización |
| Root Directory | Raíz del repositorio; dejar vacío, equivalente a `.` |
| Build Command | `npm ci --omit=dev --workspace=apps/backend` |
| Start Command | `npm start --workspace=apps/backend` |
| Health Check Path | `/api/v1/ready` |
| Liveness | `/api/v1/health` |
| Node | 24.21.0, igual a la versión local validada; fijada en .node-version |
| Puerto | PORT asignado por Render; escucha explícita en 0.0.0.0 |
| NODE_ENV | production |
| TRUST_PROXY_HOPS | 1 para acceso directo por el proxy de Render |

No usar apps/backend como raíz: se perdería el lockfile del monorepo.
El arranque conecta MongoDB antes de escuchar. /health expresa vida del proceso;
/ready devuelve 200 conectado y 503 desconectado. Las sondas GET están exentas
del rate limit para no provocar reinicios por las comprobaciones periódicas.
La readiness usa readyState del driver, no un ping en cada solicitud.

Render termina TLS y entrega HTTP interno al proceso. No se requiere certificado
local ni URL localhost de producción. Si posteriormente se añade otro proxy
delante de Render, revisar el número de saltos con la topología real; nunca usar
trust proxy indiscriminado. Confirmar en hosting que clientes diferentes tienen
rate limits distintos y que X-Forwarded-For enviado por el cliente no permite
suplantación. Mantener inicialmente una instancia; MemoryStore no comparte
cuotas entre instancias y se reinicia con el proceso.

## Variables backend — presencia local, nunca valores

Inspección de presencia en entorno del proceso y .env local ignorado. “Sí” no
significa apto para producción: las credenciales locales corresponden a QA.
Las columnas siguientes contienen exclusivamente nombres, finalidad y estado.

| Variable | Requerida | Secreta | Uso | Configurada localmente | Configurar en Render |
|---|---|---|---|---|---|
| NODE_ENV | Sí | No | Modo de ejecución | Sí | Sí |
| PORT | Sí, hosting | No | Puerto HTTP | Sí | Automática |
| MONGODB_URI | Sí | Sí | Conexión Atlas | Sí | Sí, independiente de QA |
| MONGODB_DB_NAME | Sí en producción | No | Selección explícita de base | Sí | Sí, independiente de QA |
| JWT_SECRET | Sí | Sí | Firma access JWT | Sí | Sí, nueva e independiente |
| JWT_REFRESH_SECRET | Sí | Sí | Firma refresh JWT | Sí | Sí, distinta de access/QA |
| CORS_ORIGIN_FRONTEND | Sí en producción | No | Origen web permitido | No | Sí |
| CORS_ORIGIN | No | No | Segundo origen exacto opcional | No | Solo si se necesita |
| TRUST_PROXY_HOPS | Sí para Render | No | IP cliente tras proxy | No | Sí |
| JWT_EXPIRES_IN | No | No | Duración access | No | Opcional, revisar política |
| JWT_REFRESH_EXPIRES_IN | No | No | Duración refresh | No | Opcional, revisar política |
| RATE_LIMIT_MAX | No | No | Cuota por IP | No | Opcional, revisar capacidad |
| RATE_LIMIT_WINDOW_MS | No | No | Ventana de cuota | No | Opcional |
| BCRYPT_ROUNDS | No | No | Configuración heredada; modelo usa coste fijo 12 | No | No, no cambia el hash actual |
| EMAIL_HOST | No | No | Configuración futura, sin recuperación por correo | No | No |
| EMAIL_PORT | No | No | Configuración futura | No | No |
| EMAIL_USER | No | Sí | Configuración futura | No | No |
| EMAIL_PASS | No | Sí | Configuración futura | No | No |
| COMPANY_NAME | No | No | Metadato con valor predeterminado | No | Opcional |
| COMPANY_URL | No | No | Metadato, no controla API ni CORS | No | Opcional |
| M03_QA_DATABASE | Solo runners QA | No | Confirmación exclusiva QA | Sí | **No** |
| NODE_VERSION | Fijada en archivo | No | Runtime hosting | No | Opcional; no contradecir .node-version |

La configuración de producción no carga archivos .env ni MongoDB.env. Falla
antes de conectar si faltan variables críticas, las claves JWT son cortas o
iguales, hay placeholders, CORS no es un origen HTTPS exacto, se detecta
configuración QA o se desactiva TLS/certificados en MongoDB. Mensajes de fallo
contienen nombres, nunca valores. Las claves deben generarse mediante un gestor
seguro con al menos 32 bytes aleatorios, distintas y fuera de Git. La validación
de longitud no garantiza entropía. Mantener los defaults de expiración salvo
decisión operativa explícita; no copiar el rate limit elevado de los runners QA.

## Atlas — configuración pendiente

MONGODB_URI contiene la conexión y MONGODB_DB_NAME selecciona explícitamente la
base. Localmente se usa SRV sin desactivar TLS; M01 ya conectó exitosamente a QA.
**No se repitió conexión** y no se afirma conectividad desde Render ni producción.
En producción el driver fuerza TLS y rechaza opciones que ignoran certificados.

Antes de habilitar tráfico:

1. Seleccionar/confirmar cluster y base destinados al despliegue, separados de QA,
   con transacciones disponibles. No inferirlos de la configuración local.
2. Crear/confirmar usuario de aplicación con permisos sobre esa base solamente
   (readWrite, incluidos índices necesarios), contraseña independiente y respaldo
   apropiado. No ejecutar migraciones destructivas ni seeds de ejemplo.
3. En Network Access autorizar **todos los CIDR de salida del servicio Render**,
   obtenidos desde Connect → Outbound del servicio/región. No copiar la IP del
   equipo local ni abrir 0.0.0.0/0 como solución predeterminada. Esos rangos pueden
   ser compartidos; la autorización de DB sigue siendo necesaria.
4. Configurar secretos solo en Render y comprobar /ready y login cuando se
   autorice desplegar. No ejecutar fixtures sobre producción.
5. Confirmar una cuenta administrativa operativa y un procedimiento seguro de
   provisión inicial si la base está vacía. El registro público asigna user sin
   permisos; **no crea el primer admin**. El package.json declara seed/migrate
   pero los scripts correspondientes no existen: no usarlos ni asumir bootstrap.
   No se crea una cuenta ni se modifica RBAC en esta preparación.

## Cloudflare Pages — configuración propuesta

| Campo | Configuración |
|---|---|
| Producto | Pages, sitio estático con integración Git |
| Framework preset | None, build personalizado esbuild / React Native Web |
| Production branch | main, después de aprobar e integrar esta preparación |
| Root Directory | Raíz del repositorio; vacío o `.` |
| Install Command | `npm ci --include=dev --workspace=apps/frontend` |
| Build Command completo | `npm ci --include=dev --workspace=apps/frontend && npm run build:web --workspace=apps/frontend` |
| Build output directory | `apps/frontend/dist` |
| Node | 24.21.0 mediante .node-version o NODE_VERSION |

Desactivar la instalación automática con SKIP_DEPENDENCY_INSTALL para ejecutar
el comando completo anterior una sola vez. esbuild es devDependency: conservar
--include=dev aunque el build sea de producción. No instalar Expo para web.

| Variable | Requerida | Secreta | Localmente | Configurar en Cloudflare |
|---|---|---|---|---|
| PUBLIC_API_BASE_URL | Sí, build | No | No | Sí, URL HTTPS real de Render con /api/v1 |
| NODE_VERSION | Archivo disponible | No | No | Opcional, misma versión fijada |
| SKIP_DEPENDENCY_INSTALL | Sí para el comando propuesto | No | No | Sí, habilitar |

No proporcionar MongoDB, JWT ni credenciales QA a Cloudflare. Solo
PUBLIC_API_BASE_URL se inserta explícitamente en el bundle. Es configuración de
**build**, no runtime: cambiarla exige reconstruir. Se rechazan HTTP, localhost,
credenciales en URL, query/hash y rutas distintas de /api/v1. No se inventa la
URL futura. El build validado usó un dominio .invalid sintético sin tráfico;
**ese artefacto no debe desplegarse**. Reconstruir con la dirección real.

## CORS y SPA

CORS_ORIGIN_FRONTEND debe ser el origen HTTPS exacto de Pages/dominio elegido,
sin path ni slash final. CORS_ORIGIN permite un segundo origen exacto si hace
falta. No se permiten localhost ni comodines en producción. Authorization y
preflight están permitidos; credentials se conserva. Requests sin Origin
(mobile/CLI/health checks) siguen permitidas: CORS no reemplaza autenticación.
No autorizar previews arbitrarios; configurar previews contra entorno separado.

Pages aplica fallback SPA si no existe 404.html en la raíz del output. El build
actual no lo genera: /login, /customers, /suppliers, /products, /inventory,
/users y /roles reciben index.html en lugar de 404 de hosting. No hace falta
añadir un redirect redundante. Se comprobó el artefacto y se modeló localmente
ese fallback; **no se probó un proyecto Cloudflare real**.

NavigationContainer actualmente no tiene linking: estas URLs cargan la SPA,
pero no seleccionan automáticamente la pantalla homónima. El flujo vigente
abre login o la pantalla inicial autenticada. No se añade navegación profunda
como funcionalidad nueva. Verificar las siete recargas en hosting en el smoke
de deploy, sin confundir ausencia de 404 con deep linking implementado.

## Seguridad: clasificación para primer despliegue

| Clase | Hallazgo / acción |
|---|---|
| BLOCKER | Integrar esta rama en la rama de producción mediante una fase autorizada; main aún es el baseline anterior. |
| BLOCKER | Configurar URLs reales y variables/secretos de hosting; todavía no se conocen ni verifican. |
| BLOCKER | Confirmar DB/usuario Atlas independiente de QA y autorizar salida de Render; conectividad productiva sin verificar. |
| IMPORTANT | Confirmar primer administrador operativo/provisión segura antes de abrir uso real; seed heredado inexistente. |
| IMPORTANT | AsyncStorage web conserva tokens accesibles a JavaScript: riesgo XSS. No hay cifrado/HttpOnly; evaluar endurecimiento posterior. |
| IMPORTANT | Rate limiting en memoria, una instancia; verificar topología proxy/IP en hosting y ajustar cuota a la operación real. |
| IMPORTANT | Planificar backups, monitorización, renovación de claves y actualización de dependencias; no se realizó auditoría CVE exhaustiva. |
| ACCEPTABLE FOR FIRST DEPLOY | Helmet, JWT/refresh con revocación M01, bcrypt coste 12, permisos dinámicos y errores genéricos en producción. |
| ACCEPTABLE FOR FIRST DEPLOY | TLS a Atlas, HTTPS de hosting, CORS explícito; configuración local QA rechazada en producción. |
| ACCEPTABLE FOR FIRST DEPLOY | Build minificado sin source maps. Logs de producción sin body, headers ni query; errores sin mensaje arbitrario ni detalles MongoDB. |
| ACCEPTABLE FOR FIRST DEPLOY | Sin email de recuperación; Android/iOS no ejecutados; no son requisitos de este despliegue web inicial. |

## Validación realizada

| Comando / comprobación | Resultado |
|---|---|
| npm test --workspace=apps/backend | 633 PASS, 0 FAIL, exit 0 |
| npm test --workspace=apps/frontend | 29 suites, 229 PASS, 0 FAIL, 9 TODO previos, exit 0 |
| npm run build:web --workspace=apps/frontend | SUCCESS, URL HTTPS sintética de prueba, exit 0 |
| node apps/backend/scripts/smoke-production.cjs | 12 checks, exit 0; HTTP real local, NODE_ENV production, DB desconectada |
| npm ci --dry-run --omit=dev --workspace=apps/backend --ignore-scripts --no-audit --no-fund | Resolución/lock compatibles, exit 0 |
| npm ci --dry-run --include=dev --workspace=apps/frontend --ignore-scripts --no-audit --no-fund | Resolución/lock compatibles, exit 0 |
| Artefacto web | URL API HTTPS incorporada; fallback API localhost ausente; 0 source maps; sin 404.html |

Se preservan las 617/222 pruebas anteriores y los 9 TODO. Las nuevas pruebas
cubren validación de entorno, CORS y errores de producción, URL de build y
smoke de sondas/rate limit/proxy/Helmet. El smoke importa app y escucha localmente:
no prueba el arranque exitoso de server.js con DB, porque no se conecta a Atlas.
Los dry-run no sustituyen una instalación Linux limpia ni pruebas reales del
proveedor; estas quedan para deploy. No se cambiaron dependencias ni lockfile.
No se realizaron fixtures, migraciones, escrituras DB, despliegues o merges.

## Secuencia manual posterior (no ejecutada)

1. Revisar/aprobar esta rama, integrar a main y registrar el SHA de despliegue.
2. Confirmar DB, usuario, respaldo y administrador operativo en Atlas.
3. Preparar Render con comandos/runtime anteriores y variables privadas; obtener
   URL y CIDR de salida sin inventarlos; autorizar esos CIDR en Atlas.
4. Preparar Pages con API real y comando completo; obtener origen definitivo,
   incorporarlo al CORS de Render. Evitar auto-deploy antes de completar la fase.
5. Solo con autorización de despliegue: verificar readiness, preflight, HTTPS,
   login/logout y recargas SPA; no reutilizar fixture ni clave QA.
6. Rollback de código: seleccionar el último deploy sano del proveedor; no
   restaurar/destruir DB como efecto automático de rollback de código.

## Referencias oficiales consultadas

- [Render: Node version](https://render.com/docs/node-version) — versión fijada.
- [Render: Web Services](https://render.com/docs/web-services) — bind/PORT y TLS.
- [Render: Health Checks](https://render.com/docs/health-checks).
- [Render: Outbound IP addresses](https://render.com/docs/outbound-ip-addresses).
- [Cloudflare: Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).
- [Cloudflare: Build image](https://developers.cloudflare.com/pages/configuration/build-image/) — runtime e instalación personalizada.
- [Cloudflare: Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/) — fallback SPA.
- [Atlas: IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
