# Flujos de Integración y Despliegue Automatizado (`.github/workflows/`)

Esta carpeta alberga los flujos de trabajo (*workflows*) de automatización de GitHub Actions para compilación, verificación estática y despliegue continuo de LendIt UJAP.

---

## 1. Archivos Disponibles

### `deploy.yml` — Flujo de Compilación y Despliegue a GitHub Pages

```mermaid
flowchart TD
    A[Push a rama main o workflow_dispatch] --> B[Job: build]
    B --> C[Checkout del repositorio: actions/checkout@v4]
    C --> D[Instalación de pnpm: pnpm/action-setup@v4]
    D --> E[Configuración de Node.js 20 con caché de pnpm]
    E --> F[Instalación de dependencias: pnpm install --frozen-lockfile]
    F --> G[Compilación de producción: pnpm build con GH_PAGES=true]
    G --> H[Empaquetado de artefacto dist: actions/upload-pages-artifact@v3]
    H --> I[Job: deploy (Entorno: github-pages)]
    I --> J[Publicación en GitHub Pages: actions/deploy-pages@v4]
```

#### Características Clave del Flujo
- **Disparadores (`on`)**: Se activa automáticamente al hacer push a la rama `main` o manualmente vía la pestaña Actions (`workflow_dispatch`).
- **Permisos de Seguridad (`permissions`)**: Requiere `contents: read`, `pages: write` y `id-token: write` para la autenticación OIDC segura con GitHub Pages sin requerir tokens personales.
- **Control de Concurrencia (`concurrency`)**: Define el grupo `pages` con `cancel-in-progress: true` para cancelar despliegues obsoletos si se produce un nuevo push mientras otro está en ejecución.
- **Validaciones en el Build**: El comando `pnpm build` ejecuta secuencialmente:
  1. `vue-tsc -b`: Comprobación de tipos TypeScript en componentes Vue y código de la app.
  2. `tsc -p tsconfig.api.json`: Comprobación de tipos estricta para los handlers serverless de `api/*`.
  3. `vite build`: Generación del bundle optimizado para producción en la carpeta `dist`.

---

### `CODEOWNERS`
Define los responsables y revisores obligatorios de código asignados automáticamente a los Pull Requests del repositorio.
