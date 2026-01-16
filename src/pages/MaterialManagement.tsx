import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, Edit, Trash2, Search, Filter } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { getAllMaterials, createMaterial, updateMaterial, deleteMaterial } from '@/integrations/supabase/data';
import { showError, showSuccess } from '@/utils/toast';
import MaterialForm from '@/components/MaterialForm';
import { useSession } from '@/components/SessionContextProvider';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Material {
  id: string;
  code: string;
  name: string;
  category?: string;
  unit?: string;
  user_id: string;
}

const MATERIAL_CATEGORIES = [
  'Materia Prima Fresca',
  'Materia Prima Seca',
  'Empaques',
  'Etiquetas',
  'Sin Tipo Asignado',
];

const MaterialManagement = () => {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: materials, isLoading, error } = useQuery<Material[]>({
    queryKey: ['materials'],
    queryFn: getAllMaterials,
  });

  const filteredMaterials = useMemo(() => {
    if (!materials) return [];
    let currentMaterials = materials;

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentMaterials = currentMaterials.filter(material =>
        material.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        material.code.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    if (selectedCategory !== 'all') {
      currentMaterials = currentMaterials.filter(material => material.category === selectedCategory);
    }

    return currentMaterials;
  }, [materials, searchTerm, selectedCategory]);

  const createMutation = useMutation({
    mutationFn: (newMaterial: Omit<Material, 'id' | 'created_at' | 'updated_at' | 'user_id'>) =>
      createMaterial({ ...newMaterial, user_id: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setIsFormOpen(false);
    },
    onError: (err) => {
      showError(`Error al crear material: ${err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<Material, 'id' | 'created_at' | 'updated_at' | 'user_id'>> }) =>
      updateMaterial(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setIsFormOpen(false);
      setEditingMaterial(null);
    },
    onError: (err) => {
      showError(`Error al actualizar material: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onError: (err) => {
      showError(`Error al eliminar material: ${err.message}`);
    },
  });

  const handleAddMaterial = () => {
    setEditingMaterial(null);
    setIsFormOpen(true);
  };

  const handleEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setIsFormOpen(true);
  };

  const handleDeleteMaterial = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este material?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleSubmitForm = async (data: Omit<Material, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!userId) {
      showError('Usuario no autenticado. No se puede realizar la operación.');
      return;
    }
    if (editingMaterial) {
      await updateMutation.mutateAsync({ id: editingMaterial.id, updates: data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Cargando materiales...
      </div>
    );
  }

  if (error) {
    showError(error.message);
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        Error al cargar los materiales: {error.message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-procarni-primary">Gestión de Materiales</CardTitle>
            <CardDescription>Administra la información de tus materiales.</CardDescription>
          </div>
          <div className="flex gap-2">
            {/* Botón de Carga Masiva (placeholder por ahora) */}
            <Button variant="outline" onClick={() => showError('Funcionalidad de Carga Masiva en desarrollo.')}>
              Carga Masiva (Excel)
            </Button>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddMaterial} className="bg-procarni-secondary hover:bg-green-700">
                  <PlusCircle className="mr-2 h-4 w-4" /> Añadir Material
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]" description={editingMaterial ? 'Edita los detalles del material existente.' : 'Completa los campos para añadir un nuevo material.'}>
                <DialogHeader>
                  <DialogTitle>{editingMaterial ? 'Editar Material' : 'Añadir Nuevo Material'}</DialogTitle>
                </DialogHeader>
                <MaterialForm
                  initialData={editingMaterial || undefined}
                  onSubmit={handleSubmitForm}
                  onCancel={() => setIsFormOpen(false)}
                  isSubmitting={createMutation.isPending || updateMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar material por código o nombre..."
                className="w-full appearance-none bg-background pl-8 shadow-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative md:w-1/3">
              <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full pl-8">
                  <SelectValue placeholder="Filtrar por categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Categorías</SelectItem>
                  {MATERIAL_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredMaterials && filteredMaterials.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell>{material.code}</TableCell>
                      <TableCell>{material.name}</TableCell>
                      <TableCell>{material.category || 'N/A'}</TableCell>
                      <TableCell>{material.unit || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditMaterial(material)}
                          disabled={deleteMutation.isPending}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMaterial(material.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              No hay materiales registrados o no se encontraron resultados para tu búsqueda/filtro.
            </div>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default MaterialManagement;