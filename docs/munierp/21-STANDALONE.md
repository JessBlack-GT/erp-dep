# MuniERP IA — Aplicación independiente, fase QA

**Estado:** rama `feature/munierp-standalone`, no fusionar en `main` ni desplegar sobre el servicio actual.

- Puntos de entrada separados a nivel de compilación: el frontend de esta rama solo presenta acceso y navegación municipal.
- Componentes, permisos y lógica municipal se conservan; no existe enlace al menú comercial.
- Android QA: paquete independiente `com.munierp.ia.qa`, distinto a `com.erpsystem`. Se puede instalar al mismo tiempo. Se firma con la configuración debug para QA; una distribución real exige un keystore privado y circuito de publicación separado.
- La web hace solicitudes a `/api/v1` por el mismo origen HTTPS del nuevo servicio Render. Android QA apunta temporalmente a la API municipal QA existente en `https://yj-nexo-munierp-qa.onrender.com/api/v1`.
- Los datos continúan en Atlas `munierp_qa` y las identidades actuales son sintéticas, NO un servicio productivo municipal.
- El isotipo M y favicon son *aprobado en Figmaes*, no la identidad definitiva. Reemplazar por exportaciones de Figma sin alterar el funcionamiento.
- No expone textos de diagnóstico QA dentro de la interfaz de usuario.
- En futuras versiones: aislar autenticación real, preparar dominio propio y servicio Render separado, claves de firma definitivas, flujos de CI y pruebas E2E web/Android.

## Pruebas básicas

```powershell
node apps/frontend/scripts/check-munierp-standalone.cjs
npm test --workspace apps/frontend -- --testPathPattern=municipal
$env:EXPO_PUBLIC_API_BASE_URL = '/api/v1'
npm run build:web --workspace apps/frontend
Remove-Item Env:\EXPO_PUBLIC_API_BASE_URL
pwsh -NoProfile -File apps/frontend/scripts/build-munierp-standalone-qa.ps1
```

**Importante:** la web no se publica cambiando `main` ni sobrescribiendo la instancia actual. Crear nuevo servicio Render desde esta rama cuando pase la validación, con las variables privadas del entorno municipal QA. Verificar la configuración antes de usar cualquier información real.

## Identidad aprobada de Figma (sin modificar el original)

Origen: https://www.figma.com/design/cDbjxP93eyE2fWYNbb4tnV/MuniERP?node-id=2-439
- Logo horizontal: nodo `2:444`, SVG exportado con rutas vectoriales y PNG para React Native.
- Isotipo: nodo `2:495`, SVG original de Figma sin edición; favicon y recurso Android generado del mismo arte aprobado.
- La firma en Figma es Manrope; los assets exportados contienen sus trazos vectoriales y evitan depender de la fuente.
- Sin cambios al archivo de Figma y sin sustituir el logotipo por imágenes generadas.
