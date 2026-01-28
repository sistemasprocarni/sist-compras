import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Material } from '@/integrations/supabase/types';

const fetchMaterials = async (): Promise<Material[]> => {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return data;
};

export const useMaterials = () => {
  return useQuery<Material[], Error>({
    queryKey: ['materials'],
    queryFn: fetchMaterials,
  });
};