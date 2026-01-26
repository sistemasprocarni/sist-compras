import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { showError, showSuccess } from '@/utils/toast';
import { createMaterial, createSupplierMaterialRelation } from '@/integrations/supabase/data';
import { useSession } from '@/components/SessionContextProvider';

interface AddMaterialToSupplierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMaterialAdded: (material: { id: string; name: string; unit?: string; is_exempt?: boolean }) => void;
  supplierId: string;
  supplierName: string;
}

const MATERIAL_CATEGORIES = [
  'SECA', 'FRESCA', 'EMPAQUE', 'FERRETERIA Y CONSTRUCCION', 'AGROPECUARIA',
  'GASES Y COMBUSTIBLE', 'ELECTRICIDAD', 'REFRIGERACION', 'INSUMOS DE OFICINA',
  'INSUMOS INDUSTRIALES', 'MECANICA Y SELLOS', 'NEUMATICA', 'INSUMOS DE LIMPIEZA',
  'FUMICACION', 'EQUIPOS DE CARNICERIA', 'FARMACIA', 'MEDICION Y MANIPULACION',
  'ENCERADOS', 'PUBLICIDAD',
];

const MATERIAL_UNITS = [
  'KG', 'LT', 'ROL', 'PAQ', 'SACO', 'GAL', 'UND', 'MT', 'RESMA', 'PZA', 'TAMB', 'MILL', 'CAJA'
];

const AddMaterialToSupplierDialog: React.FC<AddMaterialToSupplierDialogProps> = ({
  isOpen,
  onClose,
  onMaterialAdded,
  supplierId,
  supplierName,
}) => {
  const { session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [materialName, setMaterialName] = useState('');
  const [category, setCategory] = useState(MATERIAL_CATEGORIES[0]);
  const [unit, setUnit] = useState(MATERIAL_UNITS[0]);
  const [isExempt, setIsExempt] = useState(false);
  const [specification, setSpecification] = useState('');

  const handleAddMaterial = async () => {
    if (!session?.user?.id) {
      showError('No hay sesión activa.');
      return;
    }

    if (!materialName.trim()) {
      showError('El nombre del material es requerido.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create the new material
      const newMaterial = await createMaterial({
        name: materialName.trim(),
        category,
        unit,
        is_exempt: isExempt,
        user_id: session.user.id,
      });

      if (!newMaterial) {
        throw new Error('No se pudo crear el material.');
      }

      // 2. Associate the material with the supplier
      const relationCreated = await createSupplierMaterialRelation({
        supplier_id: supplierId,
        material_id: newMaterial.id,
        specification: specification.trim() || undefined,
        user_id: session.user.id,
      });

      if (!relationCreated) {
        throw new Error('No se pudo asociar el material con el proveedor.');
      }

      showSuccess('Material creado y asociado con el proveedor exitosamente.');
      
      // Call the callback with the new material data
      onMaterialAdded({
        id: newMaterial.id,
        name: newMaterial.name,
        unit: newMaterial.unit,
        is_exempt: newMaterial.is_exempt,
      });

      // Reset form and close
      setMaterialName('');
      setCategory(MATERIAL_CATEGORIES[0]);
      setUnit(MATERIAL_UNITS[0]);
      setIsExempt(false);
      setSpecification('');
      onClose();

    } catch (error: any) {
      console.error('[AddMaterialToSupplierDialog] Error:', error);
      showError(error.message || 'Error al crear el material.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Material</DialogTitle>
          <DialogDescription>
            Crea un nuevo material y asígnalo a <strong>{supplierName}</strong>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="materialName">Nombre del Material *</Label>
            <Input
              id="materialName"
              placeholder="Ej: Pollo entero, Carne molida..."
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">Categoría</Label>
              <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unit">Unidad</Label>
              <Select value={unit} onValueChange={setUnit} disabled={isSubmitting}>
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Selecciona unidad" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_UNITS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Exento de IVA</Label>
              <p className="text-sm text-muted-foreground">
                Marcar si este material no debe incluir IVA.
              </p>
            </div>
            <Switch
              checked={isExempt}
              onCheckedChange={setIsExempt}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="specification">Especificación (Opcional)</Label>
            <Input
              id="specification"
              placeholder="Ej: Presentación de 10kg, Marca X..."
              value={specification}
              onChange={(e) => setSpecification(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleAddMaterial} disabled={isSubmitting} className="bg-procarni-secondary hover:bg-green-700">
            {isSubmitting ? 'Guardando...' : 'Crear y Asociar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMaterialToSupplierDialog;