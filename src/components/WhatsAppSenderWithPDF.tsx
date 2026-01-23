import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';

interface WhatsAppSenderWithPDFProps {
  generatePdf: () => Promise<Blob>; // Función para generar el PDF
  fileName: string; // Nombre del archivo PDF
  recipientPhone?: string; // Teléfono del destinatario
  documentType: 'Solicitud de Cotización' | 'Orden de Compra'; // Tipo de documento
  documentNumber: string; // Número del documento
  companyName: string; // Nombre de la empresa
}

const WhatsAppSenderWithPDF: React.FC<WhatsAppSenderWithPDFProps> = ({
  generatePdf,
  fileName,
  recipientPhone,
  documentType,
  documentNumber,
  companyName,
}) => {
  const { session } = useSession();
  const [isSending, setIsSending] = useState(false);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = (error) => {
        console.error('[WhatsAppSenderWithPDF] Error converting blob to base64:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  };

  const handleSendWhatsApp = async () => {
    if (!session?.user?.email) {
      showError('No se pudo determinar el correo del usuario.');
      return;
    }

    if (!recipientPhone) {
      showError('No se encontró el número de teléfono del proveedor.');
      return;
    }

    setIsSending(true);
    const toastId = showLoading('Generando PDF y enviando por WhatsApp...');

    try {
      // 1. Generar el PDF
      const pdfBlob = await generatePdf();
      
      // 2. Convertir a Base64
      const pdfBase64 = await blobToBase64(pdfBlob);

      // 3. Subir el PDF a la segunda cuenta de Supabase
      const uploadResponse = await fetch(`https://rmafhltpjrctlfpprufp.supabase.co/functions/v1/upload-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileBase64: pdfBase64,
          fileName: fileName,
        }),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Error al subir el PDF.');
      }

      const { publicUrl } = await uploadResponse.json();
      console.log(`[WhatsAppSenderWithPDF] PDF uploaded. Public URL: ${publicUrl}`);

      // 4. Enviar mensaje de WhatsApp con la URL pública
      const formattedPhone = recipientPhone.replace(/\D/g, '');
      const finalPhone = formattedPhone.startsWith('58') ? formattedPhone : `58${formattedPhone}`;
      
      const message = `Hola, te he enviado la ${documentType} #${documentNumber} de ${companyName}. Puedes descargarla aquí: ${publicUrl}`;
      
      const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappUrl, '_blank');

      dismissToast(toastId);
      showSuccess('PDF subido y mensaje de WhatsApp preparado.');

    } catch (error: any) {
      console.error('[WhatsAppSenderWithPDF] Error:', error);
      dismissToast(toastId);
      showError(error.message || 'Error al enviar el mensaje.');
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
      <MessageSquare className="mr-2 h-4 w-4" />
      {isSending ? 'Enviando...' : 'Enviar por WhatsApp'}
    </Button>
  );
};

export default WhatsAppSenderWithPDF;