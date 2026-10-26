# Mensajes y conversaciones — LendIt UJAP

## Bandeja y consultas por objeto (25 de octubre de 2026)

- Ruta privada `/mensajes`, accesible desde cabecera, menú móvil y conversaciones recientes en `/inicio`.
- `Preguntar al propietario` en el catálogo abre `/mensajes?item=<UUID>`. Requiere sesión y crea o reutiliza una consulta por objeto y solicitante. No crea solicitudes de préstamo, pagos ni mensajes automáticos.
- `Conversar` en una solicitud abre `/mensajes?request=<UUID>`. Se conservan el historial y las restricciones de los chats existentes.
- La consulta se enlaza con `?conversation=<UUID>`. La URL permite recargar, compartir con la otra persona participante y usar Atrás. La API valida pertenencia en cada petición.
- En móvil se ve una sola región: bandeja o conversación, con retorno a Mensajes. Los borradores sobreviven al cambio de conversación mientras la sesión continúa; al salir se vacían los mensajes y borradores en memoria.

### Extensión compatible de `/api/messages`

Todas las operaciones requieren `Authorization: Bearer <jwt>`. Se preservan GET y POST con `requestId` descritos abajo.

| Operación | Entrada | Respuesta |
| --- | --- | --- |
| GET bandeja | `?view=inbox&page=0` | `{ok, threads, hasMore}`; 50 conversaciones por página, ordenadas por última actividad |
| POST iniciar consulta | `{action:"start", itemId:"UUID"}` | `{ok, thread}`; idempotente para el mismo objeto y solicitante |
| GET consulta | `?conversationId=UUID` | `{ok, thread, messages, nextCursor}` |
| GET solicitud | `?requestId=UUID` | Mismo formato, compatible con el historial anterior |
| GET anteriores | Añadir `&before=<message UUID>` | Hasta 100 mensajes anteriores; cursor validado dentro del mismo hilo |
| POST mensaje | `{conversationId:"UUID", content:"texto"}` o `{requestId:"UUID", content:"texto"}` | `201 {ok, message}` |

Se exige **exactamente uno** de `requestId` o `conversationId`. Contenido normalizado con trim, entre 1 y 2000 caracteres. No se permite consultar una publicación propia ni crear una consulta nueva para un objeto no disponible, propietario desactivado o fuera del público permitido. Solo las dos personas participantes pueden leer y escribir; las solicitudes cerradas mantienen historial de solo lectura.

Los errores adicionales son `INVALID_PAGE`, `INVALID_CURSOR` (400), `FORBIDDEN` (403), `ITEM_NOT_FOUND`/`THREAD_NOT_FOUND` (404), `OWN_ITEM`/`ITEM_NOT_AVAILABLE`/`CONVERSATION_CLOSED` (409). La bandeja no anuncia mensajes no leídos: no hay confirmaciones de lectura implementadas.

### Persistencia y actualización

Migración `20261025020000_item_conversations`: tabla `ItemConversation` con unicidad `(itemId, requesterId)`; `ChatMessage.requestId` pasa a opcional y se agrega `conversationId`. Un CHECK exige un único vínculo por mensaje. Los datos existentes no se modifican.

Supabase Realtime mantiene la suscripción a `ChatMessage`, filtrada por el hilo seleccionado. La política SELECT autoriza participantes activos mediante `lendit_can_read_chat`, una función SECURITY DEFINER con search_path vacío y ejecución restringida a `authenticated`. Las escrituras se realizan exclusivamente por la API autenticada. La UI reconcilia por ID para evitar duplicados y refresca cada 20 segundos mientras está visible como respaldo a desconexiones; el envío se confirma por respuesta HTTP, no por temporizador ni simulación.

No se han enviado mensajes de prueba a otras cuentas durante esta implementación. Compilar no prueba la entrega en tiempo real entre dos sesiones.

---

## Contrato anterior de chat por solicitud

Este documento describe la persistencia, configuración de base de datos con Realtime y el contrato de la API HTTP para el chat por solicitud de préstamo entre estudiantes y propietarios de objetos.

---

## 1. Modelo de Datos (Prisma)

El modelo `ChatMessage` se define en `prisma/schema.prisma`:

```prisma
model ChatMessage {
  id        String      @id @default(uuid()) @db.Uuid
  requestId String      @db.Uuid
  senderId  String      @db.Uuid
  content   String      @db.VarChar(2000)
  createdAt DateTime    @default(now())
  request   LoanRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  sender    User        @relation(fields: [senderId], references: [id], onDelete: Restrict)

  @@index([requestId, createdAt])
}
```

