# YJ Nexo ERP — Base Components Documentation (UI-02)

## 1. Visión General

La biblioteca de **Base Components (UI-02)** proporciona un conjunto de primitivas visuales reutilizables diseñadas bajo el Design System YJ Nexo (UI-01).

Todos los componentes han sido desarrollados con arquitectura multiplataforma (**React Native Web, Android e iOS**), garantizando coherencia visual, accesibilidad (WCAG AA) y desacoplamiento de colores o tamaños hardcodeados.

---

## 2. Arquitectura y Ubicación

Ubicación oficial en el proyecto: `apps/frontend/src/components/common/`

```
src/components/common/
├── Text.js            # Componente de tipografía atómico
├── Button.js          # Botones interactivos (primary, secondary, outline, ghost, danger)
├── IconButton.js      # Acciones compactas solo icono
├── Input.js           # Campo de texto de formulario con validación y estados
├── TextArea.js        # Campo multilínea
├── Card.js            # Contenedor con variantes (default, outlined, elevated, interactive)
├── StatCard.js        # Tarjeta KPI de métricas de negocio
├── Badge.js           # Etiqueta de estado semántica
├── StatusBadge.js     # Badge traducido para entidades del ERP (active, inactive, etc.)
├── LoadingSpinner.js  # Indicador visual de carga
├── Spacer.js          # Espaciador modular de layout
├── EmptyState.js      # Contenedor para listados/tablas sin resultados
├── ErrorBoundary.js   # Capturador de errores de renderizado
├── Showcase.js        # Catálogo de desarrollo aislado para inspección visual
└── index.js           # Re-exportación pública centralizada
```

---

## 3. Catálogo de Componentes Base

### A. `Text`
Componente tipográfico que se conecta directamente a `typographyScale` y `semanticColors`.

- **Props principales**:
  - `variant`: `'display' | 'heading1' | 'heading2' | 'heading3' | 'title' | 'subtitle' | 'body' | 'bodySmall' | 'label' | 'caption'` (default: `'body'`)
  - `color`: `'primary' | 'secondary' | 'muted' | 'inverse' | 'link' | 'error' | 'success' | 'warning' | 'info' | string`
  - `align`: `'left' | 'right' | 'center' | 'justify'`
  - `weight`: `'regular' | 'medium' | 'semibold' | 'bold'`
  - `numberOfLines`: `number`

---

### B. `Button` & `IconButton`
Botones de acción interactivos con estados de carga (`loading`), deshabilitado (`disabled`), variantes semánticas y respuesta táctil.

- **Variantes `Button`**: `primary`, `secondary`, `outline`, `ghost`, `danger`.
- **Tamaños `Button`**: `small` (32px), `medium` (40px), `large` (48px).
- **Props clave**: `label`, `onPress`, `disabled`, `loading`, `icon`, `iconPosition`, `fullWidth`.
- **`IconButton`**: Botón compacto cuadrado/circular (`small`: 32px, `medium`: 40px, `large`: 48px) con `accessibilityLabel` obligatorio.

---

### C. `Input` & `TextArea`
Componentes de entrada de datos con estados visuales `default`, `focus`, `filled`, `error` y `disabled`.

- **Props clave `Input`**: `label`, `value`, `placeholder`, `onChangeText`, `helperText`, `error`, `disabled`, `required`, `leftElement`, `rightElement`, `secureTextEntry`.
- **Props clave `TextArea`**: `numberOfLines` (default: 3), `minHeight` (default: 80px), `maxHeight` (default: 200px).
- **Accesibilidad**: Incluyen `accessibilityRole="search"` / `"text"`, indicación visual de foco y alerta semántica de error.

---

### D. `Card` & `StatCard`
Contenedores visuales para estructurar la información del ERP.

- **Variantes `Card`**: `default`, `outlined`, `elevated`, `interactive`.
- **Props `StatCard`**: `label`, `value`, `description`, `icon`, `trend` (`{ direction: 'up' | 'down' | 'neutral', value: string }`), `status` (`'success' | 'warning' | 'error' | 'info'`).

---

### E. `Badge` & `StatusBadge`
Etiquetas visuales de estado.

- **`Badge`**: Variantes `neutral`, `primary`, `success`, `warning`, `error`, `info`.
- **`StatusBadge`**: Traduce dinámicamente strings de estado del ERP (`active`, `inactive`, `deleted`, `pending`, `completed`, `cancelled`, `archived`) a etiquetas localizadas en español con variante semántica adecuada.

---

### F. Componentes Auxiliares
- **`LoadingSpinner`**: Spinner de carga con etiqueta explicativa.
- **`Spacer`**: Espaciador flexible/fijo en base a la escala `spacing`.
- **`EmptyState`**: Pantalla neutra de resultados vacíos con título, mensaje e interacción.
- **`ErrorBoundary`**: Error boundary de React para aislar fallos de renderizado.

---

## 4. Component Showcase Interno

Para revisar visualmente todos los componentes base sin alterar las rutas productivas del ERP:

- **Ubicación**: `src/components/common/Showcase.js`
- **Cómo abrirlo**: Importar e renderizar `<ComponentShowcase onClose={...} />` desde cualquier pantalla en entorno de desarrollo.
- **Contenido**: Muestra todas las variantes, tamaños, estados (`disabled`, `loading`, `error`), tipografías, tarjetas y formularios en una vista responsive de prueba.

---

## 5. Compatibilidad Multiplataforma

- **React Native Web**: Utiliza componentes flexibles, `TouchableOpacity` / `Pressable` y sombras CSS.
- **Android**: Incorpora `includeFontPadding: false` y elevación nativa.
- **iOS**: Respeta el renderizado de fuentes del sistema y sombras por opacidad/radio.
