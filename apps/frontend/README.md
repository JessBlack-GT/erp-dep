# ============================================
# ERP-SYSTEM - README del Frontend
# ============================================

## Descripción

El frontend de ERP-SYSTEM es una aplicación construida con **React Native** y **React Native Web**, diseñada para funcionar tanto en web como en dispositivos móviles.

## Estructura

```
apps/frontend/
├── src/
│   ├── app/              # Aplicación principal
│   ├── assets/           # Imágenes, iconos, fuentes
│   ├── components/       # Componentes reutilizables
│   ├── features/         # Módulos funcionales
│   ├── services/         # Cliente API y utilidades
│   ├── hooks/            # Hooks personalizados
│   ├── context/          # Contextos React
│   ├── navigation/       # Navegación
│   ├── utils/            # Utilidades diversas
│   ├── constants/        # Constantes de la app
│   └── theme/            # Tema y estilos
└── tests/                # Pruebas del frontend
```

## Instalación

```bash
cd apps/frontend
npm install
```

## Desarrollo

```bash
# Para web
npm run web

# Para Android
npm run android

# Para iOS
npm run ios
```

## Dependencias Principales

| Paquete | Función |
|---------|---------|
| react | Biblioteca principal de React |
| react-native | Framework de React para móvil |
| react-native-web | Adaptación de React Native para web |
| @react-navigation/native | Navegación |
| axios | Cliente HTTP |
| @react-native-async-storage/async-storage | Almacenamiento local |
| zustand | Gestión de estado |
| formik | Formularios |
| yup | Validación |
| react-native-paper | Componentes UI |

## Pruebas

```bash
cd apps/frontend
npm test
```

## Convenciones

- **Componentes**: PascalCase (ej: `CustomerList`)
- **Archivos**: snake_case (ej: `customer_list.js`)
- **Hooks**: usePrefix (ej: `useData`)
- **Servicios**: snake_case (ej: `customerService`)
- **Estilos**: Objetos de estilo dentro de cada componente

## Guía para Desarrolladores IA

Consulte `../../../docs/architecture/AI_DEVELOPMENT_GUIDE.md` para instrucciones detalladas.
