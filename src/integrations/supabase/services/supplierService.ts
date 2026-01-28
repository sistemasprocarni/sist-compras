// src/integrations/supabase/services/supplierService.ts

import { supabase } from '../client';
import { showError } from '@/utils/toast';
import { Supplier, SupplierMaterialPayload } from '../types';
import { logAudit } from './auditLogService';

const SupplierService = {
  getAll: async (): Promise<Supplier[]> => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[SupplierService.getAll] Error:', error);
      showError('Error al cargar proveedores.');
      return [];
    }
    return data;
  },

  create: async (
    supplierData: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>,
    materials: SupplierMaterialPayload[],
  ): Promise<Supplier | null> => {
    const { data: newSupplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert(supplierData)
      .select()
      .single();

    if (supplierError) {
      console.error('[SupplierService.create] Error:', supplierError);
      showError('Error al crear el proveedor.');
      return null;
    }

    // --- AUDIT LOG ---
    logAudit('CREATE_SUPPLIER', { 
      supplier_id: newSupplier.id, 
      name: newSupplier.name, 
      rif: newSupplier.rif,
      materials_count: materials.length
    });
    // -----------------

    if (materials && materials.length > 0) {
      const supplierMaterials = materials.map(mat => ({
        supplier_id: newSupplier.id,
        material_id: mat.material_id,
        specification: mat.specification,
        user_id: newSupplier.user_id,
      }));

      const { error: materialsError } = await supabase
        .from('supplier_materials')
        .insert(supplierMaterials);

      if (materialsError) {
        console.error('[SupplierService.create] Error al crear materiales:', materialsError);
        showError('Error al asociar materiales al proveedor.');
        return null;
      }
    }

    return newSupplier;
  },

  update: async (
    id: string,
    updates: Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'materials'>>,
    materials: SupplierMaterialPayload[],
  ): Promise<Supplier | null> => {
    const { data: updatedSupplier, error: supplierError } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (supplierError) {
      console.error('[SupplierService.update] Error:', supplierError);
      showError('Error al actualizar el proveedor.');
      return null;
    }

    // --- AUDIT LOG ---
    logAudit('UPDATE_SUPPLIER', { 
      supplier_id: id, 
      updates: updates,
      materials_count: materials.length
    });
    // -----------------

    // Obtener las relaciones de materiales existentes
    const { data: existingSupplierMaterials, error: fetchError } = await supabase
      .from('supplier_materials')
      .select('id, material_id, specification')
      .eq('supplier_id', id);

    if (fetchError) {
      console.error('[SupplierService.update] Error al obtener materiales existentes:', fetchError);
      showError('Error al actualizar los materiales del proveedor.');
      return null;
    }

    const existingMaterialMap = new Map(existingSupplierMaterials.map(sm => [sm.material_id, sm]));
    const newMaterialIds = new Set(materials.map(mat => mat.material_id));

    // Materiales a eliminar (existentes que ya no están en la lista nueva)
    const materialsToDelete = existingSupplierMaterials.filter(sm => !newMaterialIds.has(sm.material_id));
    if (materialsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('supplier_materials')
        .delete()
        .in('id', materialsToDelete.map(sm => sm.id));

      if (deleteError) {
        console.error('[SupplierService.update] Error al eliminar materiales antiguos:', deleteError);
        showError('Error al eliminar materiales antiguos del proveedor.');
        return null;
      }
    }

    // Materiales a insertar/actualizar
    for (const mat of materials) {
      const existingSm = existingMaterialMap.get(mat.material_id);

      if (!existingSm) {
        // Insertar nuevo material
        const { error: insertError } = await supabase
          .from('supplier_materials')
          .insert({
            supplier_id: id,
            material_id: mat.material_id,
            specification: mat.specification,
            user_id: updatedSupplier.user_id,
          });

        if (insertError) {
          console.error('[SupplierService.update] Error al insertar nuevo material:', insertError);
          showError('Error al insertar nuevos materiales para el proveedor.');
          return null;
        }
      } else if (existingSm.specification !== mat.specification) {
        // Actualizar especificación de material existente solo si cambió
        const { error: updateMaterialError } = await supabase
          .from('supplier_materials')
          .update({ specification: mat.specification })
          .eq('id', existingSm.id);

        if (updateMaterialError) {
          console.error('[SupplierService.update] Error al actualizar especificación:', updateMaterialError);
          showError('Error al actualizar la especificación del material del proveedor.');
          return null;
        }
      }
    }

    return updatedSupplier;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupplierService.delete] Error:', error);
      showError('Error al eliminar el proveedor.');
      return false;
    }

    // --- AUDIT LOG ---
    logAudit('DELETE_SUPPLIER', { supplier_id: id });
    // -----------------
    
    return true;
  },

  search: async (query: string): Promise<Supplier[]> => {
    // Si la consulta está vacía, devuelve los primeros 10 proveedores como sugerencias
    if (!query.trim()) {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true })
        .limit(10); // Limita a 10 sugerencias

      if (error) {
        console.error('[SupplierService.search] Error fetching default suppliers:', error);
        return [];
      }
      return data;
    }

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .or(`name.ilike.%${query}%,rif.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('[SupplierService.search] Error:', error);
      return [];
    }
    return data;
  },

  getById: async (id: string): Promise<Supplier | null> => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*, materials:supplier_materials(material_id, specification, materials:materials(id, name, code, category, unit))')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[SupplierService.getById] Error:', error);
      return null;
    }
    return data;
  },
};

export const {
  getAll: getAllSuppliers,
  create: createSupplier,
  update: updateSupplier,
  delete: deleteSupplier,
  search: searchSuppliers,
  getById: getSupplierDetails,
} = SupplierService;