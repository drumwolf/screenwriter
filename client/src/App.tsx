import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ProjectList from './pages/ProjectList'
import ScriptDetail from './pages/ScriptDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/scripts/:id" element={<ScriptDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
