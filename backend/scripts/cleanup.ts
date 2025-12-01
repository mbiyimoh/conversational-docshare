/* eslint-disable no-console */
import { prisma } from '../src/utils/prisma'

async function cleanup() {
  console.log('Deleting all test data...')

  await prisma.documentChunk.deleteMany({})
  console.log('- Deleted document chunks')

  await prisma.document.deleteMany({})
  console.log('- Deleted documents')

  await prisma.message.deleteMany({})
  console.log('- Deleted messages')

  await prisma.conversation.deleteMany({})
  console.log('- Deleted conversations')

  await prisma.contextLayer.deleteMany({})
  console.log('- Deleted context layers')

  await prisma.agentConfig.deleteMany({})
  console.log('- Deleted agent configs')

  await prisma.shareLink.deleteMany({})
  console.log('- Deleted share links')

  await prisma.project.deleteMany({})
  console.log('- Deleted projects')

  console.log('\nAll test data deleted! Dashboard is now clean.')

  await prisma.$disconnect()
}

cleanup().catch(console.error)
