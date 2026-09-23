import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProjectList from './pages/ProjectList'
import ScriptCharacters from './pages/ScriptCharacters'
import ScriptLayout from './pages/ScriptLayout'
import ScriptScenes from './pages/ScriptScenes'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/scripts/:id" element={<ScriptLayout />}>
          <Route index element={<Navigate to="scenes" replace />} />
          <Route path="scenes" element={<ScriptScenes />} />
          <Route path="characters" element={<ScriptCharacters />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
