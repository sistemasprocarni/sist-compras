import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSession } from '@/components/SessionContextProvider';
import { useShoppingCart } from '@/context/ShoppingCartContext';
import { calculateTotals } from '@/utils/calculations';
import { PlusCircle, Trash2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { createPurchaseOrder, searchSuppliers } from '@/integrations/supabase/data'; // Removed getMaterialsBySupplier as it's not used here
import { useQuery } from '@tanstack/react-query';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import PurchaseOrderPreviewModal from '@/components/PurchaseOrderPreviewModal';
import SmartSearch from '@/components/SmartSearch';

interface Company {
  id: string;
  name: string;
}

const GeneratePurchaseOrder = () => {
  const { session, isLoadingSession } = useSession();
  const { items, addItem, updateItem, removeItem, clearCart } = useShoppingCart();

  const [defaultCompanyId, setDefaultCompanyId] = React.useState<string | null>(null); // State for the default company ID
  const [supplierId, setSupplierId] = React.useState<string>('');
  const [supplierName, setSupplierName] = React.useState<string>('');
  const [currency, setCurrency] = React.useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = React.useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  // Fetch companies to get the default one
  const { data: companies, isLoading: isLoadingCompanies, error: companiesError } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: async () => {
      if (!session || !session.supabase) {
        return [];
      }
      const { data, error } = await session.supabase.from('companies').select('id, name');
      if (error) {
        console.error('[GeneratePurchaseOrder] Error fetching companies:', error);
        showError('Error al cargar las empresas.');
        return [];
      }
      return data || [];
    },
    enabled: !!session && !isLoadingSession,
  });

  // Set the default company ID once companies are loaded
  React.useEffect(() => {
    if (companies && companies.length > 0) {
      setDefaultCompanyId(companies[0].id);
    } else if (!isLoadingCompanies && !companiesError) {
      showError('No hay empresas registradas. Por favor, registra una empresa primero.');
    }
  }, [companies, isLoadingCompanies, companiesError]);

  const handleAddItem = () => {
    addItem({ material_name: '', quantity: 0, unit_price: 0, tax_rate: 0.16, is_exempt: false });
  };

  const handleItemChange = (index: number, field: keyof typeof items[0], value: any) => {
    updateItem(index, { [field]: value });
  };

  const handleRemoveItem = (index: number) => {
    removeItem(index);
  };

  const totals = calculateTotals(items);

  const handleSubmit = async () => {
    if (!userId) {
      showError('Usuario no autenticado.');
      return;
    }
    if (!defaultCompanyId) {
      showError('No se ha podido determinar la empresa de origen. Asegúrate de que haya al menos una empresa registrada.');
      return;
    }
    if (!supplierId) {
      showError('Por favor, selecciona un proveedor.');
      return;
    }
    if (currency === 'VES' && (!exchangeRate || exchangeRate <= 0)) {
      showError('La tasa de cambio es requerida y debe ser mayor que cero para órdenes en Bolívares.');
      return;
    }
    if (items.length === 0 || items.some(item => !item.material_name || item.quantity <= 0 || item.unit_price <= 0)) {
      showError('Por favor, añade al menos un ítem válido con cantidad y precio mayores a cero.');
      return;
    }

    setIsSubmitting(true);
    const orderData = {
      supplier_id: supplierId,
      company_id: defaultCompanyId, // Use the default company ID
      currency,
      exchange_rate: currency === 'VES' ? exchangeRate : null,
      status: 'Draft', // O el estado inicial que desees
      created_by: userEmail || 'unknown',
      user_id: userId,
    };

    const createdOrder = await createPurchaseOrder(orderData, items);

    if (createdOrder) {
      showSuccess('Orden de compra creada exitosamente.');
      clearCart();
      setSupplierId('');
      setSupplierName('');
      setExchangeRate(undefined);
      // Optionally, redirect or show a success message
    }
    setIsSubmitting(false);
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Generar Orden de Compra (OC)</CardTitle>
          <CardDescription>Crea una nueva orden de compra para tus proveedores.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Eliminado el selector de empresa */}
            {defaultCompanyId && companies && companies.length > 0 && (
              <div>
                <Label>Empresa de Origen</Label>
                <Input value={companies.find(c => c.id === defaultCompanyId)?.name || 'Cargando...'} readOnly className="bg-gray-100" />
              </div>
            )}
            <div>
              <Label htmlFor="supplier">Proveedor</Label>
              <SmartSearch
                placeholder="Buscar proveedor por RIF o nombre"
                onSelect={(supplier) => {
                  setSupplierId(supplier.id);
                  setSupplierName(supplier.name);
                }}
                fetchFunction={searchSuppliers}
                displayValue={supplierName}
              />
              {supplierName && <p className="text-sm text-muted-foreground mt-1">Proveedor seleccionado: {supplierName}</p>}
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="currency">Moneda (USD/VES)</Label>
              <Switch
                id="currency"
                checked={currency === 'VES'}
                onCheckedChange={(checked) => setCurrency(checked ? 'VES' : 'USD')}
              />
              <span>{currency}</span>
            </div>
            {currency === 'VES' && (
              <div>
                <Label htmlFor="exchangeRate">Tasa de Cambio (USD a VES)</Label>
                <Input
                  id="exchangeRate"
                  type="number"
                  step="0.01"
                  value={exchangeRate || ''}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
                  placeholder="Ej: 36.50"
                />
              </div>
            )}
          </div>

          <h3 className="text-lg font-semibold mb-4">Ítems de la Orden</h3>
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end border p-3 rounded-md">
                <div className="md:col-span-2">
                  <Label htmlFor={`material_name-${index}`}>Material</Label>
                  <Input
                    id={`material_name-${index}`}
                    value={item.material_name}
                    onChange={(e) => handleItemChange(index, 'material_name', e.target.value)}
                    placeholder="Nombre del material"
                  />
                </div>
                <div>
                  <Label htmlFor={`quantity-${index}`}>Cantidad</Label>
                  <Input
                    id={`quantity-${index}`}
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor={`unit_price-${index}`}>P. Unitario</Label>
                  <Input
                    id={`unit_price-${index}`}
                    type="number"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                    min="0"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`is_exempt-${index}`}
                    checked={item.is_exempt}
                    onCheckedChange={(checked) => handleItemChange(index, 'is_exempt', checked)}
                  />
                  <Label htmlFor={`is_exempt-${index}`}>Exento IVA</Label>
                </div>
                <Button variant="destructive" size="icon" onClick={() => handleRemoveItem(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={handleAddItem} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir Ítem
            </Button>
          </div>

          <div className="mt-8 border-t pt-4">
            <div className="flex justify-end items-center mb-2">
              <span className="font-semibold mr-2">Base Imponible:</span>
              <span>{currency} {totals.baseImponible.toFixed(2)}</span>
            </div>
            <div className="flex justify-end items-center mb-2">
              <span className="font-semibold mr-2">Monto IVA:</span>
              <span>{currency} {totals.montoIVA.toFixed(2)}</span>
            </div>
            <div className="flex justify-end items-center text-xl font-bold">
              <span className="mr-2">TOTAL:</span>
              <span>{currency} {totals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" disabled={isSubmitting || !defaultCompanyId}>
                  Previsualizar PDF
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Previsualización de Orden de Compra</DialogTitle>
                </DialogHeader>
                <PurchaseOrderPreviewModal
                  orderData={{
                    supplier_id: supplierId,
                    company_id: defaultCompanyId || '', // Pass the default company ID
                    currency,
                    exchange_rate: currency === 'VES' ? exchangeRate : null,
                    status: 'Draft',
                    created_by: userEmail || 'unknown',
                    user_id: userId || '',
                  }}
                  itemsData={items}
                  onClose={() => setIsModalOpen(false)}
                />
              </DialogContent>
            </Dialog>
            <Button onClick={handleSubmit} disabled={isSubmitting || !userId || !defaultCompanyId} className="bg-procarni-secondary hover:bg-green-700">
              {isSubmitting ? 'Guardando...' : 'Guardar Orden de Compra'}
            </Button>
          </div>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default GeneratePurchaseOrder;