### Relaciones:
- `request`: Vínculo a `LoanRequest` (`onDelete: Cascade`).
- `sender`: Vínculo a `User` (`onDelete: Restrict`).
- Índice compuesto `[requestId, createdAt]` para optimizar la consulta y orden cronológico de los mensajes por solicitud.

---

## 2. Migración SQL, RLS y Supabase Realtime

La migración se ubica en:
`prisma/migrations/20260917000000_chat_messages/migration.sql`

### Características de Seguridad y Realtime:
1. **Row Level Security (RLS)**:
   - RLS habilitado en la tabla `"ChatMessage"`.
   - Política `SELECT` restringida a participantes autenticados:
     `auth.uid()` se mapea contra `User.authUserId` para verificar que el usuario sea el solicitante (`LoanRequest.requesterId`) o el propietario del artículo (`Item.ownerId`).
   - Concesión de permiso: `GRANT SELECT ON "ChatMessage" TO authenticated`.
2. **Publicación Supabase Realtime**:
   - Se agrega `"ChatMessage"` a la publicación `supabase_realtime` (`ALTER PUBLICATION supabase_realtime ADD TABLE "ChatMessage"`).
   - `REPLICA IDENTITY FULL` para emisión completa de registros en eventos Realtime.

---

## 3. Contrato de la API (`/api/messages`)

Todos los endpoints requieren autenticación mediante encabezado HTTP:
`Authorization: Bearer <jwt_supabase>`

El perfil autenticado se valida mediante `getAuthenticatedProfile`. Solo los usuarios participantes (solicitante o dueño del objeto) pueden interactuar con el chat.

### 3.1. Obtener historial de mensajes

- **Método**: `GET`
- **Ruta**: `/api/messages?requestId=<UUID>`
- **Permisos de lectura**: Permitido a cualquier participante de la solicitud (requester o dueño del item), incluso si la solicitud ya fue cerrada o finalizada.
- **Respuesta Exitosa (200 OK)**:
```json
{
  "ok": true,
  "messages": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "requestId": "987fcdeb-51a2-43f7-9abc-def012345678",
      "senderId": "456e7890-e89b-12d3-a456-426614174001",
      "content": "¿Hola! Dónde nos vemos para la entrega?",
      "createdAt": "2026-10-25T04:15:00.000Z"
    }
  ]
}
```
- **Errores posibles**:
  - `400`: `INVALID_REQUEST_ID` (requestId ausente o no es UUID válido).
  - `401 / 403`: Error de autenticación / perfil (ej. `UNAUTHORIZED`, `INSTITUTIONAL_EMAIL_REQUIRED`).
  - `403`: `FORBIDDEN` (el usuario autenticado no es el solicitante ni el dueño).
  - `404`: `REQUEST_NOT_FOUND` (no existe solicitud con ese ID).

### 3.2. Enviar nuevo mensaje

- **Método**: `POST`
- **Ruta**: `/api/messages`
- **Cabeceras**: `Content-Type: application/json`
- **Cuerpo (JSON)**:
```json
{
  "requestId": "987fcdeb-51a2-43f7-9abc-def012345678",
  "content": "Estoy en el cafetín de Ingeniería."
}
```
- **Validación de contenido**: Cadena no vacía, máximo 2000 caracteres.
- **Regla de negocio**:
  Solo se permite enviar mensajes si:
  - La solicitud está en estado `PENDING` o `APPROVED`.
  - Si ya existe un préstamo asociado (`Loan`), este debe estar en estado `ACTIVE`.
- **Respuesta Exitosa (201 Created)**:
```json
{
  "ok": true,
  "message": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "requestId": "987fcdeb-51a2-43f7-9abc-def012345678",
    "senderId": "456e7890-e89b-12d3-a456-426614174001",
    "content": "Estoy en el cafetín de Ingeniería.",
    "createdAt": "2026-10-25T04:15:00.000Z"
  }
}
```
- **Errores posibles**:
  - `400`: `INVALID_MESSAGE_DATA` (payload inválido, formato de UUID incorrecto o mensaje vacío/mayor a 2000 caracteres).
  - `401 / 403`: Error de autenticación / perfil.
  - `403`: `FORBIDDEN` (usuario no es participante).
  - `404`: `REQUEST_NOT_FOUND` (solicitud no encontrada).
  - `409`: `REQUEST_NOT_ACTIVE` (la solicitud no está PENDING/APPROVED o el préstamo no está ACTIVE).

---

## 4. Despliegue y Validación

1. **Generación del cliente**:
   ```bash
   pnpm db:generate
   ```
2. **Aplicar migraciones en Supabase/PostgreSQL**:
   ```bash
   pnpm db:migrate:deploy
   ```
3. **Servidor local**:
   ```bash
   pnpm dev:full # o pnpm dev:api
   ```
   El endpoint queda disponible localmente en `http://localhost:8787/api/messages`.
