# API de LendIt UJAP

Fecha de revisión: 2026-10-26. Fuente de implementación: `server/app.ts` y handlers `backend/`. Inventario: **22 rutas y 37 operaciones HTTP**.

## Documentos y uso

- `contracts/openapi.json`: especificación OpenAPI 3.0.3 importable en Postman o un visor Swagger. Incluye inventario completo de rutas, autenticación, parámetros y esquemas iniciales de entrada. Los DTO de respuesta aún usan un sobre genérico: no es un contrato exhaustivo de todos los campos ni certifica pruebas de todas las operaciones.
- `scripts/generate-api-spec.mjs`: genera el archivo anterior desde el inventario revisado; falla si no coincide con las rutas del router. Actualizarlo cuando cambie el backend y ejecutar `pnpm docs:api`.
- `tests/api/README.md`: guía de Supertest, casos, informes y límites.
- `docs/teacher-verification-contract.md`, `docs/chat.md` y `docs/payments.md`: detalle especializado; en caso de diferencia contrastar con el código y actualizar el contrato, no asumir que un ejemplo antiguo refleja el comportamiento actual.

No se requiere publicar documentación ni subir claves para importar el JSON en Postman. Elegir servidor local para demostraciones; importar una especificación no equivale a ejecutar todos sus endpoints.

## Servidores y autenticación

| Entorno | URL |
| --- | --- |
| Local | `http://localhost:8787` (`pnpm dev:api`) |
| Producción | `https://lendit-ujap.vercel.app` |

La API admite JSON. En rutas protegidas:

```http
Authorization: Bearer <access_token_de_supabase>
Content-Type: application/json
```

Obtener sesión mediante Supabase Auth y conservar el token solo en el entorno local del cliente. No usar la clave secreta de Supabase como Bearer de usuario, ni poner contraseñas en la colección, repositorio o informe.

Registro, login, confirmación de correo y recuperación pertenecen a **Supabase Auth**. Hoy NO existen `/api/login`, `/api/register` o `/api/forgot-password` propios. El frontend usa `signUp` y `signInWithPassword`; LendIt consulta `/api/me` para materializar o recuperar el perfil y sus permisos. La implementación local incluye `/recuperar-contrasena`, `/auth/reset-password`, `/auth/confirmacion` y `/cuenta/seguridad`; consultar tests/auth-deliveries/integration.md para evidencia y límites pendientes. Estas rutas de frontend no son endpoints REST y requieren validación del despliegue antes de considerarlas disponibles en producción.

## Inventario

La columna de acceso describe condiciones del servidor. ADMIN tiene catálogo de solo lectura y no puede operar en marketplace. Un solicitante docente pendiente no obtiene privilegios docentes ni puede crear operaciones nuevas.

| Método | Ruta | Función / entrada principal | Acceso |
| --- | --- | --- | --- |
| GET | `/api/health` | Estado de PostgreSQL | Público |
| GET | `/api/me` | Perfil, rol y permisos propios | Sesión activa |
| PATCH | `/api/me` | Actualizar perfil o materializarlo desde identidad existente | `profile.update` para perfil existente |
| GET | `/api/items` | Catálogo; `mine=1`; `view=requests` | Público; vistas propias con sesión |
| POST | `/api/items` | Crear publicación o solicitud con `resource=request` | `items.publish` / `items.rent` |
| PATCH | `/api/items` | Editar publicación o resolver solicitud/préstamo | Propiedad/participación y permiso |
| DELETE | `/api/items` | `{id}`; eliminar publicación sin historial | Propietario y `items.publish` |
| GET | `/api/categories` | Catálogo; `action=photos&q=...` busca Unsplash | Público; búsqueda de fotos requiere `categories.manage` |
| POST | `/api/categories` | Crear categoría | `categories.manage` |
| PATCH, DELETE | `/api/categories/{key}` | Editar/eliminar categoría | `categories.manage` |
| GET | `/api/schools` | Listar escuelas | Público |
| POST | `/api/schools` | Crear escuela | `careers.manage` |
| PATCH, DELETE | `/api/schools/{id}` | Editar/eliminar escuela | `careers.manage` |
| GET | `/api/careers` | Listar carreras | Público |
| POST | `/api/careers` | Crear carrera | `careers.manage` |
| PATCH, DELETE | `/api/careers/{id}` | Editar/eliminar carrera | `careers.manage` |
| GET | `/api/roles` | Listar roles y permisos | Sesión activa |
| POST | `/api/roles` | `{name, description?, permissionKeys?}` | `roles.manage` |
| PATCH, DELETE | `/api/roles/{id}` | Editar permisos/descripción o eliminar rol no protegido | `roles.manage` |
| GET | `/api/permissions` | Listar claves de permiso | `roles.manage` |
| GET | `/api/users` | Búsqueda `q` y página `page` | `users.manage` |
| PATCH | `/api/users/{id}` | `{roleId?, isActive?}`; al menos uno | `users.manage` |
| POST | `/api/users/{id}/reset-password` | Solicitar correo de recuperación | `users.manage` |
| GET | `/api/messages` | Bandeja o mensajes de hilo | Participantes, no ADMIN |
| POST | `/api/messages` | Iniciar consulta o enviar mensaje | Participantes y audiencia |
| GET | `/api/payments` | `requestId` obligatorio | Participantes de solicitud, no ADMIN |
| POST | `/api/payments` | Simular pago de alquiler | Solicitante, no ADMIN |
| GET, POST | `/api/teacher-verifications/me` | Leer o enviar/re-enviar acreditación propia | Cuenta activa |
| GET | `/api/teacher-verifications/me/credential` | URL firmada temporal de credencial | Propietario activo |
| GET | `/api/admin/teacher-verifications` | Listar postulaciones con filtros | `teachers.review` |
| GET | `/api/admin/teacher-verifications/{id}` | Expediente, credencial e historial | `teachers.review` |
| POST | `/api/admin/teacher-verifications/{id}/decision` | Decisión con versión esperada | `teachers.review` |

