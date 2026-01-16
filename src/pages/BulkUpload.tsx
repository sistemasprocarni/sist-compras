import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { UploadCloud, FileText, Download } from 'lucide-react';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';

interface UploadResult {
  successCount: number;
  failureCount: number;
  errors: Array<{ row: number; data: any; reason: string }>;
  message: string;
}

const BulkUpload = () => {
  const { session } = useSession();
  const [supplierFile, setSupplierFile] = useState<File | null>(null);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [relationFile, setRelationFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'supplier' | 'material' | 'supplier_material_relation') => {
    if (event.target.files && event.target.files[0]) {
      if (type === 'supplier') {
        setSupplierFile(event.target.files[0]);
      } else if (type === 'material') {
        setMaterialFile(event.target.files[0]);
      } else {
        setRelationFile(event.target.files[0]);
      }
      setUploadResult(null); // Clear previous results
    }
  };

  const handleUpload = async (type: 'supplier' | 'material' | 'supplier_material_relation') => {
    const file = type === 'supplier' ? supplierFile : (type === 'material' ? materialFile : relationFile);
    if (!file) {
      showError('Por favor, selecciona un archivo Excel para cargar.');
      return;
    }
    if (!session) {
      showError('No hay sesión activa. Por favor, inicia sesión.');
      return;
    }

    setUploading(true);
    const loadingToastId = showLoading(`Cargando y procesando ${type === 'supplier' ? 'proveedores' : (type === 'material' ? 'materiales' : 'relaciones proveedor-material')}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/bulk-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error al procesar la carga masiva de ${type === 'supplier' ? 'proveedores' : (type === 'material' ? 'materiales' : 'relaciones proveedor-material')}.`);
      }

      const result: UploadResult = await response.json();
      setUploadResult(result);

      dismissToast(loadingToastId); // Dismiss the loading toast
      if (result.failureCount > 0) {
        showError(`Carga completada con ${result.failureCount} errores. Revisa los detalles.`);
      } else {
        showSuccess(result.message);
      }

      // Clear the file input after successful upload
      if (type === 'supplier') {
        setSupplierFile(null);
      } else if (type === 'material') {
        setMaterialFile(null);
      } else {
        setRelationFile(null);
      }

    } catch (error: any) {
      console.error('[BulkUpload] Error during upload:', error);
      dismissToast(loadingToastId); // Dismiss the loading toast even on error
      showError(error.message || 'Error desconocido al realizar la carga masiva.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async (type: 'supplier' | 'material' | 'supplier_material_relation') => {
    if (!session) {
      showError('No hay sesión activa. Por favor, inicia sesión para descargar la plantilla.');
      return;
    }

    setDownloadingTemplate(true);
    const loadingToastId = showLoading(`Generando plantilla de ${type === 'supplier' ? 'proveedores' : (type === 'material' ? 'materiales' : 'relaciones proveedor-material')}...`);

    try {
      const response = await fetch(`https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/generate-template`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al generar la plantilla.');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const fileNameMatch = contentDisposition && contentDisposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch ? fileNameMatch[1] : `template_${type}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      dismissToast(loadingToastId); // Dismiss the loading toast
      showSuccess('Plantilla descargada exitosamente.');
    } catch (error: any) {
      console.error('[BulkUpload] Error downloading template:', error);
      dismissToast(loadingToastId); // Dismiss the loading toast even on error
      showError(error.message || 'Error desconocido al descargar la plantilla.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const renderUploadSection = (type: 'supplier' | 'material' | 'supplier_material_relation') => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sube un archivo Excel (.xlsx) con los datos de {type === 'supplier' ? 'tus proveedores' : (type === 'material' ? 'tus materiales' : 'las relaciones entre proveedores y materiales')}.
        Asegúrate de que el archivo siga el formato de plantilla especificado.
      </p>
      <div className="flex items-center space-x-2">
        <Input
          id={`file-upload-${type}`}
          type="file"
          accept=".xlsx"
          onChange={(e) => handleFileChange(e, type)}
          disabled={uploading}
          className="flex-1"
        />
        <Button
          onClick={() => handleUpload(type)}
          disabled={uploading || (type === 'supplier' ? !supplierFile : (type === 'material' ? !materialFile : !relationFile))}
          className="bg-procarni-secondary hover:bg-green-700"
        >
          <UploadCloud className="mr-2 h-4 w-4" />
          {uploading ? 'Cargando...' : 'Subir Archivo'}
        </Button>
      </div>

      {uploadResult && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Resultados de la Carga</CardTitle>
            <CardDescription>
              {uploadResult.successCount} registros procesados exitosamente, {uploadResult.failureCount} con errores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploadResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-destructive">Errores ({uploadResult.failureCount}):</h4>
                <ul className="list-disc pl-5 text-sm text-destructive">
                  {uploadResult.errors.map((err, index) => (
                    <li key={index}>
                      Fila {err.row}: {err.reason} (Datos: {JSON.stringify(err.data)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {uploadResult.errors.length === 0 && (
              <p className="text-sm text-green-600">Todos los registros se procesaron sin errores.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 p-4 border rounded-md bg-muted/20">
        <h4 className="font-semibold mb-2 flex items-center">
          <FileText className="mr-2 h-4 w-4" />
          Plantilla de Ejemplo para {type === 'supplier' ? 'Proveedores' : (type === 'material' ? 'Materiales' : 'Relaciones Proveedor-Material')}
        </h4>
        <p className="text-sm text-muted-foreground">
          Descarga la plantilla para asegurarte de que tu archivo Excel tenga el formato correcto.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => handleDownloadTemplate(type)}
          disabled={downloadingTemplate}
        >
          <Download className="mr-2 h-4 w-4" />
          {downloadingTemplate ? 'Generando...' : 'Descargar Plantilla'}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          **Columnas esperadas para {type === 'supplier' ? 'Proveedores' : (type === 'material' ? 'Materiales' : 'Relaciones Proveedor-Material')}:**
          <br />
          {type === 'supplier' ? (
            <>
              `Código` (opcional, se autogenera si está vacío, ej: P001), `RIF` (requerido, ej: J123456789), `Nombre` (requerido), `Email`, `Teléfono Principal`, `Teléfono Secundario`, `Instagram`, `Dirección`, `Términos de Pago` (Contado, Crédito, Otro), `Términos de Pago Personalizados` (si es 'Otro'), `Días de Crédito` (si es 'Crédito'), `Estado` (Active, Inactive)
            </>
          ) : type === 'material' ? (
            <>
              `Código` (opcional, se autogenera si está vacío, ej: MT001), `Nombre` (requerido), `Categoría` (requerido, ej: SECA, FRESCA, etc.), `Unidad` (requerido, ej: KG, LT, UND)
            </>
          ) : (
            <>
              `RIF` (RIF del proveedor, requerido, ej: J123456789), `Código` (Código del material, requerido, ej: MT001), `ESPECIFICACION` (opcional, ej: Presentación de 10kg)
            </>
          )}
        </p>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Carga Masiva de Datos</CardTitle>
          <CardDescription>Sube tus proveedores, materiales y sus relaciones desde archivos Excel.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="suppliers" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
              <TabsTrigger value="materials">Materiales</TabsTrigger>
              <TabsTrigger value="relations">Relaciones P-M</TabsTrigger>
            </TabsList>
            <TabsContent value="suppliers">
              {renderUploadSection('supplier')}
            </TabsContent>
            <TabsContent value="materials">
              {renderUploadSection('material')}
            </TabsContent>
            <TabsContent value="relations">
              {renderUploadSection('supplier_material_relation')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default BulkUpload;