import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, FileText, Download, Mail } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { getPurchaseOrderDetails } from '@/integrations/supabase/data';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import PurchaseOrderPDFViewer from '@/components/PurchaseOrderPDFViewer';
import PDFDownloadButton from '@/components/PDFDownloadButton';
import WhatsAppSenderButton from '@/components/WhatsAppSenderButton';
import { calculateTotals, numberToWords } from '@/utils/calculations';
import { format } from 'date-fns';
import EmailSenderModal from '@/components/EmailSenderModal';
import { useSession } from '@/components/SessionContextProvider';

interface PurchaseOrderItem {
  id: string;
  material_name: string;
  supplier_code?: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  is_exempt: boolean;
}

interface SupplierDetails {
  id: string;
  name: string;
  rif: string;
  email?: string;
  phone?: string;
  payment_terms: string;
}

interface CompanyDetails {
  id: string;
  name: string;
  rif: string;
}

interface PurchaseOrderDetailsData {
  id: string;
  sequence_number?: number;
  supplier_id: string;
  suppliers: SupplierDetails;
  company_id: string;
  companies: CompanyDetails;
  currency: 'USD' | 'VES';
  exchange_rate?: number | null;
  status: string;
  created_at: string;
  created_by?: string;
  user_id: string;
  purchase_order_items: PurchaseOrderItem[];
  delivery_date?: string;
  payment_terms?: string;
  custom_payment_terms?: string | null;
  credit_days?: number;
  observations?: string;
}

const formatSequenceNumber = (sequence?: number, dateString?: string): string => {
  if (!sequence) return 'N/A';
  
  const date = dateString ? new Date(dateString) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');
  
  return `OC-${year}-${month}-${seq}`;
};

const PurchaseOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const { data: order, isLoading, error } = useQuery<PurchaseOrderDetailsData | null>({
    queryKey: ['purchaseOrderDetails', id],
    queryFn: async () => {
      if (!id) throw new Error('Purchase Order ID is missing.');
      const details = await getPurchaseOrderDetails(id);
      if (!details) throw new Error('Purchase Order not found.');
      return details as PurchaseOrderDetailsData;
    },
    enabled: !!id,
  });

  const itemsForCalculation = order?.purchase_order_items.map(item => ({
    quantity: item.quantity,
    unit_price: item.unit_price,
    tax_rate: item.tax_rate,
    is_exempt: item.is_exempt,
  })) || [];

  const totals = calculateTotals(itemsForCalculation);
  const amountInWords = order ? numberToWords(totals.total, order.currency) : '';

  const displayPaymentTerms = () => {
    if (order?.payment_terms === 'Otro' && order.custom_payment_terms) {
      return order.custom_payment_terms;
    }
    if (order?.payment_terms === 'Crédito' && order.credit_days) {
      return `Crédito (${order.credit_days} días)`;
    }
    return order?.payment_terms || 'N/A';
  };

  const generateFileName = () => {
    if (!order) return '';
    const sequence = formatSequenceNumber(order.sequence_number, order.created_at);
    const supplierName = order.suppliers?.name?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'Proveedor';
    return `${sequence}_${supplierName}.pdf`;
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log(`[PurchaseOrderDetails] Base64 conversion complete. Length: ${result.length}`);
        resolve(result);
      };
      reader.onerror = (error) => {
        console.error('[PurchaseOrderDetails] Error converting blob to base64:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  };

  const handleSendEmail = async (customMessage: string, sendWhatsApp: boolean, phone?: string) => {
    if (!session?.user?.email || !order) return;

    const toastId = showLoading('Generando PDF y enviando correo...');

    try {
      // 1. Generate PDF
      console.log(`[PurchaseOrderDetails] Generating PDF for order: ${order.id}`);
      const pdfResponse = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/generate-po-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: order.id }),
      });

      if (!pdfResponse.ok) {
        const errorData = await pdfResponse.json();
        throw new Error(errorData.error || 'Error al generar el PDF.');
      }

      const pdfBlob = await pdfResponse.blob();
      console.log(`[PurchaseOrderDetails] PDF blob size: ${pdfBlob.size} bytes`);
      
      const pdfBase64 = await blobToBase64(pdfBlob);
      console.log(`[PurchaseOrderDetails] PDF base64 length: ${pdfBase64.length}`);

      // 2. Send Email
      const emailBody = `
        <h2>Orden de Compra #${formatSequenceNumber(order.sequence_number, order.created_at)}</h2>
        <p><strong>Empresa:</strong> ${order.companies?.name}</p>
        <p><strong>Proveedor:</strong> ${order.suppliers?.name}</p>
        <p><strong>Fecha de Entrega:</strong> ${order.delivery_date ? format(new Date(order.delivery_date), 'PPP') : 'N/A'}</p>
        <p><strong>Condición de Pago:</strong> ${displayPaymentTerms()}</p>
        ${customMessage ? `<p><strong>Mensaje:</strong><br>${customMessage.replace(/\n/g, '<br>')}</p>` : ''}
        <p>Se adjunta el PDF con los detalles de la orden de compra.</p>
      `;

      console.log(`[PurchaseOrderDetails] Sending email to: ${order.suppliers?.email}`);
      const emailResponse = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: order.suppliers?.email,
          subject: `Orden de Compra #${formatSequenceNumber(order.sequence_number, order.created_at)} - ${order.companies?.name}`,
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
        const whatsappMessage = `Hola, te he enviado por correo la Orden de Compra #${formatSequenceNumber(order.sequence_number, order.created_at)} de ${order.companies?.name}. Por favor, revisa tu bandeja de entrada.`;
        const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, '_blank');
      }

      dismissToast(toastId);
      showSuccess('Correo enviado exitosamente.');
      setIsEmailModalOpen(false);

    } catch (error: any) {
      console.error('[PurchaseOrderDetails] Error sending email:', error);
      dismissToast(toastId);
      showError(error.message || 'Error al enviar el correo.');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Cargando detalles de la orden de compra...
      </div>
    );
  }

  if (error) {
    showError(error.message);
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        Error: {error.message}
        <Button asChild variant="link" className="mt-4">
          <Link to="/purchase-order-management">Volver a la gestión de órdenes</Link>
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Orden de compra no encontrada.
        <Button asChild variant="link" className="mt-4">
          <Link to="/purchase-order-management">Volver a la gestión de órdenes</Link>
        </Button>
      </div>
    );
  }

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
                <DialogTitle>Previsualización de Orden de Compra</DialogTitle>
              </DialogHeader>
              <PurchaseOrderPDFViewer
                orderId={order.id}
                onClose={() => setIsModalOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <PDFDownloadButton
            orderId={order.id}
            fileNameGenerator={generateFileName}
            endpoint="generate-po-pdf"
            label="Descargar PDF"
          />
          <WhatsAppSenderButton
            recipientPhone={order.suppliers?.phone}
            documentType="Orden de Compra"
            documentId={order.id}
            documentNumber={formatSequenceNumber(order.sequence_number, order.created_at)}
            companyName={order.companies?.name || ''}
            isPurchaseOrder={true}
          />
          <Button
            onClick={() => setIsEmailModalOpen(true)}
            disabled={!order.suppliers?.email}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Mail className="mr-2 h-4 w-4" /> Enviar por Correo
          </Button>
          <Button asChild className="bg-procarni-secondary hover:bg-green-700">
            <Link to={`/purchase-orders/edit/${order.id}`}>
              <Edit className="mr-2 h-4 w-4" /> Editar Orden
            </Link>
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Orden de Compra {formatSequenceNumber(order.sequence_number, order.created_at)}</CardTitle>
          <CardDescription>Detalles completos de la orden de compra.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-6">
            <p><strong>Proveedor:</strong> {order.suppliers?.name || 'N/A'}</p>
            <p><strong>Empresa:</strong> {order.companies?.name || 'N/A'}</p>
            <p><strong>Moneda:</strong> {order.currency}</p>
            {order.exchange_rate && <p><strong>Tasa de Cambio:</strong> {order.exchange_rate.toFixed(2)}</p>}
            <p><strong>Fecha de Creación:</strong> {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString()}</p>
            <p><strong>Fecha de Entrega:</strong> {order.delivery_date ? format(new Date(order.delivery_date), 'PPP') : 'N/A'}</p>
            <p><strong>Condición de Pago:</strong> {displayPaymentTerms()}</p>
            <p><strong>Creado por:</strong> {order.created_by || 'N/A'}</p>
          </div>

          {order.observations && (
            <div className="mb-6 p-3 border rounded-md bg-muted/50">
              <p className="font-semibold text-sm mb-1">Observaciones:</p>
              <p className="text-sm whitespace-pre-wrap">{order.observations}</p>
            </div>
          )}

          <h3 className="text-lg font-semibold mt-8 mb-4">Ítems de la Orden</h3>
          {order.purchase_order_items && order.purchase_order_items.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Cód. Prov.</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>P. Unitario ({order.currency})</TableHead>
                    <TableHead>Subtotal ({order.currency})</TableHead>
                    <TableHead>IVA ({order.currency})</TableHead>
                    <TableHead>Exento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.purchase_order_items.map((item) => {
                    const subtotal = item.quantity * item.unit_price;
                    const itemIva = item.is_exempt ? 0 : subtotal * item.tax_rate;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.material_name}</TableCell>
                        <TableCell>{item.supplier_code || 'N/A'}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell>{subtotal.toFixed(2)}</TableCell>
                        <TableCell>{itemIva.toFixed(2)}</TableCell>
                        <TableCell>{item.is_exempt ? 'Sí' : 'No'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">Esta orden no tiene ítems registrados.</p>
          )}

          <div className="mt-8 border-t pt-4">
            <div className="flex justify-end items-center mb-2">
              <span className="font-semibold mr-2">Base Imponible:</span>
              <span>{order.currency} {totals.baseImponible.toFixed(2)}</span>
            </div>
            <div className="flex justify-end items-center mb-2">
              <span className="font-semibold mr-2">Monto IVA:</span>
              <span>{order.currency} {totals.montoIVA.toFixed(2)}</span>
            </div>
            <div className="flex justify-end items-center text-xl font-bold">
              <span className="mr-2">TOTAL:</span>
              <span>{order.currency} {totals.total.toFixed(2)}</span>
            </div>
            <p className="text-sm italic mt-2 text-right">({amountInWords})</p>
          </div>
        </CardContent>
      </Card>
      <MadeWithDyad />

      <EmailSenderModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSend={handleSendEmail}
        recipientEmail={order.suppliers?.email || ''}
        recipientPhone={order.suppliers?.phone}
        documentType="Orden de Compra"
        documentId={order.id}
      />
    </div>
  );
};

export default PurchaseOrderDetails;