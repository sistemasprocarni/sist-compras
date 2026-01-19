import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MadeWithDyad } from '@/components/made-with-dyad';
import SmartSearch from '@/components/SmartSearch';
import { searchMaterials, getSuppliersByMaterial } from '@/integrations/supabase/data';
import { showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Phone, Instagram } from 'lucide-react'; // Importar iconos

interface Material {
  id: string;
  name: string;
  code: string;
  category?: string;
}

interface SupplierResult {
  id: string;
  name: string;
  rif: string;
  email?: string;
  phone?: string;
  phone_2?: string; // Añadido
  instagram?: string; // Añadido
  payment_terms: string;
  credit_days: number;
  status: string;
  specification: string;
}

const SearchSuppliersByMaterial = () => {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierResult[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);

  const formatPhoneNumberForWhatsApp = (phone: string) => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (!digitsOnly.startsWith('58')) {
      return `58${digitsOnly}`;
    }
    return digitsOnly;
  };

  const handleMaterialSelect = async (material: Material) => {
    setSelectedMaterial(material);
    setIsLoadingSuppliers(true);
    setSuppliers([]);
    try {
      const fetchedSuppliers = await getSuppliersByMaterial(material.id);
      setSuppliers(fetchedSuppliers);
    } catch (error) {
      console.error('Error fetching suppliers by material:', error);
      showError('Error al cargar los proveedores para este material.');
    } finally {
      setIsLoadingSuppliers(false);
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
              placeholder="Buscar material por nombre o código"
              onSelect={handleMaterialSelect}
              fetchFunction={searchMaterials}
              displayValue={selectedMaterial?.name || ''}
            />
            {selectedMaterial && (
              <p className="text-sm text-muted-foreground mt-2">
                Material seleccionado: <span className="font-semibold">{selectedMaterial.name} ({selectedMaterial.code})</span>
                {selectedMaterial.category && ` - Categoría: ${selectedMaterial.category}`}
              </p>
            )}
          </div>

          {isLoadingSuppliers && (
            <div className="text-center text-muted-foreground">Cargando proveedores...</div>
          )}

          {!isLoadingSuppliers && selectedMaterial && suppliers.length === 0 && (
            <div className="text-center text-muted-foreground">No se encontraron proveedores para este material.</div>
          )}

          {!isLoadingSuppliers && suppliers.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Proveedores que ofrecen "{selectedMaterial?.name}"</h3>
              <Accordion type="single" collapsible className="w-full">
                {suppliers.map((supplier) => (
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
                        <p><strong>Estado:</strong> {supplier.status}</p>
                        <p><strong>Especificación del Material:</strong> {supplier.specification || 'N/A'}</p>
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