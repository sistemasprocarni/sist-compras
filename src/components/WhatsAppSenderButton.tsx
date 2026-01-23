import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { showError, showLoading, dismissToast } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';

interface WhatsAppSenderButtonProps {
  recipientPhone?: string;
  documentType: 'Solicitud de Cotización' | 'Orden de Compra';
  documentId: string;
  documentNumber: string;
  companyName: string;
  isPurchaseOrder?: boolean; // Flag to determine which PDF to generate
}

const WhatsAppSenderButton: React.FC<WhatsAppSenderButtonProps> = ({
  recipientPhone,
  documentType,
  documentId,
  documentNumber,
  companyName,
  isPurchaseOrder = false,
}) => {
  const { session } = useSession();
  const [isSending, setIsSending] = useState(false);

  const handleSendWhatsApp = async () => {
    if (!recipientPhone) {
      showError('No se encontró el número de teléfono del proveedor.');
      return;
    }

    if (!session?.access_token) {
      showError('No hay sesión activa.');
      return;
    }

    setIsSending(true);
    const toastId = showLoading('Generando PDF y preparando mensaje...');

    try {
      let pdfUrl = '';

      if (isPurchaseOrder) {
        // Generate PDF for Purchase Order and upload to Cloudinary
        const response = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/generate-po-pdf-cloudinary`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderId: documentId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al generar el PDF.');
        }

        const result = await response.json();
        pdfUrl = result.publicUrl;
      } else {
        // For Quote Requests, we would need a similar function
        // For now, we'll just send a message without the PDF link
        showError('El envío de PDF por WhatsApp para Solicitud de Cotización aún no está implementado.');
        setIsSending(false);
        dismissToast(toastId);
        return;
      }

      const formattedPhone = recipientPhone.replace(/\D/g, '');
      const finalPhone = formattedPhone.startsWith('58') ? formattedPhone : `58${formattedPhone}`;
      
      // Include the PDF link in the message
      const message = `Hola, te adjunto la ${documentType} #${documentNumber} de ${companyName}.\n\n${pdfUrl}`;
      
      const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappUrl, '_blank');
      
      dismissToast(toastId);
      showSuccess('Mensaje de WhatsApp preparado.');

    } catch (error: any) {
      console.error('[WhatsAppSenderButton] Error:', error);
      dismissToast(toastId);
      showError(error.message || 'Error al enviar por WhatsApp.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      onClick={handleSendWhatsApp}
      disabled={!recipientPhone || isSending}
      className="bg-green-600 hover:bg-green-700"
    >
      <MessageSquare className="mr-2 h-4 w-4" /> {isSending ? 'Preparando...' : 'Enviar por WhatsApp'}
    </Button>
  );
};

export default WhatsAppSenderButton;