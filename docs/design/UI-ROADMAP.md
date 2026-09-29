# YJ Nexo ERP — UI/UX Master Implementation Roadmap

## Plan General de Implementación Visual (UI-01 a UI-12)

Este documento define la secuencia estratégica de desarrollo de la interfaz de usuario para el ERP YJ Nexo. Cada fase aborda un bloque coherente de experiencia, garantizando que el estado funcional backend/frontend existente se mantenga 100% operativo sin regresiones.

---

### FASES Y ESTADO DE EJECUCIÓN

| Fase | Título de la Fase | Ámbito / Entregables Clave | Estado |
|---|---|---|---|
| **UI-01** | **Brand System + Design Tokens** | Integración de assets YJ Nexo, extracción técnica de color, tokens centralizados, theme export, pruebas de fundación y documentación. | **APROBADA** |
| **UI-02** | **Base Components** | Componentes atómicos (Text, Button, IconButton, Input, TextArea, Card, StatCard, Badge, StatusBadge, Auxiliary, Showcase). | **APROBADA** |
| **UI-03** | **Web App Shell** | Layout estructural Web: Sidebar Navy YJ Nexo, Topbar, Breadcrumbs, User Menu y contenedor responsive. | **APROBADA** |
| **UI-04** | **Authentication Experience** | Pantalla de Login rediseñada, integración de la marca oficial YJ Nexo, estados de validación y respuesta responsive. | **APROBADA CON PENDIENTES** |
| **UI-05** | **Dashboard** | Pantalla principal (M02) con KPIs de resumen, accesos rápidos por rol y métricas visuales clave. | **NO INICIADA** |
| **UI-06** | **Customers Experience** | Rediseño de M03 (Clientes): Listado con Data Table, Filtros, Modal/Formulario y Vista de Detalle. | PENDIENTE |
| **UI-07** | **Suppliers Experience** | Rediseño de M04 (Proveedores): Tabla de proveedores, acciones contextuales y formularios estructurados. | PENDIENTE |
| **UI-08** | **Products & Services Experience** | Rediseño de M05 (Productos y Servicios): Catálogo visual, precios, categorías y gestión de items. | PENDIENTE |
| **UI-09** | **Inventory Experience** | Rediseño de M06 (Inventario): Pestañas de Existencias/Historial, selector de almacén y formularios de movimiento. | PENDIENTE |
| **UI-10** | **Responsive + Mobile Navigation** | Bottom Navigation móvil, Top App Bar, Menú 'Más' y adaptación táctil completa. | PENDIENTE |
| **UI-11** | **Accessibility + Microinteractions + Polish** | Indicadores de foco teclado, animaciones suaves, toasts de feedback y validación WCAG AA. | PENDIENTE |
| **UI-12** | **Visual QA + Full Regression** | Auditoría visual multiplataforma, ejecución suite de pruebas automatizadas y certificación final. | PENDIENTE |

---

## Detalle de la Fase UI-01 (Fundación)

### Objetivos Alcanzados en UI-01
1. **Auditoría de Interfaz Inicial**: Clasificación de la deuda visual técnica y estructural preexistente.
2. **Integración Oficial de Marca**: 4 PNGs maestros añadidos en `apps/frontend/src/assets/images/brand/` y expuestos centralizadamente en `src/assets/index.js`.
3. **Extracción de Colores Oficiales**: Análisis directo de los assets PNG confirmando el Navy Principal `#101D36`, Azul Acento `#316BDF` (Light) y `#64A0FF` (Dark), Blanco `#FFFFFF`, Slate Navy `#2E394F` y Borde `#E0E0E5`.
4. **Sistema de Tokens**: Creación de los módulos de theme en `src/theme/` (colors, typography, spacing, radius, shadows, breakpoints, zIndex, components, index).
5. **Verificación de Pruebas**: 21 suites Jest pasando (148 tests pasados, 9 TODOs, 0 fallos) + Build Web exitoso.

---

## Detalle de la Fase UI-02 (Base Components)

### Objetivos Alcanzados en UI-02
1. **Primitivas Base Creadas**: `Text`, `Button`, `IconButton`, `Input`, `TextArea`, `Card`, `StatCard`, `Badge`, `StatusBadge`.
2. **Componentes Auxiliares**: `LoadingSpinner`, `Spacer`, `EmptyState`, `ErrorBoundary`.
3. **Exportación Pública**: Centralizada en `apps/frontend/src/components/common/index.js`.
4. **Showcase Interno**: Implementado en `src/components/common/Showcase.js` para inspección visual de variantes y estados.
5. **Pruebas y Verificación**: Suite Jest en `tests/components.test.js` pasando 100% + Web Build exitoso.

---

## Detalle de la Fase UI-03 (Web App Shell)

