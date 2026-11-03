import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppearanceProvider } from './lib/appearance'
import { AuthProvider } from './lib/auth'
import Appearance from './pages/Appearance'
import Assistant from './pages/Assistant'
import Calendar from './pages/Calendar'
import Home from './pages/Home'
import Ideas from './pages/Ideas'
import Login from './pages/Login'
import NoteEditor from './pages/NoteEditor'
import Principles from './pages/Principles'
import ProjectDetail from './pages/ProjectDetail'
import Projects from './pages/Projects'

export default function App() {
  return (
    <AppearanceProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/assistant" element={<Assistant />} />
                <Route path="/appearance" element={<Appearance />} />
                <Route path="/ideas" element={<Ideas />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/principles" element={<Principles />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/notes/new" element={<NoteEditor />} />
                <Route path="/notes/:id" element={<NoteEditor />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </AppearanceProvider>
  )
}
