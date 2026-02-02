import { supabase } from "@/integrations/supabase/client";

// --- Type Definitions (Simplified for data layer) ---

export type PurchaseOrder = {
  id: string;
  sequence_number: number | null;
  supplier_id: string;
  company_id: string;
  currency: string;
  exchange_rate: number | null;
  status: string;
  created_at: string;
  user_id: string;
  suppliers: { name: string };
  companies: { name: string };
};

export type QuoteRequest = {
  id: string;
  supplier_id: string;
  company_id: string;
  currency: string;
  exchange_rate: number | null;
  status: string;
  created_at: string;
  user_id: string;
  suppliers: { name: string; email: string | null }; // Added email here
  companies: { name: string };
};

// --- Purchase Order Functions ---

export async function getAllPurchaseOrders(statusFilter: string): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(name), companies(name)')
    .neq('status', 'Deleted')
    .ilike('status', statusFilter === 'Active' ? 'Draft' : statusFilter)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as PurchaseOrder[];
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'Deleted' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function archivePurchaseOrder(id: string): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'Archived' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function unarchivePurchaseOrder(id: string): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'Draft' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function approvePurchaseOrder(id: string): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'Approved' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}


// --- Quote Request Functions ---

export async function getAllQuoteRequests(statusFilter: string): Promise<QuoteRequest[]> {
  // Fetch supplier email to check for sending constraint
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*, suppliers(name, email), companies(name)')
    .neq('status', 'Deleted')
    .ilike('status', statusFilter === 'Active' ? 'Draft' : statusFilter)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as QuoteRequest[];
}

export async function deleteQuoteRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('quote_requests')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function archiveQuoteRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('quote_requests')
    .update({ status: 'Archived' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function unarchiveQuoteRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('quote_requests')
    .update({ status: 'Draft' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function sendQuoteRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('quote_requests')
    .update({ status: 'Sent' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}