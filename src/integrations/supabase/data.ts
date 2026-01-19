// src/integrations/supabase/data.ts

import { supabase } from './client';
import { showSuccess, showError } from '@/utils/toast';

// Tipos para las tablas (puedes expandirlos según sea necesario)
interface Supplier {
  id: string;
  rif: string;
  code?: string; // New: Add code field
  name: string;
  email?: string;
  phone?: string;
  phone_2?: string; // Nuevo campo
  instagram?: string; // Nuevo campo
  address?: string; // New: Add address field
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
  sequence_number?: number; // Added for PO sequence
  supplier_id: string;
  company_id: string; // Keep company_id as it's in the DB, but it will be set internally
  currency: string;
  exchange_rate?: number;
  status?: string;
  created_by?: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
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

// Nuevas interfaces para Solicitud de Cotización
interface QuoteRequestHeader {
  id?: string;
  supplier_id: string;
  company_id: string; // Keep company_id as it's in the DB, but it will be set internally
  currency: string;
  exchange_rate?: number | null;
  status?: string;
  created_by?: string;
  user_id: string;
  created_at?: string;
}

interface QuoteRequestItem {
  id?: string;
  request_id?: string;
  material_name: string;
  description?: string; // Nueva columna
  unit?: string; // Nueva columna
  quantity: number;
  created_at?: string;
  updated_at?: string;
}

interface Company { // Re-defining Company interface for clarity in data.ts
  id: string;
  name: string;
  rif: string; // Added RIF
  logo_url?: string;
  address?: string; // Added address
  phone?: string; // Added phone
  email?: string; // Added email
  fiscal_data?: any;
  created_at?: string;
  updated_at?: string;
  user_id: string;
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
  orderData: Omit<PurchaseOrderHeader, 'id' | 'sequence_number' | 'created_at' | 'updated_at'>,
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
      suppliers (id, rif, code, name, email, phone, phone_2, instagram, address, payment_terms, custom_payment_terms, credit_days, status)
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

// --- Funciones CRUD para Solicitudes de Cotización (Quote Requests) ---

/**
 * Crea una nueva solicitud de cotización con sus ítems.
 * @param requestData Datos de la cabecera de la solicitud de cotización.
 * @param itemsData Array de ítems de la solicitud de cotización.
 * @returns La solicitud de cotización creada o null si falla.
 */
export const createQuoteRequest = async (
  requestData: Omit<QuoteRequestHeader, 'id' | 'created_at'>,
  itemsData: Omit<QuoteRequestItem, 'id' | 'request_id' | 'created_at' | 'updated_at'>[]
): Promise<QuoteRequestHeader | null> => {
  if (requestData.currency === 'VES' && (!requestData.exchange_rate || requestData.exchange_rate <= 0)) {
    showError('La tasa de cambio debe ser mayor que cero para solicitudes en Bolívares.');
    return null;
  }

  const { data: request, error: requestError } = await supabase
    .from('quote_requests')
    .insert(requestData)
    .select()
    .single();

  if (requestError) {
    console.error('[createQuoteRequest] Error creating quote request header:', requestError);
    showError('Error al crear la cabecera de la solicitud de cotización.');
    return null;
  }

  if (request && itemsData.length > 0) {
    const itemsWithRequestId = itemsData.map(item => ({
      ...item,
      request_id: request.id,
    }));

    const { error: itemsError } = await supabase
      .from('quote_request_items')
      .insert(itemsWithRequestId);

    if (itemsError) {
      console.error('[createQuoteRequest] Error creating quote request items:', itemsError);
      showError('Error al crear los ítems de la solicitud de cotización. La solicitud fue creada, pero los ítems no.');
      return null;
    }
  }

  showSuccess('Solicitud de cotización creada exitosamente.');
  return request;
};

/**
 * Obtiene los detalles completos de una solicitud de cotización.
 * @param requestId ID de la solicitud de cotización.
 * @returns Objeto con los detalles de la solicitud, proveedor, empresa y sus ítems.
 */
export const getQuoteRequestDetails = async (
  requestId: string
): Promise<(QuoteRequestHeader & {
  suppliers: Pick<Supplier, 'id' | 'name' | 'rif' | 'email' | 'phone' | 'phone_2' | 'instagram' | 'address'>;
  companies: Pick<Company, 'id' | 'name' | 'logo_url' | 'fiscal_data'>;
  quote_request_items: QuoteRequestItem[];
}) | null> => {
  const { data: request, error } = await supabase
    .from('quote_requests')
    .select(`
      *,
      suppliers (id, name, rif, email, phone, phone_2, instagram, address),
      companies (id, name, logo_url, fiscal_data),
      quote_request_items (*)
    `)
    .eq('id', requestId)
    .single();

  if (error) {
    console.error('[getQuoteRequestDetails] Error fetching quote request details:', error);
    showError('Error al obtener los detalles de la solicitud de cotización.');
    return null;
  }

  return request as any; // Cast para manejar la complejidad del tipo de retorno con joins
};

/**
 * Actualiza una solicitud de cotización existente y sus ítems.
 * @param id ID de la solicitud de cotización a actualizar.
 * @param updates Objeto con los campos a actualizar de la solicitud.
 * @param items Lista de ítems a asociar (para actualizar/crear/eliminar).
 * @returns La solicitud de cotización actualizada o null si falla.
 */
export const updateQuoteRequest = async (
  id: string,
  updates: Partial<Omit<QuoteRequestHeader, 'id' | 'created_at'>>,
  items: Omit<QuoteRequestItem, 'created_at' | 'updated_at'>[]
): Promise<QuoteRequestHeader | null> => {
  const { data: updatedRequest, error: requestError } = await supabase
    .from('quote_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (requestError) {
    console.error('[updateQuoteRequest] Error updating quote request header:', requestError);
    showError('Error al actualizar la solicitud de cotización.');
    return null;
  }

  // Manejar actualizaciones de quote_request_items
  const { data: existingItems, error: fetchError } = await supabase
    .from('quote_request_items')
    .select('id')
    .eq('request_id', id);

  if (fetchError) {
    console.error('[updateQuoteRequest] Error fetching existing quote request items:', fetchError);
    showError('Error al actualizar los ítems de la solicitud de cotización.');
    return null;
  }

  const existingItemIds = new Set(existingItems.map(item => item.id));
  const newItemIds = new Set(items.filter(item => item.id).map(item => item.id));

  // Ítems a eliminar (existentes que ya no están en la lista nueva)
  const itemsToDelete = existingItems.filter(item => !newItemIds.has(item.id));
  if (itemsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('quote_request_items')
      .delete()
      .in('id', itemsToDelete.map(item => item.id));
    if (deleteError) {
      console.error('[updateQuoteRequest] Error deleting old quote request items:', deleteError);
      showError('Error al eliminar ítems antiguos de la solicitud.');
      return null;
    }
  }

  // Ítems a insertar/actualizar
  for (const item of items) {
    if (item.id && existingItemIds.has(item.id)) {
      // Actualizar ítem existente
      const { error: updateItemError } = await supabase
        .from('quote_request_items')
        .update({
          material_name: item.material_name,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
        })
        .eq('id', item.id);
      if (updateItemError) {
        console.error('[updateQuoteRequest] Error updating quote request item:', updateItemError);
        showError('Error al actualizar un ítem de la solicitud.');
        return null;
      }
    } else {
      // Insertar nuevo ítem
      const { error: insertError } = await supabase
        .from('quote_request_items')
        .insert({
          request_id: id,
          material_name: item.material_name,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
        });
      if (insertError) {
        console.error('[updateQuoteRequest] Error inserting new quote request item:', insertError);
        showError('Error al insertar un nuevo ítem en la solicitud.');
        return null;
      }
    }
  }

  showSuccess('Solicitud de cotización actualizada exitosamente.');
  return updatedRequest;
};

/**
 * Elimina una solicitud de cotización.
 * @param id ID de la solicitud de cotización a eliminar.
 * @returns true si se eliminó exitosamente, false si falla.
 */
export const deleteQuoteRequest = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('quote_requests')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteQuoteRequest] Error deleting quote request:', error);
    showError('Error al eliminar la solicitud de cotización.');
    return false;
  }
  showSuccess('Solicitud de cotización eliminada exitosamente.');
  return true;
};

