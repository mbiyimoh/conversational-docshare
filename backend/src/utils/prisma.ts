import { PrismaClient } from '@prisma/client'

// Singleton Prisma client instance with lazy initialization
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let prismaClient: PrismaClient | null = null

/**
 * Get singleton Prisma client instance.
 * Uses lazy initialization to ensure dotenv.config() has run before accessing env vars.
 */
function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prismaClient
    }
  }
  return prismaClient
}

// Export a proxy that lazily initializes Prisma
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    const value = client[prop as keyof PrismaClient]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})

// Graceful shutdown
process.on('beforeExit', async () => {
  if (prismaClient) {
    await prismaClient.$disconnect()
  }
})
