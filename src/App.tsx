import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SessionContextProvider, useSession } from '@/components/SessionContextProvider';
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import AccountSettings from '@/pages/AccountSettings';
import { Toaster } from 'react-hot-toast';
import UserDropdown from '@/components/UserDropdown';

// Simple layout for authenticated routes
const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return <div className="p-4 text-center">Cargando...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="p-4 border-b bg-white flex justify-end">
        <UserDropdown />
      </header>
      <main className="container mx-auto py-8">
        {children}
      </main>
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<AuthenticatedLayout><Index /></AuthenticatedLayout>} />
      <Route path="/account-settings" element={<AuthenticatedLayout><AccountSettings /></AuthenticatedLayout>} />
      {/* Add other authenticated routes here */}
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <SessionContextProvider>
        <AppRoutes />
        <Toaster />
      </SessionContextProvider>
    </Router>
  );
}

export default App;