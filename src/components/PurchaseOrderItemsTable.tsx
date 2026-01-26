import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Trash2 } from 'lucide-react';
import SmartSearch from '@/components/SmartSearch';
import { searchMaterialsBySupplier } from '@/integrations/supabase/data';
import AddMaterialToSupplierDialog from '@/components/AddMaterialToSupplierDialog';

interface PurchaseOrderItemForm {
  id?: string;
  material_name: string;
  supplier_code?: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  is_exempt?: boolean;
  unit?: string;
}

interface MaterialSearchResult {
  id: string;
  name: string;
  code: string;
  category?: string;
  unit?: string;
  is_exempt?: boolean;
}

const MATERIAL_UNITS = [
  'KG', 'LT', 'ROL', 'PAQ', 'SACO', 'GAL', 'UND', 'MT', 'RESMA', 'PZA', 'TAMB', 'MILL', 'CAJA'
];

interface PurchaseOrderItemsTableProps {
  items: PurchaseOrderItemForm[];
  supplierId: string;
  supplierName: string;
  currency: 'USD' | 'VES';
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onItemChange: (index: number, field: keyof PurchaseOrderItemForm, value: any) => void;
  onMaterialSelect: (index: number, material: MaterialSearchResult) => void;
}

const PurchaseOrderItemsTable: React.FC<PurchaseOrderItemsTableProps> = ({
  items,
  supplierId,
  supplierName,
  currency,
  onAddItem,
  onRemoveItem,
  onItemChange,
  onMaterialSelect,
}) => {
  const [isAddMaterialDialogOpen, setIsAddMaterialDialogOpen] = useState(false);

  const searchSupplierMaterials = async (query: string) => {
    if (!supplierId) return [];
    return searchMaterialsBySupplier(supplierId, query);
  };

  const handleMaterialAdded = (material: { id: string; name: string; unit?: string; is_exempt?: boolean }) => {
    // Optionally, you could automatically select the newly added material
    // For now, we'll just close the dialog and let the user select it from the search
  };

  return (
    <>
      <h3 className="text-lg font-semibold mb-4">Ítems de la Orden</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[20%]">Producto</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Código Prov.</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Cantidad</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Unidad</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Precio Unit.</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Monto</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">IVA</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Exento</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Acción</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => {
              const subtotal = item.quantity * item.unit_price;
              const itemIva = item.is_exempt ? 0 : subtotal * (item.tax_rate || 0.16);

              return (
                <tr key={index}>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <SmartSearch
                      placeholder={supplierId ? "Buscar material asociado" : "Selecciona proveedor"}
                      onSelect={(material) => onMaterialSelect(index, material as MaterialSearchResult)}
                      fetchFunction={searchSupplierMaterials}
                      displayValue={item.material_name}
                      disabled={!supplierId}
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <Input
                      type="text"
                      value={item.supplier_code || ''}
                      onChange={(e) => onItemChange(index, 'supplier_code', e.target.value)}
                      placeholder="Código Prov."
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => onItemChange(index, 'quantity', parseFloat(e.target.value))}
                      min="0"
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <Select value={item.unit} onValueChange={(value) => onItemChange(index, 'unit', value)}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIAL_UNITS.map(unitOption => (
                          <SelectItem key={unitOption} value={unitOption}>{unitOption}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => onItemChange(index, 'unit_price', parseFloat(e.target.value))}
                      min="0"
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-right text-sm font-medium">
                    {currency} {subtotal.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-center text-sm">
                    {currency} {itemIva.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-center">
                    <Switch
                      checked={item.is_exempt}
                      onCheckedChange={(checked) => onItemChange(index, 'is_exempt', checked)}
                      disabled={!item.material_name}
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-right">
                    <Button variant="destructive" size="icon" onClick={() => onRemoveItem(index)} className="h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between mt-4">
        <Button variant="outline" onClick={onAddItem} className="w-full mr-2">
          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Ítem
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsAddMaterialDialogOpen(true)}
          disabled={!supplierId}
          className="w-full ml-2 bg-procarni-secondary text-white hover:bg-green-700"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Material
        </Button>
      </div>
      <AddMaterialToSupplierDialog
        isOpen={isAddMaterialDialogOpen}
        onClose={() => setIsAddMaterialDialogOpen(false)}
        onMaterialAdded={handleMaterialAdded}
        supplierId={supplierId}
        supplierName={supplierName}
      />
    </>
  );
};

export default PurchaseOrderItemsTable;