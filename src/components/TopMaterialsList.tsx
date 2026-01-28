"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTopMaterials } from '@/integrations/supabase/data';
import { TopMaterial } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package } from 'lucide-react';

const TopMaterialsList = () => {
  const { data: topMaterials, isLoading, error } = useQuery<TopMaterial[]>({
    queryKey: ['topMaterials'],
    queryFn: () => getTopMaterials(5),
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center text-procarni-primary">
            <Package className="mr-2 h-5 w-5" /> Top Materiales
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-procarni-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center text-procarni-primary">
            <Package className="mr-2 h-5 w-5" /> Top Materiales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">Error al cargar los datos de materiales.</p>
        </CardContent>
      </Card>
    );
  }

  const formatQuantity = (quantity: number) => {
    return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(quantity);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center text-procarni-primary">
          <Package className="mr-2 h-5 w-5" /> Top Materiales (Por Cantidad Comprada)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topMaterials && topMaterials.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Cantidad Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topMaterials.map((material, index) => (
                <TableRow key={material.material_name}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{material.material_name}</TableCell>
                  <TableCell className="text-right font-bold">{formatQuantity(material.total_quantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No hay suficientes datos de ítems de órdenes de compra para generar el ranking.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default TopMaterialsList;