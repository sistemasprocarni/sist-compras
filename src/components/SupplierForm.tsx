import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea'; // Importar Textarea
import { validateRif } from '@/utils/validators';

// Define las opciones de términos de pago.
// IMPORTANTE: Asegúrate de que estos valores coincidan exactamente con los permitidos por la restricción
// 'suppliers_payment_terms_check' en tu tabla 'public.suppliers' en Supabase.
// Puedes verificar esto en la consola de Supabase, en la sección de 'Database' -> 'Tables' -> 'suppliers' -> 'Constraints'.
const PAYMENT_TERMS_OPTIONS = ['Contado', 'Credito', 'Otro'];

// Esquema de validación con Zod
const supplierFormSchema = z.object({
  rif: z.string().min(1, { message: 'El RIF es requerido.' }).refine((val) => validateRif(val) !== null, {
    message: 'Formato de RIF inválido. Ej: J123456789',
  }),
  name: z.string().min(1, { message: 'El nombre es requerido.' }),
  email: z.string().email({ message: 'Formato de email inválido.' }).optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  payment_terms: z.enum(PAYMENT_TERMS_OPTIONS as [string, ...string[]], { message: 'Los términos de pago son requeridos y deben ser válidos.' }),
  custom_payment_terms: z.string().optional(), // Nuevo campo para términos personalizados
  credit_days: z.coerce.number().min(0, { message: 'Los días de crédito no pueden ser negativos.' }),
  status: z.enum(['Active', 'Inactive'], { message: 'El estado es requerido.' }),
}).superRefine((data, ctx) => {
  if (data.payment_terms === 'Otro' && (!data.custom_payment_terms || data.custom_payment_terms.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Por favor, especifica los términos de pago personalizados.',
      path: ['custom_payment_terms'],
    });
  }
});

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

interface SupplierFormProps {
  initialData?: SupplierFormValues & { id?: string };
  onSubmit: (data: SupplierFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const SupplierForm: React.FC<SupplierFormProps> = ({ initialData, onSubmit, onCancel, isSubmitting }) => {
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: initialData || {
      rif: '',
      name: '',
      email: '',
      phone: '',
      payment_terms: PAYMENT_TERMS_OPTIONS[0], // Default to the first valid option
      custom_payment_terms: '',
      credit_days: 0,
      status: 'Active', // Default value
    },
  });

  const selectedPaymentTerms = form.watch('payment_terms');

  // Set form values when initialData changes (for editing)
  React.useEffect(() => {
    if (initialData) {
      // If initialData.payment_terms is not one of the predefined options,
      // assume it's a custom term and set payment_terms to 'Otro'
      // and custom_payment_terms to the actual value.
      if (!PAYMENT_TERMS_OPTIONS.includes(initialData.payment_terms)) {
        form.reset({
          ...initialData,
          payment_terms: 'Otro',
          custom_payment_terms: initialData.payment_terms,
        });
      } else {
        form.reset(initialData);
      }
    } else {
      form.reset({
        rif: '',
        name: '',
        email: '',
        phone: '',
        payment_terms: PAYMENT_TERMS_OPTIONS[0],
        custom_payment_terms: '',
        credit_days: 0,
        status: 'Active',
      });
    }
  }, [initialData, form]);

  const handleFormSubmit = (data: SupplierFormValues) => {
    // Normalize RIF before submitting
    const normalizedRif = validateRif(data.rif);
    if (!normalizedRif) {
      form.setError('rif', { message: 'Formato de RIF inválido.' });
      return;
    }

    let finalPaymentTerms = data.payment_terms;
    if (data.payment_terms === 'Otro' && data.custom_payment_terms) {
      finalPaymentTerms = data.custom_payment_terms;
    }

    // Crear un nuevo objeto de datos para enviar, excluyendo custom_payment_terms
    const { custom_payment_terms, ...dataToSubmit } = data;

    onSubmit({ ...dataToSubmit, rif: normalizedRif, payment_terms: finalPaymentTerms });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="rif"
          render={({ field }) => (
            <FormItem>
              <FormLabel>RIF</FormLabel>
              <FormControl>
                <Input placeholder="Ej: J123456789" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Nombre del proveedor" {...field} />
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
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="email@ejemplo.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono</FormLabel>
              <FormControl>
                <Input placeholder="Ej: +584121234567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="payment_terms"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Términos de Pago</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona términos de pago" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {selectedPaymentTerms === 'Otro' && (
          <FormField
            control={form.control}
            name="custom_payment_terms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Especificar Términos de Pago</FormLabel>
                <FormControl>
                  <Textarea placeholder="Ej: Pago a 45 días con 10% de anticipo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="credit_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Días de Crédito</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estado</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el estado" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Active">Activo</SelectItem>
                  <SelectItem value="Inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-procarni-secondary hover:bg-green-700">
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default SupplierForm;