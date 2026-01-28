import { supabase } from '@/integrations/supabase/client';
import { PurchaseOrder, Supplier, TopSupplier, TopMaterial } from './types';

// Existing functions (assuming they were here)

export async function getAllPurchaseOrders(status?: string): Promise<PurchaseOrder[]> {
  let query = supabase.from('purchase_orders').select('*');
  if (status) {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as PurchaseOrder[];
}

export async function getAllSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select('*');
  if (error) throw error;
  return data as Supplier[];
}

// New analysis functions

export async function getTopSuppliers(limit: number = 5): Promise<TopSupplier[]> {
  const { data, error } = await supabase.rpc('get_top_suppliers_by_order_count', { limit_count: limit });
  if (error) throw error;
  return data as TopSupplier[];
}

export async function getTopMaterials(limit: number = 5): Promise<TopMaterial[]> {
  const { data, error } = await supabase.rpc('get_top_materials_by_quantity', { limit_count: limit });
  if (error) throw error;
  return data as TopMaterial[];
}