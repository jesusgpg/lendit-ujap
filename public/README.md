# Recursos Estáticos Públicos (`public/`)

Esta carpeta contiene los archivos estáticos servidos directamente por Vite sin procesar ni modificar por el empaquetador. Están disponibles en la raíz del servidor web (`/favicon.svg`, `/icons.svg`, `/images/...`).

---

## 1. Archivos Disponibles

### `favicon.svg`
- **Formato**: Vectorial SVG escalable a cualquier resolución de pantalla (Retina, 4K).
- **Diseño**: Emblema simplificado con los colores institucionales vino tinto (`#7a1c2e`) y dorado (`#b38b47`).
- **Uso**: Vinculado en `index.html` mediante `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`.

### `icons.svg`
- **Formato**: Sprite SVG con definiciones de símbolos identificados por `id`.
- **Modo de Consumo en Plantillas Vue**:
  ```html
  <svg class="icon">
    <use href="/icons.svg#chevron-right" />
  </svg>
  ```
- **Ventaja**: Reduce el número de peticiones HTTP al combinar múltiples iconos vectoriales en un solo archivo descargado y cacheado por el navegador.

---

## 2. Subdirectorios
- **`images/`**: Almacena las imágenes fotográficas y escudos institucionales en alta resolución.
