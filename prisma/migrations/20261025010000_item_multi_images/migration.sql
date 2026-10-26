-- Agregar columna photoUrls para soporte de hasta 8 fotos por publicación
ALTER TABLE "Item" ADD COLUMN "photoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Rellenar photoUrls a partir de photoUrl existente para preservar compatibilidad con publicaciones previas
UPDATE "Item"
SET "photoUrls" = ARRAY["photoUrl"]
WHERE "photoUrl" IS NOT NULL AND cardinality("photoUrls") = 0;
