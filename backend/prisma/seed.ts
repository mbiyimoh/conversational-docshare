/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create demo user
  const passwordHash = await bcrypt.hash('demo123', 12)
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash,
      name: 'Demo User',
      emailVerified: new Date(),
      subscriptionTier: 'pro',
    },
  })

  console.log('✅ Created demo user:', demoUser.email)

  // Create demo project
  const demoProject = await prisma.project.upsert({
    where: { id: 'demo-project' },
    update: {},
    create: {
      id: 'demo-project',
      ownerId: demoUser.id,
      name: 'Q4 Strategic Plan',
      description: 'Quarterly planning documents and analysis',
      isActive: true,
    },
  })

  console.log('✅ Created demo project:', demoProject.name)

  // Create demo agent configuration
  await prisma.agentConfig.upsert({
    where: { projectId: demoProject.id },
    update: {},
    create: {
      projectId: demoProject.id,
      status: 'complete',
      completionLevel: 100,
      preferredModel: 'gpt-4-turbo',
      temperature: 0.7,
      interviewData: {
        audience: {
          question: "Who is your primary audience?",
          answer: "Board members and senior executives",
        },
        purpose: {
          question: "What's the main purpose of these documents?",
          answer: "Quarterly strategic planning and review",
        },
        tone: {
          question: "What communication style should the AI use?",
          answer: "Professional but approachable, data-driven",
        },
        emphasis: {
          question: "What should the AI emphasize?",
          answer: "Key metrics, risks, and strategic recommendations",
        },
        questions: {
          question: "What proactive questions should the AI ask?",
          answer: "How does this align with annual objectives? What resources are needed?",
        },
      },
    },
  })

  console.log('✅ Created demo agent configuration')

  // Create context layers
  await prisma.contextLayer.create({
    data: {
      projectId: demoProject.id,
      category: 'audience',
      priority: 10,
      isActive: true,
      content: `Primary Audience: Board members and senior executives
Expertise Level: Business strategy and finance
Relationship: Decision-makers and advisors

Anticipated Questions:
- What are the key performance metrics?
- What risks should we be aware of?
- How does this align with our annual objectives?`,
      metadata: {
        audienceType: 'board_members',
        expertiseLevel: 'business',
        relationship: 'decision_makers',
      },
    },
  })

  await prisma.contextLayer.create({
    data: {
      projectId: demoProject.id,
      category: 'communication',
      priority: 9,
      isActive: true,
      content: `Tone: Professional but approachable
Style: Data-driven with clear explanations
Citation Style: Always cite specific document sections

When responding:
- Use business terminology appropriately
- Support claims with data from documents
- Provide clear section references for citations`,
      metadata: {
        tone: 'professional_approachable',
        citationRequired: true,
      },
    },
  })

  await prisma.contextLayer.create({
    data: {
      projectId: demoProject.id,
      category: 'content',
      priority: 8,
      isActive: true,
      content: `Main Purpose: Quarterly strategic planning and review

Emphasis Areas:
- Key performance metrics
- Risk assessment and mitigation
- Strategic recommendations
- Resource requirements

Speculation: Not allowed - stick to documented facts only`,
      metadata: {
        emphasisAreas: ['metrics', 'risks', 'recommendations', 'resources'],
        allowSpeculation: false,
      },
    },
  })

  await prisma.contextLayer.create({
    data: {
      projectId: demoProject.id,
      category: 'engagement',
      priority: 7,
      isActive: true,
      content: `Proactive Questions to Guide Conversation:
- "How does this align with your annual objectives?"
- "What resources would you need to implement this?"
- "Are there any concerns about the proposed timeline?"
- "Would you like me to compare this to previous quarters?"

Follow-up Actions:
- Offer to drill deeper into specific sections
- Suggest related documents when relevant
- Summarize key points at natural break points`,
      metadata: {
        proactiveQuestions: true,
        suggestFollowUps: true,
      },
    },
  })

  console.log('✅ Created 4 context layers')

  // Create demo share link
  const demoShareLink = await prisma.shareLink.create({
    data: {
      projectId: demoProject.id,
      slug: 'demo-q4-plan',
      accessType: 'email',
      allowedEmails: ['viewer@example.com', 'stakeholder@example.com'],
      isActive: true,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    },
  })

  console.log('✅ Created demo share link:', demoShareLink.slug)

  console.log('\n🎉 Seeding complete!')
  console.log('\n📝 Demo credentials:')
  console.log('   Email: demo@example.com')
  console.log('   Password: demo123')
  console.log('\n🔗 Demo share link:')
  console.log(`   http://localhost:5173/share/${demoShareLink.slug}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
