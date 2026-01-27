import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Users, Zap, FilePlus, ClipboardPlus, BarChart2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAllPurchaseOrders, getAllSuppliers } from '@/integrations/supabase/data';
import { PurchaseOrder, Supplier, PurchaseOrderItem } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import ChartTooltipContent from '@/components/ChartTooltipContent';
import ChartLegendContent from '@/components/ChartLegendContent';
import { useSession } from '@/components/SessionContextProvider';

const CHART_COLORS = [
  '#880a0a', // procarni-primary
  '#0e5708', // procarni-secondary
  '#F39C12', // procarni-alert
  '#3498db',
  '#9b59b6',
  '#e74c3c',
  '#1abc9c',
  '#f1c40f',
  '#34495e',
  '#95a5a6',
];

const SearchManagement = () => {
  const navigate = useNavigate();
  const { session } = useSession();

  // 1. Fetch all active POs (for KPI and Top Suppliers)
  const { data: purchaseOrders, isLoading: isLoadingOrders } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchaseOrders', 'Active'],
    queryFn: () => getAllPurchaseOrders('Active'),
  });

  // 2. Fetch all PO Items (for Top Materials)
  const { data: poItems, isLoading: isLoadingItems } = useQuery<PurchaseOrderItem[]>({
    queryKey: ['purchaseOrderItems'],
    queryFn: async () => {
        const { data, error } = await supabase.from('purchase_order_items').select('material_name');
        if (error) {
            console.error('Error fetching purchase order items:', error);
            return [];
        }
        return data as PurchaseOrderItem[];
    },
    enabled: !!session,
  });

  // 3. Fetch Total Suppliers (for KPI)
  const { data: suppliers, isLoading: isLoadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: getAllSuppliers,
  });

  // 4. Processing Logic (useMemo)
  const analysisData = useMemo(() => {
    if (!purchaseOrders || !poItems) {
        return { topSuppliers: [], topMaterials: [] };
    }

    // --- Top 5 Suppliers (by order count) ---
    const supplierOrderCounts = new Map<string, { name: string, count: number }>();
    purchaseOrders.forEach(order => {
        const supplierName = order.suppliers?.name || 'Proveedor Desconocido';
        const current = supplierOrderCounts.get(supplierName) || { name: supplierName, count: 0 };
        current.count += 1;
        supplierOrderCounts.set(supplierName, current);
    });

    const topSuppliers = Array.from(supplierOrderCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // --- Top 10 Materials (by item frequency) ---
    const materialCounts = new Map<string, number>();
    poItems.forEach(item => {
        const materialName = item.material_name || 'Material Desconocido';
        materialCounts.set(materialName, (materialCounts.get(materialName) || 0) + 1);
    });

    const topMaterials = Array.from(materialCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return { topSuppliers, topMaterials };
  }, [purchaseOrders, poItems]);

  const { topSuppliers, topMaterials } = analysisData;
  const isLoadingAnalysis = isLoadingOrders || isLoadingItems;
  const hasData = topSuppliers.length > 0 || topMaterials.length > 0;

  // KPI Calculations
  const pendingOrdersCount = purchaseOrders?.filter(
    (order) => order.status === 'Draft' || order.status === 'Sent'
  ).length || 0;
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

  const chartConfig = {
    data: topMaterials,
    nameKey: "name",
    valueKey: "count",
    colors: CHART_COLORS,
  };

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

      {/* Purchase Analysis Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Análisis de Compras</CardTitle>
          <CardDescription>Estadísticas basadas en las órdenes de compra registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAnalysis ? (
            <div className="text-center text-muted-foreground p-8">Cargando análisis de compras...</div>
          ) : hasData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Columna Izquierda: Top Proveedores */}
              <Card className="p-4">
                <CardTitle className="text-lg mb-4">Top 5 Proveedores (por Órdenes)</CardTitle>
                <div className="space-y-4">
                  {topSuppliers.map((supplier, index) => (
                    <React.Fragment key={supplier.name}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium truncate">{supplier.name}</span>
                        <Badge variant="secondary" className="bg-procarni-secondary hover:bg-green-700 text-white">
                          {supplier.count} órdenes
                        </Badge>
                      </div>
                      {index < topSuppliers.length - 1 && <Separator />}
                    </React.Fragment>
                  ))}
                </div>
              </Card>

              {/* Columna Derecha: Top Materiales (Gráfico) */}
              <Card className="p-4">
                <CardTitle className="text-lg mb-4">Top 10 Materiales más Solicitados</CardTitle>
                <div className="h-[300px] w-full">
                  <ChartContainer config={chartConfig} className="mx-auto aspect-square h-full">
                    <PieChart>
                      <Tooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={topMaterials}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        labelLine={false}
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {topMaterials.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>
                </div>
              </Card>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-4 min-h-[300px]">
              <div className="flex flex-col items-center gap-1 text-center">
                <h3 className="text-xl font-bold tracking-tight">
                  No hay actividad registrada
                </h3>
                <p className="text-sm text-muted-foreground">
                  Genera órdenes de compra para ver el análisis de tus compras.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Original Content (kept for completeness, although the analysis section is more relevant) */}
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-4 min-h-[300px]">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">
            Búsqueda y Gestión
          </h3>
          <p className="text-sm text-muted-foreground">
            Aquí podrás buscar y gestionar proveedores, materiales y órdenes existentes.
          </p>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default SearchManagement;