# Simulación de Pagos de Alquiler y Contrato de API — LendIt UJAP

Este documento describe la arquitectura, modelo de datos, contrato de la API HTTP y consideraciones de base de datos para la simulación de pagos de alquiler en LendIt UJAP.

---

## 1. Principios de Diseño y Simulación

1. **Entorno Académico Seguro (Simulation-Only)**:
   - LendIt UJAP **no** recolecta, transporta ni almacena números reales de tarjetas de crédito o credenciales financieras.
   - **No** se realizan cargos bancarios reales ni llamadas a pasarelas externas reales como Stripe.
   - La simulación permite a los estudiantes y profesores experimentar el flujo transaccional de alquiler completo (selección de método demo, procesamiento, éxito y estados de fallo seguro) de forma completamente virtual.

2. **Aislamiento y no afectación de préstamos gratuitos (`LOAN`)**:
   - Para artículos en modalidad `LOAN`, `request.payment` es `null`.
   - Los préstamos gratuitos continúan operando directamente sin requerir pagos ni interacción de checkout.

---

## 2. Modelo de Datos (Prisma)

El modelo existente `Payment` en `prisma/schema.prisma` se utiliza directamente:

```prisma
enum PaymentStatus {
  PENDING
  SIMULATED_PAID
  FAILED
  REFUNDED
}

enum Currency {
  USD
  EUR
  VES
}

model Payment {
  id                String        @id @default(uuid()) @db.Uuid
  userId            String        @db.Uuid
  loanId            String?       @db.Uuid
  requestId         String?       @unique @db.Uuid
  amount            Decimal       @db.Decimal(12, 2)
  currency          Currency
  status            PaymentStatus @default(PENDING)
  provider          String?       @db.VarChar(40)
  providerReference String?       @db.VarChar(120)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  user              User          @relation(fields: [userId], references: [id], onDelete: Restrict)
  loan              Loan?         @relation(fields: [loanId], references: [id], onDelete: SetNull)
  request           LoanRequest?  @relation(fields: [requestId], references: [id], onDelete: SetNull)

  @@index([userId, status])
  @@index([loanId])
}
```

### Ciclo de Estados de Pago (`PaymentStatus`):
- `PENDING`: Estado inicial cuando se crea una solicitud de alquiler. El solicitante ve la opción de pagar en su bandeja de solicitudes.
- `SIMULATED_PAID`: El solicitante completó la simulación de pago con éxito. Se asigna una referencia `SIM-...`. El propietario del objeto ahora puede aprobar la solicitud.
- `FAILED`: Estado de fallo seguro cuando la pasarela demo simula fondos insuficientes o rechazo temporal. La solicitud sigue intacta en estado `PENDING` y el solicitante puede reintentar.
- `REFUNDED`: Si una solicitud pagada es rechazada o cancelada, o si una solicitud concurrente es aprobada para el mismo objeto, el pago pasa automáticamente a `REFUNDED`.

---

## 3. Contrato de API (`/api/payments`)

Todos los endpoints requieren autenticación mediante encabezado HTTP:
```http
Authorization: Bearer <jwt_supabase>
```

### 3.1. Consultar estado de pago de una solicitud
- **Método**: `GET`
- **Ruta**: `/api/payments?requestId=<UUID>`
- **Autorización**: Requiere que el usuario autenticado sea el solicitante (`requesterId`), el propietario del objeto (`ownerId`), o un administrador con permiso `users.manage`.
- **Respuesta Exitosa (200 OK)**:
```json
{
  "ok": true,
  "payment": {
    "id": "c1f7b029-7928-4034-bfeb-ff28b5e523f0",
    "requestId": "987fcdeb-51a2-43f7-9abc-def012345678",
    "userId": "456e7890-e89b-12d3-a456-426614174001",
    "amount": 15.00,
    "currency": "USD",
    "status": "SIMULATED_PAID",
    "provider": "simulation:campus_balance",
    "providerReference": "SIM-MNB8V7-A1B2C3",
    "createdAt": "2026-10-25T04:20:00.000Z",
    "updatedAt": "2026-10-25T04:22:00.000Z"
  }
}
```
Si la solicitud aún no tiene registro de pago o es préstamo gratuito:
```json
{
  "ok": true,
  "payment": null
}
```

- **Errores posibles**:
  - `400`: `INVALID_REQUEST_ID` (el parámetro no es un UUID válido).
  - `401`: `UNAUTHORIZED` (token ausente o inválido).
  - `403`: `FORBIDDEN` (usuario no participante).
  - `404`: `REQUEST_NOT_FOUND` (no existe solicitud con ese ID).

