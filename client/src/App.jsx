// App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import HomePage from './pages/HomePage/HomePage';
import ExportStatisticsPage from './pages/ExportStatisticsPage/ExportStatisticsPage';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import AdminPage from './pages/AdminPage/AdminPage';
import LoginPage from './pages/LoginPage/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Страница логина открыта для всех */}
        <Route path="/login" element={<LoginPage />} />

        {/* Главная страница: список карточек */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        {/* Раздел со статистикой (ваш текущий функционал) */}
        <Route
          path="/export"
          element={
            <ProtectedRoute>
              <ExportStatisticsPage />
            </ProtectedRoute>
          }
        />

        {/* Заглушка для дашборда */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Заглушка для панели администратора */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
