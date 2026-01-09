/* eslint-disable no-console */
/**
 * Sets SYSTEM_ADMIN role for the test user
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'mbiyimoh@gmail.com'

  const user = await prisma.user.update({
    where: { email },
    data: { role: 'SYSTEM_ADMIN' },
    select: { id: true, email: true, role: true }
  })

  console.log('✅ Updated user role:', user)
}

main()
  .catch((e) => {
    console.error('❌ Failed to update role:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
