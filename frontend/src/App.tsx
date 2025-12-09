import { Routes, Route } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectPage } from './pages/ProjectPage'
import { SharePage } from './pages/SharePage'
import { SavedThreadPage } from './pages/SavedThreadPage'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/threads/:id" element={<SavedThreadPage />} />
        <Route path="/share/:slug" element={<SharePage />} />
        <Route path="/s/:slug" element={<SharePage />} />
        <Route path="/" element={<LoginPage />} />
      </Routes>
    </div>
  )
}

export default App
