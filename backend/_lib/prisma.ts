import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../../generated/prisma/client.js"

const globalForPrisma = globalThis as typeof globalThis & {
  lenditPrisma?: PrismaClient
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured")
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })
}

export const prisma = globalForPrisma.lenditPrisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.lenditPrisma = prisma
}
