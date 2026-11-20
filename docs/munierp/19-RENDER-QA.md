# MuniERP QA por HTTPS en Render

Desplegar en un **Web Service nuevo**, separado de `yj-nexo-api`. No modificar ni vincular a `main`. El servicio sirve la web y las APIs en un mismo origen público por HTTPS. Los perfiles son de prueba y usan claves independientes, no se imprimen claves en logs. La primera puesta en marcha carga únicamente el catálogo sintético que falte y no instala índices ni borra expedientes.

No es un entorno de producción. El almacenamiento es MongoDB Atlas real en `munierp_qa`. No usar usuarios ni datos oficiales, ni conectar otras bases. No reutilizar secretos, URI o grupos de variables del servicio productivo.

## Formulario de Render

| Campo | Valor |
|---|---|
| Service Name | `yj-nexo-munierp-qa` (o nombre QA disponible en Render) |
| Source | `JessBlack-GT/erp-dep` |
| Branch | `integration/munierp-atlas-qa` |
| Language | `Node` |
| Root Directory | Vacío |
| Region | Virginia, si es la elegida para QA |
| Build Command | `npm ci --include=dev && EXPO_PUBLIC_API_BASE_URL=/api/v1 npm run build:web --workspace apps/frontend` |
| Start Command | `node apps/backend/scripts/municipal-local-qa.cjs --render` |
| Health Check Path | `/qa-ready` |
| Instance Type | `Free` si está disponible y ese es el plan elegido |
| Auto-Deploy | Apagado para que los pushes no desplieguen automáticamente |

Render asigna `PORT` y `RENDER_EXTERNAL_URL`. No escribirlos manualmente. La opción Free está sujeta a los límites del espacio de trabajo y se duerme si no recibe tráfico.

## Variables de entorno del servicio nuevo

| Nombre | Valor |
|---|---|
| `NODE_ENV` | `test` |
| `MUNICIPAL_QA_RENDER_ENABLED` | `1` |
| `MUNICIPAL_QA_AUTHORIZED` | Fecha de autorización en UTC, responsable y base. Formato `AAAA-MM-DD\|responsable\|munierp_qa`. |
| `MUNICIPAL_QA_URI` | URI del usuario **munierp_qa_app** del proyecto MuniERP-QA, terminando en `/munierp_qa?authSource=admin`. Nunca usar la de instalación. |
| `MUNICIPAL_QA_USERS_JSON` | Objeto JSON con claves `ventanilla`, `obras` y `auditor`. Cada valor es distinto, hexadecimal y de 32 caracteres. |

Genera los valores para los usuarios web en **tu propia consola privada** y guárdalos. Solo compártelos con los responsables de la prueba por un medio apropiado. El nombre de inicio de sesión es el rol seguido de `@demo.test`. No pegues este resultado ni la URI en el chat o en GitHub.

```powershell
@{
  ventanilla = [Guid]::NewGuid().ToString('N')
  obras      = [Guid]::NewGuid().ToString('N')
  auditor    = [Guid]::NewGuid().ToString('N')
} | ConvertTo-Json -Compress
```

Para construir la URI de QA sin escribir la contraseña en el historial de PowerShell, solicita la clave con `Read-Host -AsSecureString` y aplica `[uri]::EscapeDataString(...)` al valor antes de incorporarlo a la URI. Introduce la URI completa únicamente en la variable de entorno privada del servicio.

En Atlas **MuniERP-QA**, permite los rangos de salida del servicio de Render (**Connect → Outbound**). Solo agrega los rangos en el proyecto municipal. Si no hay acceso, el arranque se detiene y Render no inicia la API. Corrige la lista y vuelve a intentar. No hace falta abrir Atlas con `0.0.0.0/0`.

## Verificación

1. En el servicio nuevo, espera el mensaje **Render QA con Atlas** y abre su URL de Render seguida de `/qa-ready`. Debe responder `{"ok":true}`.
2. Abre la raíz web, entra con `obras@demo.test` y comprueba la franja **QA POR HTTPS · datos sintéticos guardados en Atlas**.
3. Consulta `SJH-OBP-SOL-2026-000001` y verifica el asunto **Prueba de persistencia en Atlas** y su historial.
4. Antes de compilar el APK, toma la URL HTTPS efectiva. Los cambios del APK y su firma no forman parte de este despliegue.

Fuentes de Render: [Web Services](https://render.com/docs/web-services), [Outbound IPs](https://render.com/docs/outbound-ip-addresses) y [Free](https://render.com/docs/free).
