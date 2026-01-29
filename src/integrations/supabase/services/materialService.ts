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
    const payload = {
      ...materialData,
      name: materialData.name.toUpperCase(), // Convert name to uppercase
    };

    const { data: newMaterial, error } = await supabase
      .from('materials')
      .insert(payload)
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
    const payload = { ...updates };
    if (payload.name) {
      payload.name = payload.name.toUpperCase(); // Convert name to uppercase
    }

    const { data: updatedMaterial, error } = await supabase
      .from('materials')
      .update(payload)
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
};

export const {
  getAll: getAllMaterials,
  create: createMaterial,
  update: updateMaterial,
  delete: deleteMaterial,
  search: searchMaterials,
} = MaterialService;