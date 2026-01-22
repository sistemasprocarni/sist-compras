import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PlusCircle, Edit, Trash2, Search, Eye, ArrowLeft } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { getAllQuoteRequests, deleteQuoteRequest } from '@/integrations/supabase/data';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface QuoteRequest {
  id: string;
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

const QuoteRequestManagement = () => {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [requestToDeleteId, setRequestToDeleteId] = useState<string | null>(null);

  const { data: quoteRequests, isLoading, error } = useQuery<QuoteRequest[]>({
    queryKey: ['quoteRequests'],
    queryFn: getAllQuoteRequests,
    enabled: !!session,
  });

  const filteredQuoteRequests = useMemo(() => {
    if (!quoteRequests) return [];
    if (!searchTerm) return quoteRequests;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return quoteRequests.filter(request =>
      request.suppliers.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      request.companies.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      request.currency.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [quoteRequests, searchTerm]);

  const deleteMutation = useMutation({
    mutationFn: deleteQuoteRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteRequests'] });
      showSuccess('Solicitud de cotización eliminada exitosamente.');
      setIsDeleteDialogOpen(false);
      setRequestToDeleteId(null);
    },
    onError: (err) => {
      showError(`Error al eliminar solicitud: ${err.message}`);
      setIsDeleteDialogOpen(false);
      setRequestToDeleteId(null);
    },
  });

  const confirmDeleteRequest = (id: string) => {
    setRequestToDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteRequest = async () => {
    if (requestToDeleteId) {
      await deleteMutation.mutateAsync(requestToDeleteId);
    }
  };

  const handleViewDetails = (requestId: string) => {
    navigate(`/quote-requests/${requestId}`);
  };

  const handleEditRequest = (requestId: string) => {
    navigate(`/quote-requests/edit/${requestId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Cargando solicitudes de cotización...
      </div>
    );
  }

  if (error) {
    showError(error.message);
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        Error al cargar las solicitudes de cotización: {error.message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-procarni-primary">Gestión de Solicitudes de Cotización</CardTitle>
            <CardDescription>Administra tus solicitudes de cotización enviadas a proveedores.</CardDescription>
          </div>
          <Button asChild className="bg-procarni-secondary hover:bg-green-700">
            <Link to="/generate-quote">
              <PlusCircle className="mr-2 h-4 w-4" /> Nueva Solicitud
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por proveedor, empresa, estado o moneda..."
              className="w-full appearance-none bg-background pl-8 shadow-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredQuoteRequests.length > 0 ? (
            isMobile ? (
              <div className="grid gap-4">
                {filteredQuoteRequests.map((request) => (
                  <Card key={request.id} className="p-4">
                    <CardTitle className="text-lg mb-2">{request.suppliers.name}</CardTitle>
                    <CardDescription className="mb-2">Empresa: {request.companies.name}</CardDescription>
                    <div className="text-sm space-y-1">
                      <p><strong>Moneda:</strong> {request.currency}</p>
                      {request.exchange_rate && <p><strong>Tasa de Cambio:</strong> {request.exchange_rate.toFixed(2)}</p>}
                      <p><strong>Fecha:</strong> {new Date(request.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="ghost" size="icon" onClick={() => handleViewDetails(request.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEditRequest(request.id)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => confirmDeleteRequest(request.id)}>
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
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead>Tasa de Cambio</TableHead>
                      <TableHead>Fecha Creación</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuoteRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>{request.suppliers.name}</TableCell>
                        <TableCell>{request.companies.name}</TableCell>
                        <TableCell>{request.currency}</TableCell>
                        <TableCell>{request.exchange_rate ? request.exchange_rate.toFixed(2) : 'N/A'}</TableCell>
                        <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleViewDetails(request.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEditRequest(request.id)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => confirmDeleteRequest(request.id)}>
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
              No hay solicitudes de cotización registradas o no se encontraron resultados para tu búsqueda.
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
              Esta acción no se puede deshacer. Esto eliminará permanentemente la solicitud de cotización y todos sus ítems asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteRequest} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QuoteRequestManagement;