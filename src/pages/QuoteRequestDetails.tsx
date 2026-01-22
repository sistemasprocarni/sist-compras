import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, FileText, Download, ShoppingCart } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { getQuoteRequestDetails } from '@/integrations/supabase/data';
import { showError } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import QuoteRequestPreviewModal from '@/components/QuoteRequestPreviewModal';
import PDFDownloadButton from '@/components/PDFDownloadButton'; // New import
import { format } from 'date-fns';

interface QuoteRequestItem {
  id: string;
  material_name: string;
  description?: string;
  unit?: string;
  quantity: number;
  is_exempt?: boolean;
}

interface SupplierDetails {
  id: string;
  name: string;
  rif: string;
  email?: string;
  phone?: string;
  phone_2?: string;
  instagram?: string;
  address?: string;
}

interface CompanyDetails {
  id: string;
  name: string;
  logo_url?: string;
  fiscal_data?: any;
}

interface QuoteRequestDetailsData {
  id: string;
  supplier_id: string;
  suppliers: SupplierDetails;
  company_id: string;
  companies: CompanyDetails;
  currency: string;
  exchange_rate?: number | null;
  status: string;
  created_at: string;
  created_by?: string;
  user_id: string;
  quote_request_items: QuoteRequestItem[];
}

const QuoteRequestDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: request, isLoading, error } = useQuery<QuoteRequestDetailsData | null>({
    queryKey: ['quoteRequestDetails', id],
    queryFn: async () => {
      if (!id) throw new Error('Quote Request ID is missing.');
      const details = await getQuoteRequestDetails(id);
      if (!details) throw new Error('Quote Request not found.');
      return details;
    },
    enabled: !!id,
  });

  const handleConvertToPurchaseOrder = () => {
    if (!request) return;
    // Navigate to the purchase order creation page with the quote request data
    navigate('/generate-po', {
      state: {
        quoteRequest: request,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Cargando detalles de la solicitud de cotización...
      </div>
    );
  }

  if (error) {
    showError(error.message);
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        Error: {error.message}
        <Button asChild variant="link" className="mt-4">
          <Link to="/quote-request-management">Volver a la gestión de solicitudes</Link>
        </Button>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Solicitud de cotización no encontrada.
        <Button asChild variant="link" className="mt-4">
          <Link to="/quote-request-management">Volver a la gestión de solicitudes</Link>
        </Button>
      </div>
    );
  }

  const fileName = `SC_${request.suppliers?.name?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_${format(new Date(request.created_at), 'dd-MM-yyyy')}.pdf`;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <div className="flex gap-2">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <FileText className="mr-2 h-4 w-4" /> Previsualizar PDF
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl h-[95vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Previsualización de Solicitud de Cotización</DialogTitle>
              </DialogHeader>
              <QuoteRequestPreviewModal
                requestId={request.id}
                onClose={() => setIsModalOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <PDFDownloadButton
            requestId={request.id}
            fileName={fileName}
            endpoint="generate-qr-pdf"
            label="Descargar PDF"
          />
          <Button asChild className="bg-procarni-secondary hover:bg-green-700">
            <Link to={`/quote-requests/edit/${request.id}`}>
              <Edit className="mr-2 h-4 w-4" /> Editar Solicitud
            </Link>
          </Button>
          <Button onClick={handleConvertToPurchaseOrder} className="bg-blue-600 hover:bg-blue-700">
            <ShoppingCart className="mr-2 h-4 w-4" /> Convertir a OC
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Solicitud de Cotización #{request.id.substring(0, 8)}</CardTitle>
          <CardDescription>Detalles completos de la solicitud de cotización.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
            <p><strong>Proveedor:</strong> {request.suppliers?.name || 'N/A'}</p>
            <p><strong>Empresa:</strong> {request.companies?.name || 'N/A'}</p>
            <p><strong>Moneda:</strong> {request.currency}</p>
            {request.exchange_rate && <p><strong>Tasa de Cambio:</strong> {request.exchange_rate.toFixed(2)}</p>}
            <p><strong>Fecha de Creación:</strong> {new Date(request.created_at).toLocaleDateString()} {new Date(request.created_at).toLocaleTimeString()}</p>
            <p><strong>Creado por:</strong> {request.created_by || 'N/A'}</p>
          </div>

          <h3 className="text-lg font-semibold mt-8 mb-4">Ítems Solicitados</h3>
          {request.quote_request_items && request.quote_request_items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Descripción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {request.quote_request_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.material_name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit || 'N/A'}</TableCell>
                    <TableCell>{item.description || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">Esta solicitud no tiene ítems registrados.</p>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default QuoteRequestDetails;