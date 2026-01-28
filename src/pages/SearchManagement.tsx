import React from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // Import Button
import { Clock, Users, Zap, FilePlus, ClipboardPlus, BarChart2 } from 'lucide-react'; // Import new icons
import { useQuery } from '@tanstack/react-query';
import { getAllPurchaseOrders, getAllSuppliers, getApprovedOrdersForAnalytics } from '@/integrations/supabase/data';
import { PurchaseOrder, Supplier } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';

// Interfaces for data processing
interface AnalyticsItem {
  quantity: number;
  unit_price: number;
  tax_rate: number;
  is_exempt: boolean;
  material_id: string;
  materials: { category: string } | null;
}

interface AnalyticsOrder {
  id: string;
  supplier_id: string;
  suppliers: { name: string };
  currency: 'USD' | 'VES';
  exchange_rate: number | null;
  purchase_order_items: AnalyticsItem[];
}

interface DonutData {
  name: string;
  value: number;
  fill: string;
}

interface BarData {
  name: string;
  total: number;
}

const processAnalyticsData = (orders: AnalyticsOrder[]): { donutData: DonutData[], barData: BarData[] } => {
  const categoryTotals: Record<string, number> = {};
  const supplierTotals: Record<string, number> = {};

  orders.forEach(order => {
    const supplierName = order.suppliers.name;
    // Use the order's exchange rate, default to 1 if not provided or 0
    const rate = order.currency === 'VES' ? (order.exchange_rate || 1) : 1;

    order.purchase_order_items.forEach(item => {
      const subtotal = item.quantity * item.unit_price;
      const tax = item.is_exempt ? 0 : subtotal * (item.tax_rate || 0.16);
      const totalItemCost = subtotal + tax;

      // Convert to USD (base currency for comparison)
      const costInUSD = order.currency === 'VES' && rate > 0 ? totalItemCost / rate : totalItemCost;

      // 1. Category Totals
      const category = item.materials?.category || 'SIN CATEGORÍA';
      categoryTotals[category] = (categoryTotals[category] || 0) + costInUSD;

      // 2. Supplier Totals
      supplierTotals[supplierName] = (supplierTotals[supplierName] || 0) + costInUSD;
    });
  });

  // Define chart colors based on CSS variables defined in globals.css
  const chartConfigColors = {
    'SECA': 'var(--chart-seca)',
    'FRESCA': 'var(--chart-fresca)',
    'EMPAQUE': 'var(--chart-empaque)',
    'FERRETERIA Y CONSTRUCCION': 'var(--chart-ferreteria-y-construccion)',
    'AGROPECUARIA': 'var(--chart-agropecuaria)',
    'SIN CATEGORÍA': 'var(--chart-sin-categoria)',
  };

  // Format Category Data for Donut Chart
  const donutData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value: parseFloat(value.toFixed(2)),
    fill: chartConfigColors[name as keyof typeof chartConfigColors] || 'var(--chart-sin-categoria)',
  }));

  // Format Supplier Data for Bar Chart (Top 5)
  const barData = Object.entries(supplierTotals)
    .map(([name, value]) => ({
      name,
      total: parseFloat(value.toFixed(2)),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return { donutData, barData };
};

const SearchManagement = () => {
  const navigate = useNavigate();

  // 1. Fetch Purchase Orders for Pending Count
  const { data: purchaseOrders, isLoading: isLoadingOrders } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchaseOrders', 'Active'],
    queryFn: () => getAllPurchaseOrders('Active'),
  });

  // 2. Fetch Total Suppliers
  const { data: suppliers, isLoading: isLoadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: getAllSuppliers,
  });

  // 3. Fetch Approved Orders for Analytics
  const { data: analyticsOrders, isLoading: isLoadingAnalytics } = useQuery<AnalyticsOrder[]>({
    queryKey: ['approvedOrdersAnalytics'],
    queryFn: getApprovedOrdersForAnalytics,
  });

  const { donutData, barData } = React.useMemo(() => {
    if (!analyticsOrders) return { donutData: [], barData: [] };
    return processAnalyticsData(analyticsOrders as AnalyticsOrder[]);
  }, [analyticsOrders]);

  // Calculate Pending Orders (Draft or Sent)
  const pendingOrdersCount = purchaseOrders?.filter(
    (order) => order.status === 'Draft' || order.status === 'Sent'
  ).length || 0;

  // Calculate Total Suppliers
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
  
  // Chart configuration for tooltips and colors
  const chartConfig = {
    total: {
      label: "Gasto Total (USD)",
      color: "hsl(var(--procarni-primary))",
    },
    // Define colors for categories (Donut Chart)
    'SECA': { label: "Seca", color: "hsl(var(--chart-seca))" },
    'FRESCA': { label: "Fresca", color: "hsl(var(--chart-fresca))" },
    'EMPAQUE': { label: "Empaque", color: "hsl(var(--chart-empaque))" },
    'FERRETERIA Y CONSTRUCCION': { label: "Ferretería", color: "hsl(var(--chart-ferreteria-y-construccion))" },
    'AGROPECUARIA': { label: "Agropecuaria", color: "hsl(var(--chart-agropecuaria))" },
    'SIN CATEGORÍA': { label: "Sin Categoría", color: "hsl(var(--chart-sin-categoria))" },
  } as const;

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

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
              <BarChart2 className="mr-2 h-4 w-4" /> Comparar Precios
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* 1. Donut Chart: Gasto por Categoría de Material */}
        <Card>
          <CardHeader>
            <CardTitle>Gasto por Categoría de Material (USD)</CardTitle>
            <CardDescription>Distribución del gasto total en órdenes aprobadas.</CardDescription>
          </CardHeader>
          <CardContent className="aspect-square p-0">
            {isLoadingAnalytics ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">Cargando datos...</div>
            ) : donutData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">No hay datos de gasto disponibles.</div>
            ) : (
              <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="name" formatter={(value) => formatCurrency(value as number)} />} />
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      strokeWidth={2}
                      paddingAngle={5}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 2. Bar Chart: Top 5 Proveedores */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Proveedores por Gasto (USD)</CardTitle>
            <CardDescription>Proveedores con mayor monto total en órdenes aprobadas.</CardDescription>
          </CardHeader>
          <CardContent className="aspect-square p-0">
            {isLoadingAnalytics ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">Cargando datos...</div>
            ) : barData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">No hay datos de proveedores disponibles.</div>
            ) : (
              <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" dataKey="total" tickFormatter={formatCurrency} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100} 
                      tickLine={false} 
                      axisLine={false} 
                      style={{ fontSize: '10px' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => `Gasto Total: ${formatCurrency(value as number)}`} />} />
                    <Bar dataKey="total" fill="var(--procarni-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

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