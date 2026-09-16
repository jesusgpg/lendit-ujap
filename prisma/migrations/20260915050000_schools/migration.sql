-- Agrupa carreras por escuela (Escuela de Ingeniería, Escuela de Derecho, etc.)

CREATE TABLE "School" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "School_name_key" ON "School"("name");

ALTER TABLE "Career" ADD COLUMN "schoolId" UUID;
CREATE INDEX "Career_schoolId_idx" ON "Career"("schoolId");
ALTER TABLE "Career" ADD CONSTRAINT "Career_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: las 5 carreras de ingeniería sembradas hasta ahora pertenecen a una sola escuela.
INSERT INTO "School" ("name") VALUES ('Escuela de Ingeniería');

UPDATE "Career" c SET "schoolId" = s.id
FROM "School" s
WHERE s.name = 'Escuela de Ingeniería'
  AND c.name IN (
    'Ingeniería Civil',
    'Ingeniería Mecánica',
    'Ingeniería en Computación',
    'Ingeniería en Telecomunicaciones',
    'Ingeniería Industrial'
  );
