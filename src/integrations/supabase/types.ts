export type PurchaseOrder = {
  id: string;
  status: 'Draft' | 'Sent' | 'Completed' | 'Cancelled';
  // ... other fields
};

export type Supplier = {
  id: string;
  name: string;
  // ... other fields
};

export type TopMaterial = {
  material_name: string;
  total_quantity: number;
};

export type TopSupplier = {
  supplier_id: string;
  supplier_name: string;
  order_count: number;
};