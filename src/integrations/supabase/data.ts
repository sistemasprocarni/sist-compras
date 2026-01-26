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
  archiveQuoteRequest, // Exported
  unarchiveQuoteRequest, // Exported
  getAllPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderDetails,
  archivePurchaseOrder, // Exported
  unarchivePurchaseOrder, // Exported
  createSupplierMaterialRelation,
  uploadFichaTecnica,
  getAllFichasTecnicas,
  deleteFichaTecnica,
  getFichaTecnicaBySupplierAndProduct, // Exported
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

// NEW FUNCTION: Search materials associated with a specific supplier
export const searchMaterialsBySupplier = async (supplierId: string, query: string): Promise<any[]> => {
  if (!supplierId) {
    return [];
  }

  let selectQuery = supabase
    .from('supplier_materials')
    .select('materials:material_id(id, name, code, category, unit, is_exempt), specification')
    .eq('supplier_id', supplierId);

  const { data: relations, error } = await selectQuery.limit(50);

  if (error) {
    console.error('[searchMaterialsBySupplier] Error:', error);
    return [];
  }

  let materials = relations.map(sm => ({
    ...sm.materials,
    specification: sm.specification,
  })).filter(m => m !== null);

  // Client-side filtering based on query
  if (query.trim()) {
    const lowerCaseQuery = query.toLowerCase();
    materials = materials.filter(m =>
      m.name.toLowerCase().includes(lowerCaseQuery) ||
      (m.code && m.code.toLowerCase().includes(lowerCaseQuery))
    );
  }

  return materials.slice(0, 10);
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
  archiveQuoteRequest,
  unarchiveQuoteRequest,
  getAllPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderDetails,
  archivePurchaseOrder,
  unarchivePurchaseOrder,
  createSupplierMaterialRelation,
  uploadFichaTecnica,
  getAllFichasTecnicas,
  deleteFichaTecnica,
  getFichaTecnicaBySupplierAndProduct,
};