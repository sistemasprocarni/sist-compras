import { showError } from '@/utils/toast';

/**
 * Genera un Blob de PDF a partir de una función Edge.
 * @param endpoint - La función Edge a invocar ('generate-qr-pdf' o 'generate-po-pdf').
 * @param body - El cuerpo de la solicitud (ej. { requestId: '...' } o { orderId: '...' }).
 * @param accessToken - El token de acceso del usuario.
 * @returns Promise<Blob> - El Blob del PDF.
 */
export const generatePdfBlob = async (
  endpoint: string,
  body: object,
  accessToken: string
): Promise<Blob> => {
  try {
    const response = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error al generar el PDF.`);
    }

    const blob = await response.blob();
    return blob;
  } catch (error: any) {
    console.error('[generatePdfBlob] Error:', error);
    showError(error.message || 'Error desconocido al generar el PDF.');
    throw error;
  }
};