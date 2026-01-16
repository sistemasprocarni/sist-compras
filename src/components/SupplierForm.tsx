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
  custom_payment_terms: z.string().optional().nullable(), // Permitir null para custom_payment_terms
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
    defaultValues: {
      rif: '',
      name: '',
      email: '',
      phone: '',
      payment_terms: PAYMENT_TERMS_OPTIONS[0],
      custom_payment_terms: null, // Default a null
      credit_days: 0,
      status: 'Active',
    },
  });

  const selectedPaymentTerms = form.watch('payment_terms');

  // Set form values when initialData changes (for editing)
  React.useEffect(() => {
    if (initialData) {
      // Si initialData.payment_terms es 'Otro', usa su custom_payment_terms
      // Si initialData.payment_terms es un valor personalizado antiguo (no en PAYMENT_TERMS_OPTIONS),
      // establece payment_terms en 'Otro' y coloca el valor antiguo en custom_payment_terms.
      if (initialData.payment_terms === 'Otro') {
        form.reset({
          ...initialData,
          custom_payment_terms: initialData.custom_payment_terms || null, // Asegura que sea null si está vacío
        });
      } else if (!PAYMENT_TERMS_OPTIONS.includes(initialData.payment_terms)) {
        // Manejar valores personalizados antiguos que estaban directamente en payment_terms
        form.reset({
          ...initialData,
          payment_terms: 'Otro',
          custom_payment_terms: initialData.payment_terms, // Mueve el valor personalizado antiguo al nuevo campo
        });
      } else {
        form.reset({
          ...initialData,
          custom_payment_terms: null, // Asegura que custom_payment_terms sea null si no es 'Otro'
        });
      }
    } else {
      form.reset({
        rif: '',
        name: '',
        email: '',
        phone: '',
        payment_terms: PAYMENT_TERMS_OPTIONS[0],
        custom_payment_terms: null,
        credit_days: 0,
        status: 'Active',
      });
    }
  }, [initialData, form]);

  const handleFormSubmit = (data: SupplierFormValues) => {
    const normalizedRif = validateRif(data.rif);
    if (!normalizedRif) {
      form.setError('rif', { message: 'Formato de RIF inválido.' });
      return;
    }

    // Asegura que custom_payment_terms sea null si payment_terms no es 'Otro'
    const finalCustomPaymentTerms = data.payment_terms === 'Otro' ? data.custom_payment_terms : null;

    onSubmit({
      ...data,
      rif: normalizedRif,
      custom_payment_terms: finalCustomPaymentTerms,
    });
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
                  <Textarea placeholder="Ej: Pago a 45 días con 10% de anticipo" {...field} value={field.value || ''} />
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