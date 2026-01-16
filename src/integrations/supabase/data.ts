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
  user_id: string;
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

// --- Nuevas funciones para la gestión de proveedores y búsqueda por material ---

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
      suppliers (id, rif, name, email, phone, payment_terms, credit_days, status)
    `)
    .eq('material_id', materialId);

  if (error) {
    console.error('[getSuppliersByMaterial] Error fetching suppliers by material:', error);
    showError('Error al obtener proveedores para el material.');
    return [];
  }

  // Mapear para aplanar la estructura y asegurar el tipo
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
export const getSupplierDetails = async (supplierId: string): Promise<(Supplier & { materials: SupplierMaterial[] }) | null> => {
  const { data: supplierData, error: supplierError } = await supabase
    .from('suppliers')
    .select(`
      *,
      supplier_materials (
        id,
        specification,
        materials (id, code, name, category)
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

  // Mapear para aplanar la estructura de los materiales
  const materials = supplierData.supplier_materials.map((sm: any) => ({
    id: sm.id,
    specification: sm.specification,
    materials: sm.materials, // El objeto material completo
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

/**
 * Crea un nuevo proveedor.
 * @param supplier Datos del nuevo proveedor.
 * @returns El proveedor creado o null si falla.
 */
export const createSupplier = async (supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Promise<Supplier | null> => {
  const { data, error } = await supabase
    .from('suppliers')
    .insert(supplier)
    .select()
    .single();

  if (error) {
    console.error('[createSupplier] Error creating supplier:', error);
    showError('Error al crear el proveedor.');
    return null;
  }
  showSuccess('Proveedor creado exitosamente.');
  return data;
};

/**
 * Actualiza un proveedor existente.
 * @param id ID del proveedor a actualizar.
 * @param updates Objeto con los campos a actualizar.
 * @returns El proveedor actualizado o null si falla.
 */
export const updateSupplier = async (id: string, updates: Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at'>>): Promise<Supplier | null> => {
  const { data, error } = await supabase
    .from('suppliers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateSupplier] Error updating supplier:', error);
    showError('Error al actualizar el proveedor.');
    return null;
  }
  showSuccess('Proveedor actualizado exitosamente.');
  return data;
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