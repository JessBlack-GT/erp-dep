# MuniERP IA — 09 Diseño de interfaces y módulos (Fase 1)

Interfaz web municipal **adaptable** construida con React Native Web (misma base que YJ Nexo y la
app Android), con los tokens y componentes existentes (`components/common`, `theme`). Prototipo
implementado en `apps/frontend/src/features/municipal/` con **API simulada y datos sintéticos**;
no está registrado en la navegación (C-11).

## Mapa de módulos

```
features/municipal/
├─ MunicipalWorkspaceScreen.js   Espacio de trabajo: indicadores + registro/acuse + lista
├─ components/
│  ├─ IndicatorsPanel.js         RQ04 · tarjetas StatCard, 1/2/4 columnas
│  ├─ RequestIntakeForm.js       RQ01/RQ06 · registro en ventanilla con idempotencia
│  ├─ ReceiptView.js             RQ06 · acuse imprimible sin datos de contacto
│  ├─ RequestList.js             RQ03 · lista en alcance + RequestStatusBadge (texto, no solo color)
│  └─ OptionGroup.js             Selector accesible (radio) con objetivos ≥ 44 px
├─ model.js                      Etiquetas, validación espejo del contrato, folio legible por voz
└─ mockApi.js                    API simulada con forma de municipal-v1 (se reemplaza en F1-11)
```

Pantallas previstas para el resto de Fase 1 (pendientes): Detalle de expediente con historial
(RQ02) y documentos (RQ05), Turnado/Asignación, Catálogo de dependencias y Membresías
(ADMIN_MUNICIPAL), Bitácora (AUDITOR).

## Disposición adaptable

| Ancho | Breakpoint ERP | Disposición |
|---|---|---|
| < 768 px (celular) | `mobile` | Una columna: indicadores apilados → formulario/acuse → lista |
| 768–1023 px (tableta) | `tablet` | Indicadores en 2 columnas; contenido en una columna |
| ≥ 1024 px (escritorio, ventanilla) | `desktop` | Indicadores en 4 columnas; formulario a la izquierda y lista a la derecha |

```
Escritorio (≥1024)                                 Celular (360)
┌────────────────────────────────────────────┐     ┌──────────────────┐
│ MuniERP · San Juan Huactzinco              │     │ MuniERP · SJH    │
│ [Total] [Abiertas] [Concluidas] [Vencidas] │     │ [Total]          │
├──────────────────────┬─────────────────────┤     │ [Abiertas]       │
│ Registrar solicitud  │ Solicitudes         │     │ [Concluidas]     │
│ Dependencia (radio)  │ SJH-OBP-…-000002 ●  │     │ [Vencidas]       │
│ Ciudadano (radio)    │ SJH-OBP-…-000001 ●  │     │ Registrar…       │
│ Canal (radio)        │ SJH-TES-…-000001 ●  │     │ …                │
│ Asunto / Descripción │                     │     │ Solicitudes      │
│ [Registrar y emitir] │                     │     │ …                │
└──────────────────────┴─────────────────────┘     └──────────────────┘
● = insignia con texto ("En trámite"), nunca solo color
```

## Flujo de ventanilla (canal presencial, RQ06)

1. El funcionario elige dependencia, ciudadano (registrado previamente; sin CURP) y canal.
2. Captura asunto y descripción; la validación local replica el contrato (la autoridad es el servidor).
3. "Registrar y emitir folio" envía con una `Idempotency-Key` fija para ese formulario: si falla la
   red, "Reintentar registro" no duplica el folio (probado, MT-93).
4. Se muestra el **acuse** (folio grande y seleccionable, dependencia, asunto, estado, fecha); en web
   se imprime con el navegador. "Registrar otra solicitud" reinicia el formulario con clave nueva.

## Criterios de accesibilidad (objetivo WCAG 2.1 AA)

| Criterio | Implementación en el prototipo | Verificación |
|---|---|---|
| 1.4.1 Uso del color | Estados con texto en `Badge` | jest ✅ |
| 2.1.1 Teclado | Controles nativos/`TouchableOpacity` con rol; orden de foco por orden de lectura | **E2E MT-90 pendiente** |
| 2.4.6 Encabezados y etiquetas | `heading1/3`, `accessibilityLabel` en filas y grupos | jest parcial ✅ / lector de pantalla pendiente |
| 2.5.5 Tamaño de objetivo | `minHeight/minWidth: 44` en opciones | Inspección MT-91 pendiente |
| 3.3.1 Identificación de errores | Mensajes por campo y `accessibilityRole="alert"` | jest ✅ |
| 4.1.2 Nombre, función, valor | `accessibilityRole="radio"` + `accessibilityState.checked` | jest parcial ✅ / NVDA-TalkBack pendiente |
| Lectura del folio | `spokenFolio()` lee grupos ("S J H, O B P, …, 42") | jest ✅ |

## Riesgos de interfaz conocidos

- Activación con teclado de `role="radio"` en RN Web 0.19: **verificada con Playwright (2026-11-09)**. Enter funcionaba; Espacio no y `aria-checked` no se exponía → corregidos en `OptionGroup.js` (ver doc 11).
- `newIdempotencyKey()` usa `crypto.getRandomValues` en web; en Android RN 0.72 no existe y cae a
  `Math.random` (suficiente para idempotencia, no para secretos). Alternativa sin dependencia: que el
  servidor emita la clave en un paso previo (decidir en F1-11).
