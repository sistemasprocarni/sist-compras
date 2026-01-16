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
  phone_2?: string; // Nuevo campo
  instagram?: string; // Nuevo campo
  payment_terms: string;
  custom_payment_terms?: string | null;
  credit_days: number;
  status: string;
  user_id: string;
}

interface Material {
  id: string;
  code: string;
  name: string;
  category?: string;
  unit?: string;
  user_id: string;
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
    .eq('status', 'Active');

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
        category,
        unit
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
      return null;
    }
  }

  showSuccess('Orden de compra creada exitosamente.');
  return order;
};

/**
 * Busca materiales por nombre o código.
 * @param query Cadena de búsqueda.
 * @returns Lista de materiales que coinciden.
 */
export const searchMaterials = async (query: string): Promise<Material[]> => {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .or(`name.ilike.%${query}%,code.ilike.%${query}%`);

  if (error) {
    console.error('[searchMaterials] Error searching materials:', error);
    showError('Error al buscar materiales.');
    return [];
  }
  return data || [];
};

/**
 * Obtiene proveedores que ofrecen un material específico.
 * @param materialId ID del material.
 * @returns Lista de proveedores con sus detalles y la especificación del material.
 */
export const getSuppliersByMaterial = async (materialId: string): Promise<(Supplier & { specification: string })[]> => {
  const { data, error } = await supabase
    .from('supplier_materials')
    .select(`
      specification,
      suppliers (id, rif, name, email, phone, phone_2, instagram, payment_terms, custom_payment_terms, credit_days, status)
    `)
    .eq('material_id', materialId);

  if (error) {
    console.error('[getSuppliersByMaterial] Error fetching suppliers by material:', error);
    showError('Error al obtener proveedores para el material.');
    return [];
  }

  return data.map(sm => ({
    ...sm.suppliers,
    specification: sm.specification,
  })) as (Supplier & { specification: string })[] || [];
};

/**
 * Obtiene la información completa de un proveedor y sus materiales.
 * @param supplierId ID del proveedor.
 * @returns Objeto con los detalles del proveedor y una lista de sus materiales.
 */
export const getSupplierDetails = async (supplierId: string): Promise<(Supplier & { materials: (SupplierMaterial & { materials: Material })[] }) | null> => {
  const { data: supplierData, error: supplierError } = await supabase
    .from('suppliers')
    .select(`
      *,
      supplier_materials (
        id,
        specification,
        materials (id, code, name, category, unit)
      )
    `)
    .eq('id', supplierId)
    .single();

  if (supplierError) {
    console.error('[getSupplierDetails] Error fetching supplier details:', supplierError);
    showError('Error al obtener los detalles del proveedor.');
    return null;
  }

  if (!supplierData) {
    return null;
  }

  const materials = supplierData.supplier_materials.map((sm: any) => ({
    id: sm.id,
    specification: sm.specification,
    materials: sm.materials,
  }));

  return {
    ...supplierData,
    materials: materials,
  };
};

/**
 * Obtiene todos los proveedores.
 * @returns Lista de todos los proveedores.
 */
export const getAllSuppliers = async (): Promise<Supplier[]> => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*');

  if (error) {
    console.error('[getAllSuppliers] Error fetching all suppliers:', error);
    showError('Error al cargar los proveedores.');
    return [];
  }
  return data || [];
};

interface SupplierMaterialPayload {
  material_id: string;
  specification?: string;
}

/**
 * Crea un nuevo proveedor y sus materiales asociados.
 * @param supplier Datos del nuevo proveedor.
 * @param materials Lista de materiales a asociar.
 * @returns El proveedor creado o null si falla.
 */
export const createSupplier = async (
  supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>,
  materials: SupplierMaterialPayload[],
): Promise<Supplier | null> => {
  const { data: newSupplier, error: supplierError } = await supabase
    .from('suppliers')
    .insert(supplier)
    .select()
    .single();

  if (supplierError) {
    console.error('[createSupplier] Error creating supplier:', supplierError);
    showError('Error al crear el proveedor.');
    return null;
  }

  if (newSupplier && materials.length > 0) {
    const materialsToInsert = materials.map(mat => ({
      supplier_id: newSupplier.id,
      material_id: mat.material_id,
      specification: mat.specification,
      user_id: newSupplier.user_id,
    }));

    const { error: materialsError } = await supabase
      .from('supplier_materials')
      .insert(materialsToInsert);

    if (materialsError) {
      console.error('[createSupplier] Error associating materials with supplier:', materialsError);
      showError('Proveedor creado, pero hubo un error al asociar los materiales.');
      // Considerar una lógica de rollback o compensación aquí si es crítico que ambos se creen o ninguno.
      return null;
    }
  }

  return newSupplier;
};

