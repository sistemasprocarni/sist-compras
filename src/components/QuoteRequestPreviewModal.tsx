import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { showError, showLoading, dismissToast } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';
import PDFDownloadButton from './PDFDownloadButton'; // Importar el botón de descarga

interface QuoteRequestPreviewModalProps {
  requestId: string;
  onClose: () => void;
  fileName: string; // Nuevo: Nombre de archivo para la descarga
}

const QuoteRequestPreviewModal: React.FC<QuoteRequestPreviewModalProps> = ({ requestId, onClose, fileName }) => {
  const { session } = useSession();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [loadingToastId, setLoadingToastId] = useState<string | null>(null);
  const [successToastId, setSuccessToastId] = useState<string | null>(null);

  const generatePdf = async () => {
    if (!session) {
      showError('No hay sesión activa para generar el PDF.');
      return;
    }

    setIsLoadingPdf(true);
    const toastId = showLoading('Generando previsualización del PDF...');
    setLoadingToastId(toastId);

    try {
      const response = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/generate-qr-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId: requestId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al generar el PDF.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);

      // Dismiss loading toast and show success message
      if (loadingToastId) {
        dismissToast(loadingToastId);
        setLoadingToastId(null);
      }

      // Show success toast that will auto-dismiss
      const successId = showLoading('PDF generado. Puedes previsualizarlo.', 2000);
      setSuccessToastId(successId);

      // Auto-dismiss the success toast after 2 seconds
      setTimeout(() => {
        if (successId) {
          dismissToast(successId);
          setSuccessToastId(null);
        }
      }, 2000);

    } catch (error: any) {
      console.error('[QuoteRequestPreviewModal] Error generating PDF:', error);
      if (loadingToastId) {
        dismissToast(loadingToastId);
        setLoadingToastId(null);
      }
      showError(error.message || 'Error desconocido al generar el PDF.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl); // Limpiar URL temporal
    }
    // Clear all toasts when closing the modal
    if (loadingToastId) {
      dismissToast(loadingToastId);
    }
    if (successToastId) {
      dismissToast(successToastId);
    }
    onClose();
  };

  useEffect(() => {
    generatePdf();
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      if (loadingToastId) {
        dismissToast(loadingToastId);
      }
      if (successToastId) {
        dismissToast(successToastId);
      }
    };
  }, [requestId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end gap-2 mb-4">
        {/* Usar PDFDownloadButton para la descarga consistente */}
        <PDFDownloadButton
          requestId={requestId}
          fileName={fileName}
          endpoint="generate-qr-pdf"
          label="Descargar PDF"
          variant="outline"
          disabled={isLoadingPdf}
        />
        <Button onClick={handleClose} variant="outline">
          Cerrar
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoadingPdf && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Cargando previsualización del PDF...
          </div>
        )}
        {pdfUrl && !isLoadingPdf && (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-none"
            title="PDF Preview"
          ></iframe>
        )}
        {!pdfUrl && !isLoadingPdf && (
          <div className="flex items-center justify-center h-full text-destructive">
            No se pudo generar la previsualización del PDF.
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteRequestPreviewModal;