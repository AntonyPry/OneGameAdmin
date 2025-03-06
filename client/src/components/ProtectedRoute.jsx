// components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredAccess }) => {
  const isValid = sessionStorage.getItem('validPassword') === 'true';
  const accessLevel = sessionStorage.getItem('accessLevel');

  if (!isValid) {
    return <Navigate to="/login" replace />;
  }

  if (requiredAccess && accessLevel !== requiredAccess && accessLevel !== 'full') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
