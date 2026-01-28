import { supabase } from "@/integrations/supabase/client";
import { PurchaseOrder, Supplier, TopMaterial, TopSupplier } from "./types";

// Re-export all functions from the services index
export * from './services';

// Note: The functions previously defined here (getAllPurchaseOrders, getAllSuppliers, getTopMaterialsByQuantity, getTopSuppliersByOrderCount)
// are now imported from their respective service files via the index export.
// We keep the types import for reference, although they are also exported via services/index.ts -> types/index.ts