import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, FileText } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { getPurchaseOrderDetails } from '@/integrations/supabase/data';
import { showError } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import PurchaseOrderPDFViewer from '@/components/PurchaseOrderPDFViewer'; // New import
import { calculateTotals, numberToWords } from '@/utils/calculations';

interface PurchaseOrderItem {
  id: string;
  material_name: string;
  supplier_code?: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  is_exempt: boolean;
}

interface SupplierDetails {
  id: string;
  name: string;
  rif: string;
  email?: string;
  phone?: string;
  payment_terms: string;
}

interface CompanyDetails {
  id: string;
  name: string;
  rif: string;
}

interface PurchaseOrderDetailsData {
  id: string;
  sequence_number?: number;
  supplier_id: string;
  suppliers: SupplierDetails;
  company_id: string;
  companies: CompanyDetails;
  currency: 'USD' | 'VES';
  exchange_rate?: number | null;
  status: string;
  created_at: string;
  created_by?: string;
  user_id: string;
  purchase_order_items: PurchaseOrderItem[];
}

const formatSequenceNumber = (sequence?: number, dateString?: string): string => {
  if (!sequence) return 'N/A';
  
  const date = dateString ? new Date(dateString) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');
  
  return `OC-${year}-${month}-${seq}`;
};

const PurchaseOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: order, isLoading, error } = useQuery<PurchaseOrderDetailsData | null>({
    queryKey: ['purchaseOrderDetails', id],
    queryFn: async () => {
      if (!id) throw new Error('Purchase Order ID is missing.');
      const details = await getPurchaseOrderDetails(id);
      if (!details) throw new Error('Purchase Order not found.');
      return details as PurchaseOrderDetailsData;
    },
    enabled: !!id,
  });

  const itemsForCalculation = order?.purchase_order_items.map(item => ({
    quantity: item.quantity,
    unit_price: item.unit_price,
    tax_rate: item.tax_rate,
    is_exempt: item.is_exempt,
  })) || [];

  const totals = calculateTotals(itemsForCalculation);
  const amountInWords = order ? numberToWords(totals.total, order.currency) : '';

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Cargando detalles de la orden de compra...
      </div>
    );
  }

  if (error) {
    showError(error.message);
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        Error: {error.message}
        <Button asChild variant="link" className="mt-4">
          <Link to="/purchase-order-management">Volver a la gestión de órdenes</Link>
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Orden de compra no encontrada.
        <Button asChild variant="link" className="mt-4">
          <Link to="/purchase-order-management">Volver a la gestión de órdenes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Button asChild variant="outline">
          <Link to="/purchase-order-management">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la gestión de órdenes
          </Link>
        </Button>
        <div className="flex gap-2">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <FileText className="mr-2 h-4 w-4" /> Previsualizar PDF
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl h-[90vh]">
              <DialogHeader>
                <DialogTitle>Previsualización de Orden de Compra</DialogTitle>
              </DialogHeader>
              <PurchaseOrderPDFViewer
                orderId={order.id}
                onClose={() => setIsModalOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Button asChild className="bg-procarni-secondary hover:bg-green-700">
            <Link to={`/purchase-orders/edit/${order.id}`}>
              <Edit className="mr-2 h-4 w-4" /> Editar Orden
            </Link>
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Orden de Compra {formatSequenceNumber(order.sequence_number, order.created_at)}</CardTitle>
          <CardDescription>Detalles completos de la orden de compra.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
            <p><strong>Proveedor:</strong> {order.suppliers?.name || 'N/A'}</p>
            <p><strong>Empresa:</strong> {order.companies?.name || 'N/A'}</p>
            <p><strong>Moneda:</strong> {order.currency}</p>
            {order.exchange_rate && <p><strong>Tasa de Cambio:</strong> {order.exchange_rate.toFixed(2)}</p>}
            <p><strong>Estado:</strong> {order.status}</p>
            <p><strong>Fecha de Creación:</strong> {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString()}</p>
            <p><strong>Creado por:</strong> {order.created_by || 'N/A'}</p>
          </div>

          <h3 className="text-lg font-semibold mt-8 mb-4">Ítems de la Orden</h3>
          {order.purchase_order_items && order.purchase_order_items.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Cód. Prov.</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>P. Unitario ({order.currency})</TableHead>
                    <TableHead>Subtotal ({order.currency})</TableHead>
                    <TableHead>IVA ({order.currency})</TableHead>
                    <TableHead>Exento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.purchase_order_items.map((item) => {
                    const subtotal = item.quantity * item.unit_price;
                    const itemIva = item.is_exempt ? 0 : subtotal * item.tax_rate;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.material_name}</TableCell>
                        <TableCell>{item.supplier_code || 'N/A'}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell>{subtotal.toFixed(2)}</TableCell>
                        <TableCell>{itemIva.toFixed(2)}</TableCell>
                        <TableCell>{item.is_exempt ? 'Sí' : 'No'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">Esta orden no tiene ítems registrados.</p>
          )}

          <div className="mt-8 border-t pt-4">
            <div className="flex justify-end items-center mb-2">
              <span className="font-semibold mr-2">Base Imponible:</span>
              <span>{order.currency} {totals.baseImponible.toFixed(2)}</span>
            </div>
            <div className="flex justify-end items-center mb-2">
              <span className="font-semibold mr-2">Monto IVA:</span>
              <span>{order.currency} {totals.montoIVA.toFixed(2)}</span>
            </div>
            <div className="flex justify-end items-center text-xl font-bold">
              <span className="mr-2">TOTAL:</span>
              <span>{order.currency} {totals.total.toFixed(2)}</span>
            </div>
            <p className="text-sm italic mt-2 text-right">({amountInWords})</p>
          </div>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default PurchaseOrderDetails;