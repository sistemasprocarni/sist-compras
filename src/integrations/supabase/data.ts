// src/integrations/supabase/data.ts

import { supabase } from './client';
import { showSuccess, showError } from '@/utils/toast';

// Tipos para las tablas (puedes expandirlos según sea necesario)
interface Supplier {
  id: string;
  rif: string;
  name: string;
  email?: string;
  phone?: string;
  payment_terms: string;
  credit_days: number;
  status: string;
}

interface Material {
  id: string;
  code: string;
  name: string;
  category?: string;
}

interface SupplierMaterial {
  id: string;
  supplier_id: string;
  material_id: string;
  specification?: string;
  materials: Material; // Para el join
}

interface PurchaseOrderHeader {
  id?: string;
  supplier_id: string;
  company_id: string;
  currency: string;
  exchange_rate?: number;
  status?: string;
  created_by?: string;
  user_id: string;
}

interface PurchaseOrderItem {
  id?: string;
  order_id?: string;
  material_name: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  is_exempt?: boolean;
}

/**
 * Busca proveedores por RIF o nombre.
 * @param query Cadena de búsqueda.
 * @returns Lista de proveedores que coinciden.
 */
export const searchSuppliers = async (query: string): Promise<Supplier[]> => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .or(`rif.ilike.%${query}%,name.ilike.%${query}%`)
    .eq('status', 'Active'); // Solo buscar proveedores activos

  if (error) {
    console.error('[searchSuppliers] Error searching suppliers:', error);
    showError('Error al buscar proveedores.');
    return [];
  }
  return data || [];
};

/**
 * Obtiene materiales asociados a un proveedor específico.
 * Realiza un join con la tabla 'materials'.
 * @param supplierId ID del proveedor.
 * @returns Lista de materiales con sus especificaciones para el proveedor.
 */
export const getMaterialsBySupplier = async (supplierId: string): Promise<SupplierMaterial[]> => {
  const { data, error } = await supabase
    .from('supplier_materials')
    .select(`
      id,
      specification,
      materials (
        id,
        code,
        name,
        category
      )
    `)
    .eq('supplier_id', supplierId);

  if (error) {
    console.error('[getMaterialsBySupplier] Error fetching materials by supplier:', error);
    showError('Error al obtener materiales del proveedor.');
    return [];
  }
  return data || [];
};

/**
 * Crea una nueva orden de compra con sus ítems en una transacción atómica.
 * @param orderData Datos de la cabecera de la orden de compra.
 * @param itemsData Array de ítems de la orden de compra.
 * @returns La orden de compra creada o null si falla.
 */
export const createPurchaseOrder = async (
  orderData: Omit<PurchaseOrderHeader, 'id'>,
  itemsData: Omit<PurchaseOrderItem, 'id' | 'order_id'>[]
): Promise<PurchaseOrderHeader | null> => {
  // Validación de tasa de cambio
  if (orderData.currency === 'VES' && (!orderData.exchange_rate || orderData.exchange_rate <= 0)) {
    showError('La tasa de cambio debe ser mayor que cero para órdenes en Bolívares.');
    return null;
  }

  const { data: order, error: orderError } = await supabase
    .from('purchase_orders')
    .insert(orderData)
    .select()
    .single();

  if (orderError) {
    console.error('[createPurchaseOrder] Error creating purchase order header:', orderError);
    showError('Error al crear la cabecera de la orden de compra.');
    return null;
  }

  if (order && itemsData.length > 0) {
    const itemsWithOrderId = itemsData.map(item => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      console.error('[createPurchaseOrder] Error creating purchase order items:', itemsError);
      showError('Error al crear los ítems de la orden de compra. La orden de compra fue creada, pero los ítems no.');
      // Considerar una lógica de rollback o compensación aquí si es crítico que ambos se creen o ninguno.
      // Para Supabase, esto requeriría una función de base de datos o una Edge Function para una verdadera transacción.
      return null;
    }
  }

  showSuccess('Orden de compra creada exitosamente.');
  return order;
};