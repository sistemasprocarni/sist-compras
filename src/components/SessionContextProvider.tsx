import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

interface Profile {
  role: string;
}

interface SessionContextType {
  session: Session | null;
  supabase: typeof supabase;
  isLoadingSession: boolean;
  userRole: string | null; // Añadido: Rol del usuario
  isAdmin: boolean; // Añadido: Flag de administrador
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user profile:', error);
      return null;
    }
    return data as Profile | null;
  };

  useEffect(() => {
    const handleSessionChange = async (_event: string, currentSession: Session | null) => {
      setSession(currentSession);
      setLoading(false);
      
      if (currentSession) {
        const profile = await fetchUserProfile(currentSession.user.id);
        const role = profile?.role || 'user';
        setUserRole(role);

        if (_event === 'SIGNED_IN' && location.pathname === '/login') {
          navigate('/');
        }
      } else {
        setUserRole(null);
        if (location.pathname !== '/login') {
          navigate('/login');
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleSessionChange);

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSessionChange('INITIAL_SESSION', initialSession);
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  const isAdmin = userRole === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-xl text-gray-600">Cargando sesión...</p>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ session, supabase, isLoadingSession: loading, userRole, isAdmin }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};