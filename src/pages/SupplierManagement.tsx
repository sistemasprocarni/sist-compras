import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { getAllSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/integrations/supabase/data';
import { showError, showSuccess } from '@/utils/toast';
import SupplierForm from '@/components/SupplierForm';
import { useSession } from '@/components/SessionContextProvider';

interface Supplier {
  id: string;
  rif: string;
  name: string;
  email?: string;
  phone?: string;
  payment_terms: string;
  credit_days: number;
  status: string;
  user_id: string;
}

const SupplierManagement = () => {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const { data: suppliers, isLoading, error } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: getAllSuppliers,
  });

  const createMutation = useMutation({
    mutationFn: (newSupplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'user_id'>) =>
      createSupplier({ ...newSupplier, user_id: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsFormOpen(false);
    },
    onError: (err) => {
      showError(`Error al crear proveedor: ${err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'user_id'>> }) =>
      updateSupplier(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsFormOpen(false);
      setEditingSupplier(null);
    },
    onError: (err) => {
      showError(`Error al actualizar proveedor: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err) => {
      showError(`Error al eliminar proveedor: ${err.message}`);
    },
  });

  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setIsFormOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDeleteSupplier = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleSubmitForm = async (data: Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!userId) {
      showError('Usuario no autenticado. No se puede realizar la operación.');
      return;
    }
    if (editingSupplier) {
      await updateMutation.mutateAsync({ id: editingSupplier.id, updates: data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Cargando proveedores...
      </div>
    );
  }

  if (error) {
    showError(error.message);
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        Error al cargar los proveedores: {error.message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-procarni-primary">Gestión de Proveedores</CardTitle>
            <CardDescription>Administra la información de tus proveedores.</CardDescription>
          </div>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddSupplier} className="bg-procarni-secondary hover:bg-green-700">
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Proveedor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingSupplier ? 'Editar Proveedor' : 'Añadir Nuevo Proveedor'}</DialogTitle>
              </DialogHeader>
              <SupplierForm
                initialData={editingSupplier || undefined}
                onSubmit={handleSubmitForm}
                onCancel={() => setIsFormOpen(false)}
                isSubmitting={createMutation.isPending || updateMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {suppliers && suppliers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RIF</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Términos de Pago</TableHead>
                    <TableHead>Días de Crédito</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>{supplier.rif}</TableCell>
                      <TableCell>{supplier.name}</TableCell>
                      <TableCell>{supplier.email || 'N/A'}</TableCell>
                      <TableCell>{supplier.phone || 'N/A'}</TableCell>
                      <TableCell>{supplier.payment_terms}</TableCell>
                      <TableCell>{supplier.credit_days}</TableCell>
                      <TableCell>{supplier.status}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditSupplier(supplier)}
                          disabled={deleteMutation.isPending}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSupplier(supplier.id)}
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
              No hay proveedores registrados. ¡Añade uno para empezar!
            </div>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default SupplierManagement;