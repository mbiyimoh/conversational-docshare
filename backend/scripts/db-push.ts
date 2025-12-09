/* eslint-disable no-console */
/**
 * Safe database schema push script
 * Loads environment variables and pushes Prisma schema to database
 *
 * Automatically constructs DIRECT_URL from DATABASE_URL by replacing
 * the Supabase pooler port (6543) with the direct port (5432).
 * This is required because Prisma's schema engine doesn't work with pgbouncer.
 *
 * Usage: npm run db:push
 */
import { execSync } from 'child_process'

console.log('🔄 Pushing Prisma schema to database...')

// Construct direct URL from pooler URL if not set
let directUrl = process.env.DIRECT_URL
if (!directUrl && process.env.DATABASE_URL) {
  directUrl = process.env.DATABASE_URL.replace(':6543/', ':5432/')
  console.log('📡 Using direct connection (port 5432) for schema push')
}

try {
  execSync('npx prisma db push', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DIRECT_URL: directUrl
    }
  })
  console.log('✅ Schema pushed successfully!')
  console.log('💡 Remember to restart the backend server to pick up changes.')
} catch (error) {
  console.error('❌ Failed to push schema:', error)
  process.exit(1)
}
