# UI-04 — Authentication Experience

Estado: **APROBADA CON PENDIENTES** (2026-09-28).

## Recovery

Repositorio oficial: erp-dep. Se encontró la rama codex/ui-04-auth-experience
sobre a109204b33d5267d7e3974767dcd692d9c257475, igual a origin/main después de fetch.
Working tree limpio; sin staged, untracked ni commits posteriores al baseline.
El agente anterior había creado únicamente la rama. Se continuó directamente.
No se descartaron cambios ni se recreó la rama.

## Current auth architecture

LoginScreen llama a AuthContext.login; authService usa Axios POST /auth/login.
El contexto extrae response.data.data, persiste accessToken, refreshToken y user
con AsyncStorage y actualiza usuario/token en memoria. Al iniciar recupera esas
claves. MainNavigator espera la restauración y solamente registra pantallas del
ERP con WebAppShell cuando isAuthenticated es verdadero. UserMenu llama al logout
existente: POST /auth/logout y eliminación de las tres claves en finally.
No se modificaron contratos, backend, JWT, RBAC ni módulos M03–M06.

AsyncStorage es la persistencia preexistente; esta fase no introduce un almacén
cifrado ni modifica la validación/renovación preexistente de sesiones restauradas.
La autorización efectiva sigue correspondiendo al backend.

## Diseño y componentes

AuthLayout encapsula el fondo navy, logo oficial horizontalDark con contain,
mensaje empresarial y área de formulario. Usa assets y tokens UI-01.
Las referencias reales de marca son BRAND.md y DESIGN-SYSTEM.md;
BRAND-SYSTEM.md no existe en este baseline.

- Desktop >=1024: panel de marca 48%, formulario de hasta 420px.
- Tablet 768–1023: panel 42%, separación proporcional.
- Mobile <768: branding esencial arriba y formulario en una columna.
- ScrollView permite alturas reducidas; KeyboardAvoidingView atiende teclado iOS.
- Sin window, document ni localStorage en los componentes compartidos.

Se reutilizan Text, Input y Button (incluido su spinner integrado).
Input incorpora size="large" y errorStyle opcionales, preservando sus valores
predeterminados para los demás módulos. Login usa controles de 48px y texto
oscuro de error para legibilidad. No se crea otro shell ni otro logout.

## Estados y accesibilidad

Correo y contraseña requeridos; formato básico de correo; trim solamente del
correo. Los mensajes locales se muestran junto al campo y se limpian al editar.
La contraseña está oculta inicialmente; Mostrar/Ocultar conserva su valor.
Una referencia bloquea envíos simultáneos antes del siguiente render.
Durante login se deshabilitan entradas/visibilidad y el botón indica busy,
spinner y texto anunciado. Enter permite enviar desde los campos.

401 muestra Credenciales inválidas; errores Axios de red/timeout reciben una
indicación de conexión; otros fallos reciben un mensaje fijo seguro.
No se presenta response.data, err.message, stack, tokens ni detalles privados.
La contraseña no se registra ni se añade a almacenamiento persistente.

Labels accesibles, mensajes alert y live regions; se evita el rol search de
Input en estos campos. El foco de campo usa el token existente. Se verificó
Tab de correo a contraseña y Enter para validación en navegador. Los colores
del texto de errores se sobrescriben con text.primary sobre fondo claro;
no se depende únicamente del color para comunicar errores.

## Validación

Comandos de regresión solicitados:

- npm --prefix apps/frontend test: **25 suites, 191 PASS, 0 FAIL, 9 TODO**.
- npm --prefix apps/frontend run build:web: **SUCCESS**.
- npm --prefix apps/backend test: **527 PASS, 0 FAIL**.

El primer build fue bloqueado por permisos de esbuild en sandbox. Reejecutado
con autorización fuera del sandbox, pasó sin cambiar el script de build.

UI-04: auth-experience.test.js (15), auth-navigation.test.js (2) y
login.test.js (3): **20 PASS, 0 FAIL, 0 TODO**. Se conservaron los tres casos
anteriores de login, actualizando solamente sus etiquetas y mensaje esperado.

Cobertura: marca, email, password, campos vacíos, formato inválido, envío/Enter,
trim, bloqueo doble submit, loading, 401, red, timeout, API segura, visibilidad,
limpieza de errores, accesibilidad básica, restauración, login → shell y
UserMenu → logout → login. El contexto y shell son reales en integración;
API, contenido de Clientes y native stack están simulados. No equivale a E2E.

Revisión visual en navegador local: 1440x900, 768x1024, 390x844.
Se observaron los tres layouts, errores de campos vacíos y foco de teclado;
sin desbordamiento horizontal a 768 y 390px.

**E2E real autenticado: NOT EXECUTED.** La configuración local pasa el guard
QA, pero no contiene claves de credenciales QA identificadas. No se creó
ningún usuario/fixture ni se usaron credenciales autocompletadas del navegador.
Pendientes: recorrido completo con cuenta QA autorizada y pruebas en dispositivos
Android/iOS. La compatibilidad nativa fue comprobada mediante Jest, no en dispositivo.
No se afirma certificación WCAG ni prueba completa de lector de pantalla.

## Security gates y alcance

Se inspeccionaron archivos versionados, candidatos de URI/secretos y el diff.
Sólo .env.example está versionado entre los archivos de entorno; contiene
plantillas. apps/backend/.env está ignorado. No se identificaron secretos reales
ni claves privadas/tokens de proveedor en la revisión. Los valores de fixtures
son explícitamente ficticios. No se versionaron credenciales QA.
Pruebas verifican que el shell no aparece antes de autenticación, que no se
persisten contraseñas y que logout elimina las claves de sesión.

Fase publicada inicialmente sin integrar. Integrada posteriormente en main el 2026-09-28 mediante fast-forward, sin squash, rebase ni force push. Los tres commits aprobados y la rama de fase se conservan. Regresión post-integración: 25 suites frontend, 191 PASS y 9 TODO; backend 527 PASS; build web SUCCESS (exit 0 en los tres comandos). Los pendientes E2E real y Android/iOS siguen aceptados y sin resolver. Véase UI-ROADMAP.md, sección UI-04 INTEGRATED BASELINE. UI-05 — Dashboard: **NO INICIADA**.

## Archivos

Creados: src/features/auth/AuthLayout.js, tests/auth-experience.test.js,
tests/auth-navigation.test.js (bajo apps/frontend), este documento.
Modificados: apps/frontend/src/features/auth/LoginScreen.js,
apps/frontend/src/components/common/Input.js, apps/frontend/tests/login.test.js,
docs/design/UI-ROADMAP.md.
