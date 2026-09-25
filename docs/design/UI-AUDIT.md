# YJ Nexo ERP — Visual & UI Debt Audit Report

## 1. Resumen Ejecutivo

Durante la Fase **UI-01**, se realizó una auditoría exhaustiva del código fuente del frontend (`apps/frontend/src/`) para identificar la deuda visual, inconsistencias de estilo y limitaciones de la arquitectura previa.

El objetivo de este informe es documentar los hallazgos sin realizar refactorizaciones no autorizadas antes de tiempo, sirviendo como guía para las fases **UI-02 a UI-12**.

---

## 2. Matriz de Clasificación de Deuda Visual

### CRITICAL (Prioridad Alta - Afecta usabilidad, accesibilidad o consistencia estructural)
| Hallazgo | Archivos/Área Afectada | Impacto | Recomendación |
|---|---|---|---|
| **Hardcoding masivo de colores** | `LoginScreen.js`, `CustomerList.js`, `CustomerForm.js`, `SupplierForm.js`, `InventoryScreen.js`, `ProductsScreen.js` | Incompatibilidad con el Brand System; colores fijos como `#1976D2` y `#757575` dispersos en stylesheets locales. | Reemplazar gradualmente estilos locales por el hook/objeto `theme` centralizado durante las fases UI-04 a UI-09. |
| **Encabezado de navegación rudimentario** | `app/navigation/MainNavigator.js` | La barra superior utiliza botones simples alineados horizontalmente sin layout de Shell empresarial. | Construir el Web App Shell (UI-03) con Sidebar Navy YJ Nexo y Topbar con branding. |
| **Falta de feedback visual de foco en Web** | Formularios e inputs globales | Navegación por teclado deficiente en entornos de escritorio Web. | Aplicar tokens `border.focus` e indicadores de foco accesible (UI-02 y UI-11). |

---

### HIGH (Prioridad Alta - Inconsistencia de componentes y componentes duplicados)
| Hallazgo | Archivos/Área Afectada | Impacto | Recomendación |
|---|---|---|---|
| **Botones y tarjetas no estandarizadas** | Pantallas M03, M04, M05, M06 | Cada módulo define sus propias tarjetas (`card`) y botones mediante `TouchableOpacity` o nativo `Button`. | Estandarizar componentes base `Button`, `Card`, `Badge` y `Input` en UI-02. |
| **Variación en estilos de formularios** | `CustomerForm.js`, `ProductForm.js`, `SupplierForm.js`, `InventoryMovementForm.js` | Tamaños de inputs, paddings y mensajes de error varían levemente entre módulos. | Implementar el componente unificado `Input` y `FormField` en UI-02. |

---

### MEDIUM (Prioridad Media - Repetición de estilos y jerarquía tipográfica)
| Hallazgo | Archivos/Área Afectada | Impacto | Recomendación |
|---|---|---|---|
| **Hardcoding de fuentes y pesos** | Stylesheets de pantallas | Fuentes definidas como cadenas literales (`fontWeight: '600'`, `fontSize: 16`) sin referencias a escala tipográfica. | Adoptar los tokens `typography` y `typographyScale` en las vistas. |
| **Separación inconsistente de márgenes y paddings** | Componentes de lista y formularios | Uso heterogéneo de valores de padding (12, 16, 24, 8) sin seguir escala modular base 4px. | Utilizar la escala `spacing` (xs, sm, md, lg, xl). |

---

### LOW (Prioridad Baja - Microinteracciones y pulido)
| Hallazgo | Archivos/Área Afectada | Impacto | Recomendación |
|---|---|---|---|
| **Estats y tarjetas de resúmenes planas** | Pantallas de módulo M03-M06 | Falta de indicadores visuales modernos (StatusBadges con fondo suave y bordes sutiles). | Integrar `StatusBadge` y `StatCard` en el rediseño por módulos (UI-06 a UI-09). |
| **Indicadores de carga básicos** | Modulos de tabla y listas | Uso exclusivo de `ActivityIndicator` nativo sin esqueletos de carga (`Skeleton`). | Agregar feedback visual enriquecido en UI-11. |

---

## 3. Estado Preexistente de Linter

> **PRE-EXISTING LINT CONFIGURATION ISSUE**
> Se reconfirma la incidencia preexistente en `.eslintrc.json` donde el archivo contiene sintaxis JavaScript (`module.exports`) en lugar de JSON válido, ocasionando que `npm run lint` finalice con código de retorno 2. Esta condición no fue introducida en UI-01 y se mantiene inalterada respetando la congelación funcional.
