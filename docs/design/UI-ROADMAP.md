# YJ Nexo ERP — UI/UX Master Implementation Roadmap

## Plan General de Implementación Visual (UI-01 a UI-12)

Este documento define la secuencia estratégica de desarrollo de la interfaz de usuario para el ERP YJ Nexo. Cada fase aborda un bloque coherente de experiencia, garantizando que el estado funcional backend/frontend existente se mantenga 100% operativo sin regresiones.

---

### FASES Y ESTADO DE EJECUCIÓN

| Fase | Título de la Fase | Ámbito / Entregables Clave | Estado |
|---|---|---|---|
| **UI-01** | **Brand System + Design Tokens** | Integración de assets YJ Nexo, extracción técnica de color, tokens centralizados, theme export, pruebas de fundación y documentación. | **COMPLETADA** |
| **UI-02** | **Base Components** | Componentes atómicos (Button, Input, Card, Text, Badge, StatusBadge, Spinner, Divider). | PENDIENTE |
| **UI-03** | **Web App Shell** | Layout estructural Web: Sidebar Navy YJ Nexo, Topbar, Breadcrumbs, User Menu y contenedor responsive. | PENDIENTE |
| **UI-04** | **Authentication Experience** | Pantalla de Login rediseñada, integración de la marca oficial YJ Nexo, estados de validación y respuesta responsive. | PENDIENTE |
| **UI-05** | **Dashboard** | Pantalla principal (M02) con KPIs de resumen, accesos rápidos por rol y métricas visuales clave. | PENDIENTE |
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
