// src/integrations/supabase/services/fichaTecnicaService.ts

import { supabase } from '../client';
import { showError } from '@/utils/toast';
import { FichaTecnica } from '../types';

interface UploadPayload {
  nombre_producto: string;
  proveedor_id: string;
  fileBase64: string;
  fileName: string;
  mimeType: string;
}

const FichaTecnicaService = {
  upload: async (payload: UploadPayload): Promise<FichaTecnica | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showError('Sesión no activa. Por favor, inicia sesión.');
      return null;
    }

    try {
      const response = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/upload-ficha-tecnica`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error desconocido al subir la ficha técnica.');
      }

      const newFicha: FichaTecnica = await response.json();
      return newFicha;

    } catch (error: any) {
      console.error('[FichaTecnicaService.upload] Error:', error);
      showError(error.message || 'Error al subir la ficha técnica.');
      return null;
    }
  },

  getAll: async (): Promise<FichaTecnica[]> => {
    const { data, error } = await supabase
      .from('fichas_tecnicas')
      .select('*, suppliers(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FichaTecnicaService.getAll] Error:', error);
      showError('Error al cargar fichas técnicas.');
      return [];
    }
    return data as FichaTecnica[];
  },
};

export const {
  upload: uploadFichaTecnica,
  getAll: getAllFichasTecnicas,
} = FichaTecnicaService;