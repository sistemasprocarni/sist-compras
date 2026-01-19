import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';

interface UploadResult {
  successCount: number;
  failureCount: number;
  errors: Array<{ row: number; data: any; reason: string }>;
  message: string;
}

const BulkUpload = () => {
  const [uploadType, setUploadType] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { session } = useSession();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showError('Por favor, selecciona un archivo Excel.');
      return;
    }
    if (!uploadType) {
      showError('Por favor, selecciona un tipo de carga.');
      return;
    }

    setLoading(true);
    setUploadResult(null);
    const loadingToastId = showLoading('Subiendo archivo...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', uploadType);

      const response = await fetch(
        `https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/bulk-upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      const data: UploadResult = await response.json();

      if (!response.ok) {
        showError(data.message || 'Error al procesar la carga masiva.');
        setUploadResult(data);
        return;
      }

      showSuccess(data.message);
      setUploadResult(data);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSelectedFile(null);

    } catch (error: any) {
      console.error('Error during bulk upload:', error);
      showError(error.message || 'Ocurrió un error inesperado durante la carga.');
      setUploadResult({
        successCount: 0,
        failureCount: 0,
        errors: [],
        message: error.message || 'Error desconocido.',
      });
    } finally {
      dismissToast(loadingToastId);
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Carga Masiva</CardTitle>
          <CardDescription>Sube archivos Excel para gestionar proveedores, materiales o sus relaciones.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="upload-type">Tipo de Carga</Label>
            <Select onValueChange={setUploadType} value={uploadType} disabled={loading}>
              <SelectTrigger id="upload-type">
                <SelectValue placeholder="Selecciona el tipo de carga" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supplier">Proveedores</SelectItem>
                <SelectItem value="material">Materiales</SelectItem>
                <SelectItem value="supplier_material_relation">Relación Proveedor-Material</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="excel-file">Archivo Excel</Label>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              ref={fileInputRef}
              disabled={loading}
            />
            {selectedFile && <p className="text-sm text-muted-foreground">Archivo seleccionado: {selectedFile.name}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleUpload} disabled={loading || !selectedFile || !uploadType}>
            {loading ? 'Subiendo...' : 'Subir Archivo'}
          </Button>
        </CardFooter>
      </Card>

      {uploadResult && (
        <div className="mt-8 space-y-4">
          <Alert variant={uploadResult.failureCount > 0 ? "destructive" : "default"}>
            <Terminal className="h-4 w-4" />
            <AlertTitle>{uploadResult.failureCount > 0 ? "Carga con Errores" : "Carga Exitosa"}</AlertTitle>
            <AlertDescription>
              {uploadResult.message}
              <p className="mt-2">Registros exitosos: {uploadResult.successCount}</p>
              <p>Registros con errores: {uploadResult.failureCount}</p>
            </AlertDescription>
          </Alert>

          {uploadResult.errors.length > 0 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Detalles de Errores</CardTitle>
                <CardDescription>Los siguientes registros tuvieron problemas:</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto">
                  {uploadResult.errors.map((error, index) => (
                    <Alert key={index} variant="destructive" className="mb-2">
                      <AlertTitle>Fila {error.row}: {error.reason}</AlertTitle>
                      <AlertDescription>
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(error.data, null, 2)}
                        </pre>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default BulkUpload;