No hay GET de detalle para categorías, escuelas o carreras por ID/key: las rutas de detalle admiten PATCH/DELETE. No hay DELETE de usuario público implementado; desactivar por PATCH no es borrar una cuenta de Supabase Auth.

## Ejemplos y reglas

### Perfil

```http
PATCH /api/me
```

```json
{"firstName":"Ana","lastName":"Pérez","phone":"04120000000","careerId":"00000000-0000-4000-8000-000000000001"}
```

IDs de ejemplos son ilustrativos: reemplazarlos por fixtures del entorno. Estudiante requiere carrera existente; profesor requiere escuela y carrera opcional coherente con ella. Docentes aprobados que alteran escuela/departamento pasan a revisión; no confundir guardar perfil con mantener acreditación aprobada.

Éxito: `200 {"ok":true,"user":{...}}`. Perfil ausente: `409 PROFILE_REQUIRED`. Datos incompletos: `422 PROFILE_INCOMPLETE` o código académico específico. Carrera inexistente: `400 CAREER_NOT_FOUND`.

### Publicaciones y solicitudes

Crear publicación con `POST /api/items`:

```json
{"title":"Microscopio","categoryKey":"laboratorio","duration":"1 día","description":"Incluye estuche","mode":"LOAN","restrictedToRoles":[]}
```

`201 {"ok":true,"item":{...}}`. `categoryKey` debe existir. `mode=RENTAL` requiere precio positivo hasta 100000 y moneda `USD`, `EUR` o `VES`. Máximo ocho `photoUrls`; solo URLs de fotos admitidas por el backend. Audiencia vacía significa pública; las restricciones se resuelven por roles existentes.

Crear solicitud con el mismo endpoint:

```json
{"resource":"request","itemId":"00000000-0000-4000-8000-000000000002","startsAt":"2030-06-10T12:00:00Z","endsAt":"2030-06-11T12:00:00Z","message":"¿Podemos coordinar la entrega?"}
```

Usar fechas futuras al ejecutar. No se permite pedir un objeto propio, fuera de audiencia o con conflicto de disponibilidad. `201 {"ok":true,"request":{...}}`.

Resolver por `PATCH /api/items`:

```json
{"resource":"request","action":"approve","requestId":"00000000-0000-4000-8000-000000000003"}
```

Acciones: `approve`, `reject`, `cancel` requieren `requestId`; `return` requiere `loanId`. La persona autorizada depende de la acción. No se aprueba una solicitud vencida; un alquiler necesita pago simulado completo. La respuesta de éxito es 200. Editar publicación usa `{id, ...campos}` sin `resource`.

### Chat y pagos simulados

Iniciar consulta:

```json
{"action":"start","itemId":"00000000-0000-4000-8000-000000000002"}
```

Enviar por `POST /api/messages`:

```json
{"requestId":"00000000-0000-4000-8000-000000000003","content":"Nos vemos en la entrada."}
```