### Objetivos Alcanzados en UI-03
1. **Layout Estructural Creado**: `WebAppShell`, `Sidebar`, `Topbar`, `UserMenu`, `Breadcrumbs`, `PageContainer`.
2. **Identidad YJ Nexo Integrada**: Sidebar en Navy YJ Nexo (`#101D36`) con logotipos oficiales PNG maestros (`horizontalDark` y `appIcon`).
3. **Control RBAC e Integración Reutilizable**: Enlaces filtrados por permisos reales (`usePermissions()`); UserMenu conectado a `logout()` real.
4. **Responsive & Multiplataforma**: Modos Desktop Expanded, Desktop Collapsed y Mobile Web Drawer con soporte de gestos y overlay.
5. **Pruebas y Verificación**: Suite Jest en `tests/shell.test.js` pasando 100% (23 suites pasar en frontend) + Web Build exitoso + Backend sin regresiones.

## Resultado UI-04

Implementación y regresión validadas: frontend 25 suites / 191 PASS / 9 TODO, backend 527 PASS, build web SUCCESS. Revisión visual desktop/tablet/mobile completada. E2E autenticado real: NOT EXECUTED; pendiente cuenta QA autorizada y validación en dispositivos nativos. Véase [AUTHENTICATION-EXPERIENCE.md](AUTHENTICATION-EXPERIENCE.md). Integrada en main mediante fast-forward; commits aprobados preservados. UI-05 — Dashboard: NO INICIADA.

## UI-04 INTEGRATED BASELINE

Integración del 2026-09-28: baseline anterior `a109204b33d5267d7e3974767dcd692d9c257475`
→ HEAD aprobado UI-04 `f50bdb65e5e6c8242e261e0eaf318eb3e9f06c33` mediante fast-forward.
Commits preservados: `7a1e604`, `d5e1bf8`, `f50bdb6`.
El commit documental `docs(project): record UI-04 integrated baseline` que incorpora
esta sección identifica el nuevo baseline oficial de main para comenzar UI-05.
Su SHA completo se registra en el reporte de integración después de crear el commit.

Regresión post-integración: frontend **25 suites, 200 casos: 191 PASS, 0 FAIL,
9 TODO**; backend **527 PASS, 0 FAIL**; build web **SUCCESS**. Todos con exit 0.
Jest emitió un aviso de act(...) en components.test.js, sin fallos de pruebas.

UI-01, UI-02 y UI-03: **APROBADAS**. UI-04: **APROBADA CON PENDIENTES**.
Se conservan y aceptan E2E autenticado real y validación nativa Android/iOS;
no se intentaron resolver durante esta integración.
La rama codex/ui-04-auth-experience se conserva local y remotamente.
UI-05 — Dashboard: **NO INICIADA**; sin rama creada. M07: **NO INICIADO**.

## Cierre funcional M01 — 2026-09-29 (posterior al baseline UI-04)

M01 **APROBADO en rama**, sin integración a main en esta fase.
Regresión final: backend 617 PASS; frontend 222 PASS, 0 FAIL, 9 TODO previos;
build web exitoso. E2E web autenticado real de UI-04 **RESUELTO** en QA exclusiva,
con limpieza íntegra de fixtures. UI-01–04 conservadas. Android/iOS:
**NOT EXECUTED**, pendientes no obligatorios para M01.
La deuda del enlace Dashboard permanece; no se implementó esa pantalla.
Siguiente módulo funcional: **M14 — Configuración, NO INICIADO**.
**UI-05 — Dashboard: PAUSADA**. M13/M07/M08 no iniciados.
Detalles: [Usuarios y seguridad](../modules/USERS-SECURITY.md) y
[QA M01](../qa/M01-VALIDATION.md).

## M01 integrado — baseline candidato a deploy (2026-09-29)

M01 APROBADO E INTEGRADO EN MAIN por fast-forward del HEAD `61c2493`,
con sus cinco commits y rama de fase conservados. Regresión post-integración:
617 backend PASS, 222 frontend PASS, 9 TODO anteriores y build web SUCCESS;
todos exit 0. UI-01, UI-02 y UI-03 APROBADAS. UI-04 APROBADA CON PENDIENTE
NATIVO Android/iOS; E2E web autenticado RESUELTO POR M01.

La próxima etapa temporal cambia a **PRODUCTION READINESS / DEPLOY**:
preparación de Render y Cloudflare, **NOT STARTED**. No se despliega todavía.
M14 permanece NO INICIADO y UI-05 PAUSADA. La deuda Dashboard permanece.
Baseline identificado por el commit documental de integración; evidencia en
[M01-VALIDATION](../qa/M01-VALIDATION.md#m01-integrated-deploy-baseline--2026-09-29).
