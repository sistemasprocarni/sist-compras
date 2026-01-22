import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { showError, showLoading, dismissToast } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';

interface PurchaseOrderPDFViewerProps {
  orderId: string;
  onClose: () => void;
}

const PurchaseOrderPDFViewer: React.FC<PurchaseOrderPDFViewerProps> = ({ orderId, onClose }) => {
  const { session } = useSession();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [loadingToastId, setLoadingToastId] = useState<string | null>(null);
  const [successToastId, setSuccessToastId] = useState<string | null>(null); // New state for success toast ID

  const generatePdf = async () => {
    if (!session) {
      showError('No hay sesión activa para generar el PDF.');
      return;
    }

    setIsLoadingPdf(true);
    const toastId = showLoading('Generando PDF de la Orden de Compra...');
    setLoadingToastId(toastId);

    try {
      const response = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/generate-po-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: orderId }),
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
      console.error('[PurchaseOrderPDFViewer] Error generating PDF:', error);
      if (loadingToastId) {
        dismissToast(loadingToastId);
        setLoadingToastId(null);
      }
      showError(error.message || 'Error desconocido al generar el PDF.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `orden_compra_${orderId.substring(0, 8)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClose = () => {
    // Clear all toasts when closing the modal
    if (loadingToastId) {
      dismissToast(loadingToastId);
      setLoadingToastId(null);
    }
    if (successToastId) {
      dismissToast(successToastId);
      setSuccessToastId(null);
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
        setLoadingToastId(null);
      }
      if (successToastId) {
        dismissToast(successToastId);
        setSuccessToastId(null);
      }
    };
  }, [orderId]);

  return (
    <div className="flex flex-col h-full">
      {/* Moved buttons to the top for better visibility */}
      <div className="flex justify-end gap-2 mb-4">
        <Button onClick={handleDownload} variant="outline" disabled={!pdfUrl}>
          Descargar PDF
        </Button>
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
          <iframe src={pdfUrl} className="w-full h-full border-none" title="PDF Preview"></iframe>
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

export default PurchaseOrderPDFViewer;