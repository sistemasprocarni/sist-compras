import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PlusCircle, Trash2, Search, Eye, Edit } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { getAllPurchaseOrders, deletePurchaseOrder } from '@/integrations/supabase/data';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface PurchaseOrder {
  id: string;
  sequence_number?: number;
  supplier_id: string;
  suppliers: { name: string };
  company_id: string;
  companies: { name: string };
  currency: string;
  exchange_rate?: number | null;
  status: string;
  created_at: string;
  created_by?: string;
  user_id: string;
}

const formatSequenceNumber = (sequence?: number, dateString?: string): string => {
  if (!sequence) return 'N/A';
  
  const date = dateString ? new Date(dateString) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');
  
  return `OC-${year}-${month}-${seq}`;
};

const PurchaseOrderManagement = () => {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDeleteId, setOrderToDeleteId] = useState<string | null>(null);

  const { data: purchaseOrders, isLoading, error } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchaseOrders'],
    queryFn: getAllPurchaseOrders,
    enabled: !!session,
  });

  const filteredPurchaseOrders = useMemo(() => {
    if (!purchaseOrders) return [];
    if (!searchTerm) return purchaseOrders;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return purchaseOrders.filter(order =>
      formatSequenceNumber(order.sequence_number, order.created_at).toLowerCase().includes(lowerCaseSearchTerm) ||
      order.suppliers.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      order.companies.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      order.currency.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [purchaseOrders, searchTerm]);

  const deleteMutation = useMutation({
    mutationFn: deletePurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      showSuccess('Orden de compra eliminada exitosamente.');
      setIsDeleteDialogOpen(false);
      setOrderToDeleteId(null);
    },
    onError: (err) => {
      showError(`Error al eliminar orden: ${err.message}`);
      setIsDeleteDialogOpen(false);
      setOrderToDeleteId(null);
    },
  });

  const confirmDeleteOrder = (id: string) => {
    setOrderToDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteOrder = async () => {
    if (orderToDeleteId) {
      await deleteMutation.mutateAsync(orderToDeleteId);
    }
  };

  const handleViewDetails = (orderId: string) => {
    // We need a details page for Purchase Orders, let's assume the route is /purchase-orders/:id
    navigate(`/purchase-orders/${orderId}`);
  };

  const handleEditOrder = (orderId: string) => {
    // We need an edit page for Purchase Orders, let's assume the route is /purchase-orders/edit/:id
    navigate(`/purchase-orders/edit/${orderId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Cargando órdenes de compra...
      </div>
    );
  }

  if (error) {
    showError(error.message);
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        Error al cargar las órdenes de compra: {error.message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-procarni-primary">Gestión de Órdenes de Compra</CardTitle>
            <CardDescription>Administra tus órdenes de compra generadas.</CardDescription>
          </div>
          <Button asChild className="bg-procarni-secondary hover:bg-green-700">
            <Link to="/generate-po">
              <PlusCircle className="mr-2 h-4 w-4" /> Nueva Orden
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por N°, proveedor, empresa o moneda..."
              className="w-full appearance-none bg-background pl-8 shadow-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredPurchaseOrders.length > 0 ? (
            isMobile ? (
              <div className="grid gap-4">
                {filteredPurchaseOrders.map((order) => (
                  <Card key={order.id} className="p-4">
                    <CardTitle className="text-lg mb-2">{formatSequenceNumber(order.sequence_number, order.created_at)}</CardTitle>
                    <CardDescription className="mb-2">Proveedor: {order.suppliers.name}</CardDescription>
                    <div className="text-sm space-y-1">
                      <p><strong>Empresa:</strong> {order.companies.name}</p>
                      <p><strong>Moneda:</strong> {order.currency}</p>
                      <p><strong>Estado:</strong> {order.status}</p>
                      <p><strong>Fecha:</strong> {new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="ghost" size="icon" onClick={() => handleViewDetails(order.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEditOrder(order.id)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => confirmDeleteOrder(order.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Orden</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha Creación</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPurchaseOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{formatSequenceNumber(order.sequence_number, order.created_at)}</TableCell>
                        <TableCell>{order.suppliers.name}</TableCell>
                        <TableCell>{order.companies.name}</TableCell>
                        <TableCell>{order.currency}</TableCell>
                        <TableCell>{order.status}</TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleViewDetails(order.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEditOrder(order.id)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => confirmDeleteOrder(order.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <div className="text-center text-muted-foreground p-8">
              No hay órdenes de compra registradas o no se encontraron resultados para tu búsqueda.
            </div>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />

      {/* AlertDialog for delete confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la orden de compra y todos sus ítems asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PurchaseOrderManagement;