import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, PlusCircle, Edit, Trash2, Scale, DollarSign, Clock, Truck } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useNavigate } from 'react-router-dom';
import SmartSearch from '@/components/SmartSearch';
import { searchMaterials, getQuotesByMaterial, deleteQuote } from '@/integrations/supabase/data';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isPast } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { SupplierQuote } from '@/integrations/supabase/types';
import QuoteFormDialog from '@/components/QuoteFormDialog';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface MaterialSearchResult {
  id: string;
  name: string;
  code: string;
  category?: string;
  unit?: string;
}

interface SupplierQuoteExtended extends SupplierQuote {
    supplier_name?: string;
    suppliers: {
        id: string;
        name: string;
        code?: string;
        rif: string;
        phone?: string;
        email?: string;
    }
}

const QuoteComparison = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialSearchResult | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<'USD' | 'VES'>('USD');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<SupplierQuoteExtended | undefined>(undefined);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [quoteToDeleteId, setQuoteToDeleteId] = useState<string | null>(null);

  const { data: quotes, isLoading, error, refetch } = useQuery<SupplierQuoteExtended[]>({
    queryKey: ['supplierQuotes', selectedMaterial?.id],
    queryFn: () => getQuotesByMaterial(selectedMaterial!.id),
    enabled: !!selectedMaterial?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierQuotes', selectedMaterial?.id] });
      showSuccess('Cotización eliminada exitosamente.');
      setIsDeleteDialogOpen(false);
      setQuoteToDeleteId(null);
    },
    onError: (err) => {
      showError(`Error al eliminar cotización: ${err.message}`);
      setIsDeleteDialogOpen(false);
      setQuoteToDeleteId(null);
    },
  });

  const handleMaterialSelect = (material: MaterialSearchResult) => {
    setSelectedMaterial(material);
  };

  const handleAddQuote = () => {
    if (!selectedMaterial) {
        showError('Por favor, selecciona un material primero.');
        return;
    }
    setEditingQuote(undefined);
    setIsFormOpen(true);
  };

  const handleEditQuote = (quote: SupplierQuoteExtended) => {
    // Add supplier name to the object for the form dialog display
    setEditingQuote({ ...quote, supplier_name: quote.suppliers.name });
    setIsFormOpen(true);
  };

  const confirmDeleteQuote = (id: string) => {
    setQuoteToDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteQuote = async () => {
    if (quoteToDeleteId) {
      await deleteMutation.mutateAsync(quoteToDeleteId);
    }
  };

  // Helper function to convert price to the base currency
  const convertPriceToBase = (quote: SupplierQuoteExtended, base: 'USD' | 'VES'): number | null => {
    const price = quote.unit_price;
    const currency = quote.currency;
    const rate = quote.exchange_rate;

    if (currency === base) {
      return price;
    }

    if (base === 'USD' && currency === 'VES') {
      if (rate && rate > 0) {
        return price / rate;
      }
      return null; // Cannot convert VES to USD without a rate
    }

    if (base === 'VES' && currency === 'USD') {
      if (rate && rate > 0) {
        return price * rate;
      }
      return null; // Cannot convert USD to VES without a rate
    }

    return null;
  };

  const comparisonData = useMemo(() => {
    if (!quotes || quotes.length === 0) return [];

    return quotes.map(quote => {
      const convertedPrice = convertPriceToBase(quote, baseCurrency);
      const isValid = !quote.valid_until || !isPast(new Date(quote.valid_until));

      return {
        ...quote,
        convertedPrice: convertedPrice,
        isValid: isValid,
        baseCurrency: baseCurrency,
      };
    }).sort((a, b) => {
        // Sort by price, prioritizing valid quotes
        if (a.isValid && !b.isValid) return -1;
        if (!a.isValid && b.isValid) return 1;
        
        const priceA = a.convertedPrice ?? Infinity;
        const priceB = b.convertedPrice ?? Infinity;
        return priceA - priceB;
    });
  }, [quotes, baseCurrency]);

  const formatPrice = (price: number | null, currency: string) => {
    if (price === null || isNaN(price)) return 'N/A';
    return `${currency} ${price.toFixed(2)}`;
  };

  const renderComparisonTable = () => {
    if (isLoading) {
      return <div className="text-center text-muted-foreground p-8">Cargando cotizaciones...</div>;
    }

    if (!selectedMaterial) {
      return <div className="text-center text-muted-foreground p-8">Selecciona un material para ver y comparar cotizaciones.</div>;
    }

    if (comparisonData.length === 0) {
      return <div className="text-center text-muted-foreground p-8">No se encontraron cotizaciones para este material.</div>;
    }

    if (isMobile) {
      return (
        <div className="grid gap-4">
          {comparisonData.map((data, index) => (
            <Card key={data.id} className={cn("p-4", !data.isValid && "bg-red-50/50 dark:bg-red-900/20 border-l-4 border-red-500")}>
              <CardTitle className="text-lg mb-2 flex justify-between items-center">
                {data.suppliers.name}
                {index === 0 && data.isValid && <Scale className="h-5 w-5 text-procarni-secondary" />}
              </CardTitle>
              <CardDescription className="mb-2">Cód: {data.suppliers.code || 'N/A'} | RIF: {data.suppliers.rif}</CardDescription>
              <div className="text-sm space-y-1">
                <p className="font-bold text-lg">
                    <DollarSign className="inline h-4 w-4 mr-1" /> Precio: {formatPrice(data.convertedPrice, data.baseCurrency)}
                </p>
                <p>
                    <Clock className="inline h-4 w-4 mr-1 text-muted-foreground" /> Válido hasta: {data.valid_until ? format(new Date(data.valid_until), 'dd/MM/yyyy') : 'Indefinido'}
                    {!data.isValid && <span className="ml-2 text-red-600 font-semibold">(Vencida)</span>}
                </p>
                <p>
                    <Truck className="inline h-4 w-4 mr-1 text-muted-foreground" /> Entrega: {data.delivery_days !== null ? `${data.delivery_days} días` : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                    Precio Original: {data.currency} {data.unit_price.toFixed(2)}
                    {data.exchange_rate && ` (Tasa: ${data.exchange_rate.toFixed(2)})`}
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" size="icon" onClick={() => handleEditQuote(data)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => confirmDeleteQuote(data.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead>RIF</TableHead>
              <TableHead className="text-right">Precio ({baseCurrency})</TableHead>
              <TableHead>Moneda Original</TableHead>
              <TableHead>Tasa</TableHead>
              <TableHead>Válido Hasta</TableHead>
              <TableHead>Entrega (Días)</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisonData.map((data, index) => (
              <TableRow 
                key={data.id} 
                className={cn(
                    index === 0 && data.isValid && "bg-green-50/50 dark:bg-green-900/20 border-l-4 border-procarni-secondary",
                    !data.isValid && "bg-red-50/50 dark:bg-red-900/20 text-muted-foreground"
                )}
              >
                <TableCell className="font-medium flex items-center">
                    {data.suppliers.name}
                    {index === 0 && data.isValid && <Scale className="ml-2 h-4 w-4 text-procarni-secondary" />}
                </TableCell>
                <TableCell>{data.suppliers.rif}</TableCell>
                <TableCell className={cn("text-right font-bold", index === 0 && data.isValid && "text-procarni-secondary")}>
                    {formatPrice(data.convertedPrice, data.baseCurrency)}
                </TableCell>
                <TableCell>{data.currency} {data.unit_price.toFixed(2)}</TableCell>
                <TableCell>{data.exchange_rate ? data.exchange_rate.toFixed(2) : 'N/A'}</TableCell>
                <TableCell>
                    {data.valid_until ? format(new Date(data.valid_until), 'dd/MM/yyyy') : 'Indefinido'}
                    {!data.isValid && <span className="ml-2 text-red-600 font-semibold">(Vencida)</span>}
                </TableCell>
                <TableCell>{data.delivery_days !== null ? data.delivery_days : 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleEditQuote(data)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => confirmDeleteQuote(data.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Comparación de Cotizaciones</CardTitle>
          <CardDescription>
            Ingresa y compara las cotizaciones actuales recibidas de diferentes proveedores para un material específico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
            <div className="md:col-span-2">
              <Label htmlFor="material-search">Material *</Label>
              <SmartSearch
                placeholder="Buscar material por nombre o código"
                onSelect={handleMaterialSelect}
                fetchFunction={searchMaterials}
                displayValue={selectedMaterial?.name || ''}
              />
              {selectedMaterial && (
                <p className="text-sm text-muted-foreground mt-2">
                  Material seleccionado: <span className="font-semibold">{selectedMaterial.name} ({selectedMaterial.code})</span>
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="base-currency">Moneda Base de Comparación</Label>
              <Select value={baseCurrency} onValueChange={(value) => setBaseCurrency(value as 'USD' | 'VES')}>
                <SelectTrigger id="base-currency">
                  <SelectValue placeholder="Selecciona moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD (Dólares)</SelectItem>
                  <SelectItem value="VES">VES (Bolívares)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end mb-4">
            <Button 
                onClick={handleAddQuote} 
                disabled={!selectedMaterial}
                className="bg-procarni-secondary hover:bg-green-700"
            >
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Cotización
            </Button>
          </div>

          <h3 className="text-lg font-semibold mb-4">Cotizaciones Actuales</h3>
          {renderComparisonTable()}
          
        </CardContent>
      </Card>
      <MadeWithDyad />

      <QuoteFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        materialId={selectedMaterial?.id || ''}
        materialName={selectedMaterial?.name || ''}
        initialData={editingQuote}
        onSaveSuccess={() => {
            showSuccess('Cotización guardada exitosamente.');
            queryClient.invalidateQueries({ queryKey: ['supplierQuotes', selectedMaterial?.id] });
        }}
      />

      {/* AlertDialog for delete confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente esta cotización.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteQuote} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QuoteComparison;