import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTopMaterialsByQuantity, getTopSuppliersByOrderCount } from '@/integrations/supabase/data';
import { TopMaterial, TopSupplier } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, Truck } from 'lucide-react';

const DashboardStats = () => {
  const { data: topMaterials, isLoading: isLoadingMaterials } = useQuery<TopMaterial[]>({
    queryKey: ['topMaterials'],
    queryFn: () => getTopMaterialsByQuantity(5),
  });

  const { data: topSuppliers, isLoading: isLoadingSuppliers } = useQuery<TopSupplier[]>({
    queryKey: ['topSuppliers'],
    queryFn: () => getTopSuppliersByOrderCount(5),
  });

  const renderLoading = () => (
    <div className="flex justify-center items-center h-32">
      <Loader2 className="h-6 w-6 animate-spin text-procarni-primary" />
    </div>
  );

  const renderMaterialStats = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-procarni-primary flex items-center">
          <Package className="mr-2 h-4 w-4" /> Top 5 Materiales Comprados
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoadingMaterials ? renderLoading() : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Cantidad Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topMaterials && topMaterials.length > 0 ? (
                topMaterials.map((material, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{material.material_name}</TableCell>
                    <TableCell className="text-right">{material.total_quantity.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No hay datos de materiales.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const renderSupplierStats = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-procarni-primary flex items-center">
          <Truck className="mr-2 h-4 w-4" /> Top 5 Proveedores (Órdenes)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoadingSuppliers ? renderLoading() : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topSuppliers && topSuppliers.length > 0 ? (
                topSuppliers.map((supplier, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{supplier.supplier_name}</TableCell>
                    <TableCell className="text-right">{supplier.order_count}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No hay datos de proveedores.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {renderMaterialStats()}
      {renderSupplierStats()}
    </div>
  );
};

export default DashboardStats;