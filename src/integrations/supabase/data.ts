import { supabase } from "@/integrations/supabase/client";
import { PurchaseOrder, Supplier, TopMaterial, TopSupplier } from "./types";

export async function getAllPurchaseOrders(status?: string): Promise<PurchaseOrder[]> {
  let query = supabase.from('purchase_orders').select('*');
  if (status) {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as PurchaseOrder[];
}

export async function getAllSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select('*');
  if (error) throw new Error(error.message);
  return data as Supplier[];
}

export async function getTopMaterialsByQuantity(limit: number = 5): Promise<TopMaterial[]> {
  const { data, error } = await supabase.rpc('get_top_materials_by_quantity', { limit_count: limit });
  if (error) throw new Error(error.message);
  return data as TopMaterial[];
}

export async function getTopSuppliersByOrderCount(limit: number = 5): Promise<TopSupplier[]> {
  const { data, error } = await supabase.rpc('get_top_suppliers_by_order_count', { limit_count: limit });
  if (error) throw new Error(error.message);
  return data as TopSupplier[];
}