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
import { startProcessingQueue } from './services/processingQueue'
import { terminatePool } from './services/worker/workerPool'

// Create Express app
const app = express()
const PORT = process.env.PORT || 4000

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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
