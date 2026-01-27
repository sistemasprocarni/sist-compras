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
  // New fields
  delivery_date?: string;
  payment_terms?: string;
  custom_payment_terms?: string | null;
  credit_days?: number;
  observations?: string;
}

interface PurchaseOrderItem {
  material_name: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  is_exempt?: boolean;
  unit?: string; // Added unit field
}

interface PurchaseOrderDraftPreviewProps {
  orderData: PurchaseOrderHeader;
  itemsData: PurchaseOrderItem[];
  onClose: () => void;
}

const PurchaseOrderDraftPreview: React.FC<PurchaseOrderDraftPreviewProps> = ({ orderData, itemsData, onClose }) => {
  const { session } = useSession();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [tempOrderId, setTempOrderId] = useState<string | null>(null);
  const [loadingToastId, setLoadingToastId] = useState<string | null>(null);
  const [successToastId, setSuccessToastId] = useState<string | null>(null); // New state for success toast ID

  const generatePdf = async () => {
    if (!session) {
      showError('No hay sesión activa para generar el PDF.');
      return;
    }

    setIsLoadingPdf(true);
    const toastId = showLoading('Generando previsualización del PDF...');
    setLoadingToastId(toastId);

    let currentOrderId = tempOrderId;

    try {
      // 1. Create the temporary purchase order to get an ID
      if (!currentOrderId) {
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
            // New fields
            delivery_date: orderData.delivery_date,
            payment_terms: orderData.payment_terms,
            custom_payment_terms: orderData.custom_payment_terms,
            credit_days: orderData.credit_days,
            observations: orderData.observations,
          })
          .select('id')
          .single();

        if (createError || !newOrder) {
          console.error('[PurchaseOrderDraftPreview] Error creating temporary order:', createError);
          throw new Error('Error al crear la orden temporal para la previsualización.');
        }
        currentOrderId = newOrder.id;
        setTempOrderId(currentOrderId);
      }

      // 2. Insert items for the temporary order (or re-insert if already exists, ensuring clean state)
      // First, delete existing items associated with the temporary ID
      await session.supabase.from('purchase_order_items').delete().eq('order_id', currentOrderId);

      if (itemsData.length > 0) {
        const itemsWithOrderId = itemsData.map(item => ({
          ...item,
          order_id: currentOrderId,
        }));
        const { error: itemsError } = await session.supabase
          .from('purchase_order_items')
          .insert(itemsWithOrderId);

        if (itemsError) {
          console.error('[PurchaseOrderDraftPreview] Error inserting temporary order items:', itemsError);
          throw new Error('Error al insertar ítems temporales para la previsualización.');
        }
      }

      // 3. Invoke the edge function with the temporary order ID
      const response = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/generate-po-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: currentOrderId }),
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
      console.error('[PurchaseOrderDraftPreview] Error generating PDF:', error);
      if (loadingToastId) {
        dismissToast(loadingToastId);
        setLoadingToastId(null);
      }
      showError(error.message || 'Error desconocido al generar el PDF.');
      // If creation failed, ensure tempOrderId is null
      if (!tempOrderId) setTempOrderId(null);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const cleanupTemporaryOrder = async (id: string) => {
    if (!session || !orderData.user_id) return;
    try {
      // Only delete if it's still a Draft and belongs to the user
      const { data: orderToDelete, error: fetchCleanupError } = await session.supabase
        .from('purchase_orders')
        .select('id')
        .eq('id', id)
        .eq('user_id', orderData.user_id)
        .eq('status', 'Draft')
        .single();

      if (fetchCleanupError && fetchCleanupError.code !== 'PGRST116') {
        console.error('[PurchaseOrderDraftPreview] Error fetching order for cleanup:', fetchCleanupError);
      } else if (orderToDelete) {
        await session.supabase.from('purchase_order_items').delete().eq('order_id', orderToDelete.id);
        await session.supabase.from('purchase_orders').delete().eq('id', orderToDelete.id);
        console.log('[PurchaseOrderDraftPreview] Temporary order and items cleaned up.');
      }
    } catch (cleanupError) {
      console.error('[PurchaseOrderDraftPreview] Error during cleanup of temporary order:', cleanupError);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;

    const link = document.createElement('a');
    link.href = pdfUrl;
    // Use a generic draft filename for the preview component
    link.download = `orden_compra_draft_${orderData.supplier_id.substring(0, 8)}.pdf`;
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
      // Cleanup when component unmounts
      if (tempOrderId) {
        cleanupTemporaryOrder(tempOrderId);
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
  }, [orderData.supplier_id, orderData.company_id, orderData.currency, orderData.exchange_rate, orderData.delivery_date, orderData.payment_terms, orderData.custom_payment_terms, orderData.credit_days, orderData.observations, itemsData.length]); // Re-run if core data changes

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

export default PurchaseOrderDraftPreview;