import React, { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

// Define the schema for the profile data
const profileSchema = z.object({
  first_name: z.string().min(1, 'El nombre es requerido').max(50),
  last_name: z.string().min(1, 'El apellido es requerido').max(50),
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').max(30).optional().or(z.literal('')),
  email: z.string().email('Formato de correo inválido'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const AccountSettings = () => {
  const { session } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      username: '',
      email: session?.user?.email || '',
    },
  });

  const userId = session?.user?.id;

  useEffect(() => {
    if (userId) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }
  }, [userId]);

  const fetchProfile = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, username, email')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      showError('Error al cargar los datos de la cuenta.');
    } else if (data) {
      form.reset({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        username: data.username || '',
        email: data.email || session?.user?.email || '',
      });
    }
    setIsLoading(false);
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!userId) return;

    setIsLoading(true);
    
    // 1. Update the profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: values.first_name,
        last_name: values.last_name,
        username: values.username,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // 2. Update the user email in auth.users if it changed
    let authError = null;
    if (values.email !== session?.user?.email) {
        const { error } = await supabase.auth.updateUser({ email: values.email });
        authError = error;
    }

    if (profileError || authError) {
      console.error('Error updating profile:', profileError || authError);
      showError('Error al actualizar la cuenta. Si cambiaste el email, revisa tu bandeja de entrada para confirmarlo.');
    } else {
      showSuccess('Datos de la cuenta actualizados exitosamente.');
      // Re-fetch profile to ensure local state is updated if needed, or rely on session update if email changed.
      fetchProfile(); 
    }
    setIsLoading(false);
  };

  if (!session) {
    return <div className="p-4">Por favor, inicia sesión para ver esta página.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Cuenta</CardTitle>
          <CardDescription>Actualiza tu información personal y de contacto.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Tu nombre" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input placeholder="Tu apellido" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Usuario (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de usuario" {...field} disabled={isLoading} />
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
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input placeholder="email@ejemplo.com" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormDescription>
                        Si cambias tu correo, deberás confirmarlo a través de un enlace enviado a tu nueva dirección.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountSettings;