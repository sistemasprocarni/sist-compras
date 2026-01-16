import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { validateRif } from '@/utils/validators';
import { PlusCircle, Trash2 } from 'lucide-react';
import SmartSearch from '@/components/SmartSearch';
import { searchMaterials } from '@/integrations/supabase/data'; // Importar la función de búsqueda de materiales

// Define las opciones de términos de pago.
const PAYMENT_TERMS_OPTIONS = ['Contado', 'Crédito', 'Otro'];

// Esquema de validación para un material suministrado por el proveedor
const supplierMaterialSchema = z.object({
  material_id: z.string().min(1, { message: 'El material es requerido.' }),
  material_name: z.string().min(1, { message: 'El nombre del material es requerido.' }), // Para mostrar en el SmartSearch
  material_category: z.string().optional(), // Para mostrar automáticamente
  specification: z.string().optional(),
});

// Esquema de validación con Zod para el formulario completo del proveedor
const supplierFormSchema = z.object({
  code: z.string().optional(), // New: Code is optional and auto-generated
  rif: z.string().min(1, { message: 'El RIF es requerido.' }).refine((val) => validateRif(val) !== null, {
    message: 'Formato de RIF inválido. Ej: J123456789',
  }),
  name: z.string().min(1, { message: 'El nombre es requerido.' }),
  email: z.string().email({ message: 'Formato de email inválido.' }).optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  phone_2: z.string().optional().or(z.literal('')), // Nuevo campo
  instagram: z.string().optional().or(z.literal('')), // Nuevo campo
  address: z.string().optional().or(z.literal('')), // New: Address field
  payment_terms: z.enum(PAYMENT_TERMS_OPTIONS as [string, ...string[]], { message: 'Los términos de pago son requeridos y deben ser válidos.' }),
  custom_payment_terms: z.string().optional().nullable(),
  credit_days: z.coerce.number().min(0, { message: 'Los días de crédito no pueden ser negativos.' }).optional(), // Hacer opcional para la validación condicional
  status: z.enum(['Active', 'Inactive'], { message: 'El estado es requerido.' }),
  materials: z.array(supplierMaterialSchema).optional(), // Lista de materiales suministrados
}).superRefine((data, ctx) => {
  if (data.payment_terms === 'Otro' && (!data.custom_payment_terms || data.custom_payment_terms.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Por favor, especifica los términos de pago personalizados.',
      path: ['custom_payment_terms'],
    });
  }
  if (data.payment_terms === 'Crédito' && (data.credit_days === undefined || data.credit_days < 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Los días de crédito son requeridos para términos de "Crédito" y no pueden ser negativos.',
      path: ['credit_days'],
    });
  }
});

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

interface MaterialSearchResult {
  id: string;
  name: string;
  code: string;
  category?: string;
  unit?: string;
}

interface SupplierFormProps {
  initialData?: SupplierFormValues & { id?: string; materials?: Array<{ id: string; specification?: string; materials: MaterialSearchResult }> };
  onSubmit: (data: SupplierFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const SupplierForm: React.FC<SupplierFormProps> = ({ initialData, onSubmit, onCancel, isSubmitting }) => {
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      code: '', // Aseguramos que el código esté vacío para que el trigger lo genere
      rif: '',
      name: '',
      email: '',
      phone: '',
      phone_2: '', // Nuevo campo
      instagram: '', // Nuevo campo
      address: '', // New: Default for address
      payment_terms: PAYMENT_TERMS_OPTIONS[0],
      custom_payment_terms: null,
      credit_days: 0,
      status: 'Active',
      materials: [], // Inicializar con un array vacío
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "materials",
  });

  const selectedPaymentTerms = form.watch('payment_terms');