/**
 * Obtiene todas las solicitudes de cotización para el usuario actual.
 * @returns Lista de todas las solicitudes de cotización.
 */
export const getAllQuoteRequests = async (): Promise<QuoteRequestHeader[]> => {
  const { data, error } = await supabase
    .from('quote_requests')
    .select(`
      *,
      suppliers (name),
      companies (name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getAllQuoteRequests] Error fetching all quote requests:', error);
    showError('Error al cargar las solicitudes de cotización.');
    return [];
  }
  return data || [];
};

// --- Funciones CRUD para Empresas (Companies) ---

/**
 * Busca empresas por RIF o nombre.
 * @param query Cadena de búsqueda.
 * @returns Lista de empresas que coinciden.
 */
export const searchCompanies = async (query: string): Promise<Company[]> => {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, rif') // Solo necesitamos id, name y rif para el SmartSearch
    .or(`rif.ilike.%${query}%,name.ilike.%${query}%`);

  if (error) {
    console.error('[searchCompanies] Error searching companies:', error);
    showError('Error al buscar empresas.');
    return [];
  }
  return data || [];
};

/**
 * Obtiene todas las empresas.
 * @returns Lista de todas las empresas.
 */
export const getAllCompanies = async (): Promise<Company[]> => {
  const { data, error } = await supabase
    .from('companies')
    .select('*');

  if (error) {
    console.error('[getAllCompanies] Error fetching all companies:', error);
    showError('Error al cargar las empresas.');
    return [];
  }
  return data || [];
};

/**
 * Crea una nueva empresa.
 * @param company Datos de la nueva empresa.
 * @returns La empresa creada o null si falla.
 */
export const createCompany = async (company: Omit<Company, 'id' | 'created_at' | 'updated_at' | 'fiscal_data'>): Promise<Company | null> => {
  const { data, error } = await supabase
    .from('companies')
    .insert(company)
    .select()
    .single();

  if (error) {
    console.error('[createCompany] Error creating company:', error);
    showError('Error al crear la empresa.');
    return null;
  }
  showSuccess('Empresa creada exitosamente.');
  return data;
};

/**
 * Actualiza una empresa existente.
 * @param id ID de la empresa a actualizar.
 * @param updates Objeto con los campos a actualizar.
 * @returns La empresa actualizada o null si falla.
 */
export const updateCompany = async (id: string, updates: Partial<Omit<Company, 'id' | 'created_at' | 'updated_at' | 'fiscal_data'>>): Promise<Company | null> => {
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateCompany] Error updating company:', error);
    showError('Error al actualizar la empresa.');
    return null;
  }
  showSuccess('Empresa actualizada exitosamente.');
  return data;
};

/**
 * Elimina una empresa.
 * @param id ID de la empresa a eliminar.
 * @returns true si se eliminó exitosamente, false si falla.
 */
export const deleteCompany = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteCompany] Error deleting company:', error);
    showError('Error al eliminar la empresa.');
    return false;
  }
  showSuccess('Empresa eliminada exitosamente.');
  return true;
};