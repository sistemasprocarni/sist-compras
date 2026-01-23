import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { showError, showLoading, dismissToast } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';

interface WhatsAppSenderButtonProps {
  orderId?: string; // For Purchase Orders
  requestId?: string; // For Quote Requests
  recipientPhone?: string;
  documentType: 'Solicitud de Cotización' | 'Orden de Compra';
  documentId: string;
  documentNumber: string;
  companyName: string;
}

const WhatsAppSenderButton: React.FC<WhatsAppSenderButtonProps> = ({
  orderId,
  requestId,
  recipientPhone,
  documentType,
  documentId,
  documentNumber,
  companyName,
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
      let signedUrl = '';
      const endpoint = orderId ? 'generate-and-upload-po-pdf' : 'generate-and-upload-qr-pdf'; // We'll create the QR one next

      // For now, we only have the PO PDF function. We'll create the QR one later.
      if (!orderId) {
        throw new Error('Funcionalidad para Solicitud de Cotización aún no implementada.');
      }

      const response = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al generar el PDF.');
      }

      const data = await response.json();
      signedUrl = data.signedUrl;

      const formattedPhone = recipientPhone.replace(/\D/g, '');
      const finalPhone = formattedPhone.startsWith('58') ? formattedPhone : `58${formattedPhone}`;
      
      const message = `Hola, te he enviado la ${documentType} #${documentNumber} de ${companyName}. Puedes descargar el PDF aquí: ${signedUrl}`;
      
      const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappUrl, '_blank');
      dismissToast(toastId);

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