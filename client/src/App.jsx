// App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import HomePage from './pages/HomePage/HomePage';
import ExportStatisticsPage from './pages/ExportStatisticsPage/ExportStatisticsPage';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import AdminPage from './pages/AdminPage/AdminPage';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Главная страница: список карточек */}
        <Route path="/" element={<HomePage />} />

        {/* Раздел со статистикой (ваш текущий функционал) */}
        <Route path="/export" element={<ExportStatisticsPage />} />

        {/* Заглушка для дашборда */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Заглушка для панели администратора */}
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
