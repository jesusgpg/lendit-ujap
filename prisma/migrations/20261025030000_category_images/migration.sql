-- Nullable, additive columns; no category or item data is rewritten.
ALTER TABLE "Category"
  ADD COLUMN "imagenUrl" TEXT,
  ADD COLUMN "imagenAlt" TEXT,
  ADD COLUMN "unsplashPhotoId" VARCHAR(100),
  ADD COLUMN "photographerName" TEXT,
  ADD COLUMN "photographerUrl" TEXT,
  ADD COLUMN "unsplashUrl" TEXT,
  ADD COLUMN "unsplashDownloadLocation" TEXT,
  ADD COLUMN "unsplashDownloadTrackedAt" TIMESTAMP(3);
