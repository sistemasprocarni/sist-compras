import React, { useMemo } from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Users, Zap, FilePlus, ClipboardPlus, BarChart2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAllPurchaseOrders, getAllSuppliers } from '@/integrations/supabase/data';
import { PurchaseOrder, Supplier } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartLegend } from '@/components/ui/chart';

// Define CHART_COLORS for the PieChart using the corporate palette and standard colors
const CHART_COLORS = [
  '#880a0a', // procarni-primary
  '#0e5708', // procarni-secondary
  '#F39C12', // procarni-alert
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#ec4899', // pink-500
  '#a855f7', // purple-500
  '#ef4444', // red-500
];

const SearchManagement = () => {
  const navigate = useNavigate();

  // 1. Fetch Purchase Orders (for KPI and Supplier Analysis)
  const { data: purchaseOrders, isLoading: isLoadingOrders } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchaseOrders', 'Active'],
    queryFn: () => getAllPurchaseOrders('Active'),
  });

  // 2. Fetch Total Suppliers (for KPI)
  const { data: suppliers, isLoading: isLoadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: getAllSuppliers,
  });

  // 3. Fetch Purchase Order Items (for Material Analysis)
  const { data: orderItems, isLoading: isLoadingItems } = useQuery<Array<{ material_name: string; order_id: string }>>({
    queryKey: ['purchaseOrderItems'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_order_items').select('material_name, order_id');
      if (error) {
        console.error("Error fetching order items:", error);
        return [];
      }
      return data;
    },
  });

  // Calculate KPIs
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

  // Data processing for Analysis Section
  const analysisData = useMemo(() => {
    if (!purchaseOrders || !orderItems) {
      return { topSuppliers: [], topMaterials: [] };
    }

    // --- 1. Top 5 Suppliers (Count orders by supplier name) ---
    const supplierOrderCounts: Record<string, number> = {};
    purchaseOrders.forEach(order => {
      const supplierName = order.suppliers?.name;
      if (supplierName) {
        supplierOrderCounts[supplierName] = (supplierOrderCounts[supplierName] || 0) + 1;
      }
    });

    const topSuppliers = Object.entries(supplierOrderCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // --- 2. Top 10 Materials (Count frequency by material_name) ---
    const materialCounts: Record<string, number> = {};
    orderItems.forEach(item => {
      const materialName = item.material_name;
      if (materialName) {
        materialCounts[materialName] = (materialCounts[materialName] || 0) + 1;
      }
    });

    const topMaterials = Object.entries(materialCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item, index) => ({
        ...item,
        id: index,
        name: item.name,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      }));

    return { topSuppliers, topMaterials };
  }, [purchaseOrders, orderItems]);

  const { topSuppliers, topMaterials } = analysisData;
  const isLoadingAnalysis = isLoadingOrders || isLoadingSuppliers || isLoadingItems;

  // Configuration for ChartContainer (required by shadcn chart wrapper)
  const chartConfig = topMaterials.reduce((acc, item, index) => {
    // Use a safe key for the config object
    const safeKey = item.name.replace(/[^a-zA-Z0-9]/g, '_');
    acc[safeKey] = {
      label: item.name,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  // Map data for recharts, ensuring keys match chartConfig
  const chartData = topMaterials.map(item => ({
    ...item,
    name: item.name.replace(/[^a-zA-Z0-9]/g, '_'), // Use safe key for data name
  }));


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

      {/* Analysis Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Análisis de Compras</CardTitle>
          <CardDescription>Estadísticas clave basadas en órdenes de compra registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAnalysis ? (
            <div className="text-center text-muted-foreground p-8">Cargando datos de análisis...</div>
          ) : topSuppliers.length === 0 && topMaterials.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">No hay actividad registrada.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Columna Izquierda: Top Proveedores */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top 5 Proveedores por Órdenes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {topSuppliers.map((supplier, index) => (
                    <React.Fragment key={supplier.name}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium truncate">{supplier.name}</span>
                        <Badge variant="secondary" className="bg-procarni-secondary text-white hover:bg-procarni-secondary">
                          {supplier.count} órdenes
                        </Badge>
                      </div>
                      {index < topSuppliers.length - 1 && <Separator />}
                    </React.Fragment>
                  ))}
                </CardContent>
              </Card>

              {/* Columna Derecha: Top Materiales (Gráfico) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top 10 Materiales más Solicitados</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <ChartContainer
                    config={chartConfig}
                    className="h-[300px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={({ payload }) => {
                          if (payload && payload.length) {
                            const item = payload[0].payload;
                            // Find the original name from the config using the safe key
                            const originalName = chartConfig[item.name]?.label || item.name;
                            return (
                              <div className="bg-white p-2 border rounded shadow-md text-sm">
                                <p className="font-bold">{originalName}</p>
                                <p>Frecuencia: {item.count}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Pie
                        data={chartData}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        labelLine={false}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartLegend
                        content={<Legend />}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{ paddingLeft: 20 }}
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
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
          {/* Futuro componente de búsqueda inteligente */}
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default SearchManagement;