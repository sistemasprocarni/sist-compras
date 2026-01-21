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
  is_exempt?: boolean; // Añadido: Campo para indicar si el material está exento de IVA
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
  const [tempOrderId, setTempOrderId] = useState<string | null>(null); // Store the temporary order ID

  const generatePdf = async () => {
    if (!session) {
      showError('No hay sesión activa para generar el PDF.');
      return;
    }

    setIsLoadingPdf(true);
    const loadingToastId = showLoading('Generando previsualización del PDF...');

    try {
      // First, create the purchase order to get an ID
      const { data: newOrder, error: createError } = await session.supabase
        .from('purchase_orders')
        .insert({
          supplier_id: orderData.supplier_id,
          company_id: orderData.company_id,
          currency: orderData.currency,
          exchange_rate: orderData.exchange_rate,
          status: 'Draft', // Always create as Draft for preview
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
      setTempOrderId(orderId); // Store the temporary order ID

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
          // Attempt to clean up the temporary order
          await session.supabase.from('purchase_orders').delete().eq('id', orderId);
          setTempOrderId(null); // Clear tempOrderId if cleanup fails
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
      showLoading('PDF generado. Puedes previsualizarlo.', loadingToastId);
    } catch (error: any) {
      console.error('[PurchaseOrderPreviewModal] Error generating PDF:', error);
      showError(error.message || 'Error desconocido al generar el PDF.');
      dismissToast(loadingToastId);
    } finally {
      setIsLoadingPdf(false);
      // Clean up the temporary order and its items after preview
      // This logic needs to be careful not to delete a real order if the user proceeds to save it.
      // For now, we'll keep the cleanup simple, assuming it's always a temporary draft.
      if (tempOrderId) { // Only attempt cleanup if a temporary order was successfully created
        try {
          // Fetch the order again to ensure it's still a draft and belongs to the user
          const { data: orderToDelete, error: fetchCleanupError } = await session.supabase
            .from('purchase_orders')
            .select('id')
            .eq('id', tempOrderId) // CORRECTED: Use tempOrderId here
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
          setTempOrderId(null); // Clear tempOrderId after cleanup attempt
        }
      }
    }
  };

  useEffect(() => {
    generatePdf();
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      // Ensure cleanup happens if component unmounts before PDF generation finishes
      if (tempOrderId) {
        // This part is tricky because `session` might not be available on unmount
        // and we don't want to block unmount. A more robust solution might involve
        // a server-side cleanup mechanism or a more complex client-side state.
        // For now, rely on the `finally` block in `generatePdf` for most cases.
        console.warn('[PurchaseOrderPreviewModal] Component unmounted with pending temporary order cleanup. Relying on finally block.');
      }
    };
  }, []); // Empty dependency array to run once on mount

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
      <div className="flex justify-end mt-4">
        <Button onClick={onClose} variant="outline">Cerrar</Button>
      </div>
    </div>
  );
};

export default PurchaseOrderPreviewModal;