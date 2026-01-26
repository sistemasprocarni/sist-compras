// src/pages/FichaTecnicaUpload.tsx

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, UploadCloud, Eye, Search } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';
import SmartSearch from '@/components/SmartSearch';
import { searchSuppliers, uploadFichaTecnica, getAllFichasTecnicas } from '@/integrations/supabase/data';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FichaTecnica } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface Supplier {
  id: string;
  name: string;
  rif: string;
}

const FichaTecnicaUpload = () => {
  const { session } = useSession();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [productName, setProductName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentFichaUrl, setCurrentFichaUrl] = useState('');

  const { data: fichas, isLoading: isLoadingFichas, refetch } = useQuery<FichaTecnica[]>({
    queryKey: ['fichasTecnicas'],
    queryFn: getAllFichasTecnicas,
    enabled: !!session,
  });

  const filteredFichas = useMemo(() => {
    if (!fichas) return [];
    if (!searchTerm) return fichas;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return fichas.filter(ficha =>
      ficha.nombre_producto.toLowerCase().includes(lowerCaseSearchTerm) ||
      (ficha.suppliers?.name && ficha.suppliers.name.toLowerCase().includes(lowerCaseSearchTerm))
    );
  }, [fichas, searchTerm]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type !== 'application/pdf') {
        showError('Solo se permiten archivos PDF.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedSupplier) {
      showError('Por favor, selecciona un proveedor.');
      return;
    }
    if (!productName.trim()) {
      showError('Por favor, ingresa el nombre del producto.');
      return;
    }
    if (!selectedFile) {
      showError('Por favor, selecciona un archivo PDF.');
      return;
    }

    setIsUploading(true);

    try {
      // Convert file to Base64
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // Extract Base64 string after the comma (removing data URL prefix)
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(selectedFile);
      });

      const payload = {
        nombre_producto: productName.trim(),
        proveedor_id: selectedSupplier.id,
        fileBase64: fileBase64,
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
      };

      const newFicha = await uploadFichaTecnica(payload);

      if (newFicha) {
        showSuccess('Ficha técnica subida y registrada exitosamente.');
        // Reset form
        setSelectedSupplier(null);
        setProductName('');
        setSelectedFile(null);
        // Clear file input manually
        const fileInput = document.getElementById('pdfFile') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        // Force refetch the list
        refetch();
      }
    } catch (error: any) {
      console.error('Error during upload:', error);
      showError(error.message || 'Error desconocido al subir la ficha técnica.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewFicha = (url: string) => {
    setCurrentFichaUrl(url);
    setIsViewerOpen(true);
  };

  const renderFichasTable = () => {
    if (isLoadingFichas) {
      return <div className="text-center text-muted-foreground p-8">Cargando fichas técnicas...</div>;
    }

    if (filteredFichas.length === 0) {
      return <div className="text-center text-muted-foreground p-8">No hay fichas técnicas registradas o no se encontraron resultados.</div>;
    }

    if (isMobile) {
      return (
        <div className="grid gap-4">
          {filteredFichas.map((ficha) => (
            <Card key={ficha.id} className="p-4">
              <CardTitle className="text-lg mb-1 truncate">{ficha.nombre_producto}</CardTitle>
              <CardDescription className="mb-2">Proveedor: {ficha.suppliers?.name || 'N/A'}</CardDescription>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => handleViewFicha(ficha.url_visualizacion)}>
                  <Eye className="mr-2 h-4 w-4" /> Ver PDF
                </Button>
              </div>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha Subida</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFichas.map((ficha) => (
              <TableRow key={ficha.id}>
                <TableCell className="font-medium">{ficha.nombre_producto}</TableCell>
                <TableCell>{ficha.suppliers?.name || 'N/A'}</TableCell>
                <TableCell>{new Date(ficha.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleViewFicha(ficha.url_visualizacion)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Subir Ficha Técnica (PDF)</CardTitle>
          <CardDescription>Asocia un documento PDF (ficha técnica) a un proveedor y producto.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="supplier">Proveedor *</Label>
              <SmartSearch
                placeholder="Buscar proveedor por RIF o nombre"
                onSelect={setSelectedSupplier}
                fetchFunction={searchSuppliers}
                displayValue={selectedSupplier?.name || ''}
                disabled={isUploading}
              />
              {selectedSupplier && <p className="text-sm text-muted-foreground mt-1">Proveedor seleccionado: {selectedSupplier.name}</p>}
            </div>
            <div>
              <Label htmlFor="productName">Nombre del Producto *</Label>
              <Input
                id="productName"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ej: Ficha Técnica Pollo Entero"
                disabled={isUploading}
              />
            </div>
          </div>

          <div className="grid gap-2 mb-6">
            <Label htmlFor="pdfFile">Archivo PDF *</Label>
            <Input
              id="pdfFile"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">Archivo seleccionado: {selectedFile.name}</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleUpload} disabled={isUploading || !selectedSupplier || !productName || !selectedFile} className="bg-procarni-secondary hover:bg-green-700">
              <UploadCloud className="mr-2 h-4 w-4" />
              {isUploading ? 'Subiendo...' : 'Subir Ficha Técnica'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fichas Técnicas Registradas</CardTitle>
          <CardDescription>Lista de documentos subidos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por producto o proveedor..."
              className="w-full appearance-none bg-background pl-8 shadow-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {renderFichasTable()}
        </CardContent>
      </Card>

      <MadeWithDyad />

      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="max-w-5xl h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Visualización de Ficha Técnica</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {currentFichaUrl ? (
              <iframe src={currentFichaUrl} className="w-full h-full border-none" title="PDF Viewer"></iframe>
            ) : (
              <div className="text-center text-destructive">No se pudo cargar el documento.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FichaTecnicaUpload;