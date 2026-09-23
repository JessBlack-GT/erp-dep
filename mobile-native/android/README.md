# ============================================
# ERP-SYSTEM - Android Nativo
# ============================================

## Descripción

Este directorio contiene el código nativo de Kotlin para funciones específicas de Android cuando sea necesario.

## Estado Actual

**Sin código nativo implementado.** React Native se utiliza como base para la aplicación móvil.

## Cuándo Se Usa Kotlin

Kotlin se utilizará únicamente cuando sea necesario implementar funciones nativas específicas de Android que no puedan resolverse con React Native, como:

- Integración con APIs de hardware específicas
- Funcionalidades del sistema operativo que requieren código nativo
- Optimizaciones de rendimiento críticas
- Integraciones con servicios del sistema Android

## Convenciones

- **Ubicación**: `mobile-native/android/app/src/main/kotlin/`
- **Estructura**: Paquetes organizados por funcionalidad
- **Integración**: Usar React Native Bridge o TurboModules
- **No duplicar**: La lógica empresarial se mantiene en el backend

## Configuración Futura

Cuando se necesiten funciones nativas de Android:
1. Crear un módulo Kotlin en `mobile-native/android/`
2. Crear el bridge para comunicarse con React Native
3. Documentar la funcionalidad y su propósito
4. No agregar lógica empresarial del backend

## Estado del Proyecto

- ⏳ Sin funciones nativas requeridas actualmente
- 📋 Preparado para incorporar Kotlin cuando sea necesario
