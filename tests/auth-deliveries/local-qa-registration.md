# Registro y Validación Local QA — Allowlist Explícita

> **Nota de vigencia (2026-10-27):** el allowlist de correos personales descrito en este informe fue retirado. El registro ahora exige `@ujap.edu.ve` en todos los entornos y Supabase Auth aplica el mismo bloqueo en la base de datos.

Fecha: 2026-10-27  
Colaboración: Codex (helpers y cableado de fuentes) + Antigravity (especificación, suites de pruebas y verificación).

---

## 1. Alcance y Arquitectura Implementada

Se implementó un mecanismo estricto de **allowlist explícita de correos personales exclusivamente para QA local**, protegiendo la integridad semántica del producto y garantizando que bajo ninguna circunstancia se admita un correo no institucional en entornos productivos o en Vercel.

### Componentes clave

1. **`shared/emailPolicy.ts`**:
   - `isInstitutionalEmail(email)`: **Puramente semántica**. Valida única y exclusivamente el dominio institucional `@ujap.edu.ve`. No contiene excepciones ni referencias a QA.
   - `isAllowedCampusEmail(email, { development, allowlist, vercel })`: Validador de elegibilidad para el campus:
     - Si el correo es institucional (`@ujap.edu.ve`), es admitido siempre (en desarrollo, producción o Vercel, independientemente de la allowlist).
     - Si es un correo personal: requiere de forma obligatoria que `development === true`, que `vercel` sea falso/nulo, que la allowlist contenga valores y que el correo coincida exactamente (tras normalización `trim()` y `toLowerCase()`).
     - Rechaza subcadenas, coincidencias parciales, formatos inválidos y listas vacías.
     - **Regla inmutable:** NUNCA concede excepción en producción (`development: false`) ni en Vercel (`vercel: true`), aun cuando las variables de entorno contengan valores.

2. **Frontend (`src/lib/emailEligibility.ts`)**:
   - Exporta `isEligibleCampusEmail(email)`.
   - Consulta `import.meta.env.DEV && !import.meta.env.PROD` y la lista `import.meta.env.VITE_QA_EMAIL_ALLOWLIST`.
   - Integrado en los formularios y flujos institucionales:
     - Registro (`RegisterForm.vue`)
     - Login institucional (`LoginForm.vue` y `authStore.login`)
     - Reenvío de confirmación (`EmailConfirmationView.vue` y `authStore.resendConfirmationEmail`)
     - Recuperación de contraseña (`RecoveryRequestView.vue` y `authStore.requestPasswordReset`)

3. **Backend (`backend/_lib/emailPolicy.ts`)**:
   - Exporta `isEligibleCampusEmail(email)`.
   - Consulta `process.env.NODE_ENV === 'development'`, `!process.env.VERCEL` y `process.env.QA_EMAIL_ALLOWLIST`.
   - Protege tanto `/api/me` (alta y consulta de perfil) como el middleware de autenticación `getAuthenticatedProfile` en `backend/_lib/auth.ts`.
   - `server/dev-api.ts`: Fija `process.env.NODE_ENV ??= 'development'` únicamente en el punto de entrada local, sin afectar el bundle de producción ni el runtime serverless de Vercel.

4. **Sin elevación de rol ni auto-confirmación**:
   - La materialización de usuarios QA en `/api/me` crea el perfil con rol `STUDENT` (o `PROFESSOR` si aplicara flujo docente), ignorando cualquier intento de inyección de rol `ADMIN` en metadata o body.
   - La fecha `emailVerifiedAt` se sincroniza únicamente si el proveedor de identidad ya tiene registrado `email_confirmed_at`. No se salta la confirmación de correo.

---

## 2. Resultados de Pruebas Automatizadas

