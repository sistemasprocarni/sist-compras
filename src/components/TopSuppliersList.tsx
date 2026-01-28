"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTopSuppliers } from '@/integrations/supabase/data';
import { TopSupplier } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp } from 'lucide-react';

const TopSuppliersList = () => {
  const { data: topSuppliers, isLoading, error } = useQuery<TopSupplier[]>({
    queryKey: ['topSuppliers'],
    queryFn: () => getTopSuppliers(5),
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center text-procarni-primary">
            <TrendingUp className="mr-2 h-5 w-5" /> Top Proveedores
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
            <TrendingUp className="mr-2 h-5 w-5" /> Top Proveedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">Error al cargar los datos de proveedores.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center text-procarni-primary">
          <TrendingUp className="mr-2 h-5 w-5" /> Top Proveedores (Por Órdenes)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topSuppliers && topSuppliers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topSuppliers.map((supplier, index) => (
                <TableRow key={supplier.supplier_id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{supplier.supplier_name}</TableCell>
                  <TableCell className="text-right font-bold">{supplier.order_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No hay suficientes datos de órdenes de compra para generar el ranking.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default TopSuppliersList;