Usar exactamente uno entre `requestId` y `conversationId`; contenido de 1–2000 caracteres. Inicio de consulta retorna 200; mensaje creado retorna 201. Solo participantes y estados admitidos. Lectura: `GET /api/messages?requestId=...`; cursor `before` debe pertenecer al hilo. Bandeja: `view=inbox&page=0`, a partir de cero; hilos devuelven hasta 100 mensajes y `nextCursor`.

Simulación por `POST /api/payments`:

```json
{"requestId":"00000000-0000-4000-8000-000000000003","outcome":"success","paymentMethod":"campus_balance"}
```

`outcome`: success/failure. Métodos: campus_balance/fake_card/fake_mobile_pay. Retorna 200; no se cobra dinero. Pago exitoso repetido retorna el mismo pago con `idempotencyReplay`; intentar fallarlo después devuelve 409.

### Administración y docentes

Usuarios: `GET /api/users?q=ana&page=1` devuelve `users`, `total`, `page`, `pageSize=25`. Cambiar un rol no concede acreditación docente: PROFESSOR requiere revisión aprobada. No se puede desactivar/degradar el último administrador ni retirar su permiso administrativo.

Escuelas/carreras: `{name, imagenUrl?, imagenAlt?}`; carrera admite `schoolId` opcional. Imágenes generales requieren HTTPS. Categorías: `{key,label,icon?,blurb?,imagenUrl?,imagenAlt?,unsplashPhotoId?}`; no combinar imagen general con selección Unsplash. Los borrados devuelven 409 cuando existen referencias bloqueantes.

Acreditación: enviar `{schoolId,careerId?,department?,documentPath,expectedVersion?}`. La imagen debe existir, ser propia, JPEG/PNG/WebP y hasta 5 MB. El servidor versiona la evidencia; no basta un path inventado. Revisión: `{action:"APPROVE"|"REJECT"|"REQUEST_CORRECTION",expectedVersion,reason?}`. El motivo de rechazo/corrección exige 5–1000 caracteres. Colisión de versión: 409. La aprobación y asignación del rol son atómicas.

Listado administrativo de acreditaciones: `status` (por defecto PENDING; ALL para todos), `schoolId`, `search`, `page` desde 1 y `pageSize` 1–50 (por defecto 10). No confundir este `page` con la bandeja de mensajes desde cero.

Reset administrativo: `POST /api/users/{id}/reset-password`, sin cuerpo. `200 {"ok":true}` confirma aceptación por Supabase, no recepción del correo. La implementación local usa APP_URL + `/auth/reset-password`; esa URL debe estar permitida en Supabase. No se modificó su configuración remota durante esta integración.

## Errores comunes

| HTTP | Significado / ejemplos |
| --- | --- |
| 400 | Entrada inválida, categoría/carrera inexistente, audiencia inválida |
| 401 | Token ausente o inválido: UNAUTHORIZED |
| 403 | Permiso insuficiente, ACCOUNT_DISABLED, restricción de audiencia/rol |
| 404 | Recurso inexistente o API_NOT_FOUND |
| 405 | Método no admitido |
| 409 | Conflicto: LAST_ADMIN, recurso en uso, versión obsoleta, solicitud no pendiente |
| 422 | Perfil incompleto o requisito académico faltante |
| 500 | Configuración faltante o error interno controlado |
| 502 | Fallo de proveedor externo, según operación |
| 503 | Healthcheck de BD fallido |

La mayoría de errores usa `{"ok":false,"error":"CODIGO"}` y a veces `message`/`details`. Healthcheck caído usa `{"ok":false,"database":"down"}`. Un 200 no implica que un correo haya llegado o que un pago haya movido dinero real.

## Probar un endpoint específico

```powershell
pnpm test:api -- -t '/api/me'
pnpm test:api -- -t 'API-004'
pnpm test:api -- -t 'API-020'
```

El filtro busca nombres de pruebas existentes, no una URL remota. Supertest llama a `request(app)` y usa datos aislados. No todos los 37 métodos tienen pruebas en la suite de 22 casos; consultar nombres y código. Regenerar informe completo: `pnpm test:api`.

Para inspección manual de solo lectura:

```powershell
curl.exe -i http://localhost:8787/api/health
curl.exe -i http://localhost:8787/api/me
```

Se espera 200 en health si la BD local configurada está accesible y 401 en me sin sesión. Para probar escritura en una API remota se necesitan sesión, IDs y autorización sobre datos; usar la suite aislada durante la presentación.
