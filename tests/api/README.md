# Pruebas de endpoints para demostración

Ejecutar desde la raíz del proyecto:

```powershell
pnpm install
pnpm test:api
```

Requisitos: Node.js, pnpm y PostgreSQL 18 con `initdb`/`pg_ctl`. En Windows se usa `C:/Program Files/PostgreSQL/18/bin`. Para otra instalación:

```powershell
$env:QA_POSTGRES_BIN = 'C:/ruta/PostgreSQL/bin'
pnpm test:api
```

No hace falta levantar frontend/backend, introducir claves ni tener conexión a Supabase. La primera instalación de dependencias sí necesita red. Los binarios de PostgreSQL deben permitir crear un cluster temporal con el usuario actual; initdb no admite root en Linux.

## Qué se entrega

- Código reutilizable: `tests/api/endpoints.integration.ts` (casos con ID, expectativa y aserciones HTTP/BD).
- Entorno: `tests/api/environment.ts`, cluster PostgreSQL temporal con fixtures y proveedor de identidad HTTP local.
- Configuración: `vitest.api.config.ts` independiente de las pruebas unitarias normales.
- Informe de cada ejecución: `output/qa-api/report.html`, imprimible como PDF, y `report.md`.
- Evidencia automatizada: `output/qa-api/results.json` y `junit.xml`, con casos, tiempos, fallos y resultado.

Los informes se sobrescriben al repetir la ejecución; copiar la carpeta completa si se necesita conservar la evidencia de una fecha. `output/` se ignora en Git para evitar versionar resultados locales. El código y esta guía sí se pueden versionar. La salida distinta de cero indica fallo y el informe también lo refleja.

## Cómo presentarlo

Para un endpoint o un único caso se filtra por el nombre de la prueba (expresión regular):

```powershell
# Casos que mencionan el endpoint de perfil
pnpm test:api -- -t '/api/me'

# Solo un caso: acceso sin sesión
pnpm test:api -- -t 'API-004'

# Solo el CRUD de publicaciones
pnpm test:api -- -t 'API-020'
```

Cada selección también genera el informe. Las pruebas excluidas se muestran como pendientes/skipped, no como aprobadas. El comando sin filtro vuelve a ejecutar los 22 casos. Para otro endpoint que aún no tenga un caso, primero se añade a `endpoints.integration.ts`: filtrar no crea pruebas automáticamente.

1. Explicar los contratos HTTP: entrada, resultado esperado (200/201/400/401/403/404/405/409) y efecto esperado en BD.
2. Ejecutar `pnpm test:api` delante de la profesora; no requiere modificar cuentas reales.
3. Abrir `output/qa-api/report.html` y relacionar cada ID con el caso del código.
4. Mostrar un caso positivo (CRUD de publicación) y uno negativo (edición ajena o último administrador), incluyendo comprobación de persistencia.
5. Adjuntar `report.md` o imprimir el HTML como PDF; entregar también el código para repetirlo.

## Límites que deben indicarse

Supertest ejecuta el router Express y los handlers reales, con Prisma y PostgreSQL reales. Solo la respuesta del proveedor de identidad está simulada: los permisos y el perfil se resuelven desde la BD temporal real. No usa un mock de las consultas de Prisma.

La suite no comprueba Supabase Auth, contraseñas reales, signup, correo/SMTP, recepción en buzón, políticas Storage RLS ni el despliegue Vercel. API-009 comprueba que LendIt crea un perfil a partir de una identidad ya existente, no que Supabase registre a una persona. Esas pruebas se documentan aparte en la auditoría funcional de autenticación. No debe afirmarse que los 22 casos prueban toda la aplicación.

La prueba concurrente del administrador está disponible adicionalmente mediante `pnpm test:last-admin` (23 comprobaciones aisladas). La presente suite incorpora dos casos de bloqueo del último admin; no duplica las carreras concurrentes.
