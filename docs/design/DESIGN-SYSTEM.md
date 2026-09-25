# YJ Nexo ERP — Architecture & Design System Specification

## 1. Visión General

El Design System de **YJ Nexo** es la fuente única de verdad para la experiencia visual y de interacción en las plataformas Web y Mobile (React Native + React Native Web).

Proporciona una escala semántica de design tokens que desacopla los componentes visuales de valores hardcodeados (`#HEX`, px fijos), garantizando escalabilidad, accesibilidad y coherencia visual enterprise.

---

## 2. Arquitectura de Tokens (`apps/frontend/src/theme/`)

```
src/theme/
├── colors.js       # Paleta de marca, escala neutral y tokens semánticos
├── typography.js   # Escala tipográfica, pesos, tamaños y line-heights
├── spacing.js      # Escala modular de espaciado (4px base)
├── radius.js       # Radios de borde estandarizados para ERP
├── shadows.js      # Sombras multiplataforma (React Native + Web box-shadow)
├── breakpoints.js  # Breakpoints responsive (Mobile, Tablet, Desktop, Wide)
├── zIndex.js       # Niveles de apilamiento para capas y modales
├── components.js   # Tokens por defecto para componentes base
└── index.js        # Export centralizado y objeto theme
```

---

## 3. Especificación de Tokens

### A. Color Tokens (`colors.js`)

#### Paleta de Marca (OFFICIAL BRAND ASSETS)
- `navy`: `#101D36` (Navy Principal)
- `blue`: `#316BDF` (Azul Acento Light)
- `blueDark`: `#64A0FF` (Azul Acento Dark)
- `white`: `#FFFFFF` (Blanco)
- `slateNavy`: `#2E394F` (Slate Navy)
- `borderAccent`: `#E0E0E5` (Borde Light)

#### Tokens Semánticos
- **background.primary**: `#F8FAFC`
- **background.secondary**: `#FFFFFF`
- **background.dark**: `#101D36`
- **surface.primary**: `#FFFFFF`
- **surface.secondary**: `#F8FAFC`
- **surface.overlay**: `rgba(16, 29, 54, 0.5)`
- **text.primary**: `#101D36`
- **text.secondary**: `#4B5568`
- **text.muted**: `#878E9A`
- **text.inverse**: `#FFFFFF`
- **text.link**: `#316BDF`
- **border.default**: `#E0E0E5`
- **border.strong**: `#C3C6CC`
- **border.focus**: `#316BDF`
- **interactive.primary**: `#316BDF`
- **interactive.primaryHover**: `#2557C7`
- **interactive.disabled**: `#C3C6CC`
- **status.success**: `#10B981`
- **status.warning**: `#F59E0B`
- **status.error**: `#EF4444`
- **status.info**: `#3B82F6`

---

### B. Typography Tokens (`typography.js`)

Base de cálculo de texto limpia y escaneable para densidad ERP:

| Token | FontSize | FontWeight | LineHeight | Uso Recomendado |
|---|---:|---:|---:|---|
| **display** | 32px | 700 (Bold) | 40px | Dashboard hero stats, páginas principales |
| **heading1** | 28px | 700 (Bold) | 36px | Títulos principales de módulo |
| **heading2** | 24px | 600 (Semibold) | 32px | Encabezados de sección y formularios |
| **heading3** | 20px | 600 (Semibold) | 28px | Títulos de tarjetas y modales |
| **title** | 18px | 600 (Semibold) | 24px | Títulos de tablas y paneles |
| **subtitle** | 16px | 500 (Medium) | 22px | Subtítulos y etiquetas destacadas |
| **body** | 14px | 400 (Regular) | 20px | Texto principal, celdas de tabla |
| **bodySmall** | 12px | 400 (Regular) | 16px | Metadatos, descripciones secundarias |
| **label** | 14px | 600 (Semibold) | 18px | Labels de inputs y filtros |
| **caption** | 11px | 400 (Regular) | 14px | Captions, notas al pie e hints |

---

### C. Spacing Scale (`spacing.js`)

Escala de espaciado modular en base 4px:

| Token | Valor (px) | Uso Típico |
|---|---:|---|
| `xs` / `1` | 4px | Gaps internos compactos, padding de badges |
| `sm` / `2` | 8px | Padding interno de inputs, espacio entre icono y texto |
| `3` | 12px | Padding vertical de botones y celdas |
| `md` / `4` | 16px | Padding estándar de tarjetas y formularios |
| `5` | 20px | Margen entre secciones internas |
| `lg` / `6` | 24px | Padding principal de contenedor de página |
| `xl` / `8` | 32px | Separación entre módulos mayores |
| `xxl` / `12` | 48px | Espaciado en pantallas vacías o landing login |

---

### D. Radius Tokens (`radius.js`)

| Token | Valor | Uso |
|---|---:|---|
| `none` | 0px | Bordes rectos, tablas adosadas |
| `small` | 4px | Badges, tooltips, tags compactos |
| `medium` | 8px | Inputs, botones, tarjetas principales |
| `large` | 12px | Modales, drawers, contenedores flotantes |
| `xl` | 16px | Paneles destacados |
| `pill` | 9999px | Avatares circulares, status pills |

---

### E. Cross-Platform Shadows (`shadows.js`)

Define propiedades compatibles tanto con Android/iOS (`elevation`, `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`) como con React Native Web (`boxShadow` CSS fallback):

- **small**: `0 1px 2px rgba(16, 29, 54, 0.06)`, `elevation: 1`
- **medium**: `0 2px 4px rgba(16, 29, 54, 0.08)`, `elevation: 2`
- **large**: `0 4px 8px rgba(16, 29, 54, 0.12)`, `elevation: 4`

---

### F. Breakpoints & Layout (`breakpoints.js`)

- `mobile`: 0px
- `tablet`: 768px
- `desktop`: 1024px
- `wide`: 1440px

---

### G. Layering & zIndex (`zIndex.js`)

- `base`: 0
- `sticky`: 100
- `dropdown`: 200
- `overlay`: 300
- `modal`: 400
- `toast`: 500
- `tooltip`: 600

---

## 4. Estrategia Web vs Mobile

Un solo Design System; dos experiencias optimizadas para la plataforma objetivo:

- **Web (Desktop / Tablet)**:
  - Navegación lateral expansible (Sidebar Navy YJ Nexo).
  - Barra superior con breadcrumbs y acciones globales (Topbar).
  - Listados densos con datos estructurados en Data Tables y filtros horizontales.
  - Interacciones optimizadas para teclado y ratón.

- **Mobile (iOS / Android)**:
  - Barra superior compacta (Top App Bar).
  - Navegación inferior accesible con pulgar (Bottom Navigation).
  - Listados verticales adaptados mediante tarjetas interactivas.
  - Touch targets mínimos de 44x44px.

---

## 5. Accesibilidad (WCAG AA)

- **Contraste mínimo**: Ratio >= 4.5:1 para texto normal y >= 3:1 para texto grande.
- **Focus visible**: Indicador de foco visual en la plataforma Web para navegación por teclado (`border.focus`).
- **Roles semánticos**: Uso de `accessibilityRole` y `accessibilityLabel` en React Native.
- **Doble comunicación de estado**: Los mensajes de estado no dependen exclusivamente del color, integrando texto explícito e iconos.
