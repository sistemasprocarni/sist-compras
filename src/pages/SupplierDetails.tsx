import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, Instagram } from 'lucide-react'; // Importar iconos
import { MadeWithDyad } from '@/components/made-with-dyad';
import { getSupplierDetails } from '@/integrations/supabase/data';
import { showError } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const SupplierDetails = () => {
  const { id } = useParams<{ id: string }>();

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
      <Button asChild variant="outline" className="mb-4">
        <Link to="/supplier-management">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la gestión de proveedores
        </Link>
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">{supplier.name}</CardTitle>
          <CardDescription>Detalles completos del proveedor.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <p><strong>Código:</strong> {supplier.code || 'N/A'}</p> {/* New: Display code */}
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
            <p><strong>Dirección:</strong> {supplier.address || 'N/A'}</p>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre del Material</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Especificación del Proveedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.materials.map((sm) => (
                  <TableRow key={sm.id}>
                    <TableCell>{sm.materials.code}</TableCell>
                    <TableCell>{sm.materials.name}</TableCell>
                    <TableCell>{sm.materials.category || 'N/A'}</TableCell>
                    <TableCell>{sm.specification || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">Este proveedor no tiene materiales registrados.</p>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default SupplierDetails;