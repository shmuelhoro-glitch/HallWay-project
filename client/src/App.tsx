import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import BuildingPage from './pages/BuildingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import JoinPage from './pages/JoinPage';
import ProtectedRoute from './components/admin/ProtectedRoute';
import AdminHomePage from './pages/admin/AdminHomePage';
import RequestsPage from './pages/admin/RequestsPage';
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
      {/* A visitor asks to become a building manager */}
      <Route path="/join" element={<JoinPage />} />

      {/* Building managers. ProtectedRoute sends everyone else to the login page. */}
      <Route path="/admin" element={<ProtectedRoute><AdminHomePage /></ProtectedRoute>} />
      <Route path="/admin/new" element={<ProtectedRoute><NewBuildingPage /></ProtectedRoute>} />
      {/* Before /admin/:buildingId, so "requests" is not read as a building id */}
      <Route path="/admin/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
      <Route path="/admin/:buildingId" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminIndexRedirect />} />
        <Route path="floors" element={<FloorsPage />} />
        <Route path="places" element={<PlacesPage />} />
        <Route path="graph" element={<GraphEditorPage />} />
        <Route path="qr" element={<QrPage />} />
      </Route>

      {/* Any other address - a clear "not found" message */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
