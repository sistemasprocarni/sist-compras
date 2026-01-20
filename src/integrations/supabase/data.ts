// src/integrations/supabase/data.ts

import { supabase } from './client';
import { showSuccess, showError } from '@/utils/toast';

// Tipos para las tablas
interface Supplier {
  id: string;
  rif: string;
  code?: string;
  name: string;
  email?: string;
  phone?: string;
  phone_2?: string;
  instagram?: string;
  address?: string;
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
  materials: Material;
}

interface PurchaseOrderHeader {
  id?: string;
  sequence_number?: number;
  supplier_id: string;
  company_id: string;
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

interface QuoteRequestHeader {
  id?: string;
  supplier_id: string;
  company_id: string;
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
  description?: string;
  unit?: string;
  quantity: number;
  created_at?: string;
  updated_at?: string;
}

interface Company {
  id: string;
  name: string;
  rif: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  fiscal_data?: any;
  created_at?: string;
  updated_at?: string;
  user_id: string;
}

interface SupplierMaterialPayload {
  material_id: string;
  specification?: string;
}

// Módulo para Proveedores
const SupplierService = {
  search: async (query: string): Promise<Supplier[]> => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .or(`rif.ilike.%${query}%,name.ilike.%${query}%`)
      .eq('status', 'Active');

    if (error) {
      console.error('[SupplierService.search] Error:', error);
      showError('Error al buscar proveedores.');
      return [];
    }
    return data || [];
  },

  getMaterialsBySupplier: async (supplierId: string): Promise<SupplierMaterial[]> => {
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
      console.error('[SupplierService.getMaterialsBySupplier] Error:', error);
      showError('Error al obtener materiales del proveedor.');
      return [];
    }
    return data || [];
  },

  getDetails: async (supplierId: string): Promise<(Supplier & { materials: (SupplierMaterial & { materials: Material })[] }) | null> => {
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
      console.error('[SupplierService.getDetails] Error:', supplierError);
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
  },

  getAll: async (): Promise<Supplier[]> => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[SupplierService.getAll] Error:', error);
      showError('Error al cargar los proveedores.');
      return [];
    }
    return data || [];
  },

  create: async (
    supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>,
    materials: SupplierMaterialPayload[],
  ): Promise<Supplier | null> => {
    const { data: newSupplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert(supplier)
      .select()
      .single();

    if (supplierError) {
      console.error('[SupplierService.create] Error:', supplierError);
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
        console.error('[SupplierService.create] Error al asociar materiales:', materialsError);
        showError('Proveedor creado, pero hubo un error al asociar los materiales.');
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
    showSuccess('Proveedor eliminado exitosamente.');
    return true;
  },
};

// Módulo para Materiales
const MaterialService = {
  search: async (query: string): Promise<Material[]> => {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .or(`name.ilike.%${query}%,code.ilike.%${query}%`);

    if (error) {
      console.error('[MaterialService.search] Error:', error);
      showError('Error al buscar materiales.');
      return [];
    }
    return data || [];
  },

  getSuppliersByMaterial: async (materialId: string): Promise<(Supplier & { specification: string })[]> => {
    const { data, error } = await supabase
      .from('supplier_materials')
      .select(`
        specification,
        suppliers (id, rif, code, name, email, phone, phone_2, instagram, address, payment_terms, custom_payment_terms, credit_days, status)
      `)
      .eq('material_id', materialId);

    if (error) {
      console.error('[MaterialService.getSuppliersByMaterial] Error:', error);
      showError('Error al obtener proveedores para el material.');
      return [];
    }

    return data.map(sm => ({
      ...sm.suppliers,
      specification: sm.specification,
    })) as (Supplier & { specification: string })[] || [];
  },

  getAll: async (): Promise<Material[]> => {
    const { data, error } = await supabase
      .from('materials')
      .select('*');

    if (error) {
      console.error('[MaterialService.getAll] Error:', error);
      showError('Error al cargar los materiales.');
      return [];
    }
    return data || [];
  },

  create: async (material: Omit<Material, 'id' | 'created_at' | 'updated_at'>): Promise<Material | null> => {
    const { data, error } = await supabase
      .from('materials')
      .insert(material)
      .select()
      .single();

    if (error) {
      console.error('[MaterialService.create] Error:', error);
      showError('Error al crear el material.');
      return null;
    }
    showSuccess('Material creado exitosamente.');
    return data;
  },

  update: async (id: string, updates: Partial<Omit<Material, 'id' | 'created_at' | 'updated_at'>>): Promise<Material | null> => {
    const { data, error } = await supabase
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
    showSuccess('Material actualizado exitosamente.');
    return data;
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
    showSuccess('Material eliminado exitosamente.');
    return true;
  },
};

// Módulo para Órdenes de Compra
const PurchaseOrderService = {
  create: async (
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
      console.error('[PurchaseOrderService.create] Error:', orderError);
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
        console.error('[PurchaseOrderService.create] Error al crear ítems:', itemsError);
        showError('Error al crear los ítems de la orden de compra. La orden de compra fue creada, pero los ítems no.');
        return null;
      }
    }

    showSuccess('Orden de compra creada exitosamente.');
    return order;
  },
};

