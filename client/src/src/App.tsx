import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BuildingPage from './pages/BuildingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/admin/ProtectedRoute';
import AdminHomePage from './pages/admin/AdminHomePage';
import NewBuildingPage from './pages/admin/NewBuildingPage';
import AdminLayout, { AdminIndexRedirect } from './pages/admin/AdminLayout';
import FloorsPage from './pages/admin/FloorsPage';
import PlacesPage from './pages/admin/PlacesPage';
import GraphEditorPage from './pages/admin/GraphEditorPage';
import QrPage from './pages/admin/QrPage';

function App() {
  return (
    <Routes>
      {/* Visitors */}
      <Route path="/" element={<HomePage />} />
      <Route path="/b/:buildingId" element={<BuildingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Building managers. ProtectedRoute sends everyone else to the login page. */}
      <Route path="/admin" element={<ProtectedRoute><AdminHomePage /></ProtectedRoute>} />
      <Route path="/admin/new" element={<ProtectedRoute><NewBuildingPage /></ProtectedRoute>} />
      <Route path="/admin/:buildingId" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminIndexRedirect />} />
        <Route path="floors" element={<FloorsPage />} />
        <Route path="places" element={<PlacesPage />} />
        <Route path="graph" element={<GraphEditorPage />} />
        <Route path="qr" element={<QrPage />} />
      </Route>

      {/* Any other address - back to the map */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
