# Historial de Migraciones SQL (`prisma/migrations/`)

Esta carpeta contiene el registro ordenado y acumulativo de migraciones ejecutadas en la base de datos PostgreSQL mediante Prisma Migrate (`prisma migrate dev` y `prisma migrate deploy`).

---

## Migraciones y Triggers Implementados

| Migración | Propósito y Contenido SQL |
|---|---|
| `20260915010639_init` | Creación inicial de tablas base (`Role`, `Permission`, `RolePermission`, `Career`, `User`, `Category`, `Item`, `LoanRequest`, `Loan`, `Review`, `Payment`, `QrLoginChallenge`), tipos enumerados e índices de rendimiento. |
| `20260915020000_auth_user_profile_trigger` | Trigger de base de datos en PostgreSQL para escuchar inserciones en `auth.users` de Supabase y crear automáticamente el registro correspondiente en `public.User` con rol `STUDENT`. |
| `20260915030000_roles_permissions_categories_careers` | Sembrado inicial de permisos del sistema (`items.publish`, `items.rent`, `users.manage`, etc.), roles predeterminados (`ADMIN`, `STUDENT`, `PROFESSOR`) y catálogo base de categorías. |
| `20260915031500_signup_trigger_uses_career_id` | Actualización de la función trigger de registro para extraer y asociar el identificador UUID de la carrera (`careerId`) desde los metadatos de Supabase Auth. |
| `20260915040000_user_is_active` | Agrega la columna booleana `isActive` a la tabla `User` para posibilitar la suspensión o reactivación administrativa de cuentas. |
| `20260915050000_schools` | Creación de la tabla `School` y adición de la clave foránea `schoolId` en la tabla `Career` para agrupar carreras por facultades/escuelas universitarias. |
| `20260916010000_signup_trigger_stores_photo` | Modificación del trigger de alta para almacenar la URL de la foto de perfil en la columna `photoUrl` durante el registro inicial. |
| `20260916120000_item_modes_and_storage` | Adición de modalidades de publicación (`LOAN` y `RENTAL`), columnas de precio y moneda en `Item`, tabla de control de audiencia `ItemVisibility` y creación de políticas de almacenamiento. |
