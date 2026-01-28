import { supabase } from '@/integrations/supabase/client';
import { TopSupplier, TopMaterial } from './types';

// Re-export all CRUD and utility functions from the services index
export * from './services'; 

// Custom analysis functions using RPC

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