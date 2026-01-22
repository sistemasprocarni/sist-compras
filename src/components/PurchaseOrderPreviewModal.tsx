import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { showError, showLoading, dismissToast } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';

interface PurchaseOrderHeader {
  supplier_id: string;
  company_id: string;
  currency: string;
  exchange_rate?: number | null;
  status?: string;
  created_by?: string;
  user_id: string;
}

interface PurchaseOrderItem {
  material_name: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  is_exempt?: boolean;
}

interface PurchaseOrderPreviewModalProps {
  orderData: PurchaseOrderHeader;
  itemsData: PurchaseOrderItem[];
  onClose: () => void;
}

const PurchaseOrderPreviewModal: React.FC<PurchaseOrderPreviewModalProps> = ({ orderData, itemsData, onClose }) => {
  const { session } = useSession();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [tempOrderId, setTempOrderId] = useState<string | null>(null);
  const [loadingToastId, setLoadingToastId] = useState<string | null>(null);

  const generatePdf = async () => {
    if (!session) {
      showError('No hay sesión activa para generar el PDF.');
      return;
    }

    setIsLoadingPdf(true);
    const toastId = showLoading('Generando previsualización del PDF...');
    setLoadingToastId(toastId);

    try {
      // First, create the purchase order to get an ID
      const { data: newOrder, error: createError } = await session.supabase
        .from('purchase_orders')
        .insert({
          supplier_id: orderData.supplier_id,
          company_id: orderData.company_id,
          currency: orderData.currency,
          exchange_rate: orderData.exchange_rate,
          status: 'Draft',
          created_by: orderData.created_by,
          user_id: orderData.user_id,
        })
        .select('id')
        .single();

      if (createError || !newOrder) {
        console.error('[PurchaseOrderPreviewModal] Error creating temporary order:', createError);
        showError('Error al crear la orden temporal para la previsualización.');
        return;
      }

      const orderId = newOrder.id;
      setTempOrderId(orderId);

      // Insert items for the temporary order
      if (itemsData.length > 0) {
        const itemsWithOrderId = itemsData.map(item => ({
          ...item,
          order_id: orderId,
        }));
        const { error: itemsError } = await session.supabase
          .from('purchase_order_items')
          .insert(itemsWithOrderId);

        if (itemsError) {
          console.error('[PurchaseOrderPreviewModal] Error inserting temporary order items:', itemsError);
          showError('Error al insertar ítems temporales para la previsualización.');
          await session.supabase.from('purchase_orders').delete().eq('id', orderId);
          setTempOrderId(null);
          return;
        }
      }

      // Now, invoke the edge function with the temporary order ID
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
      if (loadingToastId) {
        dismissToast(loadingToastId);
      }
      showLoading('PDF generado. Puedes previsualizarlo.', 2000);
    } catch (error: any) {
      console.error('[PurchaseOrderPreviewModal] Error generating PDF:', error);
      if (loadingToastId) {
        dismissToast(loadingToastId);
      }
      showError(error.message || 'Error desconocido al generar el PDF.');
    } finally {
      setIsLoadingPdf(false);
      // Clean up the temporary order and its items after preview
      if (tempOrderId) {
        try {
          const { data: orderToDelete, error: fetchCleanupError } = await session.supabase
            .from('purchase_orders')
            .select('id')
            .eq('id', tempOrderId)
            .eq('user_id', orderData.user_id)
            .eq('status', 'Draft')
            .single();

          if (fetchCleanupError && fetchCleanupError.code !== 'PGRST116') {
            console.error('[PurchaseOrderPreviewModal] Error fetching order for cleanup:', fetchCleanupError);
          } else if (orderToDelete) {
            await session.supabase.from('purchase_order_items').delete().eq('order_id', orderToDelete.id);
            await session.supabase.from('purchase_orders').delete().eq('id', orderToDelete.id);
            console.log('[PurchaseOrderPreviewModal] Temporary order and items cleaned up.');
          }
        } catch (cleanupError) {
          console.error('[PurchaseOrderPreviewModal] Error during cleanup of temporary order:', cleanupError);
        } finally {
          setTempOrderId(null);
        }
      }
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `orden_compra_${orderData.supplier_id.substring(0, 8)}.pdf`;
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
      if (tempOrderId) {
        console.warn('[PurchaseOrderPreviewModal] Component unmounted with pending temporary order cleanup. Relying on finally block.');
      }
      if (loadingToastId) {
        dismissToast(loadingToastId);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end gap-2 mb-4">
        <Button onClick={handleDownload} variant="outline" disabled={!pdfUrl}>
          Descargar PDF
        </Button>
        <Button onClick={onClose} variant="outline">
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
            style={{ minHeight: '600px' }}
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

export default PurchaseOrderPreviewModal;