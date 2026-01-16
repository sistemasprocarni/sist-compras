import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

// Define las opciones de categoría.
const MATERIAL_CATEGORIES = [
  'SECA',
  'FRESCA',
  'EMPAQUE',
  'FERRETERIA Y CONSTRUCCION',
  'AGROPECUARIA',
  'GASES Y COMBUSTIBLE',
  'ELECTRICIDAD',
  'REFRIGERACION',
  'INSUMOS DE OFICINA',
  'INSUMOS INDUSTRIALES',
  'MECANICA Y SELLOS',
  'NEUMATICA',
  'INSUMOS DE LIMPIEZA',
  'FUMICACION',
  'EQUIPOS DE CARNICERIA',
  'FARMACIA',
  'MEDICION Y MANIPULACION',
  'ENCERADOS',
];

// Define las unidades de medida.
const MATERIAL_UNITS = [
  'KG', 'LT', 'ROL', 'PAQ', 'SACO', 'GAL', 'UND', 'MT', 'RESMA', 'PZA', 'TAMB', 'MILL', 'CAJA'
];

// Esquema de validación con Zod
const materialFormSchema = z.object({
  code: z.string().optional(), // El código ahora es opcional para la creación (se autogenera)
  name: z.string().min(1, { message: 'El nombre es requerido.' }),
  category: z.enum(MATERIAL_CATEGORIES as [string, ...string[]], { message: 'La categoría es requerida y debe ser válida.' }),
  unit: z.enum(MATERIAL_UNITS as [string, ...string[]], { message: 'La unidad es requerida y debe ser válida.' }),
});

type MaterialFormValues = z.infer<typeof materialFormSchema>;

interface MaterialFormProps {
  initialData?: MaterialFormValues & { id?: string };
  onSubmit: (data: MaterialFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const MaterialForm: React.FC<MaterialFormProps> = ({ initialData, onSubmit, onCancel, isSubmitting }) => {
  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: {
      code: '',
      name: '',
      category: MATERIAL_CATEGORIES[0],
      unit: MATERIAL_UNITS[0],
    },
  });

  // Set form values when initialData changes (for editing)
  React.useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    } else {
      form.reset({
        code: '', // Aseguramos que el código esté vacío para que el trigger lo genere
        name: '',
        category: MATERIAL_CATEGORIES[0],
        unit: MATERIAL_UNITS[0],
      });
    }
  }, [initialData, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código</FormLabel>
              <FormControl>
                {/* El campo de código es de solo lectura si ya existe (para edición) o vacío para nueva creación */}
                <Input placeholder="Se generará automáticamente" {...field} readOnly={!!initialData?.id} />
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
                <Input placeholder="Nombre del material" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MATERIAL_CATEGORIES.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unidad</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una unidad" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MATERIAL_UNITS.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
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

export default MaterialForm;