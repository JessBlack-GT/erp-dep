# Ensayo de persistencia de MuniERP en Atlas QA

Este arranque conecta únicamente el API municipal del anfitrión local de QA a `munierp_qa` en Atlas. El servidor sigue escuchando en `127.0.0.1:4314`. Los perfiles son de prueba, pero el folio, historial y bitácora se guardan en MongoDB. El entorno de producción y el arranque habitual de YJ Nexo no cambian.

Antes de abrir el API, el código verifica la base, el rol `munierp_qa_app`, los privilegios sin actualización de la bitácora y la estructura instalada. No instala índices ni borra datos. En el primer arranque inserta únicamente los registros de catálogo sintéticos que falten. Al reiniciar no reabre membresías ni restablece solicitudes. Los folios del modo en memoria no se migran.

## Arranque en Windows

Desde la raíz de la rama `integration/munierp-atlas-qa`, detén el anfitrión de memoria si ocupa 4314, sin cerrar la ventana del frontend.

```powershell
pwsh -NoProfile -File .\apps\backend\scripts\start-munierp-atlas-qa.ps1 -AtlasHost 'servidor-del-proyecto-qa.mongodb.net'
```

Usa el host exacto del proyecto Atlas de QA. El comando solicita la confirmación `solo-datos-sinteticos:munierp_qa` y la contraseña de `munierp_qa_app` sin mostrarla. No uses el usuario de instalación. La clave temporal que imprime al iniciar es para los perfiles web `@demo.test`, no para Atlas.

Si el frontend no está iniciado, arráncalo en otra ventana de PowerShell desde la misma rama:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:4314/api/v1"
npm run web --workspace apps/frontend
```

## Evidencia de persistencia

1. Abre `http://127.0.0.1:8081`, inicia sesión como `ventanilla@demo.test` y registra un ciudadano ficticio y una solicitud de Obras Públicas. Copia el folio nuevo y su asunto.
2. Detén únicamente la API y ejecuta de nuevo el arranque con Atlas. El frontend puede quedar abierto. Usa la clave temporal recién generada.
3. Inicia sesión como `obras@demo.test`, busca el mismo folio y verifica que coincidan el asunto y el historial de alta. La franja debe decir **QA LOCAL · datos sintéticos guardados en Atlas**.
4. Si quieres comprobar la bitácora, abre ese folio como `auditor@demo.test` en Auditoría. No incluyas contraseñas en las evidencias.

Esto prueba persistencia desde el navegador contra MongoDB real cuando se ejecuta con Atlas. No acredita Android contra HTTPS, cuentas oficiales, almacenamiento con datos de ciudadanos reales ni todas las verificaciones L3. No ejecutes la suite real de contrato completa con el usuario de app: la suite antigua crea instalaciones de prueba por caso y usa permisos distintos del arranque normal.
