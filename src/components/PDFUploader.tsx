import React from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { showError, showLoading, dismissToast } from '@/utils/toast';

interface PDFUploaderProps {
  onUploadComplete: (publicUrl: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({ onUploadComplete, children, disabled = false }) => {
  const { session } = useSession();

  const handleUpload = async (pdfBlob: Blob, filename: string) => {
    if (!session) {
      showError('No hay sesión activa para subir el PDF.');
      return;
    }

    const toastId = showLoading('Subiendo PDF a almacenamiento temporal...');

    try {
      // Convertir Blob a Base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = (error) => {
          console.error('[PDFUploader] Error converting blob to base64:', error);
          reject(error);
        };
        reader.readAsDataURL(pdfBlob);
      });

      // Llamar a la función Edge para subir el PDF
      const response = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/upload-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Data: base64Data,
          filename: filename,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al subir el PDF.');
      }

      const { publicUrl } = await response.json();
      dismissToast(toastId);
      onUploadComplete(publicUrl);

    } catch (error: any) {
      console.error('[PDFUploader] Error uploading PDF:', error);
      dismissToast(toastId);
      showError(error.message || 'Error desconocido al subir el PDF.');
    }
  };

  return (
    <div onClick={() => {}} className={disabled ? 'opacity-50 cursor-not-allowed' : ''}>
      {children}
    </div>
  );
};

export default PDFUploader;