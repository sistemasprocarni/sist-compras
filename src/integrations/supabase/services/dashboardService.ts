// src/integrations/supabase/services/dashboardService.ts

import { supabase } from '../client';
import { showError } from '@/utils/toast';
import { TopMaterial, TopSupplier } from '../types';

const DashboardService = {
  getTopMaterialsByQuantity: async (limit: number = 5): Promise<TopMaterial[]> => {
    const { data, error } = await supabase.rpc('get_top_materials_by_quantity', { limit_count: limit });
    if (error) {
      console.error('[DashboardService.getTopMaterialsByQuantity] Error:', error);
      showError('Error al cargar los materiales principales.');
      return [];
    }
    return data as TopMaterial[];
  },

  getTopSuppliersByOrderCount: async (limit: number = 5): Promise<TopSupplier[]> => {
    const { data, error } = await supabase.rpc('get_top_suppliers_by_order_count', { limit_count: limit });
    if (error) {
      console.error('[DashboardService.getTopSuppliersByOrderCount] Error:', error);
      showError('Error al cargar los proveedores principales.');
      return [];
    }
    return data as TopSupplier[];
  },
};

export const {
  getTopMaterialsByQuantity,
  getTopSuppliersByOrderCount,
} = DashboardService;