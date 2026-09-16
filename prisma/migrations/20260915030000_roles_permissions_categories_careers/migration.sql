-- Roles/permisos administrables, catálogo de categorías y carreras como tablas,
-- y visibilidad de items por rol (ej. "solo para profesores").
-- Reemplaza el enum UserRole fijo y las columnas de texto libre User.career / Item.category.

-- ---------- nuevas tablas ----------

CREATE TABLE "Role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(60) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "Career" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,

    CONSTRAINT "Career_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "icon" VARCHAR(8),
    "blurb" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItemVisibility" (
    "itemId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "ItemVisibility_pkey" PRIMARY KEY ("itemId", "roleId")
);

CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
CREATE INDEX "Role_name_idx" ON "Role"("name");
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE UNIQUE INDEX "Career_name_key" ON "Career"("name");
CREATE UNIQUE INDEX "Category_key_key" ON "Category"("key");

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemVisibility" ADD CONSTRAINT "ItemVisibility_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- seed: roles + permisos ----------

INSERT INTO "Role" ("name", "description") VALUES
  ('STUDENT', 'Estudiante UJAP'),
  ('PROFESSOR', 'Profesor UJAP'),
  ('ADMIN', 'Administrador de la plataforma');

INSERT INTO "Permission" ("key", "description") VALUES
  ('profile.update', 'Actualizar su propio perfil (clave, correo, teléfono, foto)'),
  ('items.publish', 'Publicar objetos para prestar'),
  ('items.rent', 'Solicitar en préstamo un objeto'),
  ('reviews.create', 'Calificar a otro usuario tras finalizar un préstamo'),
  ('roles.manage', 'Crear/editar roles y asignar permisos'),
  ('categories.manage', 'Administrar categorías de objetos'),
  ('careers.manage', 'Administrar carreras universitarias'),
  ('users.manage', 'Ver y administrar todos los usuarios');

-- STUDENT y PROFESSOR: mismos permisos base (la diferencia entre ambos es de
-- audiencia de items vía ItemVisibility, no de permisos).
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.name IN ('STUDENT', 'PROFESSOR')
  AND p.key IN ('profile.update', 'items.publish', 'items.rent', 'reviews.create');

-- ADMIN: todos los permisos.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.name = 'ADMIN';

-- ---------- seed: carreras ----------

INSERT INTO "Career" ("name") VALUES
  ('Ingeniería Civil'),
  ('Ingeniería Mecánica'),
  ('Ingeniería en Computación'),
  ('Ingeniería en Telecomunicaciones'),
  ('Ingeniería Industrial');

-- ---------- seed: categorías ----------

INSERT INTO "Category" ("key", "label", "icon", "blurb") VALUES
  ('utiles-escolares', 'Útiles escolares', '📏', 'Reglas, calculadoras, útiles de dibujo técnico y más.'),
  ('electronicos', 'Electrónicos', '🔌', 'Audífonos, mouse, cables y demás accesorios electrónicos.'),
  ('laptops', 'Laptops', '💻', 'Equipos portátiles para ese trabajo o parcial de última hora.'),
  ('cargadores', 'Cargadores de teléfono', '🔋', 'Cables y adaptadores para no quedarte sin batería entre clases.'),
  ('videobeam', 'Videobeam y proyectores', '📽️', 'Para exposiciones y presentaciones de última hora.'),
  ('marcadores', 'Marcadores de pizarra', '🖊️', 'Marcadores y borradores para exposiciones en el salón.'),
  ('libros', 'Libros y textos', '📚', 'Libros, guías y material bibliográfico por materia.'),
  ('laboratorio', 'Equipo de laboratorio', '🧪', 'Batas, instrumentos y herramientas de laboratorio o taller.');

-- ---------- User: role/career como FK ----------

ALTER TABLE "User" ADD COLUMN "roleId" UUID;
ALTER TABLE "User" ADD COLUMN "careerId" UUID;

UPDATE "User" u SET "roleId" = r.id FROM "Role" r WHERE r.name = u."role"::text;
UPDATE "User" u SET "careerId" = c.id FROM "Career" c
  WHERE c.name = CASE WHEN u."career" = 'Ingeniería en Informática' THEN 'Ingeniería en Computación' ELSE u."career" END;

-- Cualquier usuario existente que no calce con una carrera nueva cae en la primera por defecto.
UPDATE "User" SET "careerId" = (SELECT id FROM "Career" ORDER BY name LIMIT 1) WHERE "careerId" IS NULL;
UPDATE "User" SET "roleId" = (SELECT id FROM "Role" WHERE name = 'STUDENT') WHERE "roleId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "careerId" SET NOT NULL;

DROP INDEX "User_role_idx";
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" DROP COLUMN "career";
DROP TYPE "UserRole";

CREATE INDEX "User_roleId_idx" ON "User"("roleId");

ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Item: category como FK, se quita el flujo de revisión ----------

BEGIN;
CREATE TYPE "ItemStatus_new" AS ENUM ('AVAILABLE', 'PAUSED', 'LENT', 'REJECTED');
ALTER TABLE "Item" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Item" ALTER COLUMN "status" TYPE "ItemStatus_new" USING ("status"::text::"ItemStatus_new");
ALTER TYPE "ItemStatus" RENAME TO "ItemStatus_old";
ALTER TYPE "ItemStatus_new" RENAME TO "ItemStatus";
DROP TYPE "ItemStatus_old";
ALTER TABLE "Item" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

DROP INDEX "Item_category_status_idx";
ALTER TABLE "Item" ADD COLUMN "categoryId" UUID;
-- La tabla Item está vacía hasta ahora (nada pasó por el flujo previo de revisión), así que no hace falta backfill real.
UPDATE "Item" SET "categoryId" = (SELECT id FROM "Category" ORDER BY key LIMIT 1) WHERE "categoryId" IS NULL;
ALTER TABLE "Item" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Item" DROP COLUMN "category";
ALTER TABLE "Item" DROP COLUMN "approvedAt";

CREATE INDEX "Item_categoryId_status_idx" ON "Item"("categoryId", "status");

ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemVisibility" ADD CONSTRAINT "ItemVisibility_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- trigger de alta de usuario: asigna rol/carrera desde los metadatos de Supabase Auth ----------

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT;
  resolved_role_id UUID;
  resolved_career_id UUID;
BEGIN
  requested_role := UPPER(COALESCE(NEW.raw_user_meta_data ->> 'role', 'STUDENT'));
  IF requested_role NOT IN ('STUDENT', 'PROFESSOR') THEN
    requested_role := 'STUDENT';
  END IF;

  SELECT id INTO resolved_role_id FROM "Role" WHERE name = requested_role;
  SELECT id INTO resolved_career_id FROM "Career" WHERE name = NEW.raw_user_meta_data ->> 'career';
  IF resolved_career_id IS NULL THEN
    SELECT id INTO resolved_career_id FROM "Career" ORDER BY name LIMIT 1;
  END IF;

  INSERT INTO public."User" (
    "id",
    "authUserId",
    "email",
    "firstName",
    "lastName",
    "roleId",
    "careerId",
    "phone",
    "photoUrl",
    "emailVerifiedAt",
    "reliabilityScore",
    "reliabilityReviewCount",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'firstName', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'lastName', ''),
    resolved_role_id,
    resolved_career_id,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    NULL,
    NEW.email_confirmed_at,
    0,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT ("authUserId") DO UPDATE SET
    "email" = EXCLUDED."email",
    "updatedAt" = NOW();

  RETURN NEW;
END;
$$;
