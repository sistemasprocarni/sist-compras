import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { showError } from '@/utils/toast';

const loginSchema = z.object({
  username: z.string().min(3, { message: 'El nombre de usuario es requerido.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onSwitchToPasswordRecovery: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToSignup, onSwitchToPasswordRecovery }) => {
  const { supabase } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);

    try {
      // 1. Look up the user's email based on the username
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', data.username.toLowerCase())
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw new Error('Error al buscar el usuario.');
      }

      if (!profileData || !profileData.email) {
        showError('Nombre de usuario o contraseña incorrectos.');
        return;
      }
      
      const actualEmail = profileData.email;

      // 2. Sign in using the retrieved email and password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: actualEmail,
        password: data.password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          showError('Nombre de usuario o contraseña incorrectos.');
        } else {
          showError(`Error al iniciar sesión: ${signInError.message}`);
        }
        return;
      }
      
    } catch (error: any) {
      console.error('[LoginForm] Error:', error);
      showError(error.message || 'Error desconocido al iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de Usuario</FormLabel>
              <FormControl>
                <Input placeholder="Tu nombre de usuario" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contraseña</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Tu contraseña" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full bg-procarni-primary hover:bg-procarni-primary/90" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Iniciar Sesión'}
        </Button>
        
        <div className="flex justify-between text-sm mt-4">
          <Button type="button" variant="link" onClick={onSwitchToPasswordRecovery} className="p-0 h-auto text-procarni-primary">
            ¿Olvidaste tu contraseña?
          </Button>
          <Button type="button" variant="link" onClick={onSwitchToSignup} className="p-0 h-auto text-procarni-primary">
            ¿No tienes una cuenta? Regístrate
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default LoginForm;