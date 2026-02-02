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

const recoverySchema = z.object({
  email: z.string().email({ message: 'Formato de correo inválido.' }),
});

type RecoveryFormValues = z.infer<typeof recoverySchema>;

interface PasswordRecoveryFormProps {
  onSwitchToLogin: () => void;
  onRecoverySent: () => void;
}

const PasswordRecoveryForm: React.FC<PasswordRecoveryFormProps> = ({ onSwitchToLogin, onRecoverySent }) => {
  const { supabase } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RecoveryFormValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: RecoveryFormValues) => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/login?type=recovery`, // Redirect back to login page with a flag
      });

      if (error) {
        showError(`Error al enviar el enlace: ${error.message}`);
        return;
      }
      
      showSuccess('¡Enlace de recuperación enviado! Revisa tu correo.');
      onRecoverySent();

    } catch (error: any) {
      console.error('[PasswordRecoveryForm] Error:', error);
      showError(error.message || 'Error desconocido al solicitar recuperación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recuperar Contraseña</h3>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo Electrónico</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Tu correo electrónico" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full bg-procarni-primary hover:bg-procarni-primary/90" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Enviar enlace de restablecimiento'}
        </Button>
        
        <div className="text-sm mt-4 text-center">
          <Button type="button" variant="link" onClick={onSwitchToLogin} className="p-0 h-auto text-procarni-primary">
            Volver a Iniciar Sesión
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default PasswordRecoveryForm;