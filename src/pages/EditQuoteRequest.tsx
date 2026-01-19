import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/components/SessionContextProvider';
import { PlusCircle, Trash2, ArrowLeft } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { getQuoteRequestDetails, searchSuppliers, searchMaterials, updateQuoteRequest } from '@/integrations/supabase/data';
import { useQuery } from '@tanstack/react-query';
import { MadeWithDyad } from '@/components/made-with-dyad';
import SmartSearch from '@/components/SmartSearch';

interface Company {
  id: string;
  name: string;
}

interface QuoteRequestItemForm {
  id?: string; // Optional for existing items
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

const EditQuoteRequest = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();

  const [companyId, setCompanyId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<QuoteRequestItemForm[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  // Fetch existing quote request data
  const { data: initialRequest, isLoading: isLoadingRequest, error: requestError } = useQuery({
    queryKey: ['quoteRequestDetails', id],
    queryFn: () => getQuoteRequestDetails(id!),
    enabled: !!id && !!session,
  });

  // Fetch companies
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await session.supabase.from('companies').select('id, name');
      if (error) {
        console.error('Error fetching companies:', error);
        showError('Error al cargar las empresas.');
        return [];
      }
      return data || [];
    },
    enabled: !!session,
  });

  // Populate form fields when initialRequest data is loaded
  useEffect(() => {
    if (initialRequest) {
      setCompanyId(initialRequest.company_id);
      setSupplierId(initialRequest.supplier_id);
      setSupplierName(initialRequest.suppliers?.name || '');
      setCurrency(initialRequest.currency as 'USD' | 'VES');
      setExchangeRate(initialRequest.exchange_rate || undefined);
      setItems(initialRequest.quote_request_items.map(item => ({
        id: item.id,
        material_name: item.material_name,
        quantity: item.quantity,
        description: item.description || '',
        unit: item.unit || MATERIAL_UNITS[0],
      })));
    }
  }, [initialRequest]);

  if (isLoadingRequest || isLoadingCompanies) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Cargando solicitud de cotización para edición...
      </div>
    );
  }

  if (requestError) {
    showError(requestError.message);
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        Error al cargar la solicitud de cotización: {requestError.message}
        <Button asChild variant="link" className="mt-4">
          <Link to="/quote-request-management">Volver a la gestión de solicitudes</Link>
        </Button>
      </div>
    );
  }

  if (!initialRequest) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Solicitud de cotización no encontrada.
        <Button asChild variant="link" className="mt-4">
          <Link to="/quote-request-management">Volver a la gestión de solicitudes</Link>
        </Button>
      </div>
    );
  }

  const handleAddItem = () => {
    setItems((prevItems) => [...prevItems, { material_name: '', quantity: 0, description: '', unit: MATERIAL_UNITS[0] }]);
  };

  const handleItemChange = (index: number, field: keyof QuoteRequestItemForm, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (index: number) => {
    setItems((prevItems) => prevItems.filter((_, i) => i !== index));
  };

  const handleMaterialSelect = (index: number, material: MaterialSearchResult) => {
    handleItemChange(index, 'material_name', material.name);
    handleItemChange(index, 'unit', material.unit || MATERIAL_UNITS[0]);
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
      status: initialRequest.status, // Keep original status or allow editing
      created_by: userEmail || 'unknown',
      user_id: userId,
    };

    const updatedRequest = await updateQuoteRequest(id!, requestData, items);

    if (updatedRequest) {
      showSuccess('Solicitud de cotización actualizada exitosamente.');
      navigate(`/quote-requests/${id}`); // Go back to details page
    }
    setIsSubmitting(false);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Button asChild variant="outline">
          <Link to={`/quote-requests/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Detalles
          </Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Editar Solicitud de Cotización #{id?.substring(0, 8)}</CardTitle>
          <CardDescription>Modifica los detalles de esta solicitud de cotización.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="company">Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId} disabled={isLoadingCompanies}>
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
              <div key={item.id || index} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end border p-3 rounded-md">
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
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default EditQuoteRequest;