import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import SmartSearch from '@/components/SmartSearch';
import { searchSuppliers, createOrUpdateQuote } from '@/integrations/supabase/data';
import { useSession } from '@/components/SessionContextProvider';
import { showError } from '@/utils/toast';
import { SupplierQuote } from '@/integrations/supabase/types';

interface SupplierQuoteExtended extends SupplierQuote {
    supplier_name?: string;
}

interface QuoteFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string;
  materialName: string;
  initialData?: SupplierQuoteExtended;
  onSaveSuccess: () => void;
}

const quoteFormSchema = z.object({
  supplier_id: z.string().min(1, 'El proveedor es requerido.'),
  unit_price: z.number().min(0.01, 'El precio debe ser mayor a cero.'),
  currency: z.enum(['USD', 'VES'], { message: 'Moneda inválida.' }),
  exchange_rate: z.number().optional().nullable(),
  valid_until: z.date().optional().nullable(),
  delivery_days: z.number().min(0, 'Días de entrega no puede ser negativo.').optional().nullable(),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

const QuoteFormDialog: React.FC<QuoteFormDialogProps> = ({
  isOpen,
  onClose,
  materialId,
  materialName,
  initialData,
  onSaveSuccess,
}) => {
  const { session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supplierName, setSupplierName] = useState(initialData?.supplier_name || '');

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      supplier_id: initialData?.supplier_id || '',
      unit_price: initialData?.unit_price || 0,
      currency: initialData?.currency || 'USD',
      exchange_rate: initialData?.exchange_rate || null,
      valid_until: initialData?.valid_until ? new Date(initialData.valid_until) : null,
      delivery_days: initialData?.delivery_days || null,
    },
  });

  const currentCurrency = form.watch('currency');

  useEffect(() => {
    if (initialData) {
      form.reset({
        supplier_id: initialData.supplier_id,
        unit_price: initialData.unit_price,
        currency: initialData.currency,
        exchange_rate: initialData.exchange_rate || null,
        valid_until: initialData.valid_until ? new Date(initialData.valid_until) : null,
        delivery_days: initialData.delivery_days || null,
      });
      setSupplierName(initialData.supplier_name || '');
    } else {
      form.reset({
        supplier_id: '',
        unit_price: 0,
        currency: 'USD',
        exchange_rate: null,
        valid_until: null,
        delivery_days: null,
      });
      setSupplierName('');
    }
  }, [initialData, form]);

  const handleSupplierSelect = (supplier: { id: string; name: string }) => {
    form.setValue('supplier_id', supplier.id, { shouldValidate: true });
    setSupplierName(supplier.name);
  };

  const onSubmit = async (data: QuoteFormValues) => {
    if (!session?.user?.id) {
      showError('Usuario no autenticado.');
      return;
    }

    if (data.currency === 'VES' && (!data.exchange_rate || data.exchange_rate <= 0)) {
      form.setError('exchange_rate', { message: 'La tasa de cambio es requerida para VES.' });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      ...data,
      material_id: materialId,
      user_id: session.user.id,
      exchange_rate: data.currency === 'USD' ? null : data.exchange_rate,
      valid_until: data.valid_until ? format(data.valid_until, 'yyyy-MM-dd') : null,
      delivery_days: data.delivery_days || null,
    };

    try {
      const result = await createOrUpdateQuote(payload);
      if (result) {
        onSaveSuccess();
        handleClose();
      }
    } catch (error) {
      // Error handling is done inside createOrUpdateQuote
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.clearErrors();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Cotización' : 'Añadir Nueva Cotización'}</DialogTitle>
          <DialogDescription>
            Material: <span className="font-semibold text-procarni-primary">{materialName}</span>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor *</FormLabel>
                  <FormControl>
                    <SmartSearch
                      placeholder="Buscar proveedor por RIF o nombre"
                      onSelect={handleSupplierSelect}
                      fetchFunction={searchSuppliers}
                      displayValue={supplierName}
                      selectedId={field.value}
                      disabled={!!initialData} // Disable supplier selection if editing
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio Unitario *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD (Dólares)</SelectItem>
                        <SelectItem value="VES">VES (Bolívares)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {currentCurrency === 'VES' && (
              <FormField
                control={form.control}
                name="exchange_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tasa de Cambio (USD a VES) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Ej: 36.50"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="delivery_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días de Entrega</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ej: 7"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Válido Hasta</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Selecciona una fecha</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-procarni-secondary hover:bg-green-700">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cotización'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteFormDialog;