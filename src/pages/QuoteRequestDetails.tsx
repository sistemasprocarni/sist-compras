import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, FileText, Download, ShoppingCart, Mail } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { getQuoteRequestDetails } from '@/integrations/supabase/data';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import QuoteRequestPreviewModal from '@/components/QuoteRequestPreviewModal';
import PDFDownloadButton from '@/components/PDFDownloadButton';
import WhatsAppSenderButton from '@/components/WhatsAppSenderButton';
import { format } from 'date-fns';
import EmailSenderModal from '@/components/EmailSenderModal';
import { useSession } from '@/components/SessionContextProvider';
import { useIsMobile } from '@/hooks/use-mobile'; // Importar hook de móvil

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
  const { session } = useSession();
  const isMobile = useIsMobile();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

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
    navigate('/generate-po', {
      state: {
        quoteRequest: request,
      },
    });
  };

  const generateFileName = () => {
    if (!request) return '';
    const supplierName = request.suppliers?.name?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'Proveedor';
    const date = new Date(request.created_at).toLocaleDateString('es-VE').replace(/\//g, '-');
    // Formato: SC_ID_PROVEEDOR_FECHA.pdf
    return `SC_${request.id.substring(0, 8)}_${supplierName}_${date}.pdf`;
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log(`[QuoteRequestDetails] Base64 conversion complete. Length: ${result.length}`);
        resolve(result);
      };
      reader.onerror = (error) => {
        console.error('[QuoteRequestDetails] Error converting blob to base64:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  };

  const handleSendEmail = async (customMessage: string, sendWhatsApp: boolean, phone?: string) => {
    if (!session?.user?.email || !request) return;

    const toastId = showLoading('Generando PDF y enviando correo...');

    try {
      // 1. Generate PDF
      console.log(`[QuoteRequestDetails] Generating PDF for request: ${request.id}`);
      const pdfResponse = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/generate-qr-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId: request.id }),
      });

      if (!pdfResponse.ok) {
        const errorData = await pdfResponse.json();
        throw new Error(errorData.error || 'Error al generar el PDF.');
      }

      const pdfBlob = await pdfResponse.blob();
      console.log(`[QuoteRequestDetails] PDF blob size: ${pdfBlob.size} bytes`);
      
      const pdfBase64 = await blobToBase64(pdfBlob);
      console.log(`[QuoteRequestDetails] PDF base64 length: ${pdfBase64.length}`);

      // 2. Send Email
      const emailBody = `
        <h2>Solicitud de Cotización #${request.id.substring(0, 8)}</h2>
        <p><strong>Empresa:</strong> ${request.companies?.name}</p>
        <p><strong>Proveedor:</strong> ${request.suppliers?.name}</p>
        <p><strong>Fecha:</strong> ${new Date(request.created_at).toLocaleDateString('es-VE')}</p>
        ${customMessage ? `<p><strong>Mensaje:</strong><br>${customMessage.replace(/\n/g, '<br>')}</p>` : ''}
        <p>Se adjunta el PDF con los detalles de la solicitud.</p>
      `;

      console.log(`[QuoteRequestDetails] Sending email to: ${request.suppliers?.email}`);
      const emailResponse = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: request.suppliers?.email,
          subject: `Solicitud de Cotización #${request.id.substring(0, 8)} - ${request.companies?.name}`,
          body: emailBody,
          attachmentBase64: pdfBase64,
          attachmentFilename: generateFileName(),
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        throw new Error(errorData.error || 'Error al enviar el correo.');
      }

      // 3. Send WhatsApp (if requested)
      if (sendWhatsApp && phone) {
        const formattedPhone = phone.replace(/\D/g, '');
        const finalPhone = formattedPhone.startsWith('58') ? formattedPhone : `58${formattedPhone}`;
        const whatsappMessage = `Hola, te he enviado por correo la Solicitud de Cotización #${request.id.substring(0, 8)} de ${request.companies?.name}. Por favor, revisa tu bandeja de entrada.`;
        const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, '_blank');
      }

      dismissToast(toastId);
      showSuccess('Correo enviado exitosamente.');
      setIsEmailModalOpen(false);

    } catch (error: any) {
      console.error('[QuoteRequestDetails] Error sending email:', error);
      dismissToast(toastId);
      showError(error.message || 'Error al enviar el correo.');
    }
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

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <div className="flex gap-2 flex-wrap justify-end">
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
                fileName={generateFileName()} // Pasar el nombre de archivo generado
              />
            </DialogContent>
          </Dialog>
          <PDFDownloadButton
            requestId={request.id}
            fileNameGenerator={generateFileName}
            endpoint="generate-qr-pdf"
            label="Descargar PDF"
          />
          <WhatsAppSenderButton
            recipientPhone={request.suppliers?.phone}
            documentType="Solicitud de Cotización"
            documentId={request.id}
            documentNumber={request.id.substring(0, 8)}
            companyName={request.companies?.name || ''}
          />
          <Button
            onClick={() => setIsEmailModalOpen(true)}
            disabled={!request.suppliers?.email}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Mail className="mr-2 h-4 w-4" /> Enviar por Correo
          </Button>
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
            isMobile ? (
              <div className="space-y-3">
                {request.quote_request_items.map((item) => (
                  <Card key={item.id} className="p-3">
                    <p className="font-semibold text-procarni-primary">{item.material_name}</p>
                    <div className="text-sm mt-1 space-y-0.5">
                      <p><strong>Cantidad:</strong> {item.quantity} {item.unit || 'N/A'}</p>
                      <p><strong>Descripción:</strong> {item.description || 'N/A'}</p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
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
              </div>
            )
          ) : (
            <p className="text-muted-foreground">Esta solicitud no tiene ítems registrados.</p>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />

      <EmailSenderModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSend={handleSendEmail}
        recipientEmail={request.suppliers?.email || ''}
        recipientPhone={request.suppliers?.phone}
        documentType="Solicitud de Cotización"
        documentId={request.id}
      />
    </div>
  );
};

export default QuoteRequestDetails;