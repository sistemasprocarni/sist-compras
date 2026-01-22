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
import { PlusCircle, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { createPurchaseOrder, searchSuppliers, searchCompanies, searchMaterialsBySupplier, getSupplierDetails } from '@/integrations/supabase/data';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import PurchaseOrderDraftPreview from '@/components/PurchaseOrderDraftPreview';
import SmartSearch from '@/components/SmartSearch';
import { useQuery } from '@tanstack/react-query';
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Textarea } from '@/components/ui/textarea';

interface Company {
  id: string;
  name: string;
  rif: string; // Added rif for SmartSearch
}

// Define MaterialSearchResult structure based on what searchMaterialsBySupplier returns
interface MaterialSearchResult {
  id: string;
  name: string;
  code: string;
  category?: string;
  unit?: string;
  is_exempt?: boolean;
}

const GeneratePurchaseOrder = () => {
  const { session, isLoadingSession } = useSession();
  const { items, addItem, updateItem, removeItem, clearCart } = useShoppingCart();

  const [companyId, setCompanyId] = React.useState<string>(''); // Now explicitly selected
  const [companyName, setCompanyName] = React.useState<string>(''); // For SmartSearch display
  const [supplierId, setSupplierId] = React.useState<string>('');
  const [supplierName, setSupplierName] = React.useState<string>('');
  const [currency, setCurrency] = React.useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = React.useState<number | undefined>(undefined);
  
  // New states for PO details
  const [deliveryDate, setDeliveryDate] = React.useState<Date | undefined>(undefined);
  const [paymentTerms, setPaymentTerms] = React.useState<'Contado' | 'Crédito' | 'Otro'>('Contado');
  const [customPaymentTerms, setCustomPaymentTerms] = React.useState<string>('');
  const [creditDays, setCreditDays] = React.useState<number>(0);
  const [observations, setObservations] = React.useState<string>('');

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  // Fetch supplier details to get default payment terms
  const { data: supplierDetails } = useQuery({
    queryKey: ['supplierDetails', supplierId],
    queryFn: () => getSupplierDetails(supplierId),
    enabled: !!supplierId,
  });

  // Effect to set default payment terms when supplier changes
  React.useEffect(() => {
    if (supplierDetails) {
      const terms = supplierDetails.payment_terms as 'Contado' | 'Crédito' | 'Otro';
      setPaymentTerms(terms);
      setCustomPaymentTerms(supplierDetails.custom_payment_terms || '');
      setCreditDays(supplierDetails.credit_days || 0);
    } else {
      // Reset if supplier is cleared
      setPaymentTerms('Contado');
      setCustomPaymentTerms('');
      setCreditDays(0);
    }
  }, [supplierDetails]);

  // New wrapper function for material search, filtered by selected supplier
  const searchSupplierMaterials = async (query: string) => {
    if (!supplierId) return [];
    return searchMaterialsBySupplier(supplierId, query);
  };

  const handleMaterialSelect = (index: number, material: MaterialSearchResult) => {
    // Update material_name and is_exempt based on selected material
    updateItem(index, {
      material_name: material.name,
      is_exempt: material.is_exempt || false,
      // tax_rate remains 0.16 by default, calculation handles is_exempt
    });
  };

  const handleAddItem = () => {
    addItem({ material_name: '', supplier_code: '', quantity: 0, unit_price: 0, tax_rate: 0.16, is_exempt: false });
  };

  const handleItemChange = (index: number, field: keyof typeof items[0], value: any) => {
    updateItem(index, { [field]: value });
  };

  const handleRemoveItem = (index: number) => {
    removeItem(index);
  };

  const handleCompanySelect = (company: Company) => {
    setCompanyId(company.id);
    setCompanyName(company.name);
  };

  const totals = calculateTotals(items);

  const handleSubmit = async () => {
    if (!userId) {
      showError('Usuario no autenticado.');
      return;
    }
    if (!companyId) {
      showError('Por favor, selecciona una empresa de origen.');
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
    if (paymentTerms === 'Otro' && (!customPaymentTerms || customPaymentTerms.trim() === '')) {
      showError('Debe especificar los términos de pago personalizados.');
      return;
    }
    if (paymentTerms === 'Crédito' && (creditDays === undefined || creditDays <= 0)) {
      showError('Debe especificar los días de crédito.');
      return;
    }
    if (!deliveryDate) {
      showError('Debe seleccionar una fecha de entrega.');
      return;
    }

    setIsSubmitting(true);
    const orderData = {
      supplier_id: supplierId,
      company_id: companyId, // Use the selected company ID
      currency,
      exchange_rate: currency === 'VES' ? exchangeRate : null,
      status: 'Draft', // O el estado inicial que desees
      created_by: userEmail || 'unknown',
      user_id: userId,
      // New fields
      delivery_date: format(deliveryDate, 'yyyy-MM-dd'),
      payment_terms: paymentTerms,
      custom_payment_terms: paymentTerms === 'Otro' ? customPaymentTerms : null,
      credit_days: paymentTerms === 'Crédito' ? creditDays : 0,
      observations: observations || null,
    };

    const createdOrder = await createPurchaseOrder(orderData, items);

    if (createdOrder) {
      showSuccess('Orden de compra creada exitosamente.');
      clearCart();
      setCompanyId('');
      setCompanyName('');
      setSupplierId('');
      setSupplierName('');
      setExchangeRate(undefined);
      setDeliveryDate(undefined);
      setPaymentTerms('Contado');
      setCustomPaymentTerms('');
      setCreditDays(0);
      setObservations('');
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label htmlFor="company">Empresa de Origen</Label>
              <SmartSearch
                placeholder="Buscar empresa por RIF o nombre"
                onSelect={handleCompanySelect}
                fetchFunction={searchCompanies}
                displayValue={companyName}
              />
              {companyName && <p className="text-sm text-muted-foreground mt-1">Empresa seleccionada: {companyName}</p>}
            </div>
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
            <div>
              <Label htmlFor="deliveryDate">Fecha de Entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !deliveryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deliveryDate ? format(deliveryDate, "PPP") : <span>Selecciona una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={deliveryDate}
                    onSelect={setDeliveryDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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
            <div>
              <Label htmlFor="paymentTerms">Condición de Pago</Label>
              <Select value={paymentTerms} onValueChange={(value: 'Contado' | 'Crédito' | 'Otro') => {
                setPaymentTerms(value);
                // Reset related fields if terms change
                if (value !== 'Crédito') setCreditDays(0);
                if (value !== 'Otro') setCustomPaymentTerms('');
              }}>
                <SelectTrigger id="paymentTerms">
                  <SelectValue placeholder="Seleccione condición" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Contado">Contado</SelectItem>
                  <SelectItem value="Crédito">Crédito</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paymentTerms === 'Crédito' && (
              <div>
                <Label htmlFor="creditDays">Días de Crédito</Label>
                <Input
                  id="creditDays"
                  type="number"
                  value={creditDays}
                  onChange={(e) => setCreditDays(parseInt(e.target.value) || 0)}
                  min="0"
                  placeholder="Ej: 30"
                />
              </div>
            )}
            {paymentTerms === 'Otro' && (
              <div className="md:col-span-2">
                <Label htmlFor="customPaymentTerms">Términos de Pago Personalizados</Label>
                <Input
                  id="customPaymentTerms"
                  type="text"
                  value={customPaymentTerms}
                  onChange={(e) => setCustomPaymentTerms(e.target.value)}
                  placeholder="Describa los términos de pago"
                />
              </div>
            )}
          </div>

          <div className="mb-6">
            <Label htmlFor="observations">Observaciones</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Añade cualquier observación relevante para esta orden de compra."
              rows={3}
            />
          </div>

          <h3 className="text-lg font-semibold mb-4">Ítems de la Orden</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[20%]">Producto</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Código Prov.</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Cantidad</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Precio Unit.</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Monto</th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">IVA</th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Exento</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Acción</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item, index) => {
                  const subtotal = item.quantity * item.unit_price;
                  const itemIva = item.is_exempt ? 0 : subtotal * (item.tax_rate || 0.16);

                  return (
                    <tr key={index}>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <SmartSearch
                          placeholder={supplierId ? "Buscar material asociado" : "Selecciona proveedor"}
                          onSelect={(material) => handleMaterialSelect(index, material as MaterialSearchResult)}
                          fetchFunction={searchSupplierMaterials}
                          displayValue={item.material_name}
                          disabled={!supplierId}
                        />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <Input
                          type="text"
                          value={item.supplier_code || ''}
                          onChange={(e) => handleItemChange(index, 'supplier_code', e.target.value)}
                          placeholder="Código Prov."
                          className="h-8"
                        />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                          min="0"
                          className="h-8"
                        />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                          min="0"
                          className="h-8"
                        />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-right text-sm font-medium">
                        {currency} {subtotal.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-center text-sm">
                        {currency} {itemIva.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-center">
                        <Switch
                          checked={item.is_exempt}
                          onCheckedChange={(checked) => handleItemChange(index, 'is_exempt', checked)}
                          disabled={!item.material_name}
                        />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-right">
                        <Button variant="destructive" size="icon" onClick={() => handleRemoveItem(index)} className="h-8 w-8">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button variant="outline" onClick={handleAddItem} className="w-full mt-4">
            <PlusCircle className="mr-2 h-4 w-4" /> Añadir Ítem
          </Button>

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
                <Button variant="secondary" disabled={isSubmitting || !companyId}>
                  Previsualizar PDF
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl h-[95vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Previsualización de Orden de Compra</DialogTitle>
                </DialogHeader>
                <PurchaseOrderDraftPreview
                  orderData={{
                    supplier_id: supplierId,
                    company_id: companyId || '', // Pass the selected company ID
                    currency,
                    exchange_rate: currency === 'VES' ? exchangeRate : null,
                    status: 'Draft',
                    created_by: userEmail || 'unknown',
                    user_id: userId || '',
                    // Pass new fields for preview
                    delivery_date: deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : undefined,
                    payment_terms: paymentTerms,
                    custom_payment_terms: paymentTerms === 'Otro' ? customPaymentTerms : null,
                    credit_days: paymentTerms === 'Crédito' ? creditDays : 0,
                    observations: observations || null,
                  }}
                  itemsData={items}
                  onClose={() => setIsModalOpen(false)}
                />
              </DialogContent>
            </Dialog>
            <Button onClick={handleSubmit} disabled={isSubmitting || !userId || !companyId || !deliveryDate} className="bg-procarni-secondary hover:bg-green-700">
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