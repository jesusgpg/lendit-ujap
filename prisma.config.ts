import "dotenv/config"
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Las migraciones se ejecutan con la conexión directa/sesión de Supabase.
    url: env("DIRECT_URL"),
  },
})
