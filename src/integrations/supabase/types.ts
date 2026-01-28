// Define types for Supabase tables and custom function results

// Assuming existing types like PurchaseOrder and Supplier are here...

export type PurchaseOrder = {
  id: string;
  sequence_number: number | null;
  supplier_id: string;
  company_id: string;
  currency: string;
  exchange_rate: number | null;
  status: 'Draft' | 'Sent' | 'Received' | 'Cancelled';
  created_at: string;
  created_by: string | null;
  user_id: string;
  delivery_date: string | null;
  payment_terms: string | null;
  custom_payment_terms: string | null;
  credit_days: number | null;
  observations: string | null;
  quote_request_id: string | null;
};

export type Supplier = {
  id: string;
  rif: string;
  name: string;
  email: string | null;
  phone: string | null;
  payment_terms: string;
  credit_days: number | null;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string | null;
  user_id: string | null;
  custom_payment_terms: string | null;
  phone_2: string | null;
  instagram: string | null;
  address: string | null;
  code: string | null;
};

// New types for analysis
export type TopSupplier = {
  supplier_id: string;
  supplier_name: string;
  order_count: number;
};

export type TopMaterial = {
  material_name: string;
  total_quantity: number;
};