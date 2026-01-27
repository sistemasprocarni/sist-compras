import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useNavigate } from 'react-router-dom';
import SmartSearch from '@/components/SmartSearch';
import { searchMaterials, getPriceHistoryByMaterialId } from '@/integrations/supabase/data';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface MaterialSearchResult {
  id: string;
  name: string;
  code: string;
  category?: string;
}

interface PriceHistoryEntry {
  id: string;
  material_id: string;
  supplier_id: string;
  unit_price: number;
  currency: string;
  exchange_rate?: number | null;
  recorded_at: string;
  suppliers: {
    name: string;
    rif: string;
    code?: string;
  };
}

const PriceComparison = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialSearchResult | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<'USD' | 'VES'>('USD'); // New state for base currency

  const { data: priceHistory, isLoading, error } = useQuery<PriceHistoryEntry[]>({
    queryKey: ['priceHistory', selectedMaterial?.id],
    queryFn: () => getPriceHistoryByMaterialId(selectedMaterial!.id),
    enabled: !!selectedMaterial?.id,
  });

  const handleMaterialSelect = (material: MaterialSearchResult) => {
    setSelectedMaterial(material);
  };

  // Helper function to convert price to the base currency
  const convertPriceToBase = (entry: PriceHistoryEntry, base: 'USD' | 'VES'): number | null => {
    const price = entry.unit_price;
    const currency = entry.currency as 'USD' | 'VES';
    const rate = entry.exchange_rate;

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

  // Group history by supplier to calculate min/max/average in the base currency
  const comparisonData = useMemo(() => {
    if (!priceHistory || priceHistory.length === 0) return [];

    const grouped = priceHistory.reduce((acc, entry) => {
      const convertedPrice = convertPriceToBase(entry, baseCurrency);
      if (convertedPrice === null) return acc; // Skip entries that cannot be converted

      const supplierId = entry.supplier_id;
      if (!acc[supplierId]) {
        acc[supplierId] = {
          supplierName: entry.suppliers.name,
          supplierCode: entry.suppliers.code,
          prices: [],
          latestPrice: entry,
        };
      }
      acc[supplierId].prices.push(convertedPrice);
      
      // Determine the latest price based on recorded_at timestamp
      if (new Date(entry.recorded_at) > new Date(acc[supplierId].latestPrice.recorded_at)) {
        acc[supplierId].latestPrice = entry;
      }

      return acc;
    }, {} as Record<string, { supplierName: string; supplierCode?: string; prices: number[]; latestPrice: PriceHistoryEntry }>);

    return Object.values(grouped).map(group => {
      const prices = group.prices;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;

      // Convert the latest price to the base currency for display
      const latestPriceConverted = convertPriceToBase(group.latestPrice, baseCurrency);

      return {
        supplierName: group.supplierName,
        supplierCode: group.supplierCode,
        latestPrice: latestPriceConverted,
        minPrice: minPrice,
        maxPrice: maxPrice,
        avgPrice: avgPrice,
        priceCount: prices.length,
        baseCurrency: baseCurrency,
      };
    });
  }, [priceHistory, baseCurrency]);

  const renderComparisonTable = () => {
    if (isLoading) {
      return <div className="text-center text-muted-foreground p-8">Cargando historial de precios...</div>;
    }

    if (!selectedMaterial) {
      return <div className="text-center text-muted-foreground p-8">Selecciona un material para ver su historial de precios.</div>;
    }

    if (comparisonData.length === 0) {
      return <div className="text-center text-muted-foreground p-8">No se encontró historial de precios para este material en la moneda base seleccionada.</div>;
    }

    const formatPrice = (price: number | null, currency: string) => {
      if (price === null) return 'N/A';
      return `${currency} ${price.toFixed(2)}`;
    };

    if (isMobile) {
      return (
        <div className="grid gap-4">
          {comparisonData.map((data, index) => (
            <Card key={index} className="p-4">
              <CardTitle className="text-lg mb-2">{data.supplierName}</CardTitle>
              <CardDescription className="mb-2">Cód: {data.supplierCode || 'N/A'}</CardDescription>
              <div className="text-sm space-y-1">
                <p><strong>Último Precio ({data.baseCurrency}):</strong> {formatPrice(data.latestPrice, data.baseCurrency)} ({format(new Date(data.latestPrice.recorded_at), 'dd/MM/yy')})</p>
                <p><strong>Precio Mínimo ({data.baseCurrency}):</strong> {formatPrice(data.minPrice, data.baseCurrency)}</p>
                <p><strong>Precio Máximo ({data.baseCurrency}):</strong> {formatPrice(data.maxPrice, data.baseCurrency)}</p>
                <p><strong>Promedio ({data.baseCurrency}):</strong> {formatPrice(data.avgPrice, data.baseCurrency)}</p>
                <p><strong>Registros:</strong> {data.priceCount}</p>
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
              <TableHead>Cód. Prov.</TableHead>
              <TableHead>Último Precio ({baseCurrency})</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Mínimo Histórico ({baseCurrency})</TableHead>
              <TableHead>Máximo Histórico ({baseCurrency})</TableHead>
              <TableHead>Promedio ({baseCurrency})</TableHead>
              <TableHead>Registros</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisonData.map((data, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{data.supplierName}</TableCell>
                <TableCell>{data.supplierCode || 'N/A'}</TableCell>
                <TableCell>
                  {formatPrice(data.latestPrice, data.baseCurrency)}
                </TableCell>
                <TableCell>{format(new Date(data.latestPrice.recorded_at), 'dd/MM/yyyy')}</TableCell>
                <TableCell className="text-green-600">{formatPrice(data.minPrice, data.baseCurrency)}</TableCell>
                <TableCell className="text-red-600">{formatPrice(data.maxPrice, data.baseCurrency)}</TableCell>
                <TableCell>{formatPrice(data.avgPrice, data.baseCurrency)}</TableCell>
                <TableCell>{data.priceCount}</TableCell>
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
          <CardTitle className="text-procarni-primary">Comparación de Precios Históricos</CardTitle>
          <CardDescription>
            Selecciona un material para ver el historial de precios pagados a diferentes proveedores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
            <div className="md:col-span-2">
              <Label htmlFor="material-search">Material</Label>
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

          <h3 className="text-lg font-semibold mb-4">Historial y Comparativa</h3>
          {renderComparisonTable()}
          
          {/* Detailed History Table (Optional, but useful) */}
          {priceHistory && priceHistory.length > 0 && !isMobile && (
            <div className="mt-8">
              <h4 className="text-md font-semibold mb-2">Detalle de Transacciones (Moneda Original)</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Precio Unitario</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead>Tasa de Cambio</TableHead>
                      <TableHead>Fecha Registro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.suppliers.name}</TableCell>
                        <TableCell>{entry.unit_price.toFixed(2)}</TableCell>
                        <TableCell>{entry.currency}</TableCell>
                        <TableCell>{entry.exchange_rate ? entry.exchange_rate.toFixed(2) : 'N/A'}</TableCell>
                        <TableCell>{format(new Date(entry.recorded_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default PriceComparison;