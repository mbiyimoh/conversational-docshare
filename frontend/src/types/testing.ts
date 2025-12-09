export interface TestSession {
  id: string
  projectId: string
  name: string | null
  status: 'active' | 'ended'
  createdAt: string
  updatedAt: string
  endedAt: string | null
}

export interface TestSessionSummary {
  id: string
  name: string | null
  status: 'active' | 'ended'
  messageCount: number
  commentCount: number
  createdAt: string
  endedAt: string | null
}

export interface TestSessionWithMessages extends TestSession {
  messages: TestMessage[]
}

export interface TestMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  comments: TestComment[]
}

export interface TestComment {
  id: string
  messageId: string
  content: string
  templateId: string | null
  createdAt: string
}

export interface CommentTemplate {
  id: string
  label: string
  icon: string
  placeholder: string
}
