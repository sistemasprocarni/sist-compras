import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';
import LoginForm from '@/components/auth/LoginForm';
import SignupForm from '@/components/auth/SignupForm';
import PasswordRecoveryForm from '@/components/auth/PasswordRecoveryForm';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle } from 'lucide-react';

const currentYear = new Date().getFullYear();

type AuthView = 'login' | 'signup' | 'recovery' | 'success';

const Login = () => {
  const [view, setView] = useState<AuthView>('login');
  const [searchParams] = useSearchParams();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'recovery') {
      setSuccessMessage('Tu contraseña ha sido restablecida exitosamente. Por favor, inicia sesión.');
      setView('login');
    } else if (type === 'signup') {
      setSuccessMessage('¡Registro exitoso! Por favor, revisa tu correo para verificar tu cuenta.');
      setView('login');
    }
  }, [searchParams]);

  const handleSignupSuccess = () => {
    setSuccessMessage('¡Registro exitoso! Por favor, revisa tu correo para verificar tu cuenta.');
    setView('login');
  };

  const handleRecoverySent = () => {
    setSuccessMessage('Se ha enviado un enlace de recuperación a tu correo.');
    setView('login');
  };

  const renderForm = () => {
    if (view === 'signup') {
      return <SignupForm onSwitchToLogin={() => { setView('login'); setSuccessMessage(null); }} onSignupSuccess={handleSignupSuccess} />;
    }
    if (view === 'recovery') {
      return <PasswordRecoveryForm onSwitchToLogin={() => { setView('login'); setSuccessMessage(null); }} onRecoverySent={handleRecoverySent} />;
    }
    return <LoginForm onSwitchToSignup={() => { setView('signup'); setSuccessMessage(null); }} onSwitchToPasswordRecovery={() => { setView('recovery'); setSuccessMessage(null); }} />;
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* 1. Left Panel (Branding and Context) - Hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 text-white p-12 flex-col justify-center relative overflow-hidden">
        {/* Background Gradient/Color (Dark Burgundy to Near Black) */}
        <div className="absolute inset-0 bg-gradient-to-b from-procarni-primary to-gray-900 opacity-90"></div>
        
        {/* Content */}
        <div className="relative z-10 max-w-md space-y-6">
          <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
            Procarni System
          </h1>
          <h2 className="text-2xl font-semibold text-gray-200">
            Gestión de Suministros y Compras
          </h2>
          <p className="text-gray-300 text-lg max-w-sm">
            Plataforma integral diseñada para centralizar, optimizar y agilizar el flujo de abastecimiento y las órdenes de compra de la empresa.
          </p>
        </div>
      </div>

      {/* 2. Right Panel (Login Form) - Full width on mobile, 50% on large screens */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-8 dark:bg-gray-800">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center justify-center mb-6">
            <img 
              src="/Sis-Prov.png" 
              alt="Sis-Prov Logo" 
              className="h-16 w-auto object-contain drop-shadow-md mb-4" 
            />
            <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
              {view === 'login' ? 'Acceso al Sistema' : (view === 'signup' ? 'Registro de Usuario' : 'Recuperación')}
            </h1>
          </div>
          
          {successMessage && (
            <Alert className="bg-green-50 border-green-400 text-green-700 dark:bg-green-900/20 dark:text-green-300">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Éxito</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          {renderForm()}
          
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 pt-4">
            &copy; {currentYear} Procarni System. Todos los derechos reservados.
          </p>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Login;