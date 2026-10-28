# Imágenes Institucionales (`public/images/`)

Esta carpeta almacena los activos gráficos y fotográficos que componen la identidad visual de la Universidad José Antonio Páez (UJAP) dentro de LendIt.

---

## 1. Inventario de Imágenes

| Archivo | Formato y Peso | Dimensiones | Uso en la Aplicación |
|---|---|---|---|
| `Logo-UJAP1.png` | PNG (162 KB) | Alta definición con transparencia | Emblema y logotipo oficial desplegado en la cabecera superior (`SiteHeader.vue`), en el footer (`SiteFooter.vue`) y en la pantalla de bienvenida. |
| `ujap_escultura.jpg` | JPEG (142 KB) | Fotografía horizontal de campus | Imagen principal de portada de la sección hero en `LandingView.vue`, representando la emblemática escultura del campus universitario. |

---

## 2. Buenas Prácticas de Consumo en Código

En los componentes de Vue se debe emplear la variable de Vite `import.meta.env.BASE_URL` para garantizar que las rutas a las imágenes funcionen correctamente tanto en desarrollo local como bajo subdirectorios en despliegues de producción:

```typescript
const crestSrc = `${import.meta.env.BASE_URL}images/Logo-UJAP1.png`
const campusSrc = `${import.meta.env.BASE_URL}images/ujap_escultura.jpg`
```
