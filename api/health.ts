import { prisma } from "./_lib/prisma.js"

type ApiRequest = {
  method?: string
}

type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" })
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    return res.status(200).json({ ok: true, database: "up" })
  } catch (error) {
    console.error(
      "Database health check failed",
      error instanceof Error ? error.message : "unknown error",
    )

    return res.status(503).json({ ok: false, database: "down" })
  }
}
