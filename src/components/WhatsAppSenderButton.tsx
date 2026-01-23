import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react'; // Usar MessageSquare en lugar de WhatsApp
import { showError } from '@/utils/toast';

interface WhatsAppSenderButtonProps {
  recipientPhone?: string;
  documentType: 'Solicitud de Cotización' | 'Orden de Compra';
  documentId: string;
  documentNumber: string;
  companyName: string;
}

const WhatsAppSenderButton: React.FC<WhatsAppSenderButtonProps> = ({
  recipientPhone,
  documentType,
  documentId,
  documentNumber,
  companyName,
}) => {
  const handleSendWhatsApp = () => {
    if (!recipientPhone) {
      showError('No se encontró el número de teléfono del proveedor.');
      return;
    }

    const formattedPhone = recipientPhone.replace(/\D/g, '');
    const finalPhone = formattedPhone.startsWith('58') ? formattedPhone : `58${formattedPhone}`;
    
    const message = `Hola, te he enviado por correo la ${documentType} #${documentNumber} de ${companyName}. Por favor, revisa tu bandeja de entrada.`;
    
    const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  return (
    <Button
      onClick={handleSendWhatsApp}
      disabled={!recipientPhone}
      className="bg-green-600 hover:bg-green-700"
    >
      <MessageSquare className="mr-2 h-4 w-4" /> Enviar por WhatsApp
    </Button>
  );
};

export default WhatsAppSenderButton;