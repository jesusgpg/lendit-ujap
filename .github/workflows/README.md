# Flujos de Integración y Despliegue Continuo (`.github/workflows/`)

Esta carpeta contiene las acciones y flujos de trabajo automatizados de GitHub Actions para LendIt UJAP.

---

## Archivos y Flujos

### 1. `deploy.yml`
Flujo de trabajo de integración y despliegue continuo (CI/CD):
- Se ejecuta automáticamente ante eventos `push` en la rama principal (`main`).
- Configura el entorno Node.js, instala dependencias vía pnpm y corre validaciones de compilación (`vue-tsc`, `tsc -p tsconfig.api.json`, `vite build`) y ejecución de pruebas con Vitest.
- Despliega la aplicación hacia Vercel si todas las pruebas pasan satisfactoriamente.

### 2. `CODEOWNERS`
Define los propietarios y revisores obligatorios de código para los pull requests del repositorio.
