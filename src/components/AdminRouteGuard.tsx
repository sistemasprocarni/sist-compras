import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { showError } from '@/utils/toast';

const AdminRouteGuard: React.FC = () => {
  const { isAdmin, isLoadingSession } = useSession();

  if (isLoadingSession) {
    // Render nothing or a loading spinner while session loads
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-xl text-gray-600">Verificando permisos...</p>
      </div>
    );
  }

  if (!isAdmin) {
    showError('Acceso denegado. Solo administradores pueden ver esta página.');
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AdminRouteGuard;