### A. Pruebas Unitarias de Políticas (`pnpm test --run`)
- **Suite**: `shared/emailPolicy.spec.ts` (17 pruebas específicas)
- **Cobertura total del proyecto**: 11 archivos de prueba, **122 pruebas aprobadas**, 0 fallos.
- **Aspectos verificados**:
  - Pureza semántica de `isInstitutionalEmail` (acepta `@ujap.edu.ve`, rechaza Hotmail, Gmail, subdominios o cadenas vacías).
  - Admisión incondicional del dominio institucional en desarrollo, producción y Vercel.
  - Admisión de correo personal en allowlist (`jesusp2095@hotmail.com`) únicamente en desarrollo local con coincidencia exacta y normalización de mayúsculas/espacios.
  - Rechazo de correos personales no autorizados, subcadenas o allowlist vacía.
  - Rechazo rotundo de correos personales en producción (`development: false`) y en Vercel (`vercel: true`), aun cuando la allowlist contenga el correo.

### B. Pruebas de Integración de API (`pnpm test:api`)
- **Herramientas**: Supertest + Vitest + PostgreSQL temporal aislado.
- **Suites ejecutadas**:
  - `tests/api/endpoints.integration.ts` (22 casos de regresión)
  - `tests/api/qa-allowlist.integration.ts` (9 casos nuevos de allowlist y middleware)
- **Resultado consolidado**: **31 pruebas aprobadas**, 0 fallos, código de salida 0.
- **Casos QA específicos**:
  - `QA-API-001`: Intento de consulta `/api/me` con correo personal no allowlisteado retorna `403 INSTITUTIONAL_EMAIL_REQUIRED`.
  - `QA-API-002`: Consulta `/api/me` con correo QA allowlisteado sin perfil creado en BD retorna `409 PROFILE_REQUIRED` (demuestra que la autenticación y el filtro de correo fueron superados).
  - `QA-API-003`: `PATCH /api/me` materializa el perfil con rol `STUDENT`, descartando cualquier elevación a `ADMIN` enviada en metadata.
  - `QA-API-004`: `GET /api/me` del usuario QA materializado retorna el perfil sin exponer contraseñas.
  - `QA-API-005`: Middleware `getAuthenticatedProfile` permite publicar ítems (`POST /api/items`) al estudiante QA validado.
  - `QA-API-006`: Middleware rechaza a usuarios con correos no autorizados en rutas protegidas (`403 INSTITUTIONAL_EMAIL_REQUIRED`).
  - `QA-API-007`: En producción (`NODE_ENV=production`), el usuario QA es rechazado de inmediato (`403`).
  - `QA-API-008`: En Vercel (`VERCEL=1`), el usuario QA es rechazado de inmediato (`403`).
  - `QA-API-009`: Con allowlist vacía, el usuario QA es rechazado de inmediato (`403`).

### C. Verificación de Compilación (`pnpm build`)
- `vue-tsc -b`: 0 errores de tipado en TypeScript para el frontend.
- `tsc -p tsconfig.api.json`: 0 errores de tipado para los endpoints de la API.
- `vite build`: Compilación exitosa de activos estáticos para producción.

---

## 3. Limitaciones y Consideraciones Operativas

1. **Puerto del servidor frontend**:
   - El puerto habitual `5173` se encuentra en uso por el proceso externo `monitor-mayoreo` (no debe ser intervenido).
   - El entorno local de desarrollo de LendIt opera en el puerto alternativo `5174` y la API en el puerto `8787`.
2. **Correo autorizado para la prueba**:
   - Se configuró y autorizó el correo personal `jesusp2095@hotmail.com` para la prueba E2E de registro en `.env` (gestionado por Codex).
   - No se utilizaron ni expusieron correos personales de administración ni la cuenta retirada `jpena13`.
3. **Sin envío de correos ni creación remota**:
   - Esta entrega consistió estrictamente en la infraestructura de código, helpers y suites de pruebas automatizadas.
   - No se emitieron correos SMTP ni se crearon cuentas en la instancia remota de Supabase; dicha fase será coordinada por Codex mediante navegación real en Orca Browser.
