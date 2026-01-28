import { supabase } from '@/integrations/supabase/client';
import { Material } from '@/integrations/supabase/types';

export const searchMaterials = async (query: string): Promise<Material[]> => {
  if (!query) return [];
  
  const { data, error } = await supabase
    .from('materials')
    .select('id, name') // Only select necessary fields for search results
    .ilike('name', `%${query}%`)
    .limit(10);

  if (error) {
    console.error("[searchMaterials] Error searching materials:", error);
    throw error;
  }
  return data as Material[];
};