import { supabase } from "@/integrations/supabase/client";

// Re-export all services from the index file
export * from './services';

// Note: The functions previously defined here (like getAllPurchaseOrders, etc.) 
// are now exported directly from the services index.