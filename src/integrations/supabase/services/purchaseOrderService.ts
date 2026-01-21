// src/integrations/supabase/services/purchaseOrderService.ts

import { supabase } from '../client';
import { showError } from '@/utils/toast';
import { PurchaseOrder, PurchaseOrderItem } from '../types';

const PurchaseOrderService = {
  getAll: async (): Promise<PurchaseOrder[]> => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name), companies(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PurchaseOrderService.getAll] Error:', error);
      showError('Error al cargar órdenes de compra.');
      return [];
    }
    return data;
  },

  create: async (orderData: Omit<PurchaseOrder, 'id' | 'created_at'>, items: Omit<PurchaseOrderItem, 'id' | 'order_id'>[]): Promise<PurchaseOrder | null> => {
    const { data: newOrder, error: orderError } = await supabase
      .from('purchase_orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('[PurchaseOrderService.create] Error:', orderError);
      showError('Error al crear la orden de compra.');
      return null;
    }

    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        order_id: newOrder.id,
        material_name: item.material_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        is_exempt: item.is_exempt,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('[PurchaseOrderService.create] Error al crear ítems:', itemsError);
        showError('Error al crear los ítems de la orden.');
        return null;
      }
    }

    return newOrder;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[PurchaseOrderService.delete] Error:', error);
      showError('Error al eliminar la orden de compra.');
      return false;
    }
    return true;
  },

  getById: async (id: string): Promise<PurchaseOrder | null> => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(*), companies(*), purchase_order_items(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[PurchaseOrderService.getById] Error:', error);
      return null;
    }
    return data;
  },
};

export const {
  getAll: getAllPurchaseOrders,
  create: createPurchaseOrder,
  delete: deletePurchaseOrder,
  getById: getPurchaseOrderDetails,
} = PurchaseOrderService;