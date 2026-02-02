import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Users, Zap, FilePlus, ClipboardPlus, BarChart2, Scale, DollarSign } from 'lucide-react'; // Import Scale and DollarSign
import { useQuery } from '@tanstack/react-query';
import { getAllPurchaseOrders, getAllSuppliers } from '@/integrations/supabase/data';
import { PurchaseOrder, Supplier } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';
import MaterialSearchQuickAccess from '@/components/MaterialSearchQuickAccess';
import { Separator } from '@/components/ui/separator';

const SearchManagement = () => {
  const navigate = useNavigate();

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
      color: 'text-procarni-alert',
    },
    {
      title: "Proveedores Totales",
      value: isLoadingSuppliers ? "Cargando..." : totalSuppliersCount,
      icon: Users,
      description: "Total de proveedores registrados.",
      color: 'text-procarni-secondary',
    },
  ];

  const quickLinks = [
    { label: 'Nueva Orden de Compra', icon: FilePlus, path: '/generate-po', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Nueva Solicitud de Cotización', icon: ClipboardPlus, path: '/generate-quote', color: 'bg-procarni-secondary hover:bg-green-700' },
    { label: 'Comparar Precios', icon: Scale, path: '/quote-comparison', color: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'Historial de Precios', icon: DollarSign, path: '/price-history', color: 'bg-yellow-600 hover:bg-yellow-700' },
  ];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-procarni-primary mb-6">Panel de Control</h1>

      {/* KPI Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 mb-8">
        {kpis.map((kpi, index) => (
          <Card key={index} className="shadow-lg border-l-4 border-procarni-primary hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold text-gray-900 dark:text-white">
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
      <Card className="mb-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-procarni-primary flex items-center">
            <Zap className="mr-2 h-5 w-5" /> Acciones Rápidas
          </CardTitle>
          <CardDescription>Accede directamente a las funciones clave del sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickLinks.map((link, index) => (
              <Button 
                key={index}
                onClick={() => navigate(link.path)}
                className={`flex flex-col h-24 items-center justify-center text-white shadow-md ${link.color}`}
              >
                <link.icon className="h-6 w-6 mb-1" />
                <span className="text-xs font-medium text-center">{link.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search Quick Access */}
      <MaterialSearchQuickAccess />
      
      <MadeWithDyad />
    </div>
  );
};

export default SearchManagement;