import "dotenv/config"
import { defineConfig } from "prisma/config"

const directUrl = process.env.DIRECT_URL
const databaseCommands = ["migrate", "db", "studio", "introspect"]
const needsDatabase = process.argv.some((argument) => databaseCommands.includes(argument))

if (!directUrl && needsDatabase) {
  throw new Error("DIRECT_URL is required for Prisma commands that access the database.")
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `generate` y `validate` no conectan a la base de datos, pero Prisma carga
    // este archivo durante `pnpm install`; por eso la URL puede estar ausente.
    // Los comandos de base de datos siguen necesitando un DIRECT_URL real.
    url: directUrl ?? "",
  },
})
