import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MadeWithDyad } from '@/components/made-with-dyad';
import SmartSearch from '@/components/SmartSearch';
import { searchSuppliersByMaterialNameQuery } from '@/integrations/supabase/data'; // Import the new function
import { showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Phone, Instagram, Search } from 'lucide-react';

// Updated SupplierResult interface to match the data returned by searchSuppliersByMaterialNameQuery
interface SupplierResult {
  id: string;
  name: string;
  rif: string;
  email?: string;
  phone?: string;
  phone_2?: string;
  instagram?: string;
  payment_terms: string;
  credit_days: number;
  status: string;
  specification: string; // This will now come from the search result, indicating the matched material
}

const SearchSuppliersByMaterial = () => {
  const [displayedSuppliers, setDisplayedSuppliers] = useState<SupplierResult[]>([]);
  const [selectedSupplierFromSearch, setSelectedSupplierFromSearch] = useState<SupplierResult | null>(null);

  const formatPhoneNumberForWhatsApp = (phone: string) => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (!digitsOnly.startsWith('58')) {
      return `58${digitsOnly}`;
    }
    return digitsOnly;
  };

  const handleSupplierSelectedFromSearch = (supplier: SupplierResult | null) => {
    setSelectedSupplierFromSearch(supplier);
    if (supplier) {
      // If a supplier is selected, display only that supplier in the accordion
      setDisplayedSuppliers([supplier]);
    } else {
      // If selection is cleared, clear displayed suppliers
      setDisplayedSuppliers([]);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Buscar Proveedores por Material</CardTitle>
          <CardDescription>Encuentra proveedores que ofrecen un material específico.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <SmartSearch
              placeholder="Buscar proveedor por material o código de material"
              onSelect={handleSupplierSelectedFromSearch}
              fetchFunction={searchSuppliersByMaterialNameQuery}
              displayValue={selectedSupplierFromSearch?.name || ''}
              leftIcon={<Search />}
              inputClassName="appearance-none bg-background shadow-none"
            />
            {selectedSupplierFromSearch && (
              <p className="text-sm text-muted-foreground mt-2">
                Proveedor seleccionado: <span className="font-semibold">{selectedSupplierFromSearch.name}</span>
                {selectedSupplierFromSearch.specification && ` - Material: ${selectedSupplierFromSearch.specification}`}
              </p>
            )}
          </div>

          {selectedSupplierFromSearch && displayedSuppliers.length === 0 && (
            <div className="text-center text-muted-foreground">No se encontraron proveedores para este material.</div>
          )}

          {displayedSuppliers.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Resultados de la búsqueda</h3>
              <Accordion type="single" collapsible className="w-full">
                {displayedSuppliers.map((supplier) => (
                  <AccordionItem key={supplier.id} value={supplier.id}>
                    <AccordionTrigger className="text-left">
                      <div className="flex flex-col items-start">
                        <span className="font-bold">{supplier.name}</span>
                        <span className="text-sm text-muted-foreground">RIF: {supplier.rif}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-muted/20 rounded-b-md">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <p><strong>Email:</strong> {supplier.email || 'N/A'}</p>
                        <p>
                          <strong>Teléfono Principal:</strong>{' '}
                          {supplier.phone ? (
                            <a href={`https://wa.me/${formatPhoneNumberForWhatsApp(supplier.phone)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                              {supplier.phone} <Phone className="ml-1 h-3 w-3" />
                            </a>
                          ) : 'N/A'}
                        </p>
                        <p>
                          <strong>Teléfono Secundario:</strong>{' '}
                          {supplier.phone_2 ? (
                            <a href={`https://wa.me/${formatPhoneNumberForWhatsApp(supplier.phone_2)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                              {supplier.phone_2} <Phone className="ml-1 h-3 w-3" />
                            </a>
                          ) : 'N/A'}
                        </p>
                        <p>
                          <strong>Instagram:</strong>{' '}
                          {supplier.instagram ? (
                            <a href={`https://instagram.com/${supplier.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                              {supplier.instagram} <Instagram className="ml-1 h-3 w-3" />
                            </a>
                          ) : 'N/A'}
                        </p>
                        <p><strong>Términos de Pago:</strong> {supplier.payment_terms}</p>
                        <p><strong>Días de Crédito:</strong> {supplier.credit_days}</p>
                        <p><strong>Material Coincidente:</strong> {supplier.specification || 'N/A'}</p>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button asChild variant="outline" className="bg-procarni-secondary text-white hover:bg-green-700 hover:text-white">
                          <Link to={`/suppliers/${supplier.id}`}>Ver Detalles Completos</Link>
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default SearchSuppliersByMaterial;