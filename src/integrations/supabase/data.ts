import { supabase } from './client';
import { showError } from '@/utils/toast';
import {
  getAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  searchSuppliers,
  getSupplierDetails,
  getAllMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  searchMaterials,
  getAllCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  searchCompanies,
  getAllQuoteRequests,
  createQuoteRequest,
  updateQuoteRequest,
  deleteQuoteRequest,
  getQuoteRequestDetails,
  getAllPurchaseOrders,
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderDetails,
} from './services';

// Funciones adicionales que no encajan directamente en un servicio CRUD
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
export {
  getAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  searchSuppliers,
  getSupplierDetails,
  getAllMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  searchMaterials,
  getAllCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  searchCompanies,
  getAllQuoteRequests,
  createQuoteRequest,
  updateQuoteRequest,
  deleteQuoteRequest,
  getQuoteRequestDetails,
  getAllPurchaseOrders,
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderDetails,
};