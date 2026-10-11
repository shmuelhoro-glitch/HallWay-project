import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BuildingPage from './pages/BuildingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/b/:buildingId" element={<BuildingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Yair's admin routes (/admin ...) go here too */}
    </Routes>
  );
}

export default App;
