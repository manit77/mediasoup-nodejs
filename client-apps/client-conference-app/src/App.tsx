import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ConferencePage from "./pages/ConferencePage"

const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/meeting/:meetingId" element={<ConferencePage />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;