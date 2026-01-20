import { supabase } from './client';
import { showError, showSuccess } from '@/utils/toast';

// Tipos e interfaces
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
  code?: string;
  name: string;
  category?: string;
  unit?: string;
  user_id: string;
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
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface QuoteRequest {
  id: string;
  supplier_id: string;
  company_id: string;
  currency: string;
  exchange_rate?: number | null;
  status: string;
  created_at: string;
  created_by?: string;
  user_id: string;
}

interface PurchaseOrder {
  id: string;
  sequence_number?: number;
  supplier_id: string;
  company_id: string;
  currency: string;
  exchange_rate?: number | null;
  status: string;
  created_at: string;
  created_by?: string;
  user_id: string;
}

interface SupplierMaterialPayload {
  material_id: string;
  specification?: string;
}

interface QuoteRequestItem {
  id?: string;
  request_id?: string;
  material_name: string;
  quantity: number;
  description?: string;
  unit?: string;
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

// Servicios modulares
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
    return true;
  },

  search: async (query: string): Promise<Supplier[]> => {
    if (!query.trim()) return [];

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
    return true;
  },

  search: async (query: string): Promise<Material[]> => {
    if (!query.trim()) return [];

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

const CompanyService = {
  getAll: async (): Promise<Company[]> => {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[CompanyService.getAll] Error:', error);
      showError('Error al cargar empresas.');
      return [];
    }
    return data;
  },

  create: async (companyData: Omit<Company, 'id' | 'created_at' | 'updated_at'>): Promise<Company | null> => {
    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert(companyData)
      .select()
      .single();

    if (error) {
      console.error('[CompanyService.create] Error:', error);
      showError('Error al crear la empresa.');
      return null;
    }
    return newCompany;
  },

  update: async (id: string, updates: Partial<Omit<Company, 'id' | 'created_at' | 'updated_at'>>): Promise<Company | null> => {
    const { data: updatedCompany, error } = await supabase
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
    return updatedCompany;
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
    return true;
  },

  search: async (query: string): Promise<Company[]> => {
    if (!query.trim()) return [];

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .or(`name.ilike.%${query}%,rif.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('[CompanyService.search] Error:', error);
      return [];
    }
    return data;
  },
};

const QuoteRequestService = {
  getAll: async (): Promise<QuoteRequest[]> => {
    const { data, error } = await supabase
      .from('quote_requests')
      .select('*, suppliers(name), companies(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[QuoteRequestService.getAll] Error:', error);
      showError('Error al cargar solicitudes de cotización.');
      return [];
    }
    return data;
  },

  create: async (requestData: Omit<QuoteRequest, 'id' | 'created_at'>, items: Omit<QuoteRequestItem, 'id' | 'request_id'>[]): Promise<QuoteRequest | null> => {
    const { data: newRequest, error: requestError } = await supabase
      .from('quote_requests')
      .insert(requestData)
      .select()
      .single();

    if (requestError) {
      console.error('[QuoteRequestService.create] Error:', requestError);
      showError('Error al crear la solicitud de cotización.');
      return null;
    }

    if (items && items.length > 0) {
      const requestItems = items.map(item => ({
        request_id: newRequest.id,
        material_name: item.material_name,
        quantity: item.quantity,
        description: item.description,
        unit: item.unit,
      }));

      const { error: itemsError } = await supabase
        .from('quote_request_items')
        .insert(requestItems);

      if (itemsError) {
        console.error('[QuoteRequestService.create] Error al crear ítems:', itemsError);
        showError('Error al crear los ítems de la solicitud.');
        return null;
      }
    }

    return newRequest;
  },

  update: async (id: string, updates: Partial<Omit<QuoteRequest, 'id' | 'created_at'>>, items: Omit<QuoteRequestItem, 'id' | 'request_id'>[]): Promise<QuoteRequest | null> => {
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

    // Eliminar ítems existentes
    const { error: deleteError } = await supabase
      .from('quote_request_items')
      .delete()
      .eq('request_id', id);

    if (deleteError) {
      console.error('[QuoteRequestService.update] Error al eliminar ítems antiguos:', deleteError);
      showError('Error al actualizar los ítems de la solicitud.');
      return null;
    }

    // Insertar nuevos ítems
    if (items && items.length > 0) {
      const requestItems = items.map(item => ({
        request_id: id,
        material_name: item.material_name,
        quantity: item.quantity,
        description: item.description,
        unit: item.unit,
      }));

      const { error: itemsError } = await supabase
        .from('quote_request_items')
        .insert(requestItems);

      if (itemsError) {
        console.error('[QuoteRequestService.update] Error al crear nuevos ítems:', itemsError);
        showError('Error al actualizar los ítems de la solicitud.');
        return null;
      }
    }

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
    return true;
  },

  getById: async (id: string): Promise<QuoteRequest | null> => {
    const { data, error } = await supabase
      .from('quote_requests')
      .select('*, suppliers(*), companies(*), quote_request_items(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[QuoteRequestService.getById] Error:', error);
      return null;
    }
    return data;
  },
};

const PurchaseOrderService = {
  getAll: async (): Promise<PurchaseOrder[]> => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name), companies(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PurchaseOrderService.getAll] Error:', error);
      showError('Error al cargar órdenes de compra.');
      return [];
    }
    return data;
  },

  create: async (orderData: Omit<PurchaseOrder, 'id' | 'created_at'>, items: Omit<PurchaseOrderItem, 'id' | 'order_id'>[]): Promise<PurchaseOrder | null> => {
    const { data: newOrder, error: orderError } = await supabase
      .from('purchase_orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('[PurchaseOrderService.create] Error:', orderError);
      showError('Error al crear la orden de compra.');
      return null;
    }

    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        order_id: newOrder.id,
        material_name: item.material_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        is_exempt: item.is_exempt,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('[PurchaseOrderService.create] Error al crear ítems:', itemsError);
        showError('Error al crear los ítems de la orden.');
        return null;
      }
    }

    return newOrder;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[PurchaseOrderService.delete] Error:', error);
      showError('Error al eliminar la orden de compra.');
      return false;
    }
    return true;
  },

  getById: async (id: string): Promise<PurchaseOrder | null> => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(*), companies(*), purchase_order_items(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[PurchaseOrderService.getById] Error:', error);
      return null;
    }
    return data;
  },
};

// Funciones adicionales
export const getSuppliersByMaterial = async (materialId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('supplier_materials')
    .select('*, suppliers(*)')
    .eq('material_id', materialId);

  if (error) {
    console.error('[getSuppliersByMaterial] Error:', error);
    return [];
  }

  return data.map(sm => ({
    ...sm.suppliers,
    specification: sm.specification,
  }));
};

// Exportaciones individuales para mantener compatibilidad
export const getAllSuppliers = SupplierService.getAll;
export const createSupplier = SupplierService.create;
export const updateSupplier = SupplierService.update;
export const deleteSupplier = SupplierService.delete;
export const searchSuppliers = SupplierService.search;
export const getSupplierDetails = SupplierService.getById;

export const getAllMaterials = MaterialService.getAll;
export const createMaterial = MaterialService.create;
export const updateMaterial = MaterialService.update;
export const deleteMaterial = MaterialService.delete;
export const searchMaterials = MaterialService.search;

export const getAllCompanies = CompanyService.getAll;
export const createCompany = CompanyService.create;
export const updateCompany = CompanyService.update;
export const deleteCompany = CompanyService.delete;
export const searchCompanies = CompanyService.search;

export const getAllQuoteRequests = QuoteRequestService.getAll;
export const createQuoteRequest = QuoteRequestService.create;
export const updateQuoteRequest = QuoteRequestService.update;
export const deleteQuoteRequest = QuoteRequestService.delete;
export const getQuoteRequestDetails = QuoteRequestService.getById;

export const getAllPurchaseOrders = PurchaseOrderService.getAll;
export const createPurchaseOrder = PurchaseOrderService.create;
export const deletePurchaseOrder = PurchaseOrderService.delete;
export const getPurchaseOrderDetails = PurchaseOrderService.getById;