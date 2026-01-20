import { supabase } from '@/integrations/supabase/client';

// Define the SupplierResult interface to match the expected output
interface SupplierResult {
  id: string;
  name: string;
  rif: string;
  email?: string;
  phone?: string;
  phone_2?: string;
  instagram?: string;
  payment_terms: string;
  credit_days: number;
  status: string;
  specification: string; // This will hold the material specification that matched
}

// Function to search for materials (kept for reference, though not used in the new SmartSearch flow)
export async function searchMaterials(query: string) {
  const { data, error } = await supabase
    .from('materials')
    .select('id, name, code, category')
    .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error('Error searching materials:', error);
    throw error;
  }
  return data;
}

// Function to get suppliers by a specific material ID (kept for reference)
export async function getSuppliersByMaterial(materialId: string) {
  const { data, error } = await supabase
    .from('supplier_materials')
    .select(`
      specification,
      suppliers (
        id,
        name,
        rif,
        email,
        phone,
        phone_2,
        instagram,
        payment_terms,
        credit_days,
        status
      )
    `)
    .eq('material_id', materialId);

  if (error) {
    console.error('Error fetching suppliers by material:', error);
    throw error;
  }

  return data.map((item: any) => ({
    ...item.suppliers,
    specification: item.specification,
  }));
}

// New function to search for suppliers directly by material name or code query
export async function searchSuppliersByMaterialNameQuery(query: string): Promise<SupplierResult[]> {
  if (!query) return [];

  const { data, error } = await supabase
    .from('supplier_materials')
    .select(`
      suppliers (
        id,
        name,
        rif,
        email,
        phone,
        phone_2,
        instagram,
        payment_terms,
        credit_days,
        status
      ),
      materials (
        name,
        code
      ),
      specification
    `)
    .or(`materials.name.ilike.%${query}%,materials.code.ilike.%${query}%`);

  if (error) {
    console.error('Error searching suppliers by material name:', error);
    throw error;
  }

  const uniqueSuppliersMap = new Map<string, SupplierResult>();

  data.forEach((item: any) => {
    const supplier = item.suppliers;
    const material = item.materials;
    const specification = item.specification;

    if (supplier) {
      // If a supplier sells multiple materials matching the query,
      // we'll use the specification from the first match found.
      if (!uniqueSuppliersMap.has(supplier.id)) {
        uniqueSuppliersMap.set(supplier.id, {
          id: supplier.id,
          name: supplier.name,
          rif: supplier.rif,
          email: supplier.email,
          phone: supplier.phone,
          phone_2: supplier.phone_2,
          instagram: supplier.instagram,
          payment_terms: supplier.payment_terms,
          credit_days: supplier.credit_days,
          status: supplier.status,
          specification: specification || `Material: ${material?.name || 'N/A'}` // Include material info
        });
      }
    }
  });

  return Array.from(uniqueSuppliersMap.values());
}