# YJ Nexo ERP — Web App Shell Documentation (UI-03)

## 1. Visión General

El **Web App Shell (UI-03)** establece la estructura visual y navegacional profesional de la aplicación Web + Mobile para **YJ Nexo ERP**.

Proporciona un contenedor persistente que une la identidad de marca de UI-01 (YJ Nexo Navy `#101D36`, logotipos oficiales y design tokens) y los componentes base de UI-02 (`Text`, `Button`, `IconButton`, `Card`, `Badge`, `PageContainer`, etc.), sobre el cual se montarán los rediseños futuros de las pantallas del sistema.

---

## 2. Arquitectura de Componentes de Layout

Ubicación oficial en el proyecto: `apps/frontend/src/components/layout/`

```
src/components/layout/
├── Sidebar.js          # Barra de navegación lateral empresarial (Navy #101D36)
├── Topbar.js           # Barra superior con toggle, contexto/breadcrumbs y UserMenu
├── UserMenu.js         # Menú desplegable de sesión, perfil y cierre de sesión real
├── Breadcrumbs.js      # Ruta de navegación contextual (ej. Inicio / Clientes)
├── PageContainer.js    # Contenedor central responsive con padding usando spacing tokens
├── WebAppShell.js      # Shell estructural integrador con detección de breakpoints
├── AppLayout.js        # Alias de compatibilidad para WebAppShell
├── Footer.js           # Pie de página opcional de derechos de autor
├── ScrollableContent.js# Wrapper scrolleable con padding
└── index.js            # Exportaciones públicas de layout
```

---

## 3. Especificación de Componentes del Shell

### A. `Sidebar`
- **Identidad de Marca**: Fondo en Navy YJ Nexo (`#101D36`) con logotipos oficiales PNG maestros (`horizontalDark` cuando está desplegado y `appIcon` cuando está colapsado).
- **Control de Navegación**:
  - Panel Principal (`Dashboard`)
  - Clientes (`Customers`)
  - Proveedores (`Suppliers`)
  - Productos y Servicios (`Products`)
  - Inventario (`Inventory`)
- **Filtro RBAC Integrado**: Consulta la matriz de permisos existente vía `usePermissions()`. Muestra únicamente las rutas autorizadas para el rol del usuario autenticado (ej. `customers.read`, `suppliers.read`, `products.read`, `inventory.read`).
- **Modos de Visualización**:
  - **Desktop Expanded**: Muestra el logotipo completo, nombre YJ Nexo, icono y etiqueta textual de cada módulo.
  - **Desktop Collapsed**: Muestra el icono compacto de marca e iconos de navegación con fondo activo y bordes de acento (`#316BDF`).
  - **Mobile Web Drawer**: Transforma la barra lateral en un drawer deslizante sobre overlay oscuro que se cierra al seleccionar una ruta o hacer clic en el backdrop.

---

### B. `Topbar`
- **Barra Superior**: Altura estandarizada (64px) sobre superficie clara con sombra sutil (`shadows.small`).
- **Botón Toggle**: Cambia el estado de colapsado/expandido en escritorio o abre el drawer en dispositivos móviles.
- **Contexto de Página**: Muestra el título del módulo activo o migas de pan (`Breadcrumbs`).
- **`UserMenu`**:
  - Muestra el avatar con iniciales del usuario, nombre y badge de rol.
  - Al hacer clic abre un desplegable modal con correo del usuario, rol asignado y el botón **Cerrar sesión** directamente conectado al método `logout()` de `AuthContext`.

---

### C. `Breadcrumbs` & `PageContainer`
- **`Breadcrumbs`**: Sistema de contexto navegado (`Inicio / Clientes / Detalle`) que permite interactividad y navegación hacia atrás.
- **`PageContainer`**: Wrapper central que aísla el contenido interno de los bordes del Shell, aplicando padding responsivo derivado de la escala `spacing` de UI-01 y evitando desbordamientos visuales.

---

## 4. Comportamiento Responsive

| Pantalla | Ancho (px) | Comportamiento del Shell |
|---|---:|---|
| **Mobile Web** | `< 768px` | Sidebar en modo Modal Drawer desplegable vía botón hamburguesa en Topbar. |
| **Tablet** | `768px – 1023px` | Topbar funcional con Sidebar colapsado o drawer según orientación. |
| **Desktop** | `>= 1024px` | Layout de dos columnas principales: Sidebar lateral persistente (240px expanded / 72px collapsed) + Área de contenido. |

---

## 5. Integración con Navegación y Rutas (`MainNavigator.js`)

El Shell envuelve de forma transparente cada pantalla del ERP (`CustomersScreen`, `CustomerDetailScreen`, `SuppliersScreen`, `ProductsScreen`, `InventoryScreen`, etc.) dentro de `MainNavigator.js`.

Esto permite que:
1. El usuario navegue fluidamente desde el Sidebar entre módulos.
2. Todas las pantallas M03-M06 funcionen normalmente con sus contratos HTTP y componentes nativos intactos.
3. El estado de autenticación y cierre de sesión opere sobre los flujos reales de la aplicación.
