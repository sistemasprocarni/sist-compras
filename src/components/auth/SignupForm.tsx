import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';

const signupSchema = z.object({
  username: z.string().min(3, { message: 'El nombre de usuario es requerido.' }).regex(/^[a-zA-Z0-9_]+$/, { message: 'Solo letras, números y guiones bajos.' }),
  email: z.string().email({ message: 'Formato de correo inválido.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
});

type SignupFormValues = z.infer<typeof signupSchema>;

interface SignupFormProps {
  onSwitchToLogin: () => void;
  onSignupSuccess: () => void;
}

const SignupForm: React.FC<SignupFormProps> = ({ onSwitchToLogin, onSignupSuccess }) => {
  const { supabase } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsSubmitting(true);
    const usernameLower = data.username.toLowerCase();

    try {
      // 1. Check if username is already taken
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', usernameLower)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        throw new Error('Error al verificar la disponibilidad del nombre de usuario.');
      }

      if (existingProfile) {
        form.setError('username', { message: 'Este nombre de usuario ya está en uso.' });
        return;
      }

      // 2. Sign up using email/password, passing username in metadata
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            username: usernameLower,
          },
        },
      });

      if (signUpError) {
        showError(`Error al registrarse: ${signUpError.message}`);
        return;
      }
      
      // 3. If user requires email confirmation, show success message and switch view
      if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
        showSuccess('¡Registro exitoso! Por favor, revisa tu correo para verificar tu cuenta.');
        onSignupSuccess();
      } else if (authData.user) {
        showSuccess('¡Registro exitoso! Has iniciado sesión.');
      } else {
        showError('Registro completado, pero el estado de la sesión es incierto. Por favor, revisa tu correo.');
        onSignupSuccess();
      }

    } catch (error: any) {
      console.error('[SignupForm] Error:', error);
      showError(error.message || 'Error desconocido al registrarse.');
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
              <FormLabel>Nombre de Usuario *</FormLabel>
              <FormControl>
                <Input placeholder="Ej: miusuario123" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo Electrónico *</FormLabel>
              <FormControl>
                <Input type="email" placeholder="ejemplo@correo.com" {...field} disabled={isSubmitting} />
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
              <FormLabel>Contraseña *</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Mínimo 6 caracteres" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full bg-procarni-secondary hover:bg-green-700" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Registrarse'}
        </Button>
        
        <div className="text-sm mt-4 text-center">
          <Button type="button" variant="link" onClick={onSwitchToLogin} className="p-0 h-auto text-procarni-primary">
            ¿Ya tienes una cuenta? Inicia sesión
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default SignupForm;