-- Permite al admin deshabilitar una cuenta sin borrarla.
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
