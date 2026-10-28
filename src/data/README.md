# Datos Estáticos y Constantes de la Aplicación (`src/data/`)

Esta carpeta alberga los datos constantes y textos informativos fijos de la aplicación. Los datos dinámicos (categorías, artículos, carreras y usuarios) se obtienen en tiempo de ejecución desde los endpoints de la API real mediante los stores de Pinia.

---

## Archivos y Funciones

### 1. `app.ts`
Proporciona los identificadores y textos institucionales fijos para la pantalla de inicio y cabeceras.

#### Funciones

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `getAppName()` | Ninguno | `string` | Retorna el nombre oficial de la plataforma: `'LendIt UJAP'`. |
| `getAppTagline()` | Ninguno | `string` | Retorna el lema descriptivo del proyecto: `'Como Airbnb, pero para prestar cosas entre estudiantes por tiempo limitado.'`. |

---

### 2. `index.ts`
Punto de re-exportación centralizado para facilitar importaciones limpias en el resto del código (`export * from './app'`).

---

### 3. `app.spec.ts`
Pruebas unitarias de regresión ejecutadas con Vitest para validar que las funciones estáticas retornen las cadenas esperadas por la interfaz.
