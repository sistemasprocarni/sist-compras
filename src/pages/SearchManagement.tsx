import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // Import Button
import { Clock, Users, Zap, FilePlus, ClipboardPlus, BarChart2 } from 'lucide-react'; // Import new icons
import { useQuery } from '@tanstack/react-query';
import { getAllPurchaseOrders, getAllSuppliers } from '@/integrations/supabase/data';
import { PurchaseOrder, Supplier } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

const SearchManagement = () => {
  const navigate = useNavigate(); // Initialize useNavigate hook

  // 1. Fetch Purchase Orders for Pending Count
  const { data: purchaseOrders, isLoading: isLoadingOrders } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchaseOrders', 'Active'],
    queryFn: () => getAllPurchaseOrders('Active'),
  });

  // Calculate Pending Orders (Draft or Sent)
  const pendingOrdersCount = purchaseOrders?.filter(
    (order) => order.status === 'Draft' || order.status === 'Sent'
  ).length || 0;

  // 2. Fetch Total Suppliers
  const { data: suppliers, isLoading: isLoadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: getAllSuppliers,
  });

  const totalSuppliersCount = suppliers?.length || 0;

  const kpis = [
    {
      title: "Órdenes Pendientes",
      value: isLoadingOrders ? "Cargando..." : pendingOrdersCount,
      icon: Clock,
      description: "Órdenes en estado Borrador o Enviado.",
    },
    {
      title: "Proveedores Totales",
      value: isLoadingSuppliers ? "Cargando..." : totalSuppliersCount,
      icon: Users,
      description: "Total de proveedores registrados.",
    },
  ];

  return (
    <div className="container mx-auto p-0">
      {/* KPI Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 mb-6">
        {kpis.map((kpi, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-procarni-primary">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpi.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpi.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions Section */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-procarni-primary flex items-center">
            <Zap className="mr-2 h-4 w-4" /> Acciones Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/generate-po')}
              className="flex items-center justify-center py-4 text-sm hover:bg-procarni-primary/10"
            >
              <FilePlus className="mr-2 h-4 w-4" /> + Nueva Orden de Compra
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/generate-quote')}
              className="flex items-center justify-center py-4 text-sm hover:bg-procarni-primary/10"
            >
              <ClipboardPlus className="mr-2 h-4 w-4" /> + Nueva Cotización
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/price-comparison')}
              className="flex items-center justify-center py-4 text-sm hover:bg-procarni-primary/10"
            >
              <BarChart2 className="mr-2 h-4 w-4" /> 🔍 Comparar Precios
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Original Content */}
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-4 min-h-[300px]">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">
            Búsqueda y Gestión
          </h3>
          <p className="text-sm text-muted-foreground">
            Aquí podrás buscar y gestionar proveedores, materiales y órdenes existentes.
          </p>
          {/* Futuro componente de búsqueda inteligente */}
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default SearchManagement;