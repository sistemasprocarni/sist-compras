import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';

const Login = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">
          Procarni System
        </h1>
        <Auth
          supabaseClient={supabase}
          providers={[]} // Puedes añadir 'google', 'github', etc. aquí si los configuras en Supabase
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(var(--primary))',
                  brandAccent: 'hsl(var(--primary-foreground))',
                },
              },
            },
            className: {
              button: 'w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors',
            },
          }}
          theme="light" // Puedes cambiar a 'dark' si tu app soporta tema oscuro
          redirectTo={window.location.origin} // Redirige a la raíz después del login
          localization={{
            variables: {
              sign_in: {
                button_label: 'Iniciar Sesión',
                email_label: 'Correo Electrónico',
                password_label: 'Contraseña',
                forgot_password_link: '¿Olvidaste tu contraseña?',
                loading_button_label: 'Iniciando sesión...',
                social_provider_text: 'Iniciar sesión con {{provider}}',
                confirmation_text: 'Te hemos enviado un correo para confirmar tu cuenta.',
              },
              sign_up: {
                button_label: 'Registrarse',
                email_label: 'Correo Electrónico',
                password_label: 'Contraseña',
                confirm_password_label: 'Confirmar Contraseña',
                loading_button_label: 'Registrando...',
                social_provider_text: 'Registrarse con {{provider}}',
                confirmation_text: 'Te hemos enviado un correo para confirmar tu cuenta.',
              },
              forgotten_password: {
                button_label: 'Enviar enlace de restablecimiento',
                email_label: 'Correo Electrónico',
                loading_button_label: 'Enviando...',
                link_text: '¿Olvidaste tu contraseña?',
                confirmation_text: 'Te hemos enviado un correo con instrucciones para restablecer tu contraseña.',
              },
              update_password: {
                button_label: 'Actualizar contraseña',
                password_label: 'Nueva contraseña',
                confirm_password_label: 'Confirmar nueva contraseña',
                loading_button_label: 'Actualizando...',
              },
            },
          }}
        />
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Login;