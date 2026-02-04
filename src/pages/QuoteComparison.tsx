import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle, Scale, Download, X, Loader2, RefreshCw, DollarSign } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useNavigate } from 'react-router-dom';
import SmartSearch from '@/components/SmartSearch';
import { searchMaterials } from '@/integrations/supabase/data';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { showError, showSuccess } from '@/utils/toast';
import MaterialQuoteComparisonRow from '@/components/MaterialQuoteComparisonRow';
import QuoteComparisonPDFButton from '@/components/QuoteComparisonPDFButton';
import { Separator } from '@/components/ui/separator';

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
  const [globalInputCurrency, setGlobalInputCurrency] = useState<'USD' | 'VES'>('USD'); 
  const [exchangeRate, setExchangeRate] = useState<number | undefined>(undefined);
  
  // New states for rate management
  const [dailyRate, setDailyRate] = useState<number | undefined>(undefined);
  const [rateSource, setRateSource] = useState<'custom' | 'daily'>('custom');
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  // State for adding a new material via SmartSearch
  const [newMaterialQuery, setNewMaterialQuery] = useState('');
  const [selectedMaterialToAdd, setSelectedMaterialToAdd] = useState<MaterialSearchResult | null>(null);

  const fetchDailyRate = useCallback(async () => {
    setIsLoadingRate(true);
    try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        if (!response.ok) {
            throw new Error('Failed to fetch daily rate');
        }
        const data = await response.json();
        
        // Assuming the API returns an object with 'promedio' or 'valor'
        const rate = data.promedio || data.valor; 
        
        if (typeof rate === 'number' && rate > 0) {
            setDailyRate(rate);
            showSuccess(`Tasa del día cargada: ${rate.toFixed(2)} VES/USD`);
        } else {
            throw new Error('Formato de tasa de cambio inválido.');
        }
        return rate;
    } catch (e: any) {
        console.error('[QuoteComparison] Error fetching daily rate:', e);
        showError(`Error al cargar la tasa del día: ${e.message}`);
        setDailyRate(undefined);
        return undefined;
    } finally {
        setIsLoadingRate(false);
    }
  }, []);

  // Effect to manage rate fetching and default selection when globalInputCurrency changes
  useEffect(() => {
    if (globalInputCurrency === 'VES') {
        fetchDailyRate().then(rate => {
            if (rate) {
                setRateSource('daily');
                setExchangeRate(rate);
            } else {
                setRateSource('custom');
                setExchangeRate(undefined);
            }
        });
    } else {
        setDailyRate(undefined);
        setRateSource('custom');
        setExchangeRate(undefined); // Clear exchange rate when switching to USD
    }
  }, [globalInputCurrency, fetchDailyRate]);

  // Effect to synchronize exchangeRate based on rateSource and dailyRate
  useEffect(() => {
    if (globalInputCurrency === 'VES') {
        if (rateSource === 'daily' && dailyRate !== undefined) {
            setExchangeRate(dailyRate);
        } else if (rateSource === 'custom') {
            // Keep custom rate, rely on input field to update it
        }
    } else {
        setExchangeRate(undefined);
    }
  }, [globalInputCurrency, rateSource, dailyRate]);


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
            currency: globalInputCurrency, 
            exchangeRate: globalInputCurrency === 'VES' ? exchangeRate : undefined 
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

  const handleQuoteChange = (materialId: string, quoteIndex: number, field: keyof QuoteEntry, value: any, supplierName?: string) => {
    setMaterialsToCompare(prev => prev.map(m => {
      if (m.material.id === materialId) {
        const updatedQuotes = m.quotes.map((q, i) => {
          if (i === quoteIndex) {
            const newQuote = { ...q, [field]: value };
            
            if (field === 'currency' && value === 'USD') {
                newQuote.exchangeRate = undefined;
            }
            
            if (field === 'supplierId' && supplierName) {
                newQuote.supplierName = supplierName;
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
  const comparisonBaseCurrency = 'USD'; 

  const comparisonResults = useMemo(() => {
    return materialsToCompare.map(materialComp => {
      const results = materialComp.quotes.map(quote => {
        
        const rateToUse = quote.exchangeRate || exchangeRate; 

        if (!quote.supplierId || quote.unitPrice <= 0) {
            return { ...quote, convertedPrice: null, isValid: false, error: 'Datos incompletos o inválidos.' };
        }
        
        if (quote.currency === 'VES' && (!rateToUse || rateToUse <= 0)) {
            return { ...quote, convertedPrice: null, isValid: false, error: 'Falta Tasa de Cambio para VES a USD.' };
        }

        let convertedPrice: number | null = quote.unitPrice;
        let finalRate = quote.exchangeRate; // Start with the rate explicitly set on the quote

        if (quote.currency === comparisonBaseCurrency) {
            // USD -> USD
        } else if (quote.currency === 'VES' && comparisonBaseCurrency === 'USD') {
            if (rateToUse && rateToUse > 0) {
                convertedPrice = quote.unitPrice / rateToUse;
                finalRate = rateToUse; // Use the rate that was actually used (local or global)
            } else {
                return { ...quote, convertedPrice: null, isValid: false, error: 'Falta Tasa de Cambio para VES a USD.' };
            }
        } 
        
        if (convertedPrice === null || isNaN(convertedPrice)) {
             return { ...quote, convertedPrice: null, isValid: false, error: 'Error de cálculo.' };
        }
        
        // Ensure the final rate used for conversion is included in the result object
        return { ...quote, convertedPrice: convertedPrice, isValid: true, error: null, exchangeRate: finalRate };
      });

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
  }, [materialsToCompare, exchangeRate]);
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
              baseCurrency={comparisonBaseCurrency}
              globalExchangeRate={exchangeRate}
              onAddQuoteEntry={handleAddQuoteEntry}
              onRemoveQuoteEntry={handleRemoveQuoteEntry}
              onQuoteChange={handleQuoteChange}
              onRemoveMaterial={handleRemoveMaterial}
            />
            {/* Individual PDF Download Button */}
            <div className="flex justify-end mt-2">
                <QuoteComparisonPDFButton
                    comparisonResults={[materialComp]}
                    baseCurrency={comparisonBaseCurrency}
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

  const renderExchangeRateInput = () => {
    if (globalInputCurrency === 'USD') {
        // If input currency is USD, the exchange rate is irrelevant for the global setting
        return (
            <div className="text-sm text-muted-foreground mt-1">
                Tasa no requerida si la moneda de ingreso es USD.
            </div>
        );
    }

    // If input currency is VES, show rate selection
    return (
        <div className="space-y-2">
            <Select value={rateSource} onValueChange={(value) => setRateSource(value as 'custom' | 'daily')}>
                <SelectTrigger id="rate-source">
                    <SelectValue placeholder="Selecciona fuente de tasa" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="daily" disabled={dailyRate === undefined}>
                        Tasa del día {dailyRate ? `(${dailyRate.toFixed(2)} VES/USD)` : '(Cargando...)'}
                    </SelectItem>
                    <SelectItem value="custom">Tasa personalizada</SelectItem>
                </SelectContent>
            </Select>

            {rateSource === 'daily' && (
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        step="0.01"
                        value={dailyRate || ''}
                        placeholder="Tasa del día"
                        disabled
                        className="bg-gray-100 dark:bg-gray-700"
                    />
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={fetchDailyRate} 
                        disabled={isLoadingRate}
                    >
                        {isLoadingRate ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                </div>
            )}

            {rateSource === 'custom' && (
                <Input
                    id="exchange-rate"
                    type="number"
                    step="0.01"
                    placeholder="Ingresa tasa personalizada"
                    value={exchangeRate || ''}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || undefined)}
                />
            )}
            <p className="text-xs text-muted-foreground mt-1">
                Tasa actual utilizada: {exchangeRate ? exchangeRate.toFixed(4) : 'N/A'} VES/USD
            </p>
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
          <CardTitle className="text-procarni-primary flex items-center">
            <Scale className="mr-2 h-6 w-6" />
            Comparación Inmediata de Cotizaciones
          </CardTitle>
          <CardDescription>
            Compara precios de diferentes proveedores para múltiples materiales en tiempo real.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <h3 className="text-md font-semibold mb-3 flex items-center text-procarni-primary">
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Materiales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                    <Label htmlFor="material-search">Buscar Material</Label>
                    <SmartSearch
                        placeholder="Buscar material por nombre o código"
                        onSelect={handleMaterialSelect}
                        fetchFunction={searchMaterials}
                        displayValue={newMaterialQuery}
                        selectedId={selectedMaterialToAdd?.id}
                    />
                </div>
                <Button 
                    onClick={handleAddMaterial} 
                    disabled={!selectedMaterialToAdd}
                    className="bg-procarni-secondary hover:bg-green-700 h-10"
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> Añadir a la Comparación
                </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-start p-4 border rounded-lg">
            <div>
              <Label htmlFor="global-input-currency">Moneda Global de Ingreso</Label>
              <Select value={globalInputCurrency} onValueChange={(value) => setGlobalInputCurrency(value as 'USD' | 'VES')}>
                <SelectTrigger id="global-input-currency">
                  <SelectValue placeholder="Selecciona moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD (Dólares)</SelectItem>
                  <SelectItem value="VES">VES (Bolívares)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Moneda por defecto para nuevas cotizaciones.</p>
            </div>
            <div>
              <Label htmlFor="exchange-rate">Tasa de Cambio Global (USD/VES)</Label>
              {renderExchangeRateInput()}
            </div>
            <div className="flex flex-col justify-end items-end h-full">
                <QuoteComparisonPDFButton
                    comparisonResults={comparisonResults}
                    baseCurrency={comparisonBaseCurrency}
                    globalExchangeRate={exchangeRate}
                    label="Descargar Reporte General"
                    variant="default"
                />
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-4 flex items-center text-procarni-primary">
            <DollarSign className="mr-2 h-5 w-5" />
            Resultados de la Comparación (Base: USD)
          </h3>
          {renderComparisonTable()}
          
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default QuoteComparison;