// Módulo para Solicitudes de Cotización
const QuoteRequestService = {
  create: async (
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
      console.error('[QuoteRequestService.create] Error:', requestError);
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
        console.error('[QuoteRequestService.create] Error al crear ítems:', itemsError);
        showError('Error al crear los ítems de la solicitud de cotización. La solicitud fue creada, pero los ítems no.');
        return null;
      }
    }

    showSuccess('Solicitud de cotización creada exitosamente.');
    return request;
  },

  getDetails: async (
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
      console.error('[QuoteRequestService.getDetails] Error:', error);
      showError('Error al obtener los detalles de la solicitud de cotización.');
      return null;
    }

    return request as any;
  },

  update: async (
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
      console.error('[QuoteRequestService.update] Error:', requestError);
      showError('Error al actualizar la solicitud de cotización.');
      return null;
    }

    // Manejar actualizaciones de quote_request_items
    const { data: existingItems, error: fetchError } = await supabase
      .from('quote_request_items')
      .select('id')
      .eq('request_id', id);

    if (fetchError) {
      console.error('[QuoteRequestService.update] Error al obtener ítems existentes:', fetchError);
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
        console.error('[QuoteRequestService.update] Error al eliminar ítems antiguos:', deleteError);
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
          console.error('[QuoteRequestService.update] Error al actualizar ítem:', updateItemError);
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
          console.error('[QuoteRequestService.update] Error al insertar nuevo ítem:', insertError);
          showError('Error al insertar un nuevo ítem en la solicitud.');
          return null;
        }
      }
    }

    showSuccess('Solicitud de cotización actualizada exitosamente.');
    return updatedRequest;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('quote_requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[QuoteRequestService.delete] Error:', error);
      showError('Error al eliminar la solicitud de cotización.');
      return false;
    }
    showSuccess('Solicitud de cotización eliminada exitosamente.');
    return true;
  },

  getAll: async (): Promise<QuoteRequestHeader[]> => {
    const { data, error } = await supabase
      .from('quote_requests')
      .select(`
        *,
        suppliers (name),
        companies (name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[QuoteRequestService.getAll] Error:', error);
      showError('Error al cargar las solicitudes de cotización.');
      return [];
    }
    return data || [];
  },
};

// Módulo para Empresas
const CompanyService = {
  search: async (query: string): Promise<Company[]> => {
    const encodedQuery = encodeURIComponent(query);
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, rif')
      .or(`rif.ilike.%${encodedQuery}%,name.ilike.%${encodedQuery}%`);

    if (error) {
      console.error('[CompanyService.search] Error:', error);
      showError('Error al buscar empresas: ' + error.message);
      return [];
    }
    return data || [];
  },

  getAll: async (): Promise<Company[]> => {
    const { data, error } = await supabase
      .from('companies')
      .select('*');

    if (error) {
      console.error('[CompanyService.getAll] Error:', error);
      showError('Error al cargar las empresas.');
      return [];
    }
    return data || [];
  },

  create: async (company: Omit<Company, 'id' | 'created_at' | 'updated_at' | 'fiscal_data'>): Promise<Company | null> => {
    const { data, error } = await supabase
      .from('companies')
      .insert(company)
      .select()
      .single();

    if (error) {
      console.error('[CompanyService.create] Error:', error);
      showError('Error al crear la empresa.');
      return null;
    }
    showSuccess('Empresa creada exitosamente.');
    return data;
  },

  update: async (id: string, updates: Partial<Omit<Company, 'id' | 'created_at' | 'updated_at' | 'fiscal_data'>>): Promise<Company | null> => {
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[CompanyService.update] Error:', error);
      showError('Error al actualizar la empresa.');
      return null;
    }
    showSuccess('Empresa actualizada exitosamente.');
    return data;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[CompanyService.delete] Error:', error);
      showError('Error al eliminar la empresa.');
      return false;
    }
    showSuccess('Empresa eliminada exitosamente.');
    return true;
  },
};

// Exportar todos los servicios
export const SupplierServiceAPI = SupplierService;
export const MaterialServiceAPI = MaterialService;
export const PurchaseOrderServiceAPI = PurchaseOrderService;
export const QuoteRequestServiceAPI = QuoteRequestService;
export const CompanyServiceAPI = CompanyService;

// Exportar funciones individuales para compatibilidad con código existente
export const searchSuppliers = SupplierService.search;
export const getMaterialsBySupplier = SupplierService.getMaterialsBySupplier;
export const getSupplierDetails = SupplierService.getDetails;
export const getAllSuppliers = SupplierService.getAll;
export const createSupplier = SupplierService.create;
export const updateSupplier = SupplierService.update;
export const deleteSupplier = SupplierService.delete;

export const searchMaterials = MaterialService.search;
export const getSuppliersByMaterial = MaterialService.getSuppliersByMaterial;
export const getAllMaterials = MaterialService.getAll;
export const createMaterial = MaterialService.create;
export const updateMaterial = MaterialService.update;
export const deleteMaterial = MaterialService.delete;

export const createPurchaseOrder = PurchaseOrderService.create;

export const createQuoteRequest = QuoteRequestService.create;
export const getQuoteRequestDetails = QuoteRequestService.getDetails;
export const updateQuoteRequest = QuoteRequestService.update;
export const deleteQuoteRequest = QuoteRequestService.delete;
export const getAllQuoteRequests = QuoteRequestService.getAll;

export const searchCompanies = CompanyService.search;
export const getAllCompanies = CompanyService.getAll;
export const createCompany = CompanyService.create;
export const updateCompany = CompanyService.update;
export const deleteCompany = CompanyService.delete;