  // Set form values when initialData changes (for editing)
  React.useEffect(() => {
    if (initialData) {
      const mappedMaterials = initialData.materials?.map(sm => ({
        material_id: sm.materials.id,
        material_name: sm.materials.name,
        material_category: sm.materials.category,
        specification: sm.specification || '',
      })) || [];

      // Manejar valores personalizados antiguos de payment_terms
      let paymentTermsValue = initialData.payment_terms;
      let customPaymentTermsValue = initialData.custom_payment_terms || null;

      if (!PAYMENT_TERMS_OPTIONS.includes(initialData.payment_terms) && initialData.payment_terms !== 'Otro') {
        paymentTermsValue = 'Otro';
        customPaymentTermsValue = initialData.payment_terms; // Mueve el valor personalizado antiguo
      }

      form.reset({
        ...initialData,
        payment_terms: paymentTermsValue,
        custom_payment_terms: customPaymentTermsValue,
        materials: mappedMaterials,
      });
    } else {
      form.reset({
        code: '', // Aseguramos que el código esté vacío para que el trigger lo genere
        rif: '',
        name: '',
        email: '',
        phone: '',
        phone_2: '', // Nuevo campo
        instagram: '', // Nuevo campo
        address: '', // New: Default for address
        payment_terms: PAYMENT_TERMS_OPTIONS[0],
        custom_payment_terms: null,
        credit_days: 0,
        status: 'Active',
        materials: [],
      });
    }
  }, [initialData, form]);

  const handleAddMaterial = () => {
    append({ material_id: '', material_name: '', material_category: '', specification: '' });
  };

  const handleMaterialSelect = (index: number, material: MaterialSearchResult) => {
    form.setValue(`materials.${index}.material_id`, material.id);
    form.setValue(`materials.${index}.material_name`, material.name);
    form.setValue(`materials.${index}.material_category`, material.category);
    form.trigger(`materials.${index}.material_id`); // Disparar validación para el campo material_id
  };

  const handleRemoveMaterial = (index: number) => {
    remove(index);
  };

  const handleFormSubmit = (data: SupplierFormValues) => {
    const normalizedRif = validateRif(data.rif);
    if (!normalizedRif) {
      form.setError('rif', { message: 'Formato de RIF inválido.' });
      return;
    }

    const finalCustomPaymentTerms = data.payment_terms === 'Otro' ? data.custom_payment_terms : null;

    onSubmit({
      ...data,
      rif: normalizedRif,
      custom_payment_terms: finalCustomPaymentTerms,
      materials: data.materials, // Incluir los materiales en los datos enviados
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código del Proveedor</FormLabel>
              <FormControl>
                <Input placeholder="Se autogenerará (ej: P001)" {...field} readOnly className="bg-gray-100" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
              <FormLabel>Teléfono Principal</FormLabel>
              <FormControl>
                <Input placeholder="Ej: +584121234567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone_2"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono Secundario</FormLabel>
              <FormControl>
                <Input placeholder="Ej: +584127654321" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="instagram"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instagram</FormLabel>
              <FormControl>
                <Input placeholder="Ej: @nombredeusuario" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección</FormLabel>
              <FormControl>
                <Textarea placeholder="Dirección completa del proveedor" {...field} value={field.value || ''} />
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
        {selectedPaymentTerms === 'Crédito' && ( // Condición para mostrar "Días de Crédito"
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
        )}
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

        <h3 className="text-lg font-semibold mt-6 mb-4 text-procarni-primary">Materia Prima Suministrada</h3>
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end border p-3 rounded-md">
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name={`materials.${index}.material_name`}
                  render={({ field: materialNameField }) => (
                    <FormItem>
                      <FormLabel>Nombre de Materia Prima (*)</FormLabel>
                      <SmartSearch
                        placeholder="Buscar material por nombre o código"
                        onSelect={(material) => handleMaterialSelect(index, material as MaterialSearchResult)}
                        fetchFunction={searchMaterials}
                        displayValue={materialNameField.value}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormItem>
                  <FormLabel>Categoría (Auto)</FormLabel>
                  <Input
                    readOnly
                    value={form.watch(`materials.${index}.material_category`) || 'N/A'}
                    className="bg-gray-100"
                  />
                </FormItem>
              </div>
              <div className="md:col-span-3">
                <FormField
                  control={form.control}
                  name={`materials.${index}.specification`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especificación (textarea)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Detalles de presentación, calidad, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button variant="destructive" size="icon" onClick={() => handleRemoveMaterial(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={handleAddMaterial} className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Materia Prima
          </Button>
        </div>

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