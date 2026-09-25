# YJ Nexo — Manual de Identidad de Marca y Assets Oficiales

## 1. Identidad del Producto

- **Nombre Oficial**: YJ Nexo
- **Tipo de Producto**: ERP Empresarial Modular Web + Mobile
- **Conceptos Clave**: Conexión, organización, control, confianza, tecnología, claridad, modularidad, escalabilidad, profesionalismo.
- **Significado**: "Nexo" representa la conexión fluida entre las diferentes áreas operativas, administrativas y financieras de la empresa.
- **Tono Visual**: Enterprise + Moderna + Limpia + Tecnológica + Profesional + Escalable.

---

## 2. Master Brand Assets (Archivos Maestros)

Ubicación oficial en el proyecto: `apps/frontend/src/assets/images/brand/`

| Asset | Archivo | Descripción | Uso Recomendado |
|---|---|---|---|
| **Horizontal Light** | `yj-nexo-horizontal-light.png` | Logo horizontal sobre fondo claro | Encabezados, topbars, login y superficies claras. |
| **Horizontal Dark** | `yj-nexo-horizontal-dark.png` | Logo horizontal sobre fondo oscuro | Sidebars navy, footers oscuros y fondos contrastantes. |
| **App Icon** | `yj-nexo-app-icon.png` | Símbolo compacto e icono | Favicon, app launcher, avatars y botones compactos. |
| **Monochrome** | `yj-nexo-monochrome.png` | Variante monocromática pura | Impresión, documentos PDF, marcas de agua y contextos unicolor. |

---

## 3. Paleta Oficial Extraída de los Assets de Marca

> **EXTRACTED FROM OFFICIAL BRAND ASSET**
> Los colores primarios fueron obtenidos mediante análisis técnico directo de los archivos PNG maestros, aislando píxeles sólidos sin antialiasing de bordes.

| Token de Marca | HEX | RGB | Fuente / Origen | Uso Recomendado |
|---|---|---|---|---|
| **Navy Principal** | `#101D36` | `RGB(16, 29, 54)` | OFFICIAL BRAND ASSET | Fondos principales, sidebars, texto primario y elementos de alto contraste. |
| **Azul de Acento (Light)** | `#316BDF` | `RGB(49, 107, 223)` | OFFICIAL BRAND ASSET | Acciones primarias (botones), enlaces, estados activos e indicadores en Light Mode. |
| **Azul de Acento (Dark)** | `#64A0FF` | `RGB(100, 160, 255)` | OFFICIAL BRAND ASSET | Acciones de acento y realce sobre superficies oscuras o navy. |
| **Blanco Puro** | `#FFFFFF` | `RGB(255, 255, 255)` | OFFICIAL BRAND ASSET | Tarjetas, contenedores elevate, texto inverso sobre navy y fondos. |
| **Navy Secundario (Slate)** | `#2E394F` | `RGB(46, 57, 79)` | OFFICIAL BRAND ASSET | Sub-elementos de navegación, encabezados secundarios y superficies navy elevadas. |
| **Borde / Accent Light** | `#E0E0E5` | `RGB(224, 224, 229)` | OFFICIAL BRAND ASSET | Bordes de tarjetas, divisores y contenedores neutros en Light Mode. |

---

## 4. Reglas Estrictas de Uso

### USOS PERMITIDOS
- Mantener siempre la relación de aspecto original de cada PNG.
- Utilizar la variante correspondiente según la luminancia del fondo (Light sobre fondo claro, Dark sobre fondo oscuro).
- Centralizar las referencias de imagen mediante el export maestro de assets `src/assets/index.js`.

### PROHIBICIONES ESTRICTAS
- **NO** redibujar o recrear los logotipos.
- **NO** sustituir la marca gráfica con texto plano simulado.
- **NO** deformar, estirar o alterar las proporciones de las imágenes.
- **NO** recortar los logos de manera destructiva.
- **NO** aplicar sombras paralelas, resplandores o contornos a los logotipos.
- **NO** aplicar degradados ni alterar los colores del logotipo.
- **NO** optimizar destructivamente los archivos PNG originales.
- **NO** sobrescribir ni eliminar los archivos en `apps/frontend/src/assets/images/brand/`.
