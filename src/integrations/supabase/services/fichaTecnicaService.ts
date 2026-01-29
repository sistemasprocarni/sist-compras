// src/integrations/supabase/services/fichaTecnicaService.ts

import { supabase } from '../client';
import { showError } from '@/utils/toast';
import { FichaTecnica } from '../types';
import { logAudit } from './auditLogService';

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
      
      // --- AUDIT LOG ---
      logAudit('UPLOAD_FICHA_TECNICA', { 
        ficha_id: newFicha.id, 
        nombre_producto: newFicha.nombre_producto, 
        proveedor_id: newFicha.proveedor_id,
        file_name: payload.fileName
      });
      // -----------------
      
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

  getBySupplierAndProduct: async (proveedorId: string, nombreProducto: string): Promise<FichaTecnica | null> => {
    const { data, error } = await supabase
      .from('fichas_tecnicas')
      .select('*')
      .eq('proveedor_id', proveedorId)
      .eq('nombre_producto', nombreProducto)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('[FichaTecnicaService.getBySupplierAndProduct] Error:', error);
      return null;
    }
    return data as FichaTecnica | null;
  },

  delete: async (fichaId: string, storageUrl: string): Promise<boolean> => {
    // 1. Extract file path from storage URL
    // Example URL: https://[project_id].supabase.co/storage/v1/object/public/fichas/user_id/timestamp_filename.pdf
    const pathSegments = storageUrl.split('/');
    const bucketIndex = pathSegments.indexOf('fichas');
    
    if (bucketIndex === -1 || bucketIndex + 1 >= pathSegments.length) {
      console.error('[FichaTecnicaService.delete] Invalid storage URL format:', storageUrl);
      showError('Error: URL de almacenamiento inválida.');
      return false;
    }
    
    // Path is everything after 'fichas/'
    const filePath = pathSegments.slice(bucketIndex + 1).join('/');
    
    // 2. Delete file from Storage
    const { error: storageError } = await supabase.storage
      .from('fichas')
      .remove([filePath]);

    if (storageError) {
      console.error('[FichaTecnicaService.delete] Storage Delete Error:', storageError);
      showError('Error al eliminar el archivo del almacenamiento.');
      // We continue to delete the DB entry even if storage fails, to clean up metadata
    }

    // 3. Delete metadata from DB
    const { error: dbError } = await supabase
      .from('fichas_tecnicas')
      .delete()
      .eq('id', fichaId);

    if (dbError) {
      console.error('[FichaTecnicaService.delete] DB Delete Error:', dbError);
      // Throwing an error ensures the useMutation onError handler is triggered.
      throw new Error(`Error al eliminar el registro de la base de datos: ${dbError.message}`);
    }

    // --- AUDIT LOG ---
    logAudit('DELETE_FICHA_TECNICA', { 
      ficha_id: fichaId, 
      storage_path: filePath 
    });
    // -----------------

    return true;
  },
};

export const {
  upload: uploadFichaTecnica,
  getAll: getAllFichasTecnicas,
  delete: deleteFichaTecnica,
  getBySupplierAndProduct: getFichaTecnicaBySupplierAndProduct,
} = FichaTecnicaService;