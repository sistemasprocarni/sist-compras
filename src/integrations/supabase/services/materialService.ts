// src/integrations/supabase/services/materialService.ts

import { supabase } from '../client';
import { showError } from '@/utils/toast';
import { Material } from '../types';
import { logAudit } from './auditLogService';

const MaterialService = {
  getAll: async (): Promise<Material[]> => {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[MaterialService.getAll] Error:', error);
      showError('Error al cargar materiales.');
      return [];
    }
    return data;
  },

  create: async (materialData: Omit<Material, 'id' | 'created_at' | 'updated_at'>): Promise<Material | null> => {
    const { data: newMaterial, error } = await supabase
      .from('materials')
      .insert(materialData)
      .select()
      .single();

    if (error) {
      console.error('[MaterialService.create] Error:', error);
      showError('Error al crear el material.');
      return null;
    }

    // --- AUDIT LOG ---
    logAudit('CREATE_MATERIAL', { 
      material_id: newMaterial.id, 
      name: newMaterial.name, 
      code: newMaterial.code 
    });
    // -----------------
    
    return newMaterial;
  },

  update: async (id: string, updates: Partial<Omit<Material, 'id' | 'created_at' | 'updated_at'>>): Promise<Material | null> => {
    const { data: updatedMaterial, error } = await supabase
      .from('materials')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[MaterialService.update] Error:', error);
      showError('Error al actualizar el material.');
      return null;
    }

    // --- AUDIT LOG ---
    logAudit('UPDATE_MATERIAL', { 
      material_id: id, 
      updates: updates 
    });
    // -----------------
    
    return updatedMaterial;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[MaterialService.delete] Error:', error);
      showError('Error al eliminar el material.');
      return false;
    }

    // --- AUDIT LOG ---
    logAudit('DELETE_MATERIAL', { material_id: id });
    // -----------------
    
    return true;
  },

  search: async (query: string): Promise<Material[]> => {
    // Si la consulta está vacía, devuelve los primeros 10 materiales como sugerencias
    if (!query.trim()) {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('name', { ascending: true })
        .limit(10); // Limita a 10 sugerencias

      if (error) {
        console.error('[MaterialService.search] Error fetching default materials:', error);
        return [];
      }
      return data;
    }

    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('[MaterialService.search] Error:', error);
      return [];
    }
    return data;
  },

  searchBySupplier: async (supplierId: string, query: string): Promise<any[]> => {
    let baseQuery = supabase
      .from('supplier_materials')
      .select(`
        material_id:materials!inner(id, name, code, category, unit, is_exempt),
        specification
      `)
      .eq('supplier_id', supplierId);

    if (query.trim()) {
      baseQuery = baseQuery.or(`material_id.name.ilike.%${query}%,material_id.code.ilike.%${query}%`);
    }

    const { data, error } = await baseQuery.limit(10);

    if (error) {
      console.error('[MaterialService.searchBySupplier] Error:', error);
      showError('Error al buscar materiales asociados al proveedor.');
      return [];
    }

    // Flatten the result structure for the frontend components
    return data.map(item => ({
      id: item.material_id.id,
      name: item.material_id.name,
      code: item.material_id.code,
      category: item.material_id.category,
      unit: item.material_id.unit,
      is_exempt: item.material_id.is_exempt,
      specification: item.specification,
    }));
  },
};

export const {
  getAll: getAllMaterials,
  create: createMaterial,
  update: updateMaterial,
  delete: deleteMaterial,
  search: searchMaterials,
  searchBySupplier: searchMaterialsBySupplier,
} = MaterialService;