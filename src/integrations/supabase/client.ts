import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is not defined in environment variables.');
  // Depending on the application's criticality, you might want to throw an error
  // or provide a fallback/mock client in a production environment.
  // For development, a console error is usually sufficient.
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);