---

### 3.2. Simular pago de alquiler
- **Método**: `POST`
- **Ruta**: `/api/payments`
- **Cabeceras**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <jwt_supabase>`
- **Cuerpo (JSON)**:
```json
{
  "requestId": "987fcdeb-51a2-43f7-9abc-def012345678",
  "outcome": "success",
  "paymentMethod": "campus_balance"
}
```

#### Parámetros del cuerpo:
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `requestId` | UUID string | Sí | Identificador de la solicitud de alquiler |
| `outcome` | `'success'` \| `'failure'` | No (default: `'success'`) | Resultado simulado de la transacción |
| `paymentMethod` | `'campus_balance'` \| `'fake_card'` \| `'fake_mobile_pay'` | No (default: `'campus_balance'`) | Método virtual de prueba seleccionado |

#### Reglas de negocio y validación:
1. **Autorización del solicitante**: Solo el usuario creador de la solicitud (`loanRequest.requesterId === profile.id`) puede simular el pago. Otros usuarios reciben `403 FORBIDDEN`.
2. **Validación de modalidad de alquiler**: La solicitud debe pertenecer a un artículo con `mode: 'RENTAL'`, precio no nulo y moneda definida. Solicitudes de préstamo gratuito devuelven `400 NOT_A_RENTAL_REQUEST`.
3. **Estado de la solicitud**: La solicitud debe encontrarse en estado `PENDING`. Si ya fue aprobada, cancelada o rechazada, devuelve `409 REQUEST_NOT_PENDING`.
4. **Idempotencia**:
   - Si la solicitud ya tiene un pago en estado `SIMULATED_PAID` y se envía `outcome: 'success'`, la API responde inmediatamente `200 OK` retornando el pago existente con `idempotencyReplay: true` sin duplicar cargos ni modificar la referencia.
   - Si ya está en `SIMULATED_PAID` y se intenta enviar `outcome: 'failure'`, devuelve `409 PAYMENT_ALREADY_COMPLETED`.

#### Respuesta Exitosa (200 OK — `outcome: 'success'`):
```json
{
  "ok": true,
  "payment": {
    "id": "c1f7b029-7928-4034-bfeb-ff28b5e523f0",
    "requestId": "987fcdeb-51a2-43f7-9abc-def012345678",
    "userId": "456e7890-e89b-12d3-a456-426614174001",
    "amount": 15.00,
    "currency": "USD",
    "status": "SIMULATED_PAID",
    "provider": "simulation:campus_balance",
    "providerReference": "SIM-MNB8V7-A1B2C3",
    "createdAt": "2026-10-25T04:20:00.000Z",
    "updatedAt": "2026-10-25T04:22:00.000Z"
  },
  "message": "Pago simulado completado con éxito."
}
```

#### Respuesta de Fallo Seguro (200 OK — `outcome: 'failure'`):
```json
{
  "ok": true,
  "payment": {
    "id": "c1f7b029-7928-4034-bfeb-ff28b5e523f0",
    "requestId": "987fcdeb-51a2-43f7-9abc-def012345678",
    "userId": "456e7890-e89b-12d3-a456-426614174001",
    "amount": 15.00,
    "currency": "USD",
    "status": "FAILED",
    "provider": "simulation:fake_card",
    "providerReference": "SIM-FAIL-MNB8V7-D4E5F6",
    "createdAt": "2026-10-25T04:20:00.000Z",
    "updatedAt": "2026-10-25T04:22:00.000Z"
  },
  "simulatedFailure": true,
  "message": "Simulación: El pago simulado fue rechazado de forma segura (fondos insuficientes o pasarela demo)."
}
```

---

## 4. Prerrequisitos de Base de Datos Restantes

1. **Tabla `Payment` existente**:
   - En el entorno de desarrollo y pruebas locales, el modelo `Payment` ya está definido en `prisma/schema.prisma` y mapeado en las migraciones iniciales (`20260915010639_init`).
2. **Despliegue a producción en Supabase**:
   - Si la base de datos de producción aún no ha aplicado las migraciones iniciales completas, se debe ejecutar `prisma migrate deploy` en el entorno objetivo.
   - No se requieren migraciones adicionales nuevas, ya que el modelo `Payment` contenía los campos y estados necesarios (`PENDING`, `SIMULATED_PAID`, `FAILED`, `REFUNDED`).
   - Conforme a las restricciones del proyecto, no se escriben registros de prueba en Supabase ni se aplican migraciones no autorizadas.
