import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { UploadCloud, FileText } from 'lucide-react';
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
  const [relationFile, setRelationFile] = useState<File | null>(null); // Nuevo estado para el archivo de relaciones
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'supplier' | 'material' | 'supplier_material_relation') => {
    if (event.target.files && event.target.files[0]) {
      if (type === 'supplier') {
        setSupplierFile(event.target.files[0]);
      } else if (type === 'material') {
        setMaterialFile(event.target.files[0]);
      } else { // 'supplier_material_relation'
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
      showError(error.message || 'Error desconocido al realizar la carga masiva.');
    } finally {
      dismissToast(loadingToastId);
      setUploading(false);
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
        <Button variant="outline" size="sm" className="mt-2" onClick={() => showError('Descarga de plantilla en desarrollo.')}>
          Descargar Plantilla
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          **Columnas esperadas para {type === 'supplier' ? 'Proveedores' : (type === 'material' ? 'Materiales' : 'Relaciones Proveedor-Material')}:**
          <br />
          {type === 'supplier' ? (
            <>
              `RIF` (requerido, ej: J123456789), `Nombre` (requerido), `Email`, `Teléfono Principal`, `Teléfono Secundario`, `Instagram`, `Dirección`, `Términos de Pago` (Contado, Crédito, Otro), `Términos de Pago Personalizados` (si es 'Otro'), `Días de Crédito` (si es 'Crédito'), `Estado` (Active, Inactive)
            </>
          ) : type === 'material' ? (
            <>
              `Código` (opcional, se autogenera si está vacío), `Nombre` (requerido), `Categoría` (requerido, ej: SECA, FRESCA, etc.), `Unidad` (requerido, ej: KG, LT, UND)
            </>
          ) : (
            <>
              `RIF` (código del proveedor, requerido, ej: J123456789), `Código` (código del material, requerido, ej: MT001), `ESPECIFICACION` (opcional, ej: Presentación de 10kg)
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
            <TabsList className="grid w-full grid-cols-3"> {/* Cambiado a 3 columnas */}
              <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
              <TabsTrigger value="materials">Materiales</TabsTrigger>
              <TabsTrigger value="relations">Relaciones P-M</TabsTrigger> {/* Nueva pestaña */}
            </TabsList>
            <TabsContent value="suppliers">
              {renderUploadSection('supplier')}
            </TabsContent>
            <TabsContent value="materials">
              {renderUploadSection('material')}
            </TabsContent>
            <TabsContent value="relations"> {/* Nuevo contenido para la pestaña de relaciones */}
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