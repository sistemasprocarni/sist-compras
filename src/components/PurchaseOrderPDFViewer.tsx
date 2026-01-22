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

  const generatePdf = async () => {
    if (!session) {
      showError('No hay sesión activa para generar el PDF.');
      return;
    }

    setIsLoadingPdf(true);
    const loadingToastId = showLoading('Generando PDF de la Orden de Compra...');

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
      showLoading('PDF generado. Puedes previsualizarlo.', loadingToastId);
    } catch (error: any) {
      console.error('[PurchaseOrderPDFViewer] Error generating PDF:', error);
      showError(error.message || 'Error desconocido al generar el PDF.');
      dismissToast(loadingToastId);
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

  useEffect(() => {
    generatePdf();
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [orderId]);

  return (
    <div className="flex flex-col h-full">
      {isLoadingPdf && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Cargando previsualización del PDF...
        </div>
      )}
      {pdfUrl && !isLoadingPdf && (
        <iframe src={pdfUrl} className="flex-1 w-full h-full border-none" title="PDF Preview"></iframe>
      )}
      {!pdfUrl && !isLoadingPdf && (
        <div className="flex items-center justify-center h-full text-destructive">
          No se pudo generar la previsualización del PDF.
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <Button onClick={handleDownload} variant="outline" disabled={!pdfUrl}>
          Descargar PDF
        </Button>
        <Button onClick={onClose} variant="outline">
          Cerrar
        </Button>
      </div>
    </div>
  );
};

export default PurchaseOrderPDFViewer;