// src/integrations/supabase/types/index.ts

export interface Supplier {
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

export interface Material {
  id: string;
  code?: string;
  name: string;
  category?: string;
  unit?: string;
  is_exempt?: boolean;
  user_id: string;
}

export interface Company {
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

export interface QuoteRequest {
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

export interface PurchaseOrder {
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

export interface SupplierMaterialPayload {
  material_id: string;
  specification?: string;
}

export interface QuoteRequestItem {
  id?: string;
  request_id?: string;
  material_name: string;
  quantity: number;
  description?: string;
  unit?: string;
  is_exempt?: boolean;
}

export interface PurchaseOrderItem {
  id?: string;
  order_id?: string;
  material_name: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  is_exempt?: boolean;
}