import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from '@/components/SessionContextProvider';
import { useShoppingCart } from '@/context/ShoppingCartContext';
import { calculateTotals } from '@/utils/calculations';
import { PlusCircle, Trash2, Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';
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
import { useLocation, useNavigate } from 'react-router-dom'; // Import useLocation and useNavigate
import PurchaseOrderItemsTable from '@/components/PurchaseOrderItemsTable';
import PurchaseOrderDetailsForm from '@/components/PurchaseOrderDetailsForm';

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

// Define las unidades de medida.
const MATERIAL_UNITS = [
  'KG', 'LT', 'ROL', 'PAQ', 'SACO', 'GAL', 'UND', 'MT', 'RESMA', 'PZA', 'TAMB', 'MILL', 'CAJA'
];

const GeneratePurchaseOrder = () => {
  const { session, isLoadingSession } = useSession();
  const { items, addItem, updateItem, removeItem, clearCart } = useShoppingCart();
  const location = useLocation(); // Hook para obtener el estado de la navegación
  const navigate = useNavigate(); // Hook para navegar

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

  // Check if there's a quote request in the location state
  const quoteRequest = location.state?.quoteRequest;
  const supplierData = location.state?.supplier;

  // Effect to prefill form from quote request
  React.useEffect(() => {
    if (quoteRequest) {
      setCompanyId(quoteRequest.company_id);
      setCompanyName(quoteRequest.companies?.name || '');
      setSupplierId(quoteRequest.supplier_id);
      setSupplierName(quoteRequest.suppliers?.name || '');
      setCurrency(quoteRequest.currency as 'USD' | 'VES');
      setExchangeRate(quoteRequest.exchange_rate || undefined);
      setObservations(`Generado desde Solicitud de Cotización: ${quoteRequest.id.substring(0, 8)}`);

      // Clear existing items and add items from quote request
      clearCart();
      quoteRequest.quote_request_items.forEach((item: any) => {
        addItem({
          material_name: item.material_name,
          supplier_code: '', // No supplier code in quote request
          quantity: item.quantity,
          unit_price: 0, // Price needs to be entered
          tax_rate: 0.16,
          is_exempt: false,
          unit: item.unit || MATERIAL_UNITS[0],
        });
      });
    }
  }, [quoteRequest]);

  // Effect to prefill form from supplier data
  React.useEffect(() => {
    if (supplierData) {
      setSupplierId(supplierData.id);
      setSupplierName(supplierData.name);
    }
  }, [supplierData]);

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

  const handleMaterialSelect = (index: number, material: MaterialSearchResult) => {
    // Update material_name, unit, and is_exempt based on selected material
    updateItem(index, {
      material_name: material.name,
      unit: material.unit || MATERIAL_UNITS[0],
      is_exempt: material.is_exempt || false,
      // tax_rate remains 0.16 by default, calculation handles is_exempt
    });
  };

  const handleAddItem = () => {
    addItem({ material_name: '', supplier_code: '', quantity: 0, unit_price: 0, tax_rate: 0.16, is_exempt: false, unit: MATERIAL_UNITS[0] });
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

  const handleSupplierSelect = (supplier: { id: string; name: string }) => {
    setSupplierId(supplier.id);
    setSupplierName(supplier.name);
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
      // Link to quote request if it exists
      quote_request_id: quoteRequest?.id || null,
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
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Generar Orden de Compra (OC)</CardTitle>
          <CardDescription>Crea una nueva orden de compra para tus proveedores.</CardDescription>
        </CardHeader>
        <CardContent>
          <PurchaseOrderDetailsForm
            companyId={companyId}
            companyName={companyName}
            supplierId={supplierId}
            supplierName={supplierName}
            currency={currency}
            exchangeRate={exchangeRate}
            deliveryDate={deliveryDate}
            paymentTerms={paymentTerms}
            customPaymentTerms={customPaymentTerms}
            creditDays={creditDays}
            observations={observations}
            onCompanySelect={handleCompanySelect}
            onSupplierSelect={handleSupplierSelect}
            onCurrencyChange={(checked) => setCurrency(checked ? 'VES' : 'USD')}
            onExchangeRateChange={setExchangeRate}
            onDeliveryDateChange={setDeliveryDate}
            onPaymentTermsChange={setPaymentTerms}
            onCustomPaymentTermsChange={setCustomPaymentTerms}
            onCreditDaysChange={setCreditDays}
            onObservationsChange={setObservations}
          />

          <PurchaseOrderItemsTable
            items={items}
            supplierId={supplierId}
            currency={currency}
            onAddItem={handleAddItem}
            onRemoveItem={handleRemoveItem}
            onItemChange={handleItemChange}
            onMaterialSelect={handleMaterialSelect}
          />

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