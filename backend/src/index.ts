// Load environment variables FIRST before any other imports
import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { apiLimiter } from './middleware/rateLimit'
import authRoutes from './routes/auth.routes'
import projectRoutes from './routes/project.routes'
import documentRoutes from './routes/document.routes'
import chatRoutes from './routes/chat.routes'
import agentRoutes from './routes/agent.routes'
import shareLinkRoutes from './routes/shareLink.routes'
import analyticsRoutes from './routes/analytics.routes'
import testSessionRoutes from './routes/testSession.routes'
import recommendationRoutes from './routes/recommendation.routes'
import conversationRoutes from './routes/conversation.routes'
import userRoutes from './routes/user.routes'
import documentCommentRoutes from './routes/documentComment.routes'
import audienceSynthesisRoutes from './routes/audienceSynthesis.routes'
import audienceProfileRoutes from './routes/audienceProfile.routes'
import collaboratorProfileRoutes from './routes/collaboratorProfile.routes'
import { documentVersionRoutes } from './routes/documentVersion.routes'
import { startProcessingQueue } from './services/processingQueue'
import { terminatePool } from './services/worker/workerPool'
import { runReprocessingIfNeeded } from './services/documentReprocessor'

// Create Express app
const app = express()
const PORT = process.env.PORT || 4000

// CORS configuration - supports multiple origins via comma-separated CORS_ORIGIN
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS not allowed for origin: ${origin}`))
    }
  },
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Rate limiting
app.use('/api/', apiLimiter)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api', documentRoutes)
app.use('/api', chatRoutes)
app.use('/api', agentRoutes)
app.use('/api', shareLinkRoutes)
app.use('/api', analyticsRoutes)
app.use('/api', testSessionRoutes)
app.use('/api', recommendationRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/users', userRoutes)
app.use('/api', documentCommentRoutes)
app.use('/api', audienceSynthesisRoutes)
app.use('/api', audienceProfileRoutes)
app.use('/api', collaboratorProfileRoutes)
app.use('/api', documentVersionRoutes)

// 404 handler
app.use(notFoundHandler)

// Error handler (must be last)
app.use(errorHandler)

// Start server
app.listen(PORT, () => {
  console.warn(`🚀 Server running on port ${PORT}`)
  console.warn(`📍 API available at http://localhost:${PORT}/api`)
  console.warn(`🏥 Health check at http://localhost:${PORT}/health`)

  // Re-enable processing queue with worker pool isolation
  startProcessingQueue(15000)
  console.warn('📋 Document processing queue ENABLED (worker pool mode)')

  // Reprocess existing DOCX documents with formatting preservation
  runReprocessingIfNeeded()
})

// Graceful shutdown - clean up worker pool
process.on('SIGTERM', async () => {
  console.warn('SIGTERM signal received: closing HTTP server')
  await terminatePool()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.warn('SIGINT signal received: closing HTTP server')
  await terminatePool()
  process.exit(0)
})