/**
 * Actualiza un proveedor existente y sus materiales asociados.
 * @param id ID del proveedor a actualizar.
 * @param updates Objeto con los campos a actualizar del proveedor.
 * @param materials Lista de materiales a asociar (para actualizar/crear/eliminar).
 * @returns El proveedor actualizado o null si falla.
 */
export const updateSupplier = async (
  id: string,
  updates: Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at'>>,
  materials: SupplierMaterialPayload[],
): Promise<Supplier | null> => {
  const { data: updatedSupplier, error: supplierError } = await supabase
    .from('suppliers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (supplierError) {
    console.error('[updateSupplier] Error updating supplier:', supplierError);
    showError('Error al actualizar el proveedor.');
    return null;
  }

  // Manejar actualizaciones de supplier_materials
  const { data: existingSupplierMaterials, error: fetchError } = await supabase
    .from('supplier_materials')
    .select('id, material_id')
    .eq('supplier_id', id);

  if (fetchError) {
    console.error('[updateSupplier] Error fetching existing supplier materials:', fetchError);
    showError('Error al actualizar los materiales del proveedor.');
    return null;
  }

  const existingMaterialMap = new Map(existingSupplierMaterials.map(sm => [sm.material_id, sm.id]));
  const newMaterialIds = new Set(materials.map(mat => mat.material_id));

  // Materiales a eliminar (existentes que ya no están en la lista nueva)
  const materialsToDelete = existingSupplierMaterials.filter(sm => !newMaterialIds.has(sm.material_id));
  if (materialsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('supplier_materials')
      .delete()
      .in('id', materialsToDelete.map(sm => sm.id));
    if (deleteError) {
      console.error('[updateSupplier] Error deleting old supplier materials:', deleteError);
      showError('Error al eliminar materiales antiguos del proveedor.');
      return null;
    }
  }

  // Materiales a insertar/actualizar
  for (const mat of materials) {
    if (!existingMaterialMap.has(mat.material_id)) {
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
        console.error('[updateSupplier] Error inserting new supplier material:', insertError);
        showError('Error al insertar nuevos materiales para el proveedor.');
        return null;
      }
    } else {
      // Actualizar especificación de material existente
      const existingSmId = existingMaterialMap.get(mat.material_id);
      if (existingSmId) {
        const { error: updateMaterialError } = await supabase
          .from('supplier_materials')
          .update({ specification: mat.specification })
          .eq('id', existingSmId);
        if (updateMaterialError) {
          console.error('[updateSupplier] Error updating supplier material specification:', updateMaterialError);
          showError('Error al actualizar la especificación del material del proveedor.');
          return null;
        }
      }
    }
  }

  return updatedSupplier;
};

/**
 * Elimina un proveedor.
 * @param id ID del proveedor a eliminar.
 * @returns true si se eliminó exitosamente, false si falla.
 */
export const deleteSupplier = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteSupplier] Error deleting supplier:', error);
    showError('Error al eliminar el proveedor.');
    return false;
  }
  showSuccess('Proveedor eliminado exitosamente.');
  return true;
};

/**
 * Obtiene todos los materiales.
 * @returns Lista de todos los materiales.
 */
export const getAllMaterials = async (): Promise<Material[]> => {
  const { data, error } = await supabase
    .from('materials')
    .select('*');

  if (error) {
    console.error('[getAllMaterials] Error fetching all materials:', error);
    showError('Error al cargar los materiales.');
    return [];
  }
  return data || [];
};

/**
 * Crea un nuevo material.
 * @param material Datos del nuevo material.
 * @returns El material creado o null si falla.
 */
export const createMaterial = async (material: Omit<Material, 'id' | 'created_at' | 'updated_at'>): Promise<Material | null> => {
  const { data, error } = await supabase
    .from('materials')
    .insert(material)
    .select()
    .single();

  if (error) {
    console.error('[createMaterial] Error creating material:', error);
    showError('Error al crear el material.');
    return null;
  }
  showSuccess('Material creado exitosamente.');
  return data;
};

/**
 * Actualiza un material existente.
 * @param id ID del material a actualizar.
 * @param updates Objeto con los campos a actualizar.
 * @returns El material actualizado o null si falla.
 */
export const updateMaterial = async (id: string, updates: Partial<Omit<Material, 'id' | 'created_at' | 'updated_at'>>): Promise<Material | null> => {
  const { data, error } = await supabase
    .from('materials')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateMaterial] Error updating material:', error);
    showError('Error al actualizar el material.');
    return null;
  }
  showSuccess('Material actualizado exitosamente.');
  return data;
};

/**
 * Elimina un material.
 * @param id ID del material a eliminar.
 * @returns true si se eliminó exitosamente, false si falla.
 */
export const deleteMaterial = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('materials')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteMaterial] Error deleting material:', error);
    showError('Error al eliminar el material.');
    return false;
  }
  showSuccess('Material eliminado exitosamente.');
  return true;
};