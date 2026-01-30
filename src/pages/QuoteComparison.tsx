import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle, Scale, Download, X } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useNavigate } from 'react-router-dom';
import SmartSearch from '@/components/SmartSearch';
import { searchMaterials } from '@/integrations/supabase/data';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { showError } from '@/utils/toast';
import MaterialQuoteComparisonRow from '@/components/MaterialQuoteComparisonRow';
import QuoteComparisonPDFButton from '@/components/QuoteComparisonPDFButton'; // NEW IMPORT

interface MaterialSearchResult {
  id: string;
  name: string;
  code: string;
  category?: string;
  unit?: string;
}

interface SupplierResult {
  id: string;
  name: string;
  rif: string;
  code?: string;
}

interface QuoteEntry {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  currency: 'USD' | 'VES';
  exchangeRate?: number;
}

interface MaterialComparison {
  material: MaterialSearchResult;
  quotes: QuoteEntry[];
}

const QuoteComparison = () => {
  const navigate = useNavigate();
  
  const [materialsToCompare, setMaterialsToCompare] = useState<MaterialComparison[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number | undefined>(undefined);
  
  // State for adding a new material via SmartSearch
  const [newMaterialQuery, setNewMaterialQuery] = useState('');
  const [selectedMaterialToAdd, setSelectedMaterialToAdd] = useState<MaterialSearchResult | null>(null);

  const handleMaterialSelect = (material: MaterialSearchResult) => {
    setSelectedMaterialToAdd(material);
    setNewMaterialQuery(material.name);
  };

  const handleAddMaterial = () => {
    if (!selectedMaterialToAdd) {
      showError('Por favor, selecciona un material para añadir.');
      return;
    }
    if (materialsToCompare.some(m => m.material.id === selectedMaterialToAdd.id)) {
      showError('Este material ya está en la lista de comparación.');
      return;
    }

    setMaterialsToCompare(prev => [
      ...prev,
      { material: selectedMaterialToAdd, quotes: [] }
    ]);
    setSelectedMaterialToAdd(null);
    setNewMaterialQuery('');
  };

  const handleRemoveMaterial = (materialId: string) => {
    setMaterialsToCompare(prev => prev.filter(m => m.material.id !== materialId));
  };

  const handleAddQuoteEntry = (materialId: string) => {
    setMaterialsToCompare(prev => prev.map(m => {
      if (m.material.id === materialId) {
        return {
          ...m,
          quotes: [...m.quotes, { 
            supplierId: '', 
            supplierName: '', 
            unitPrice: 0, 
            currency: 'USD', 
            exchangeRate: undefined 
          }]
        };
      }
      return m;
    }));
  };

  const handleRemoveQuoteEntry = (materialId: string, quoteIndex: number) => {
    setMaterialsToCompare(prev => prev.map(m => {
      if (m.material.id === materialId) {
        return {
          ...m,
          quotes: m.quotes.filter((_, i) => i !== quoteIndex)
        };
      }
      return m;
    }));
  };

  const handleQuoteChange = (materialId: string, quoteIndex: number, field: keyof QuoteEntry, value: any) => {
    setMaterialsToCompare(prev => prev.map(m => {
      if (m.material.id === materialId) {
        const updatedQuotes = m.quotes.map((q, i) => {
          if (i === quoteIndex) {
            const newQuote = { ...q, [field]: value };
            
            // Handle currency change logic
            if (field === 'currency' && value === 'USD') {
                newQuote.exchangeRate = undefined;
            }
            
            return newQuote;
          }
          return q;
        });
        return { ...m, quotes: updatedQuotes };
      }
      return m;
    }));
  };

  // --- Core Comparison Logic (Memoized) ---
  const comparisonResults = useMemo(() => {
    return materialsToCompare.map(materialComp => {
      const results = materialComp.quotes.map(quote => {
        // 1. Validate required fields
        if (!quote.supplierId || quote.unitPrice <= 0 || (quote.currency === 'VES' && (!quote.exchangeRate || quote.exchangeRate <= 0))) {
            return { ...quote, convertedPrice: null, isValid: false, error: 'Datos incompletos o inválidos.' };
        }

        // 2. Convert price to base currency
        let convertedPrice: number | null = quote.unitPrice;
        const rate = quote.exchangeRate || exchangeRate; // Use quote rate first, then global rate

        if (quote.currency === baseCurrency) {
            // No conversion needed
        } else if (baseCurrency === 'USD' && quote.currency === 'VES') {
            if (rate && rate > 0) {
                convertedPrice = quote.unitPrice / rate;
            } else {
                return { ...quote, convertedPrice: null, isValid: false, error: 'Falta Tasa de Cambio para VES a USD.' };
            }
        } else if (baseCurrency === 'VES' && quote.currency === 'USD') {
            if (rate && rate > 0) {
                convertedPrice = quote.unitPrice * rate;
            } else {
                return { ...quote, convertedPrice: null, isValid: false, error: 'Falta Tasa de Cambio para USD a VES.' };
            }
        }
        
        return { ...quote, convertedPrice: convertedPrice, isValid: true, error: null };
      });

      // Find the best price among valid quotes
      const validResults = results.filter(r => r.isValid && r.convertedPrice !== null);
      const bestPrice = validResults.length > 0 
        ? Math.min(...validResults.map(r => r.convertedPrice!)) 
        : null;

      return {
        material: materialComp.material,
        results: results,
        bestPrice: bestPrice,
      };
    });
  }, [materialsToCompare, baseCurrency, exchangeRate]);
  // -----------------------------

  const renderComparisonTable = () => {
    if (materialsToCompare.length === 0) {
      return <div className="text-center text-muted-foreground p-8">Añade materiales para empezar la comparación.</div>;
    }

    return (
      <div className="space-y-8">
        {comparisonResults.map(materialComp => (
          <div key={materialComp.material.id}>
            <MaterialQuoteComparisonRow
              comparisonData={materialComp}
              baseCurrency={baseCurrency}
              globalExchangeRate={exchangeRate}
              onAddQuoteEntry={handleAddQuoteEntry}
              onRemoveQuoteEntry={handleRemoveQuoteEntry}
              onQuoteChange={handleQuoteChange}
              onRemoveMaterial={handleRemoveMaterial}
            />
            {/* Individual PDF Download Button */}
            <div className="flex justify-end mt-2">
                <QuoteComparisonPDFButton
                    comparisonResults={[materialComp]} // Pass only the current material
                    baseCurrency={baseCurrency}
                    globalExchangeRate={exchangeRate}
                    label={`Descargar PDF de ${materialComp.material.code}`}
                    variant="outline"
                    isSingleMaterial={true}
                />
            </div>
          </div>
        ))}
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
          <CardTitle className="text-procarni-primary">Comparación Inmediata de Cotizaciones</CardTitle>
          <CardDescription>
            Compara precios de diferentes proveedores para múltiples materiales en tiempo real.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end p-4 border rounded-lg bg-muted/20">
            <div className="md:col-span-2">
              <Label htmlFor="material-search">Añadir Material a Comparar</Label>
              <SmartSearch
                placeholder="Buscar material por nombre o código"
                onSelect={handleMaterialSelect}
                fetchFunction={searchMaterials}
                displayValue={newMaterialQuery}
                selectedId={selectedMaterialToAdd?.id}
              />
              {selectedMaterialToAdd && (
                <p className="text-sm text-muted-foreground mt-2">
                  Material listo para añadir: <span className="font-semibold">{selectedMaterialToAdd.name} ({selectedMaterialToAdd.code})</span>
                </p>
              )}
            </div>
            <Button 
                onClick={handleAddMaterial} 
                disabled={!selectedMaterialToAdd}
                className="bg-procarni-secondary hover:bg-green-700 h-10"
            >
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Material
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end p-4 border rounded-lg">
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
            <div>
              <Label htmlFor="exchange-rate">Tasa de Cambio Global (USD a VES)</Label>
              <Input
                id="exchange-rate"
                type="number"
                step="0.01"
                placeholder="Opcional: Tasa global"
                value={exchangeRate || ''}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || undefined)}
              />
              <p className="text-xs text-muted-foreground mt-1">Se usa si la cotización en VES no especifica su propia tasa.</p>
            </div>
            <div className="flex justify-end items-end">
                <QuoteComparisonPDFButton
                    comparisonResults={comparisonResults}
                    baseCurrency={baseCurrency}
                    globalExchangeRate={exchangeRate}
                    label="Descargar Reporte General"
                    variant="default"
                />
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Scale className="mr-2 h-5 w-5 text-procarni-primary" />
            Resultados de la Comparación
          </h3>
          {renderComparisonTable()}
          
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default QuoteComparison;