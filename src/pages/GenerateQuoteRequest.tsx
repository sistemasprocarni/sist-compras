import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/components/SessionContextProvider';
import { PlusCircle, Trash2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { createQuoteRequest, searchSuppliers, searchMaterials } from '@/integrations/supabase/data';
import { useQuery } from '@tanstack/react-query';
import { MadeWithDyad } from '@/components/made-with-dyad';
import SmartSearch from '@/components/SmartSearch';

interface Company {
  id: string;
  name: string;
}

interface QuoteRequestItem {
  material_name: string;
  quantity: number;
  description?: string;
  unit?: string;
}

interface MaterialSearchResult {
  id: string;
  name: string;
  code: string;
  category?: string;
  unit?: string;
}

// Define las unidades de medida.
const MATERIAL_UNITS = [
  'KG', 'LT', 'ROL', 'PAQ', 'SACO', 'GAL', 'UND', 'MT', 'RESMA', 'PZA', 'TAMB', 'MILL', 'CAJA'
];

const GenerateQuoteRequest = () => {
  const { session, isLoadingSession } = useSession();

  const [companyId, setCompanyId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>(''); // For SmartSearch display
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<QuoteRequestItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  // Fetch companies
  const { data: companies, isLoading: isLoadingCompanies, error: companiesError } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: async () => {
      if (!session || !session.supabase) {
        return [];
      }
      const { data, error } = await session.supabase.from('companies').select('id, name');
      if (error) {
        console.error('[GenerateQuoteRequest] Error fetching companies:', error);
        showError('Error al cargar las empresas.');
        return [];
      }
      return data || [];
    },
    enabled: !!session && !isLoadingSession, // Habilitar la consulta solo cuando la sesión esté lista
  });

  const handleAddItem = () => {
    setItems((prevItems) => [...prevItems, { material_name: '', quantity: 0, description: '', unit: MATERIAL_UNITS[0] }]);
  };

  const handleItemChange = (index: number, field: keyof QuoteRequestItem, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (index: number) => {
    setItems((prevItems) => prevItems.filter((_, i) => i !== index));
  };

  const handleMaterialSelect = (index: number, material: MaterialSearchResult) => {
    handleItemChange(index, 'material_name', material.name);
    handleItemChange(index, 'unit', material.unit || MATERIAL_UNITS[0]); // Set unit if available from material
  };

  const handleSubmit = async () => {
    if (!userId) {
      showError('Usuario no autenticado.');
      return;
    }
    if (!companyId) {
      showError('Por favor, selecciona una empresa.');
      return;
    }
    if (!supplierId) {
      showError('Por favor, selecciona un proveedor.');
      return;
    }
    if (currency === 'VES' && (!exchangeRate || exchangeRate <= 0)) {
      showError('La tasa de cambio es requerida y debe ser mayor que cero para solicitudes en Bolívares.');
      return;
    }
    if (items.length === 0 || items.some(item => !item.material_name || item.quantity <= 0 || !item.unit)) {
      showError('Por favor, añade al menos un ítem válido con nombre, cantidad mayor a cero y unidad.');
      return;
    }

    setIsSubmitting(true);
    const requestData = {
      supplier_id: supplierId,
      company_id: companyId,
      currency,
      exchange_rate: currency === 'VES' ? exchangeRate : null,
      status: 'Draft', // O el estado inicial que desees
      created_by: userEmail || 'unknown',
      user_id: userId,
    };

    const createdRequest = await createQuoteRequest(requestData, items);

    if (createdRequest) {
      showSuccess('Solicitud de cotización creada exitosamente.');
      setCompanyId('');
      setSupplierId('');
      setSupplierName('');
      setCurrency('USD');
      setExchangeRate(undefined);
      setItems([]);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Generar Solicitud de Cotización (SC)</CardTitle>
          <CardDescription>Crea una nueva solicitud de cotización para tus proveedores.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="company">Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId} disabled={isLoadingCompanies || isLoadingSession}>
                <SelectTrigger id="company">
                  <SelectValue placeholder="Selecciona una empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <h3 className="text-lg font-semibold mb-4">Ítems de la Solicitud</h3>
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end border p-3 rounded-md">
                <div className="md:col-span-2">
                  <Label htmlFor={`material_name-${index}`}>Material</Label>
                  <SmartSearch
                    placeholder="Buscar material por nombre o código"
                    onSelect={(material) => handleMaterialSelect(index, material as MaterialSearchResult)}
                    fetchFunction={searchMaterials}
                    displayValue={item.material_name}
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
                <div className="md:col-span-2">
                  <Label htmlFor={`description-${index}`}>Descripción</Label>
                  <Textarea
                    id={`description-${index}`}
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    placeholder="Especificación, marca, etc."
                    rows={1}
                  />
                </div>
                <div>
                  <Label htmlFor={`unit-${index}`}>Unidad</Label>
                  <Select value={item.unit} onValueChange={(value) => handleItemChange(index, 'unit', value)}>
                    <SelectTrigger id={`unit-${index}`}>
                      <SelectValue placeholder="Unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_UNITS.map(unitOption => (
                        <SelectItem key={unitOption} value={unitOption}>{unitOption}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={handleSubmit} disabled={isSubmitting || !userId} className="bg-procarni-secondary hover:bg-green-700">
              {isSubmitting ? 'Guardando...' : 'Guardar Solicitud de Cotización'}
            </Button>
          </div>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default GenerateQuoteRequest;