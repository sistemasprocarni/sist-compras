import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, Instagram, PlusCircle, ShoppingCart, FileText } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { getSupplierDetails, getFichaTecnicaBySupplierAndProduct } from '@/integrations/supabase/data';
import { showError } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile'; // Importar hook de móvil
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FichaTecnica } from '@/integrations/supabase/types';

const SupplierDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentFichaUrl, setCurrentFichaUrl] = useState('');
  const [currentFichaTitle, setCurrentFichaTitle] = useState('');

  const { data: supplier, isLoading, error } = useQuery({
    queryKey: ['supplierDetails', id],
    queryFn: async () => {
      if (!id) throw new Error('Supplier ID is missing.');
      const details = await getSupplierDetails(id);
      if (!details) throw new Error('Supplier not found.');
      return details;
    },
    enabled: !!id,
  });

  const formatPhoneNumberForWhatsApp = (phone: string) => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (!digitsOnly.startsWith('58')) {
      return `58${digitsOnly}`;
    }
    return digitsOnly;
  };

  const handleGenerateSC = () => {
    if (!supplier) return;
    // Navigate to the quote request creation page with the supplier data
    navigate('/generate-quote', {
      state: {
        supplier: supplier,
      },
    });
  };

  const handleGenerateOC = () => {
    if (!supplier) return;
    // Navigate to the purchase order creation page with the supplier data
    navigate('/generate-po', {
      state: {
        supplier: supplier,
      },
    });
  };

  const handleViewFicha = async (materialName: string) => {
    if (!supplier?.id) {
      showError('ID de proveedor no disponible.');
      return;
    }

    const ficha: FichaTecnica | null = await getFichaTecnicaBySupplierAndProduct(supplier.id, materialName);

    if (ficha && ficha.storage_url) {
      setCurrentFichaUrl(ficha.storage_url);
      setCurrentFichaTitle(`Ficha Técnica: ${materialName}`);
      setIsViewerOpen(true);
    } else {
      showError(`No se encontró una ficha técnica para el material "${materialName}" de este proveedor.`);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Cargando detalles del proveedor...
      </div>
    );
  }

  if (error) {
    showError(error.message);
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        Error: {error.message}
        <Button asChild variant="link" className="mt-4">
          <Link to="/supplier-management">Volver a la gestión de proveedores</Link>
        </Button>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Proveedor no encontrado.
        <Button asChild variant="link" className="mt-4">
          <Link to="/supplier-management">Volver a la gestión de proveedores</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button onClick={handleGenerateSC} className="bg-procarni-secondary hover:bg-green-700">
            <PlusCircle className="mr-2 h-4 w-4" /> Generar SC
          </Button>
          <Button onClick={handleGenerateOC} className="bg-blue-600 hover:bg-blue-700">
            <ShoppingCart className="mr-2 h-4 w-4" /> Generar OC
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">{supplier.name}</CardTitle>
          <CardDescription>Detalles completos del proveedor.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <p><strong>Código:</strong> {supplier.code || 'N/A'}</p>
            <p><strong>RIF:</strong> {supplier.rif}</p>
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
            <p className="md:col-span-2"><strong>Dirección:</strong> {supplier.address || 'N/A'}</p>
            <p>
              <strong>Términos de Pago:</strong>{' '}
              {supplier.payment_terms === 'Otro' && supplier.custom_payment_terms
                ? supplier.custom_payment_terms
                : supplier.payment_terms}
            </p>
            <p><strong>Días de Crédito:</strong> {supplier.credit_days}</p>
            <p><strong>Estado:</strong> {supplier.status}</p>
          </div>

          <h3 className="text-lg font-semibold mt-8 mb-4">Materiales Ofrecidos</h3>
          {supplier.materials && supplier.materials.length > 0 ? (
            isMobile ? (
              <div className="space-y-3">
                {supplier.materials.map((sm) => (
                  <Card key={sm.id} className="p-3">
                    <p className="font-semibold text-procarni-primary">{sm.materials.name}</p>
                    <div className="text-sm mt-1 space-y-0.5">
                      <p><strong>Código:</strong> {sm.materials.code || 'N/A'}</p>
                      <p><strong>Categoría:</strong> {sm.materials.category || 'N/A'}</p>
                      <p><strong>Especificación:</strong> {sm.specification || 'N/A'}</p>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => handleViewFicha(sm.materials.name)}>
                        <FileText className="mr-2 h-4 w-4" /> Ver Ficha Técnica
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre del Material</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Especificación del Proveedor</TableHead>
                      <TableHead className="text-right">Ficha Técnica</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplier.materials.map((sm) => (
                      <TableRow key={sm.id}>
                        <TableCell>{sm.materials.code || 'N/A'}</TableCell>
                        <TableCell>{sm.materials.name}</TableCell>
                        <TableCell>{sm.materials.category || 'N/A'}</TableCell>
                        <TableCell>{sm.specification || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleViewFicha(sm.materials.name)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <p className="text-muted-foreground">Este proveedor no tiene materiales registrados.</p>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />

      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="max-w-5xl h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{currentFichaTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {currentFichaUrl ? (
              <iframe src={currentFichaUrl} className="w-full h-full border-none" title="PDF Viewer"></iframe>
            ) : (
              <div className="text-center text-destructive">No se pudo cargar el documento.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierDetails;