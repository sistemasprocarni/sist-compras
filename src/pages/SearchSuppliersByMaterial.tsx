import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MadeWithDyad } from '@/components/made-with-dyad';
import SmartSearch from '@/components/SmartSearch';
import { searchMaterials, getSuppliersByMaterial } from '@/integrations/supabase/data';
import { showError } from '@/utils/toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom'; // Import useSearchParams
import { Button } from '@/components/ui/button';
import { Phone, Instagram, PlusCircle, Eye, ArrowLeft, FileText, ShoppingCart, CheckCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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
  phone_2?: string;
  instagram?: string;
  payment_terms: string;
  credit_days: number;
  status: string;
  specification: string;
}

const SearchSuppliersByMaterial = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierResult[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string | null>(null);

  const formatPhoneNumberForWhatsApp = (phone: string) => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (!digitsOnly.startsWith('58')) {
      return `58${digitsOnly}`;
    }
    return digitsOnly;
  };

  const fetchSuppliers = async (materialId: string) => {
    setIsLoadingSuppliers(true);
    setSuppliers([]);
    try {
      const fetchedSuppliers = await getSuppliersByMaterial(materialId);
      setSuppliers(fetchedSuppliers);
    } catch (error) {
      console.error('Error fetching suppliers by material:', error);
      showError('Error al cargar los proveedores para este material.');
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  const handleMaterialSelect = async (material: Material) => {
    setSelectedMaterial(material);
    setInitialQuery(null); 
    await fetchSuppliers(material.id);
  };

  useEffect(() => {
    const queryFromUrl = searchParams.get('query');
    if (queryFromUrl) {
      setInitialQuery(queryFromUrl);
      const searchAndLoad = async () => {
        try {
          const results = await searchMaterials(queryFromUrl);
          if (results.length > 0) {
            const material = results[0];
            setSelectedMaterial(material);
            await fetchSuppliers(material.id);
          } else {
            showError(`No se encontró un material que coincida con "${queryFromUrl}".`);
          }
        } catch (error) {
          console.error('Error searching material on initial load:', error);
          showError('Error al buscar el material inicial.');
        }
      };
      searchAndLoad();
    }
  }, [searchParams]);

  const handleCreateQuoteRequest = (supplier: SupplierResult) => {
    if (!selectedMaterial) {
      showError('No se ha seleccionado un material.');
      return;
    }
    navigate('/generate-quote', {
      state: {
        supplier: supplier,
        material: selectedMaterial,
      },
    });
  };
  
  const handleCreatePurchaseOrder = (supplier: SupplierResult) => {
    if (!selectedMaterial) {
      showError('No se ha seleccionado un material.');
      return;
    }
    navigate('/generate-po', {
      state: {
        supplier: supplier,
        material: selectedMaterial,
      },
    });
  };

  const handleViewSupplierDetails = (supplier: SupplierResult) => {
    navigate(`/suppliers/${supplier.id}`);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>
      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="text-procarni-primary text-2xl">Búsqueda de Proveedores por Material</CardTitle>
          <CardDescription>
            Selecciona un material para encontrar los proveedores asociados y sus especificaciones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-2">
            <label className="text-sm font-medium">Material a Buscar</label>
            <SmartSearch
              placeholder="Buscar material por nombre o código"
              onSelect={handleMaterialSelect}
              fetchFunction={searchMaterials}
              displayValue={selectedMaterial?.name || initialQuery || ''} 
              selectedId={selectedMaterial?.id}
            />
            {selectedMaterial && (
              <div className="p-3 bg-muted/50 rounded-md border border-procarni-primary/20">
                <p className="text-sm font-semibold text-procarni-primary">
                  Material Seleccionado: {selectedMaterial.name} ({selectedMaterial.code})
                </p>
                {selectedMaterial.category && <p className="text-xs text-muted-foreground">Categoría: {selectedMaterial.category}</p>}
              </div>
            )}
          </div>

          {isLoadingSuppliers && (
            <div className="text-center text-muted-foreground p-8">Cargando proveedores...</div>
          )}

          {!isLoadingSuppliers && selectedMaterial && suppliers.length === 0 && (
            <div className="text-center text-muted-foreground p-8 border rounded-lg">
              No se encontraron proveedores asociados para este material.
            </div>
          )}

          {!isLoadingSuppliers && suppliers.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-4 text-procarni-secondary">
                Resultados ({suppliers.length})
              </h3>
              <Accordion type="single" collapsible className="w-full">
                {suppliers.map((supplier) => (
                  <AccordionItem key={supplier.id} value={supplier.id} className="border-b border-procarni-primary/10">
                    <AccordionTrigger className="text-left hover:bg-procarni-primary/5 transition-colors">
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-lg text-gray-800 dark:text-white">{supplier.name}</span>
                        <span className="text-sm text-muted-foreground">RIF: {supplier.rif} | Estado: {supplier.status}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-gray-50 dark:bg-gray-800 rounded-b-md border-t border-procarni-primary/10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="font-semibold text-procarni-primary">Detalles de Contacto</p>
                          <Separator className="my-1" />
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
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-procarni-primary">Detalles de Material y Pago</p>
                          <Separator className="my-1" />
                          <p className="p-2 bg-white dark:bg-gray-700 rounded-md border border-procarni-secondary/30">
                            <strong className="text-procarni-secondary">Especificación del Material:</strong> {supplier.specification || 'N/A'}
                          </p>
                          <p><strong>Términos de Pago:</strong> {supplier.payment_terms}</p>
                          <p><strong>Días de Crédito:</strong> {supplier.credit_days}</p>
                        </div>
                      </div>
                      <div className="mt-6 flex justify-end gap-3 flex-wrap">
                        <Button 
                          variant="outline" 
                          className="bg-procarni-secondary text-white hover:bg-green-700"
                          onClick={() => handleCreateQuoteRequest(supplier)}
                        >
                          <FileText className="mr-2 h-4 w-4" /> Crear Solicitud (SC)
                        </Button>
                        <Button 
                          variant="outline" 
                          className="bg-blue-600 text-white hover:bg-blue-700"
                          onClick={() => handleCreatePurchaseOrder(supplier)}
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" /> Crear Orden (OC)
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleViewSupplierDetails(supplier)}
                        >
                          <Eye className="mr-2 h-4 w-4" /> Ver Perfil
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